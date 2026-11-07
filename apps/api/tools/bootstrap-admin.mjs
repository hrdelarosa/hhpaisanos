import 'reflect-metadata';
import { emitKeypressEvents } from 'node:readline';
import { eq } from 'drizzle-orm';
import { loadDatabaseConfig } from '../dist/database/database.config.js';
import { DatabaseService } from '../dist/database/database.service.js';
import { auditoria, roles, usuarios } from '../dist/database/schema/index.js';
import { hashPassword } from '../dist/modules/auth/auth.service.js';
import { validateNewPassword } from '../dist/modules/auth/dto/change-password.dto.js';

function hiddenPassword(label) {
  if (!process.stdin.isTTY) throw new Error('Interactive terminal required');
  process.stdout.write(label);
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let password = '';
    const finish = () => {
      process.stdin.off('keypress', onKey);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
    };
    const onKey = (text, key) => {
      if (key?.ctrl && key.name === 'c') {
        finish();
        reject(new Error('Cancelled'));
      } else if (key?.name === 'return') {
        finish();
        resolve(password);
      } else if (key?.name === 'backspace') {
        password = Array.from(password).slice(0, -1).join('');
      } else if (text && !key?.ctrl && !key?.meta && Array.from(password).length < 129) {
        password += text;
      }
    };
    process.stdin.on('keypress', onKey);
  });
}

let service;
try {
  const username = process.argv[2];
  if (!username?.trim() || Array.from(username).length > 50 || process.argv.length !== 3) {
    throw new Error('Expected one username argument');
  }
  const config = loadDatabaseConfig();
  if (
    (process.env.NODE_ENV && process.env.NODE_ENV !== 'development') ||
    config.host !== 'localhost' ||
    config.database !== 'hhpaisanos' ||
    config.user !== 'hhpaisanos'
  ) {
    throw new Error(
      'Bootstrap is restricted to the documented disposable local development database',
    );
  }
  const password = await hiddenPassword('Temporary password (hidden): ');
  validateNewPassword(password);
  if (password !== (await hiddenPassword('Repeat password (hidden): ')))
    throw new Error('Passwords do not match');
  const passwordHash = await hashPassword(password);
  service = new DatabaseService(config);
  await service.onModuleInit();
  await service.db.transaction(async (tx) => {
    let [role] = await tx.select().from(roles).where(eq(roles.codigo, 'ADMIN')).for('update');
    if (!role) {
      const [{ id }] = await tx
        .insert(roles)
        .values({ codigo: 'ADMIN', nombre: 'Administrator', activo: true })
        .$returningId();
      role = { id, activo: true };
    }
    if (!role.activo) throw new Error('ADMIN role is inactive');
    const [existing] = await tx
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(eq(usuarios.rolId, role.id))
      .limit(1);
    if (existing)
      throw new Error('An administrator already exists; bootstrap will not reset credentials');
    const [{ id }] = await tx
      .insert(usuarios)
      .values({
        rolId: role.id,
        nombreUsuario: username,
        nombreCompleto: 'Local development administrator',
        passwordHash,
        activo: true,
        debeCambiarPassword: true,
        intentosFallidos: 0,
      })
      .$returningId();
    await tx.insert(auditoria).values({
      usuarioId: id,
      entidadId: id,
      tipoEntidad: 'usuarios',
      accion: 'auth.admin.bootstrapped',
      canal: 'manual',
    });
  });
  console.log(
    'Local administrator created with mandatory password change. No permissions were seeded.',
  );
} catch {
  // Database errors may embed credentials; do not print exceptions or SQL parameters.
  console.error(
    'Bootstrap failed. Check local configuration, password rules, schema and existing accounts. No credentials were printed.',
  );
  process.exitCode = 1;
} finally {
  try {
    await service?.onModuleDestroy();
  } catch {
    console.error('Database connection cleanup failed.');
    process.exitCode = 1;
  }
}
