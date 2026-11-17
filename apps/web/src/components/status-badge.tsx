import { Badge } from './ui/badge';

const tones = {
  success: 'bg-success-surface text-success',
  neutral: 'bg-muted text-foreground-secondary',
  warning: 'bg-warning-surface text-warning',
};

export function StatusBadge({ label, tone }: { label: string; tone: keyof typeof tones }) {
  return (
    <Badge className={tones[tone]}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {label}
    </Badge>
  );
}
