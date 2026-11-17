import { useQuery } from '@tanstack/react-query';
import { createParser, parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs';
import { Link, useLocation } from 'react-router';
import { z } from 'zod';
import { DataTable, type DataTableColumn } from '../../../components/data-table';
import { PageHeader } from '../../../components/page-header';
import { PaginationPage } from '../../../components/pagination-page';
import { StatusBadge } from '../../../components/status-badge';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { listUsers, usersKey } from '../api/users';
import type { UserAccount } from '../schemas/users';
import { userError } from '../utils/feedback';

const integer = (max: number) =>
  createParser({
    parse: (value) =>
      /^\d{1,8}$/.test(value) && Number(value) >= 1 && Number(value) <= max ? Number(value) : null,
    serialize: String,
  });

const columns: DataTableColumn<UserAccount>[] = [
  {
    key: 'username',
    header: 'Usuario',
    rowHeader: true,
    cellClassName: 'min-w-40 whitespace-pre-wrap',
    render: (account) => account.username,
  },
  {
    key: 'name',
    header: 'Nombre',
    cellClassName: 'min-w-56 whitespace-pre-wrap',
    render: (account) => account.fullName,
  },
  {
    key: 'role',
    header: 'Rol',
    cellClassName: 'whitespace-nowrap',
    render: (account) => account.role,
  },
  {
    key: 'active',
    header: 'Estado',
    render: (account) => (
      <StatusBadge
        label={account.active ? 'Activa' : 'Inactiva'}
        tone={account.active ? 'success' : 'neutral'}
      />
    ),
  },
  {
    key: 'password',
    header: 'Cambio de contraseña',
    render: (account) => (
      <StatusBadge
        label={account.mustChangePassword ? 'Requerido' : 'No requerido'}
        tone={account.mustChangePassword ? 'warning' : 'neutral'}
      />
    ),
  },
];

export function UsersListPage() {
  const [filters, setFilters] = useQueryStates(
    {
      search: parseAsString.withDefault(''),
      active: parseAsStringEnum<string>(['', 'true', 'false']).withDefault(''),
      roleId: parseAsString.withDefault(''),
      page: integer(1000000).withDefault(1),
      pageSize: integer(100).withDefault(20),
    },
    { history: 'push' },
  );
  const { search } = useLocation();
  const valid =
    Array.from(filters.search).length <= 150 &&
    (!filters.roleId || z.uuidv7().safeParse(filters.roleId).success);
  const query = useQuery({
    queryKey: [...usersKey, 'list', filters],
    queryFn: ({ signal }) => listUsers(filters, signal),
    enabled: valid,
  });
  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Cuentas de usuario"
        description="Orden: creación e identificador ascendentes. El estado de la cuenta no es el estado del perfil de observador."
      />
      <section aria-label="Filtros de cuentas" className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block space-y-2 text-label" htmlFor="users-search">
            Buscar por usuario o nombre
            <Input
              id="users-search"
              value={filters.search}
              onChange={(event) => void setFilters({ search: event.target.value, page: 1 })}
            />
          </label>
          <div className="space-y-2">
            <label className="text-label" htmlFor="users-active">
              Estado de la cuenta
            </label>
            <select
              id="users-active"
              className="min-h-touch w-full rounded-md border border-input bg-card px-3"
              value={filters.active}
              onChange={(event) => void setFilters({ active: event.target.value, page: 1 })}
            >
              <option value="">Todos</option>
              <option value="true">Activa</option>
              <option value="false">Inactiva</option>
            </select>
          </div>
          <label className="block space-y-2 text-label" htmlFor="users-role">
            Identificador de rol (UUIDv7)
            <Input
              id="users-role"
              value={filters.roleId}
              onChange={(event) => void setFilters({ roleId: event.target.value, page: 1 })}
            />
          </label>
          <label className="block space-y-2 text-label" htmlFor="users-size">
            Registros por página
            <Input
              id="users-size"
              type="number"
              min={1}
              max={100}
              value={filters.pageSize}
              onChange={(event) => {
                const pageSize = Number(event.target.value);
                if (Number.isInteger(pageSize) && pageSize >= 1 && pageSize <= 100)
                  void setFilters({ pageSize, page: 1 });
              }}
            />
          </label>
        </div>
        <Button
          variant="secondary"
          onClick={() => void setFilters({ search: null, active: null, roleId: null, page: 1 })}
        >
          Limpiar filtros
        </Button>
      </section>
      {!valid ? (
        <p role="alert">
          La búsqueda admite hasta 150 caracteres y el rol debe ser un UUIDv7 válido.
        </p>
      ) : (
        <DataTable
          columns={columns}
          data={query.data?.items}
          isPending={query.isPending}
          isError={query.isError}
          isSuccess={query.isSuccess}
          onRetry={() => void query.refetch()}
          getRowKey={(account) => account.id}
          caption="Cuentas de Guerrero"
          regionLabel="Tabla de cuentas"
          tableClassName="min-w-200"
          loadingMessage="Cargando cuentas…"
          emptyMessage="No hay cuentas en esta página para los filtros seleccionados."
          errorMessage={query.isError ? userError(query.error) : ''}
          renderActions={(account) => (
            <Link
              className="inline-flex min-h-touch items-center text-primary underline underline-offset-4"
              aria-label={`Ver cuenta ${account.username}`}
              to={`/cuentas/${account.id}${search}`}
            >
              Ver detalle
            </Link>
          )}
        />
      )}
      {valid && query.isSuccess && (
        <PaginationPage
          label="Paginación de cuentas"
          page={query.data.page}
          total={query.data.total}
          limit={query.data.pageSize}
          previousDisabled={filters.page <= 1}
          nextDisabled={
            filters.page >= 1000000 || filters.page * filters.pageSize >= query.data.total
          }
          onPreviousClick={() => void setFilters({ page: filters.page - 1 })}
          onNextClick={() => void setFilters({ page: filters.page + 1 })}
        />
      )}
    </div>
  );
}
