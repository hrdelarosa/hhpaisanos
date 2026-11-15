import type { ComponentProps } from 'react';
import { Input } from '../../../components/ui/input';

export function OperativeField({
  id,
  label,
  error,
  ...props
}: ComponentProps<typeof Input> & { id: string; label: string; error?: string }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-label">
        {label}
      </label>
      <Input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="text-body-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
