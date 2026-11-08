import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service.js';
import { auditoria, operativos } from '../../database/schema/index.js';
import type { AuthContext } from '../auth/auth.types.js';
import type { CreateOperativeDto } from './dto/create-operative.dto.js';
import type { ListOperativesQueryDto } from './dto/list-operatives-query.dto.js';

const projection = {
  id: operativos.id,
  name: operativos.nombre,
  startDate: operativos.fechaInicio,
  endDate: operativos.fechaFin,
  status: operativos.estado,
  createdAt: sql<string>`CONCAT(REPLACE(${operativos.creadoEn}, ' ', 'T'), 'Z')`,
  updatedAt: sql<string>`CONCAT(REPLACE(${operativos.actualizadoEn}, ' ', 'T'), 'Z')`,
};

function isDuplicateOperative(error: unknown): boolean {
  const driver = error instanceof Error && error.cause ? error.cause : error;
  if (typeof driver !== 'object' || driver === null) return false;
  return (
    'code' in driver &&
    driver.code === 'ER_DUP_ENTRY' &&
    'sqlMessage' in driver &&
    typeof driver.sqlMessage === 'string' &&
    /for key '(?:operativos\.)?operativos_nombre_fechas_unique'/.test(driver.sqlMessage)
  );
}

@Injectable()
export class OperativesService {
  constructor(private readonly database: DatabaseService) {}

  async create(input: CreateOperativeDto, context: AuthContext) {
    if (input.startDate > input.endDate) throw new BadRequestException('Invalid operative dates');
    try {
      return await this.database.db.transaction(async (tx) => {
        const [{ id }] = await tx
          .insert(operativos)
          .values({
            nombre: input.name,
            fechaInicio: input.startDate,
            fechaFin: input.endDate,
            estado: 'borrador',
          })
          .$returningId();
        await tx.insert(auditoria).values({
          usuarioId: context.user.id,
          sesionId: context.sessionId,
          accion: 'operatives.created',
          tipoEntidad: 'operativos',
          entidadId: id,
          valoresNuevos: {
            nombre: input.name,
            fechaInicio: input.startDate,
            fechaFin: input.endDate,
            estado: 'borrador',
          },
          canal: 'web',
        });
        const [created] = await tx.select(projection).from(operativos).where(eq(operativos.id, id));
        return created;
      });
    } catch (error) {
      if (isDuplicateOperative(error)) throw new ConflictException('Operative already exists');
      throw error;
    }
  }

  async list(query: ListOperativesQueryDto) {
    const offset = (query.page - 1) * query.limit;
    if (!Number.isSafeInteger(offset)) throw new BadRequestException('Invalid page');
    const where = and(
      // LOCATE treats user-supplied % and _ literally, unlike a LIKE pattern.
      query.name === undefined ? undefined : sql`LOCATE(${query.name}, ${operativos.nombre}) > 0`,
      query.status === undefined ? undefined : eq(operativos.estado, query.status),
    );
    // Keep the total and the page consistent under concurrent creation.
    return this.database.db.transaction(
      async (tx) => {
        const [{ total }] = await tx.select({ total: count() }).from(operativos).where(where);
        const items = await tx
          .select(projection)
          .from(operativos)
          .where(where)
          .orderBy(desc(operativos.fechaInicio), desc(operativos.id))
          .limit(query.limit)
          .offset(offset);
        return { items, page: query.page, limit: query.limit, total };
      },
      { isolationLevel: 'repeatable read', accessMode: 'read only' },
    );
  }

  async detail(id: string) {
    const [operative] = await this.database.db
      .select(projection)
      .from(operativos)
      .where(eq(operativos.id, id));
    if (!operative) throw new NotFoundException('Operative not found');
    return operative;
  }
}
