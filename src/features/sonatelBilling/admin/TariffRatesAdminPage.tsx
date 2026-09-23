import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { UploadCloud, RefreshCw, Search, Trash2, CheckCircle2, AlertCircle, FileSpreadsheet } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  deleteTariff,
  importTariffs,
  listTariffs,
  TariffRate,
} from "@/features/sonatelBilling/admin/api";
import { importPaymentStatus, PaymentStatusImportResult } from "@/features/sonatelBilling/api";

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
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-xl p-0 gap-0 rounded-3xl border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <DialogTitle asChild>
            <div className="text-lg font-semibold text-slate-900">Importer les tarifs</div>
          </DialogTitle>
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
      </DialogContent>
    </Dialog>
  );
}

function PaymentStatusImportModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PaymentStatusImportResult | null>(null);

  const reset = () => {
    setFile(null);
    setResult(null);
  };

  const onImport = async () => {
    if (!file) return toast.error("Sélectionne un fichier Excel ou CSV.");
    setLoading(true);
    setResult(null);
    try {
      const res = await importPaymentStatus(file);
      setResult(res);
      toast.success(`${res.updated} facture(s) mise(s) à jour.`);
    } catch (e: any) {
      const detail = e?.response?.data?.detail || "Import impossible.";
      const cols = e?.response?.data?.columns_found;
      toast.error(cols ? `${detail} Colonnes trouvées : ${cols.join(", ")}` : detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) { reset(); onClose(); } }}>
      <DialogContent className="max-w-2xl p-0 gap-0 rounded-3xl border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <DialogTitle asChild>
            <div className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-blue-700" />
              Importer les statuts de paiement
            </div>
          </DialogTitle>
          <div className="text-sm text-slate-600 mt-1">
            Colonnes attendues : <b>Numero de facture</b> (obligatoire) &amp; <b>Statut Paiement</b> (optionnel).
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* File picker */}
          <label className="block">
            <div className="text-sm font-semibold text-slate-700 mb-2">Fichier Excel ou CSV</div>
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); }}
              />
              {file ? (
                <div className="mt-3 text-sm text-slate-700">
                  <span className="font-semibold">Sélectionné :</span> {file.name}
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-500">Choisis un fichier .xlsx / .xls / .csv</div>
              )}
            </div>
          </label>

          {/* Info box */}
          <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-sm text-slate-700 space-y-1">
            <div><b>Mapping automatique du statut de paiement :</b></div>
            <div>• <span className="font-mono text-xs bg-green-100 px-1 rounded">PAID / Payé / Oui</span> → <b>Payée</b></div>
            <div>• <span className="font-mono text-xs bg-red-100 px-1 rounded">OUT_OF_SCOPE / Annulé / N/A</span> → <b>Hors scope</b></div>
            <div>• <span className="font-mono text-xs bg-slate-100 px-1 rounded">vide / absent</span> → <b>Impayée</b> (défaut)</div>
          </div>

          {/* Result */}
          {result && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-700 font-semibold">
                  <CheckCircle2 className="h-4 w-4" /> {result.updated} mis à jour
                </span>
                {result.not_found > 0 && (
                  <span className="flex items-center gap-1 text-amber-700 font-semibold">
                    <AlertCircle className="h-4 w-4" /> {result.not_found} non trouvé(s)
                  </span>
                )}
                <span className="text-slate-500">{result.total_rows} lignes traitées</span>
              </div>
              <div className="text-xs text-slate-500">
                Colonne facture : <b>{result.col_facture}</b>
                {result.col_statut
                  ? <> · Colonne statut : <b>{result.col_statut}</b></>
                  : <> · <span className="text-amber-600">Colonne statut absente → tout mis à <b>IMPAYÉE</b></span></>
                }
              </div>
              {result.rows.length > 0 && (
                <div className="max-h-48 overflow-auto rounded-xl border border-slate-100">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold text-slate-600">Numéro facture</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-600">Statut</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-600">Résultat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row, i) => (
                        <tr key={i} className={cn("border-t border-slate-100", row.action === "not_found" && "bg-amber-50")}>
                          <td className="px-3 py-1.5 font-mono">{row.numero_facture}</td>
                          <td className="px-3 py-1.5">{row.payment_status}</td>
                          <td className="px-3 py-1.5">
                            {row.action === "updated"
                              ? <span className="text-green-700">✓ mis à jour</span>
                              : <span className="text-amber-700">⚠ non trouvé</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            onClick={() => { reset(); onClose(); }}
            className="px-4 py-2 rounded-2xl border border-slate-200 text-slate-700 hover:border-slate-300"
          >
            Fermer
          </button>
          {!result && (
            <button
              disabled={loading || !file}
              onClick={onImport}
              className="px-4 py-2 rounded-2xl bg-blue-900 text-white font-semibold shadow-sm hover:bg-blue-800 disabled:opacity-60"
            >
              {loading ? "Import en cours…" : "Importer"}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TariffRatesAdminPage() {
  const qc = useQueryClient();
  const [searchText, setSearchText] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [importOpen, setImportOpen] = useState(false);
  const [paymentImportOpen, setPaymentImportOpen] = useState(false);

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

      {/* Payment status import section */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="p-5 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-4 justify-between">
            <div>
              <div className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-blue-700" />
                Statuts de paiement
              </div>
              <div className="text-sm text-slate-600 mt-0.5">
                Importe un fichier avec <b>Numero de facture</b> pour mettre à jour le statut de paiement des factures Sonatel.
                Si la colonne statut est absente, toutes les factures sont marquées <b>Impayées</b>.
              </div>
            </div>
            <button
              onClick={() => setPaymentImportOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-blue-900 text-white font-semibold shadow-sm hover:bg-blue-800 shrink-0"
            >
              <UploadCloud className="h-4 w-4" />
              Importer les statuts
            </button>
          </div>

          <div className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3 text-xs text-slate-600 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
              <b>PAID</b> — valeurs : PAID, Payé, Oui, Yes
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-slate-400" />
              <b>UNPAID</b> — vide ou absent (défaut)
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-red-400" />
              <b>OUT_OF_SCOPE</b> — Annulé, N/A
            </div>
          </div>
        </div>
      </div>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={() => qc.invalidateQueries({ queryKey: ["tariffs"] })}
      />

      <PaymentStatusImportModal
        open={paymentImportOpen}
        onClose={() => setPaymentImportOpen(false)}
      />
    </div>
  );
}
