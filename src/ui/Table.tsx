import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { SkeletonRow } from './Skeleton'

export interface Column<T> {
  key: string
  header: string
  width?: string
  className?: string
  cell: (row: T, index: number) => ReactNode
}

export interface TableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  loading?: boolean
  loadingRows?: number
  emptyState?: ReactNode
  className?: string
}

export function Table<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  loading,
  loadingRows = 5,
  emptyState,
  className,
}: TableProps<T>) {
  return (
    <div className={cn('w-full overflow-x-auto rounded-lg border border-[var(--border-subtle)]', className)}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                style={col.width ? { width: col.width } : undefined}
                className={cn(
                  'px-4 py-2.5 text-left text-label font-semibold uppercase tracking-wide text-[var(--text-tertiary)]',
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: loadingRows }).map((_, i) => (
                <tr key={i} className="border-b border-[var(--border-subtle)] last:border-0">
                  <td colSpan={columns.length} className="p-0">
                    <SkeletonRow />
                  </td>
                </tr>
              ))
            : rows.length === 0
              ? emptyState && (
                  <tr>
                    <td colSpan={columns.length}>{emptyState}</td>
                  </tr>
                )
              : rows.map((row, i) => (
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      'border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] last:border-0',
                      onRowClick && 'cursor-pointer hover:bg-[var(--bg-surface-elevated)]',
                    )}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn('px-4 py-3 text-body text-[var(--text-primary)]', col.className)}
                      >
                        {col.cell(row, i)}
                      </td>
                    ))}
                  </tr>
                ))}
        </tbody>
      </table>
    </div>
  )
}
