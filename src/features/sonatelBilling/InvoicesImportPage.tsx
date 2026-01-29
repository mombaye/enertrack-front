import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { UploadCloud, RefreshCw } from "lucide-react";
import { DataTable, Col } from "@/components/DataTable";
import { cn } from "@/features/sonatelBilling/ui";
import { SeverityPill } from "./admin/ui";
import { getBatchIssues, importInvoices, listBatches, ImportIssue } from "./admin/importApi";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_60px_rgba(2,6,23,0.06)]">
      <div className="text-xs font-semibold tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-extrabold text-slate-900">{value}</div>
    </div>
  );
}

export default function InvoicesImportPage() {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [severity, setSeverity] = useState<string>("");
  const [echeance, setEcheance] = useState<string>("");


  const batchesQ = useQuery({
    queryKey: ["sb-batches", { kind: "SENELEC_INVOICE" }],
    queryFn: () => listBatches({ kind: "SENELEC_INVOICE", page: 1, page_size: 20 }),
  });

  const issuesQ = useQuery({
    enabled: !!selectedBatchId,
    queryKey: ["sb-batch-issues", selectedBatchId, severity],
    queryFn: () => getBatchIssues(selectedBatchId!, severity ? { severity } : undefined),
  });

  const mut = useMutation({
    mutationFn: ({ file, echeance }: { file: File; echeance: string }) => importInvoices(file, echeance),
    onSuccess: (res) => {
      toast.success(`Import OK: +${res.rows_created} / maj ${res.rows_updated} • issues ${res.issues_logged}`);
      setSelectedBatchId(res.batch.id);
      qc.invalidateQueries({ queryKey: ["sb-batches"] });
      qc.invalidateQueries({ queryKey: ["sb-invoices"] });
      qc.invalidateQueries({ queryKey: ["sb-monthly"] });
      qc.invalidateQueries({ queryKey: ["sb-contract-months"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Import échoué"),
  });


  const cols: Col<ImportIssue>[] = useMemo(
    () => [
      { key: "sev", title: "Niveau", render: (r) => <SeverityPill v={r.severity} /> },
      { key: "row", title: "Ligne", render: (r) => r.row_number ?? "—", className: "whitespace-nowrap font-semibold" },
      { key: "field", title: "Champ", render: (r) => r.field || "—", className: "whitespace-nowrap" },
      { key: "msg", title: "Message", render: (r) => <div className="min-w-[420px]">{r.message}</div> },
    ],
    []
  );

  const lastBatches = batchesQ.data?.results ?? [];
  const issues = issuesQ.data ?? [];

  return (
    <div className="space-y-4">
      {/* Upload */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(2,6,23,0.06)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">Import Factures (Excel)</h2>
            <p className="text-slate-500 mt-1">
              Upload du fichier Sonatel → upsert factures + génération synthèse mensuelle + recalcul Contrat×Mois.
            </p>
          </div>

          <button
            onClick={() => batchesQ.refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 font-semibold"
          >
            <RefreshCw className="h-4 w-4" />
            Rafraîchir
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-xs font-semibold text-slate-500">Fichier</div>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mt-2 block w-full text-sm"
            />
            {file ? <div className="mt-2 text-xs text-slate-500">{file.name}</div> : null}
          </label>

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-xs font-semibold text-slate-500">Derniers batches</div>
              <input
                type="date"
                value={echeance}
                onChange={(e) => setEcheance(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 font-semibold"
              />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex items-end">
            <button
                disabled={!file || !echeance || mut.isPending}
                onClick={() => file && echeance && mut.mutate({ file, echeance })}
                className={cn(
                  "w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-extrabold",
                  "bg-blue-900 text-white border border-blue-900",
                  (!file || !echeance || mut.isPending) ? "opacity-50 cursor-not-allowed" : "hover:opacity-95"
                )}
              >
                <UploadCloud className="h-5 w-5" />
                {mut.isPending ? "Import..." : "Importer"}
              </button>

          </div>

         

        </div>

        


        {/* Résultat */}
        {mut.data ? (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-6 gap-3">
            <Stat label="Créées" value={mut.data.rows_created} />
            <Stat label="Mises à jour" value={mut.data.rows_updated} />
            <Stat label="Monthly créées" value={mut.data.monthly_rows_created} />
            <Stat label="Issues" value={mut.data.issues_logged} />
            <Stat label="Missing Site" value={mut.data.invoices_missing_site_count} />
            <Stat label="Contrat×Mois upsert" value={mut.data.contract_months_upserted} />
          </div>
        ) : null}

        {mut.data?.invoices_missing_site_count ? (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <div className="font-semibold">Attention : contrats sans mapping Site</div>
            <div className="text-sm mt-1">
              Exemples: {mut.data.invoices_missing_site_sample?.join(", ") || "—"}
            </div>
          </div>
        ) : null}
      </div>

      {/* Issues */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(2,6,23,0.06)]">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-extrabold text-slate-900">Issues du batch</h3>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 font-semibold"
          >
            <option value="">Tous</option>
            <option value="ERROR">ERROR</option>
            <option value="WARN">WARN</option>
            <option value="INFO">INFO</option>
          </select>
        </div>

        <div className="mt-3">
          <DataTable
            cols={cols}
            rows={issues}
            loading={issuesQ.isLoading}
            emptyText={selectedBatchId ? "Aucune issue" : "Sélectionne un batch pour voir les issues"}
          />
        </div>
      </div>
    </div>
  );
}
