import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { Button } from '../../../components/ui/button';
import { AuthField } from '../components/AuthField';
import { AuthFrame } from '../components/AuthFrame';
import { useSession } from '../hooks/use-session';
import { passwordSchema, type PasswordInput } from '../schemas/auth';

export function ChangePasswordPage() {
  const session = useSession();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordInput>({ resolver: zodResolver(passwordSchema) });
  return (
    <AuthFrame variant="authentication">
      <header className="space-y-2">
        <p className="text-caption font-medium tracking-wide text-muted-foreground">
          Acceso institucional
        </p>
        <h1 className="text-heading">Cambiar contraseña</h1>
        <p className="text-body-sm text-foreground-secondary">
          {session.user?.mustChangePassword
            ? 'Debes cambiar tu contraseña antes de continuar.'
            : 'Actualiza tu contraseña.'}{' '}
          Al cambiarla se cerrarán todas tus sesiones y tendrás que iniciar sesión de nuevo.
        </p>
      </header>
      {session.actionError && (
        <p role="alert" className="text-destructive">
          {session.actionError}
        </p>
      )}
      <form
        noValidate
        className="space-y-4"
        onSubmit={handleSubmit(async (input) => {
          try {
            await session.changePassword(input);
          } finally {
            reset();
          }
        })}
      >
        <AuthField
          id="currentPassword"
          label="Contraseña actual"
          type="password"
          autoComplete="current-password"
          disabled={session.busy}
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <AuthField
          id="newPassword"
          label="Nueva contraseña (15 a 128 caracteres)"
          type="password"
          autoComplete="new-password"
          disabled={session.busy}
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <AuthField
          id="confirmPassword"
          label="Confirmar nueva contraseña"
          type="password"
          autoComplete="new-password"
          disabled={session.busy}
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <Button type="submit" className="w-full" disabled={session.busy}>
          {session.busy ? 'Cambiando contraseña…' : 'Actualizar contraseña'}
        </Button>
      </form>
      <div className="flex flex-wrap items-center gap-4">
        {!session.user?.mustChangePassword && (
          <Link className="inline-flex min-h-touch items-center text-primary underline" to="/">
            Volver al inicio
          </Link>
        )}
        <Button variant="secondary" onClick={() => void session.logout()} disabled={session.busy}>
          Cerrar sesión
        </Button>
      </div>
    </AuthFrame>
  );
}
