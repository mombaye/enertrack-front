import { useEffect, useMemo, useState } from "react";
import { fetchSites, Site, deleteSite, importSitesExcel } from "@/services/sites";
import { ColumnDef, flexRender, getCoreRowModel, useReactTable, getFilteredRowModel, getPaginationRowModel } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Plus, Upload, Trash2, Pencil } from "lucide-react";
import { toast } from "react-toastify";
import clsx from "clsx";
import { SearchInput } from "@/components/SearchInput";
import { SiteModal } from "./SiteModal";

export default function SitesTable() {
  const [sites, setSites] = useState<Site[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [zoneFilter, setZoneFilter] = useState<string | null>(null);
  const [countryFilter, setCountryFilter] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Site | null>(null);

  useEffect(() => {
    loadSites();
  }, []);

  function loadSites() {
    setLoading(true);
    fetchSites()
      .then(setSites)
      .catch(() => toast.error("Erreur lors du chargement des sites"))
      .finally(() => setLoading(false));
  }

  // Zones dynamiques à partir des données (sans doublons)
  const ZONES = useMemo(() => {
    const unique = Array.from(new Set(sites.map(s => s.zone).filter(Boolean)));
    return unique.map(zone => ({ value: zone, label: zone }));
  }, [sites]);

  // Pays dynamiques à partir des données (sans doublons)
  const COUNTRIES = useMemo(() => {
    const unique = Array.from(new Set(sites.map(s => s.country).filter(Boolean)));
    return unique.map(c => ({ value: c, label: (typeof c === "string" ? c.toUpperCase() : c) }));
  }, [sites]);

  // Filtering (client-side)
  const filtered = useMemo(() => {
    return sites.filter(s =>
      (search === "" ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.site_id.toLowerCase().includes(search.toLowerCase()))
      && (!zoneFilter || s.zone === zoneFilter)
      && (!countryFilter || s.country === countryFilter)
    );
  }, [sites, search, zoneFilter, countryFilter]);

  function toUpperIfString(v: unknown) {
    return typeof v === "string" ? v.toUpperCase() : "";
  }

  // Columns definition
  const columns = useMemo<ColumnDef<Site>[]>(() => [
    { accessorKey: "site_id", header: "ID", cell: info => info.getValue() },
    { accessorKey: "name", header: "Nom", cell: info => info.getValue() },
    { accessorKey: "zone", header: "Zone", cell: info => info.getValue() },
    { accessorKey: "country", header: "Pays", cell: info => toUpperIfString(info.getValue()) },
    { accessorKey: "real_typology", header: "Typologie", cell: info => info.getValue() },
    { accessorKey: "is_billed", header: "Facturé", cell: info => info.getValue() ? "Oui" : "Non" },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button size="icon" variant="ghost" onClick={() => handleEdit(row.original)}>
            <Pencil size={16} />
          </Button>
          <Button size="icon" variant="destructive" onClick={() => handleDelete(row.original)}>
            <Trash2 size={16} />
          </Button>
        </div>
      ),
    }
  ], []);

  // Table instance
  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { globalFilter: search }
  });

  function handleDelete(site: Site) {
    if (!window.confirm(`Supprimer ${site.name} ?`)) return;
    deleteSite(site.id)
      .then(() => {
        setSites(sites => sites.filter(s => s.id !== site.id));
        toast.success("Site supprimé !");
      })
      .catch(() => toast.error("Erreur suppression"));
  }

  function handleExcelImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    importSitesExcel(file)
      .then(() => {
        toast.success("Import réussi !");
        loadSites(); // Refresh the list after import
      })
      .catch(() => toast.error("Échec import Excel"))
      .finally(() => setImportLoading(false));
  }

  function handleEdit(site: Site) {
    setEditing(site);
    setModalOpen(true);
  }

  function handleAdd() {
    setEditing(null);
    setModalOpen(true);
  }

  function handleSaved(newSite: Site) {
    setModalOpen(false);
    setEditing(null);
    setSites((oldSites) => {
      const idx = oldSites.findIndex((s) => s.id === newSite.id);
      if (idx >= 0) {
        // update
        const updated = [...oldSites];
        updated[idx] = newSite;
        return updated;
      }
      // add
      return [newSite, ...oldSites];
    });
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4 md:p-8">
      {/* Header Actions */}
      <div className="flex flex-wrap items-center gap-2 mb-6 justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <SearchInput
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Recherche par nom ou ID…"
          />
          <select
            className="rounded-xl px-2 py-1 border border-blue-900 text-blue-900"
            value={zoneFilter || ""}
            onChange={e => setZoneFilter(e.target.value || null)}
          >
            <option value="">Zone</option>
            {ZONES.map(z => (
              <option key={z.value} value={z.value}>{z.label}</option>
            ))}
          </select>
          <select
            className="rounded-xl px-2 py-1 border border-blue-900 text-blue-900"
            value={countryFilter || ""}
            onChange={e => setCountryFilter(e.target.value || null)}
          >
            <option value="">Pays</option>
            {COUNTRIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <label className="inline-flex items-center cursor-pointer">
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleExcelImport}
              hidden
              disabled={importLoading}
            />
            <Button variant="outline" className="gap-2" asChild disabled={importLoading}>
              <span>
                <Upload size={18} />
                {importLoading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin h-4 w-4 mr-1 text-blue-900" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Import…
                  </span>
                ) : (
                  "Importer Excel"
                )}
              </span>
            </Button>
          </label>
          <Button
            onClick={handleAdd}
            className="bg-blue-900 text-white rounded-xl gap-2"
          >
            <Plus size={18} /> Nouveau site
          </Button>
        </div>
      </div>

      <SiteModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSaved={handleSaved}
        initial={editing || undefined}
        mode={editing ? "edit" : "add"}
      />

      {/* Table */}
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
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-12">
                  Chargement…
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-12 text-blue-900">
                  <div className="text-2xl font-semibold mb-2">Aucun site trouvé</div>
                  <div className="opacity-70">Ajoutez un site ou importez un fichier Excel !</div>
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

      {/* Pagination */}
      <div className="flex justify-between items-center mt-6">
        <div className="text-sm opacity-70">
          {filtered.length} sites
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            Précédent
          </Button>
          <span className="px-2 text-sm">
            Page {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            Suivant
          </Button>
        </div>
      </div>
    </div>
  );
}
