import type { ReactNode } from 'react';
import { cn } from '../lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { TableEmptyState, TableErrorState, TableLoadingState } from './table/table-states';

// Adapted from SIGIP's DataTable, retaining Paisanos' captions, row headers and scroll access.
export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  headerClassName?: string;
  cellClassName?: string;
  rowHeader?: boolean;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[] | undefined;
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  onRetry: () => void;
  getRowKey: (row: T) => string | number;
  caption: string;
  regionLabel: string;
  tableClassName: string;
  loadingMessage: string;
  emptyMessage: string;
  errorMessage: string;
  renderActions: (row: T) => ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  isPending,
  isError,
  isSuccess,
  onRetry,
  getRowKey,
  caption,
  regionLabel,
  tableClassName,
  loadingMessage,
  emptyMessage,
  errorMessage,
  renderActions,
}: DataTableProps<T>) {
  const colSpan = columns.length + 1;
  return (
    <section
      aria-label={regionLabel}
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Native scroll region needs keyboard focus.
      tabIndex={0}
      className="min-w-0 overflow-x-auto rounded-lg border bg-card"
    >
      {isPending && (
        <output className="block border-b px-4 py-3 text-body-sm text-muted-foreground">
          {loadingMessage}
        </output>
      )}
      <Table className={tableClassName} aria-busy={isPending}>
        <caption className="sr-only">{caption}</caption>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key} className={column.headerClassName}>
                {column.header}
              </TableHead>
            ))}
            <TableHead className="w-32">Detalle</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isPending && <TableLoadingState colSpan={colSpan} />}
          {isError && (
            <TableErrorState colSpan={colSpan} message={errorMessage} onRetry={onRetry} />
          )}
          {isSuccess && data?.length === 0 && (
            <TableEmptyState colSpan={colSpan} message={emptyMessage} />
          )}
          {isSuccess &&
            data?.map((row) => (
              <TableRow key={getRowKey(row)}>
                {columns.map((column) =>
                  column.rowHeader ? (
                    <th
                      key={column.key}
                      scope="row"
                      className={cn(
                        'px-4 py-2 text-left align-middle font-medium whitespace-normal',
                        column.cellClassName,
                      )}
                    >
                      {column.render(row)}
                    </th>
                  ) : (
                    <TableCell key={column.key} className={column.cellClassName}>
                      {column.render(row)}
                    </TableCell>
                  ),
                )}
                <TableCell className="whitespace-nowrap">{renderActions(row)}</TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </section>
  );
}
