import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

export function Button({
  className,
  variant = 'primary',
  type = 'button',
  ...props
}: ComponentProps<'button'> & { variant?: 'primary' | 'secondary' }) {
  return (
    <button
      data-slot="button"
      type={type}
      className={cn(
        'inline-flex min-h-touch items-center justify-center rounded-md px-4 py-2 text-label disabled:cursor-not-allowed disabled:opacity-60',
        variant === 'primary'
          ? 'bg-primary text-primary-foreground hover:bg-primary-hover'
          : 'bg-secondary text-secondary-foreground hover:bg-secondary-hover',
        className,
      )}
      {...props}
    />
  );
}
