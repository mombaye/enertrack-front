import { useMemo } from "react";
import { ColumnDef, flexRender, useReactTable, getCoreRowModel, getPaginationRowModel } from "@tanstack/react-table";
import { Invoice } from "@/types/invoice";
import clsx from "clsx";

export default function InvoicesTable({ invoices }: { invoices: Invoice[] }) {
  const columns = useMemo<ColumnDef<Invoice>[]>(
    () => [
      { accessorKey: "date_facture", header: "Date", cell: info => info.getValue() },
      { accessorKey: "site_name", header: "Site", cell: info => info.getValue() },
      { accessorKey: "facture_number", header: "Facture", cell: info => info.getValue() },
      { accessorKey: "montant_ht", header: "Montant HT", cell: info => Number(info.getValue()).toLocaleString() },
      { accessorKey: "montant_ttc", header: "Montant TTC", cell: info => Number(info.getValue() || 0).toLocaleString() },
      { accessorKey: "consommation_kwh", header: "Conso (kWh)", cell: info => Number(info.getValue() || 0).toLocaleString() },
      { accessorKey: "mois_business", header: "Mois", cell: info => info.getValue() },
      { accessorKey: "annee_business", header: "Année", cell: info => info.getValue() },
    ],
    []
  );

  const table = useReactTable({
    data: invoices,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="overflow-x-auto rounded-xl">
      <table className="min-w-full border-separate border-spacing-y-2">
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th
                  key={header.id}
                  className={clsx(
                    "text-left font-semibold text-blue-900 py-2 px-3 bg-blue-50 rounded-t-xl"
                  )}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {invoices.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-12 text-blue-900">
                Aucun résultat
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map(row => (
              <tr key={row.id} className="hover:shadow-lg transition-all hover:scale-[1.01] bg-white rounded-xl">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-3 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
