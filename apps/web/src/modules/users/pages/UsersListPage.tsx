import { useQuery } from '@tanstack/react-query';
import { createParser, parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs';
import { Link, useLocation } from 'react-router';
import { z } from 'zod';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { listUsers, usersKey } from '../api/users';
import { userError } from '../utils/feedback';

const integer = (max: number) =>
  createParser({
    parse: (v) => (/^\d{1,8}$/.test(v) && Number(v) >= 1 && Number(v) <= max ? Number(v) : null),
    serialize: String,
  });
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
    <div className="space-y-4">
      <h1 className="text-heading">Cuentas de usuario</h1>
      <p>
        Orden: creación e identificador ascendentes. El estado de la cuenta no es el estado del
        perfil de observador.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-2" htmlFor="users-search">
          Buscar por usuario o nombre
          <Input
            id="users-search"
            value={filters.search}
            onChange={(e) => void setFilters({ search: e.target.value, page: 1 })}
          />
        </label>
        <label className="space-y-2" htmlFor="users-active">
          Estado de la cuenta
          <select
            id="users-active"
            className="min-h-touch w-full rounded-md border border-input bg-card px-3"
            value={filters.active}
            onChange={(e) => void setFilters({ active: e.target.value, page: 1 })}
          >
            <option value="">Todos</option>
            <option value="true">Activa</option>
            <option value="false">Inactiva</option>
          </select>
        </label>
        <label className="space-y-2" htmlFor="users-role">
          Identificador de rol (UUIDv7)
          <Input
            id="users-role"
            value={filters.roleId}
            onChange={(e) => void setFilters({ roleId: e.target.value, page: 1 })}
          />
        </label>
        <label className="space-y-2" htmlFor="users-size">
          Registros por página
          <Input
            id="users-size"
            type="number"
            min={1}
            max={100}
            value={filters.pageSize}
            onChange={(e) => {
              const pageSize = Number(e.target.value);
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
      {!valid ? (
        <p role="alert">
          La búsqueda admite hasta 150 caracteres y el rol debe ser un UUIDv7 válido.
        </p>
      ) : query.isPending ? (
        <output>Cargando cuentas…</output>
      ) : query.isError ? (
        <div role="alert">
          <p>{userError(query.error)}</p>
          <Button onClick={() => void query.refetch()}>Reintentar</Button>
        </div>
      ) : (
        <>
          {query.data.items.length ? (
            <section
              aria-label="Tabla de cuentas"
              // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Native scroll region needs keyboard focus.
              tabIndex={0}
              className="overflow-x-auto rounded-lg border bg-card"
            >
              <table className="w-full min-w-200 text-left text-body-sm whitespace-nowrap">
                <caption className="sr-only">Cuentas de Guerrero</caption>
                <thead>
                  <tr>
                    {['Usuario', 'Nombre', 'Rol', 'Estado', 'Cambio de contraseña', 'Detalle'].map(
                      (label) => (
                        <th className="p-4" scope="col" key={label}>
                          {label}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((account) => (
                    <tr className="border-t" key={account.id}>
                      <th className="min-w-40 p-4 font-medium whitespace-pre-wrap" scope="row">
                        {account.username}
                      </th>
                      <td className="min-w-56 p-4 whitespace-pre-wrap">{account.fullName}</td>
                      <td className="p-4">{account.role}</td>
                      <td className="p-4">{account.active ? 'Activa' : 'Inactiva'}</td>
                      <td className="p-4">
                        {account.mustChangePassword ? 'Requerido' : 'No requerido'}
                      </td>
                      <td className="p-4">
                        <Link
                          className="inline-flex min-h-touch items-center text-primary underline"
                          aria-label={`Ver cuenta ${account.username}`}
                          to={`/cuentas/${account.id}${search}`}
                        >
                          Ver detalle
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : (
            <output>No hay cuentas en esta página para los filtros seleccionados.</output>
          )}
          <nav aria-label="Paginación de cuentas" className="flex flex-wrap items-center gap-4">
            <Button
              variant="secondary"
              disabled={filters.page <= 1}
              onClick={() => void setFilters({ page: filters.page - 1 })}
            >
              Anterior
            </Button>
            <p className="tabular-nums">
              Página {query.data.page} de{' '}
              {Math.max(1, Math.ceil(query.data.total / query.data.pageSize))} · {query.data.total}{' '}
              registros
            </p>
            <Button
              variant="secondary"
              disabled={
                filters.page >= 1000000 || filters.page * filters.pageSize >= query.data.total
              }
              onClick={() => void setFilters({ page: filters.page + 1 })}
            >
              Siguiente
            </Button>
          </nav>
        </>
      )}
    </div>
  );
}
