import React from "react";
import { cn } from "@/features/sonatelBilling/ui";

export type Col<T> = {
  key: string;
  title: string;
  className?: string;
  headClassName?: string;
  render: (row: T) => React.ReactNode;
};

export function DataTable<T>({
  cols,
  rows,
  loading,
  emptyText = "Aucune donnée",
}: {
  cols: Col<T>[];
  rows: T[];
  loading?: boolean;
  emptyText?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_18px_60px_rgba(2,6,23,0.06)] overflow-hidden">
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-300">
            <tr>
              {cols.map((c) => (
                <th
                  key={c.key}
                  className={cn("text-left px-4 py-3 font-semibold text-slate-700 whitespace-nowrap", c.headClassName)}
                >
                  {c.title}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-300">
            {loading ? (
              <tr>
                <td className="px-4 py-10 text-slate-500" colSpan={cols.length}>
                  Chargement…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-slate-500" colSpan={cols.length}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50/60">
                  {cols.map((c) => (
                    <td key={c.key} className={cn("px-4 py-3 text-slate-900", c.className)}>
                      {c.render(r)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
