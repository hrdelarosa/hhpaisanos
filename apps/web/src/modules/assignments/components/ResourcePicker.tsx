import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { fieldErrorAttributes } from '../../../lib/field-error';
import { useSession } from '../../auth/hooks/use-session';
import { listObservers, observerQuery, observersKey } from '../../observers/api/observers';
import { listOperatives, operativeQuery, operativesKey } from '../../operatives/api/operatives';
import {
  listModules,
  moduleQuery,
  modulesKey,
} from '../../attention-modules/api/attention-modules';
import { assignmentError } from '../utils/feedback';

export type ResourceKind = 'observer' | 'operative' | 'module';
export const resources = {
  observer: { label: 'Observador', permission: 'observers:read', key: observersKey },
  operative: { label: 'Operativo', permission: 'operatives:read', key: operativesKey },
  module: { label: 'Módulo de atención', permission: 'attention-modules:read', key: modulesKey },
};
export function ResourceName({ kind, id }: { kind: ResourceKind; id: string }) {
  const { user } = useSession();
  const allowed = Boolean(user?.permissions.includes(resources[kind].permission));
  const observer = useQuery({ ...observerQuery(id), enabled: allowed && kind === 'observer' });
  const operative = useQuery({ ...operativeQuery(id), enabled: allowed && kind === 'operative' });
  const module = useQuery({ ...moduleQuery(id), enabled: allowed && kind === 'module' });
  const name =
    kind === 'observer'
      ? observer.data
        ? `${observer.data.firstNames} ${observer.data.lastNames}`
        : undefined
      : kind === 'operative'
        ? operative.data?.name
        : module.data?.name;
  const loading =
    kind === 'observer'
      ? observer.isPending
      : kind === 'operative'
        ? operative.isPending
        : module.isPending;
  return (
    <span className="break-words">
      {name ?? (allowed && loading ? 'Consultando nombre…' : 'Nombre no disponible')}{' '}
      <span className="break-all text-foreground-secondary">({id})</span>
    </span>
  );
}

export function ResourcePicker({
  kind,
  value,
  onChange,
  disabled,
  error,
  'aria-describedby': description,
}: {
  kind: ResourceKind;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  'aria-describedby'?: string;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const searchErrorId = `${id}-search-error`;
  const { user } = useSession();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const allowed = Boolean(user?.permissions.includes(resources[kind].permission));
  const query = useQuery({
    queryKey: [...resources[kind].key, 'assignment-picker', search, page],
    queryFn: async ({ signal }) => {
      if (kind === 'observer') {
        const result = await listObservers(
          { search, active: '', linked: '', page, pageSize: 20 },
          signal,
        );
        return {
          total: result.total,
          items: result.items.map((v) => ({
            id: v.id,
            label: `${v.firstNames} ${v.lastNames} · ${v.active ? 'Activo' : 'Inactivo'}`,
          })),
        };
      }
      if (kind === 'operative') {
        const result = await listOperatives({ name: search, status: '', page, limit: 20 }, signal);
        return {
          total: result.total,
          items: result.items.map((v) => ({
            id: v.id,
            label: `${v.name} · ${v.status} · ${v.startDate} — ${v.endDate}`,
          })),
        };
      }
      const result = await listModules(
        { name: search, municipality: '', active: '', page, limit: 20 },
        signal,
      );
      return {
        total: result.total,
        items: result.items.map((v) => ({
          id: v.id,
          label: `${v.name} · ${v.municipality} · ${v.active ? 'Activo' : 'Inactivo'}`,
        })),
      };
    },
    enabled: allowed && Array.from(search).length <= 100,
  });
  const label = resources[kind].label;
  const searchError =
    Array.from(search).length > 100 ? 'Máximo 100 caracteres de búsqueda.' : undefined;
  const selectionAvailable = !searchError && query.isSuccess;
  const searchDescription =
    [description, searchError && !selectionAvailable && error ? errorId : undefined]
      .filter(Boolean)
      .join(' ') || undefined;
  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-2 rounded-md border p-4">
      <legend>{label}</legend>
      {!allowed ? (
        <p role="alert">Se requiere {resources[kind].permission} para seleccionar este recurso.</p>
      ) : (
        <>
          {value && (
            <p>
              Selección: <ResourceName kind={kind} id={value} />
            </p>
          )}
          <label htmlFor={`${id}-search`}>Buscar {label.toLowerCase()}</label>
          <Input
            id={`${id}-search`}
            {...fieldErrorAttributes(
              searchError ? searchErrorId : errorId,
              searchError ?? (!selectionAvailable ? error : undefined),
              searchDescription,
            )}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          {searchError ? (
            <p id={searchErrorId}>{searchError}</p>
          ) : query.isPending ? (
            <output>Cargando opciones.</output>
          ) : query.isError ? (
            <div role="alert">
              <p>{assignmentError(query.error)}</p>
              <Button type="button" variant="secondary" onClick={() => void query.refetch()}>
                Reintentar opciones
              </Button>
            </div>
          ) : (
            <>
              <label htmlFor={`${id}-selection`}>
                Seleccionar {label.toLowerCase()} (página {page})
              </label>
              <select
                id={`${id}-selection`}
                className="min-h-touch w-full min-w-0 rounded-md border border-input bg-card px-3"
                value={query.data.items.some((v) => v.id === value) ? value : ''}
                onChange={(e) => onChange(e.target.value)}
                {...fieldErrorAttributes(errorId, error, description)}
              >
                <option value="">Selecciona una opción</option>
                {query.data.items.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label} ({v.id})
                  </option>
                ))}
              </select>
              {!query.data.items.length && <p>No hay opciones para esta búsqueda.</p>}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Opciones anteriores de {label.toLowerCase()}
                </Button>
                <span>Página {page}</span>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={page * 20 >= query.data.total}
                  onClick={() => setPage(page + 1)}
                >
                  Más opciones de {label.toLowerCase()}
                </Button>
              </div>
            </>
          )}
        </>
      )}
      {error && <p id={errorId}>{error}</p>}
    </fieldset>
  );
}
