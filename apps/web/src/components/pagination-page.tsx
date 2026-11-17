import { Button } from './ui/button';

// Adapted from SIGIP without its API types, custom Select, or automatic scrolling.
export function PaginationPage({
  label,
  page,
  total,
  limit,
  previousDisabled,
  nextDisabled,
  onPreviousClick,
  onNextClick,
}: {
  label: string;
  page: number;
  total: number;
  limit: number;
  previousDisabled: boolean;
  nextDisabled: boolean;
  onPreviousClick: () => void;
  onNextClick: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <p aria-live="polite" className="text-body-sm text-muted-foreground tabular-nums">
        Página {page} de {Math.max(1, Math.ceil(total / limit))} · {total} registros
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <nav aria-label={label} className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={previousDisabled} onClick={onPreviousClick}>
            Anterior
          </Button>
          <Button variant="secondary" disabled={nextDisabled} onClick={onNextClick}>
            Siguiente
          </Button>
        </nav>
      </div>
    </div>
  );
}
