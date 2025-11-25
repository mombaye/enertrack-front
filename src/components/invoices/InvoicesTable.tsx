import React, { useMemo, useState } from "react";
import { ColumnDef, flexRender, useReactTable, getCoreRowModel, getPaginationRowModel, getFilteredRowModel } from "@tanstack/react-table";
import { Invoice } from "@/types/invoice";
import { Input } from "@/components/ui/input";
import clsx from "clsx";

export default function InvoicesTable({ invoices }: { invoices: Invoice[] }) {
  // Etats pour la recherche
  const [search, setSearch] = useState("");
  const [siteSearch, setSiteSearch] = useState("");

  // Colonnes pertinentes
  const columns = useMemo<ColumnDef<Invoice>[]>(() => [
    { accessorKey: "date_facture", header: "Date", cell: info => info.getValue() },
    { accessorKey: "site_name", header: "Site", cell: info => info.getValue() },
    { accessorKey: "facture_number", header: "Facture", cell: info => info.getValue() },
    { accessorKey: "montant_ht", header: "Montant HT", cell: info => Number(info.getValue()).toLocaleString() },
    { accessorKey: "montant_ttc", header: "Montant TTC", cell: info => Number(info.getValue() || 0).toLocaleString() },
    { accessorKey: "consommation_kwh", header: "Conso (kWh)", cell: info => Number(info.getValue() || 0).toLocaleString() },
    { accessorKey: "categorie", header: "Catégorie", cell: info => info.getValue() },
    { accessorKey: "mois_business", header: "Mois", cell: info => info.getValue() },
    { accessorKey: "annee_business", header: "Année", cell: info => info.getValue() },
    // { accessorKey: "statut", header: "Statut", cell: info => info.getValue() }, // Ajoute si tu veux badge statut
  ], []);

  // Filtres personnalisés
  const filteredData = useMemo(() => {
    return invoices.filter(inv =>
      (!search || inv.facture_number?.toLowerCase().includes(search.toLowerCase())) &&
      (!siteSearch || inv.site_name?.toLowerCase().includes(siteSearch.toLowerCase()))
    );
  }, [invoices, search, siteSearch]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    pageCount: Math.ceil(filteredData.length / 20), // 20 lignes par page
    initialState: { pagination: { pageSize: 20 } }
  });

  return (
    <div className="overflow-x-auto rounded-xl">
      {/* Filtres / Recherche */}
      <div className="flex gap-4 mb-3">
        <Input
          placeholder="Recherche n° facture..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs border-blue-200"
        />
        <Input
          placeholder="Recherche site..."
          value={siteSearch}
          onChange={e => setSiteSearch(e.target.value)}
          className="max-w-xs border-blue-200"
        />
        <span className="text-sm text-blue-900/70 mt-2">{filteredData.length} facture(s) trouvée(s)</span>
      </div>

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
          {table.getRowModel().rows.length === 0 ? (
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

      {/* Pagination stylée */}
      <div className="flex gap-4 items-center mt-5 justify-center">
        <button
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
          className="px-3 py-1 rounded bg-blue-100 text-blue-900 font-medium disabled:opacity-50"
        >
          ⏮ Début
        </button>
        <button
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className="px-3 py-1 rounded bg-blue-100 text-blue-900 font-medium disabled:opacity-50"
        >
          Précédent
        </button>
        <span>
          Page <b>{table.getState().pagination.pageIndex + 1}</b> / {table.getPageCount()}
        </span>
        <button
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          className="px-3 py-1 rounded bg-blue-100 text-blue-900 font-medium disabled:opacity-50"
        >
          Suivant
        </button>
        <button
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!table.getCanNextPage()}
          className="px-3 py-1 rounded bg-blue-100 text-blue-900 font-medium disabled:opacity-50"
        >
          Fin ⏭
        </button>
      </div>
    </div>
  );
}
