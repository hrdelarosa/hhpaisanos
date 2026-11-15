import type { ComponentProps } from 'react';
import { Input } from '../../../components/ui/input';

export function AssignmentField({
  label,
  error,
  ...props
}: ComponentProps<typeof Input> & { id: string; label: string; error?: string }) {
  return (
    <div className="space-y-2">
      <label htmlFor={props.id}>{label}</label>
      <Input
        {...props}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${props.id}-error` : undefined}
      />
      {error && (
        <p role="alert" id={`${props.id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
