import { useMemo } from "react";

export default function StatsTable({ stats }: { stats: any[] }) {
  const columns = useMemo(
    () => [
      { key: "site__site_id", label: "ID site" },
      { key: "site__name", label: "Nom site" },
      { key: "avg_montant_ht", label: "Avg HT", format: (v: any) => Number(v).toLocaleString() },
      { key: "avg_montant_ttc", label: "Avg TTC", format: (v: any) => Number(v).toLocaleString() },
      { key: "avg_consommation", label: "Avg kWh", format: (v: any) => Number(v).toLocaleString() },
      { key: "count", label: "Factures" },
    ],
    []
  );

  return (
    <div className="overflow-x-auto rounded-xl">
      <table className="min-w-full border-separate border-spacing-y-2">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} className="text-left font-semibold text-blue-900 py-2 px-3 bg-blue-50 rounded-t-xl">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stats.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-12 text-blue-900">
                Aucun résultat
              </td>
            </tr>
          ) : (
            stats.map((row, idx) => (
              <tr key={idx} className="hover:shadow-lg transition-all hover:scale-[1.01] bg-white rounded-xl">
                {columns.map(col => (
                  <td key={col.key} className="px-3 py-2">
                    {col.format ? col.format(row[col.key]) : row[col.key]}
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
