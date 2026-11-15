import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { Button } from '../../../components/ui/button';
import { HttpError } from '../../../lib/http';
import { useSession } from '../../auth/hooks/use-session';
import { ObserverField } from '../../observers/components/ObserverField';
import { createUser, rolesQuery, usersKey } from '../api/users';
import { createUserSchema, type CreateUserInput } from '../schemas/users';
import { userError } from '../utils/feedback';

export function CreateUserPage() {
  const { user } = useSession();
  const client = useQueryClient();
  const roles = useQuery({ ...rolesQuery, enabled: user?.permissions.includes('roles:read') });
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [uncertain, setUncertain] = useState(false);
  // One-time display only: unmount/dismiss loses this secret; never cache or persist it.
  const [created, setCreated] = useState<{ id: string; temporaryPassword: string } | null>(null);
  const [finished, setFinished] = useState(false);
  const [reveal, setReveal] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateUserInput>({ resolver: zodResolver(createUserSchema) });
  if (!user?.permissions.includes('roles:read'))
    return (
      <p role="alert">
        Para crear cuentas se necesita también roles:read para seleccionar un rol autorizado.
      </p>
    );
  if (roles.isPending) return <output>Cargando roles disponibles…</output>;
  if (roles.isError)
    return (
      <div role="alert">
        <p>{userError(roles.error)}</p>
        <Button onClick={() => void roles.refetch()}>Reintentar</Button>
      </div>
    );
  if (finished)
    return (
      <output>Cuenta creada. La credencial temporal ya no está disponible en esta pantalla.</output>
    );
  if (created)
    return (
      <section className="max-w-form space-y-4 rounded-lg border bg-card p-4 sm:p-6">
        <h1 className="text-heading">Cuenta creada</h1>
        <output className="block">
          Creación confirmada por el servidor. Entrega la credencial una sola vez mediante un canal
          autorizado.
        </output>
        <p>
          La cuenta está activa y requiere cambiar su contraseña. No se creó ni vinculó un perfil de
          observador.
        </p>
        <p>
          No guardes capturas. Al ocultar o salir se pierde la credencial; no se puede recuperar.
          Esta interfaz no restablece contraseñas.
        </p>
        <label className="block space-y-2">
          Contraseña temporal
          <input
            className="min-h-touch w-full rounded-md border border-input bg-card px-3"
            type={reveal ? 'text' : 'password'}
            readOnly
            value={created.temporaryPassword}
            autoComplete="off"
          />
        </label>
        <Button variant="secondary" onClick={() => setReveal(!reveal)}>
          {reveal ? 'Enmascarar contraseña temporal' : 'Mostrar contraseña temporal'}
        </Button>
        <p className="break-all">Identificador: {created.id}</p>
        {user.permissions.includes('users:read') && (
          <Link
            className="inline-flex min-h-touch items-center text-primary underline"
            to={`/cuentas/${created.id}`}
          >
            Ver cuenta (descarta la credencial)
          </Link>
        )}
        <Button
          onClick={() => {
            setCreated(null);
            setFinished(true);
          }}
        >
          Ocultar credencial definitivamente
        </Button>
      </section>
    );
  const assignable = roles.data.filter(
    (role) => role.active && ['ENLACE', 'OBSERVADOR'].includes(role.code),
  );
  return (
    <section className="max-w-form space-y-4">
      <h1 className="text-heading">Crear cuenta</h1>
      <p>
        Usuario inmutable. Solo se admiten roles ENLACE u OBSERVADOR activos como clasificación
        inicial, sin editar roles o permisos. La contraseña temporal se mostrará una sola vez y
        exige cambio por su titular.
      </p>
      {notice && <p role="alert">{notice}</p>}
      {uncertain && (
        <p role="alert">
          No vuelvas a crear esta cuenta sin comprobar el listado. Si se creó y se perdió la
          credencial, solicita el proceso administrativo autorizado fuera de esta interfaz.
        </p>
      )}
      {!assignable.length && <p role="alert">No hay roles activos asignables.</p>}
      <form
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          void handleSubmit(async (input) => {
            if (busy.current || uncertain) return;
            busy.current = true;
            setPending(true);
            setNotice('');
            try {
              const result = await createUser(input);
              setCreated(result);
              await client.invalidateQueries({ queryKey: usersKey });
            } catch (error) {
              setNotice(userError(error, true));
              if (!(error instanceof HttpError && error.status >= 400 && error.status < 500)) {
                setUncertain(true);
                await client.invalidateQueries({ queryKey: usersKey });
              }
            } finally {
              busy.current = false;
              setPending(false);
            }
          })(event);
        }}
      >
        <ObserverField
          id="username"
          label="Nombre de usuario"
          error={errors.username?.message}
          disabled={pending || uncertain}
          {...register('username')}
        />
        <ObserverField
          id="fullName"
          label="Nombre completo de la cuenta"
          error={errors.fullName?.message}
          disabled={pending || uncertain}
          {...register('fullName')}
        />
        <label className="block space-y-2" htmlFor="initial-role">
          Rol inicial
          <select
            id="initial-role"
            className="min-h-touch w-full rounded-md border border-input bg-card px-3"
            disabled={pending || uncertain}
            {...register('roleId')}
          >
            <option value="">Selecciona un rol</option>
            {assignable.map((role) => (
              <option key={role.id} value={role.id}>
                {role.code}
              </option>
            ))}
          </select>
        </label>
        {errors.roleId && <p role="alert">{errors.roleId.message}</p>}
        <Button type="submit" disabled={pending || uncertain || !assignable.length}>
          {pending ? 'Creando…' : 'Crear cuenta'}
        </Button>
      </form>
    </section>
  );
}
