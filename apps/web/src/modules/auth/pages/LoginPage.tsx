import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Navigate } from 'react-router';
import { Button } from '../../../components/ui/button';
import { AuthField } from '../components/AuthField';
import { SessionStatus } from '../components/SessionStatus';
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
    <section className="mx-auto max-w-form space-y-6 rounded-lg border bg-card p-4 sm:p-6">
      <header className="space-y-2">
        <h1 className="text-heading">Iniciar sesión</h1>
        <p className="text-foreground-secondary">Heroínas y Héroes Paisanos · Guerrero</p>
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
        <Button type="submit" disabled={session.busy}>
          {session.busy ? 'Iniciando sesión…' : 'Iniciar sesión'}
        </Button>
      </form>
      <Button variant="secondary" disabled={session.busy} onClick={session.recheck}>
        Verificar sesión existente
      </Button>
    </section>
  );
}
