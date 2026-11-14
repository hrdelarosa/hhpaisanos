import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      data-slot="input"
      className={cn(
        'min-h-touch w-full rounded-md border border-input bg-card px-3 py-2 text-body text-foreground aria-invalid:border-destructive disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}
