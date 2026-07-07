import type { ReactNode } from "react";
import { cn } from "./cn";

export type Column<Row> = {
  key: string;
  header: ReactNode;
  align?: "left" | "right";
  render: (row: Row) => ReactNode;
};

/**
 * Dense operational table. Optimized for scan speed on desktop; consumers wrap
 * it in a horizontally scrollable container on small screens (no page overflow).
 */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  empty = "Kayit yok.",
  className,
}: {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  empty?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto rounded-card border border-line", className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-surface-muted text-left">
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  "px-3 py-2 text-xs font-semibold text-ink-subtle",
                  column.align === "right" && "text-right",
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center text-sm text-ink-subtle">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-line last:border-0 hover:bg-surface-muted/75">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn("px-3 py-2 text-ink", column.align === "right" && "text-right")}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
