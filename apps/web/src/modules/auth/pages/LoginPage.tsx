import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Navigate } from 'react-router';
import { Button } from '../../../components/ui/button';
import { AuthField } from '../components/AuthField';
import { SessionStatus } from '../components/SessionStatus';
import { AuthFrame } from '../components/AuthFrame';
import { useSession } from '../hooks/use-session';
import { loginSchema, type LoginInput } from '../schemas/auth';

export function LoginPage() {
  const session = useSession();
  const {
    register,
    handleSubmit,
    resetField,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });
  if (session.status === 'authenticated')
    return <Navigate to={session.user?.mustChangePassword ? '/cambiar-contrasena' : '/'} replace />;
  if (session.status !== 'anonymous') return <SessionStatus />;
  return (
    <AuthFrame variant="login">
      <header className="space-y-2">
        <p className="text-caption font-medium tracking-wide text-muted-foreground">
          Acceso institucional
        </p>
        <h1 className="text-heading">Iniciar sesión</h1>
        <p className="text-body-sm text-foreground-secondary">
          Usa las credenciales asignadas por el administrador del sistema.
        </p>
      </header>
      {session.notice && <output className="block">{session.notice}</output>}
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
            await session.login(input);
          } finally {
            resetField('password');
          }
        })}
      >
        <AuthField
          id="username"
          label="Usuario"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          disabled={session.busy}
          error={errors.username?.message}
          {...register('username')}
        />
        <AuthField
          id="password"
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          disabled={session.busy}
          error={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" className="w-full" disabled={session.busy}>
          {session.busy ? 'Iniciando sesión…' : 'Iniciar sesión'}
        </Button>
      </form>
      <Button
        variant="secondary"
        className="mx-auto min-h-0 bg-transparent px-2 py-1 text-body-sm text-foreground-secondary hover:bg-secondary"
        disabled={session.busy}
        onClick={session.recheck}
      >
        Verificar sesión existente
      </Button>
    </AuthFrame>
  );
}
