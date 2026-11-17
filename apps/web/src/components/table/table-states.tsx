import { Button } from '../ui/button';
import { TableCell, TableRow } from '../ui/table';

// SIGIP's in-table states keep the same column geometry as the loaded results.
export function TableLoadingState({ colSpan }: { colSpan: number }) {
  return (
    <>
      {Array.from({ length: 5 }, (_, row) => (
        <TableRow key={row} aria-hidden="true">
          {Array.from({ length: colSpan }, (_, column) => (
            <TableCell key={column} className="px-4 py-4">
              <div className="h-4 rounded-sm bg-muted" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function TableEmptyState({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-32 px-4 py-6 text-center text-muted-foreground">
        <output>{message}</output>
      </TableCell>
    </TableRow>
  );
}

export function TableErrorState({
  colSpan,
  message,
  onRetry,
}: {
  colSpan: number;
  message: string;
  onRetry: () => void;
}) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-32 px-4 py-6">
        <div role="alert" className="flex flex-col items-center gap-3 text-center">
          <p>{message}</p>
          <Button variant="secondary" onClick={onRetry}>
            Reintentar
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
