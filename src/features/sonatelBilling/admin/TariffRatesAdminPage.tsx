import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { Plus, UploadCloud, RefreshCw, Search, Pencil, Trash2, MoreVertical } from "lucide-react";
import {
  createTariff,
  deleteTariff,
  importTariffs,
  listTariffs,
  TariffRate,
  updateTariff,
} from "@/features/sonatelBilling/admin/api";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function money(v?: string | null) {
  if (!v) return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return v;
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function CardStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-5">
      <div className="text-xs font-semibold tracking-widest text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function ImportModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const onImport = async () => {
    if (!file) return toast.error("Sélectionne un fichier Excel.");
    setLoading(true);
    try {
      const res = await importTariffs(file);
      toast.success(`Import terminé (created=${res.created}, updated=${res.updated}, skipped=${res.skipped})`);
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Import impossible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/35" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-3xl bg-white border border-slate-200 shadow-2xl">
        <div className="p-6 border-b border-slate-200">
          <div className="text-lg font-semibold text-slate-900">Importer les tarifs</div>
          <div className="text-sm text-slate-600 mt-1">
            Format attendu (ton fichier) : Categori, Heures Hors Pointe, Heures de Pointe, Prime Fixe, Date debut, Date Fin.
          </div>
        </div>

        <div className="p-6 space-y-4">
          <label className="block">
            <div className="text-sm font-semibold text-slate-700 mb-2">Fichier Excel</div>
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              {file ? (
                <div className="mt-3 text-sm text-slate-700">
                  <span className="font-semibold">Sélectionné :</span> {file.name}
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-500">Choisis un fichier .xlsx/.xls</div>
              )}
            </div>
          </label>

          <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 text-sm text-slate-700">
            💡 Conseil : si tu utilises <b>99/99/9999</b> en Date Fin, assure-toi que le backend le convertit en <b>9999-12-31</b>
            (je te donne le patch juste après).
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-2xl border border-slate-200 text-slate-700 hover:border-slate-300"
          >
            Annuler
          </button>
          <button
            disabled={loading}
            onClick={onImport}
            className="px-4 py-2 rounded-2xl bg-blue-900 text-white font-semibold shadow-sm hover:bg-blue-800 disabled:opacity-60"
          >
            {loading ? "Import..." : "Importer"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TariffRatesAdminPage() {
  const qc = useQueryClient();
  const [searchText, setSearchText] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [importOpen, setImportOpen] = useState(false);

  const queryKey = ["tariffs", { searchText, category, page, pageSize }];

  const q = useQuery({
    queryKey,
    queryFn: () => listTariffs({ search: searchText, category, page, page_size: pageSize }),
    placeholderData: (prev) => prev,
  });

  const rows = q.data?.results ?? [];
  const total = q.data?.count ?? 0;

  const categories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.category));
    return Array.from(set).sort();
  }, [rows]);

  const delMut = useMutation({
    mutationFn: (id: number) => deleteTariff(id),
    onSuccess: async () => {
      toast.success("Tarif supprimé.");
      await qc.invalidateQueries({ queryKey: ["tariffs"] });
    },
    onError: () => toast.error("Suppression impossible."),
  });

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CardStat label="TOTAL TARIFS" value={String(total)} />
        <CardStat label="PAGE" value={`${page}`} />
        <CardStat label="AFFICHÉS" value={String(rows.length)} />
      </div>

      {/* Toolbar */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="min-w-0">
              <div className="text-lg font-semibold text-slate-900">Tarifs</div>
              <div className="text-sm text-slate-600">
                Référence de calcul : Heures Hors Pointe (K1), Heures de Pointe (K2), Prime Fixe, période.
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setImportOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-blue-900 text-white font-semibold shadow-sm hover:bg-blue-800"
              >
                <UploadCloud className="h-4 w-4" />
                Importer
              </button>
              <button
                onClick={() => qc.invalidateQueries({ queryKey: ["tariffs"] })}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl border border-slate-200 text-slate-700 hover:border-slate-300"
              >
                <RefreshCw className="h-4 w-4" />
                Rafraîchir
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 flex items-center gap-2">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                value={searchText}
                onChange={(e) => { setSearchText(e.target.value); setPage(1); }}
                placeholder="Rechercher (catégorie)…"
                className="w-full outline-none text-sm"
              />
            </div>

            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1); }}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none hover:border-slate-300"
            >
              <option value="">Toutes catégories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <div className="text-sm text-slate-500 flex items-center justify-end">
              {q.isFetching ? "Chargement…" : " "}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="max-h-[62vh] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-slate-400">
                <th className="text-left font-semibold text-slate-700 px-4 py-3">Catégorie</th>
                <th className="text-left font-semibold text-slate-700 px-4 py-3">Période</th>
                <th className="text-right font-semibold text-slate-700 px-4 py-3">Hors Pointe (K1)</th>
                <th className="text-right font-semibold text-slate-700 px-4 py-3">Pointe (K2)</th>
                <th className="text-right font-semibold text-slate-700 px-4 py-3">Prime fixe</th>
                <th className="text-left font-semibold text-slate-700 px-4 py-3">Audit</th>
                <th className="w-[60px] px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-300 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{r.category}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {r.date_debut} → {r.date_fin}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(r.energie_k1)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(r.energie_k2)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(r.prime_fixe)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <div className="text-xs">last_seen: {r.last_seen_at || "—"}</div>
                    <div className="text-xs">batch: {r.last_seen_batch ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => delMut.mutate(r.id)}
                      className="inline-flex items-center justify-center h-9 w-9 rounded-2xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4 text-slate-700" />
                    </button>
                  </td>
                </tr>
              ))}

              {!q.isFetching && rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    Aucun tarif trouvé.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            {total} résultat(s)
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-2 rounded-2xl border border-slate-200 text-slate-700 disabled:opacity-50 hover:border-slate-300"
            >
              Précédent
            </button>
            <button
              disabled={page * pageSize >= total}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-2 rounded-2xl border border-slate-200 text-slate-700 disabled:opacity-50 hover:border-slate-300"
            >
              Suivant
            </button>
          </div>
        </div>
      </div>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={() => qc.invalidateQueries({ queryKey: ["tariffs"] })}
      />
    </div>
  );
}
