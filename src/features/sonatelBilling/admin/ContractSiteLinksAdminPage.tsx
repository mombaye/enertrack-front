import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { Search, UploadCloud, RefreshCw, Link2, ArrowRight } from "lucide-react";
import { importContractLinks, listContractLinks, resolveContract } from "@/features/sonatelBilling/admin/api";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function CardStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-5">
      <div className="text-xs font-semibold tracking-widest text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

export default function ContractSiteLinksAdminPage() {
  const qc = useQueryClient();
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [contract, setContract] = useState("");
  const [resolved, setResolved] = useState<{ contract: string; site_id: string; site_pk: number } | null>(null);

  const q = useQuery({
    queryKey: ["contractLinks", { searchText, page, pageSize }],
    queryFn: () => listContractLinks({ search: searchText, page, page_size: pageSize }),
    placeholderData: (prev) => prev,
  });

  const rows = q.data?.results ?? [];
  const total = q.data?.count ?? 0;

  console.log("Rendered with rows:", rows);

  const onResolve = async () => {
    if (!contract.trim()) return toast.error("Entre un numéro de contrat.");
    try {
      const r = await resolveContract(contract.trim());
      setResolved({ contract: r.numero_compte_contrat, site_id: r.site_id, site_pk: r.site_pk });
      toast.success("Contrat résolu.");
    } catch (e: any) {
      setResolved(null);
      toast.error(e?.response?.data?.detail || "Contrat non mappé.");
    }
  };

  const onImport = async (file: File) => {
    try {
      const res = await importContractLinks(file);
      toast.success(`Import mapping OK (batch_id=${res.batch_id ?? "—"})`);
      await qc.invalidateQueries({ queryKey: ["contractLinks"] });
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Import mapping impossible.");
    }
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CardStat label="TOTAL MAPPINGS" value={String(total)} />
        <CardStat label="PAGE" value={`${page}`} />
        <CardStat label="AFFICHÉS" value={String(rows.length)} />
      </div>

      {/* Resolve card */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="p-5 flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-blue-900 text-white flex items-center justify-center shadow-sm">
            <Link2 className="h-6 w-6" />
          </div>

          <div className="flex-1">
            <div className="text-lg font-semibold text-slate-900">Résoudre un contrat</div>
            <div className="text-sm text-slate-600">
              Tape un numéro de contrat pour vérifier s’il est bien mappé à un site.
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
              <input
                value={contract}
                onChange={(e) => setContract(e.target.value)}
                placeholder="ex: 22001513021"
                className="rounded-2xl border border-slate-200 px-3 py-2 outline-none hover:border-slate-300"
              />
              <button
                onClick={onResolve}
                className="px-4 py-2 rounded-2xl bg-blue-900 text-white font-semibold hover:bg-blue-800 shadow-sm"
              >
                Vérifier
              </button>
            </div>

            {resolved ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-slate-800">
                ✅ Contrat <b>{resolved.contract}</b> → Site <b>{resolved.site_id}</b> (pk={resolved.site_pk})
              </div>
            ) : null}
          </div>

          <div className="hidden md:flex items-center gap-2">
            <label className="px-3 py-2 rounded-2xl border border-slate-200 text-slate-700 hover:border-slate-300 cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImport(f);
                }}
              />
              <span className="inline-flex items-center gap-2 font-semibold">
                <UploadCloud className="h-4 w-4" />
                Import mapping
              </span>
            </label>

            <button
              onClick={() => qc.invalidateQueries({ queryKey: ["contractLinks"] })}
              className="px-3 py-2 rounded-2xl border border-slate-200 text-slate-700 hover:border-slate-300"
            >
              <span className="inline-flex items-center gap-2 font-semibold">
                <RefreshCw className="h-4 w-4" />
                Rafraîchir
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Table + filters */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="p-5 border-b border-slate-200">
          <div className="flex flex-col gap-3">
            <div className="text-lg font-semibold text-slate-900">Contrats ↔ Sites</div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 flex items-center gap-2">
                <Search className="h-4 w-4 text-slate-500" />
                <input
                  value={searchText}
                  onChange={(e) => { setSearchText(e.target.value); setPage(1); }}
                  placeholder="Rechercher (contrat / site)…"
                  className="w-full outline-none text-sm"
                />
              </div>

              <div className="text-sm text-slate-500 flex items-center">
                Format import : Code site, Name, Numéro contrat
              </div>

              <div className="text-sm text-slate-500 flex items-center justify-end">
                {q.isFetching ? "Chargement…" : " "}
              </div>
            </div>
          </div>
        </div>

        <div className="max-h-[62vh] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-slate-400">
                <th className="text-left font-semibold text-slate-700 px-4 py-3">Contrat</th>
                <th className="text-left font-semibold text-slate-700 px-4 py-3">Site</th>
                <th className="text-left font-semibold text-slate-700 px-4 py-3">Nom</th>
                <th className="text-left font-semibold text-slate-700 px-4 py-3">Audit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                
                <tr key={r.site_id} className="border-b border-slate-300 hover:bg-slate-50">
                   
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900 tabular-nums">{r.numero_compte_contrat}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="inline-flex items-center gap-2">
                      <span className="px-2 py-1 rounded-xl bg-blue-50 border border-blue-100 text-blue-900 font-semibold">
                        {r.site_id}
                      </span>
                      <span className="text-xs text-slate-500">pk={r.site_id}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{r.site_name || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <div className="text-xs">last_seen: {r.last_seen_at}</div>
                    <div className="text-xs">file: {r.source_filename || "—"}</div>
                  </td>
                </tr>
              ))}

              {!q.isFetching && rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                    Aucun mapping trouvé.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
          <div className="text-sm text-slate-600">{total} résultat(s)</div>
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
    </div>
  );
}
