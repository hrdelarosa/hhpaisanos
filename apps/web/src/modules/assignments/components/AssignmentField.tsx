import { useId, type ComponentProps } from 'react';
import { Input } from '../../../components/ui/input';
import { fieldErrorAttributes } from '../../../lib/field-error';

export function AssignmentField({
  label,
  error,
  ...props
}: ComponentProps<typeof Input> & { id: string; label: string; error?: string }) {
  const errorId = `${useId()}-error`;
  return (
    <div className="space-y-2">
      <label htmlFor={props.id}>{label}</label>
      <Input {...props} {...fieldErrorAttributes(errorId, error, props['aria-describedby'])} />
      {error && <p id={errorId}>{error}</p>}
    </div>
  );
}
