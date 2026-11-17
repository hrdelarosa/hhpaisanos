import { useState, type ComponentProps } from 'react';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';

export function AuthField({
  label,
  error,
  id,
  ...props
}: ComponentProps<typeof Input> & { label: string; id: string; error?: string }) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const password = props.type === 'password';
  const describedBy =
    [props['aria-describedby'], error ? `${id}-error` : undefined].filter(Boolean).join(' ') ||
    undefined;
  return (
    <div className="space-y-2">
      <label className="block text-label" htmlFor={id}>
        {label}
      </label>
      {password ? (
        <div className="flex min-w-0 items-center gap-2">
          <Input
            {...props}
            id={id}
            type={passwordVisible ? 'text' : 'password'}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
          />
          <Button
            type="button"
            variant="secondary"
            className="shrink-0 px-3"
            aria-label={passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={passwordVisible}
            disabled={props.disabled}
            onClick={() => setPasswordVisible((visible) => !visible)}
          >
            {passwordVisible ? 'Ocultar' : 'Mostrar'}
          </Button>
        </div>
      ) : (
        <Input {...props} id={id} aria-invalid={Boolean(error)} aria-describedby={describedBy} />
      )}
      {error && (
        <p id={`${id}-error`} className="text-body-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
