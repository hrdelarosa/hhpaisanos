import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

// SIGIP's Badge presentation needs neither polymorphic rendering nor a variants dependency here.
export function Badge({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      data-slot="badge"
      className={cn(
        'inline-flex w-fit shrink-0 items-center gap-2 rounded-full px-2.5 py-1 text-label whitespace-nowrap',
        className,
      )}
      {...props}
    />
  );
}
