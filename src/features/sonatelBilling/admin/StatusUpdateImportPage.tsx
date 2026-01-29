import { useState } from "react";
import { toast } from "react-toastify";
import { importStatusUpdateFile, listBatchIssues } from "@/features/sonatelBilling/api";

export default function StatusUpdateAdminPage() {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [issues, setIssues] = useState<any[]>([]);

  async function onSubmit() {
    if (!file) return toast.error("Choisis un fichier Excel");
    setSubmitting(true);
    setResult(null);
    setIssues([]);
    try {
      const r = await importStatusUpdateFile(file);
      setResult(r);
      toast.success(`Statuts mis à jour: ${r.updated} (skipped: ${r.skipped})`);

      if (r.batch_id) {
        const iss = await listBatchIssues(r.batch_id);
        setIssues(iss);
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Erreur import");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-slate-900">Mise à jour des statuts</h2>
        <p className="text-slate-500 mt-1">Import Excel → update status (Créée / Validée / Contestée) + issues</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-3 items-end">
          <div className="md:col-span-2">
            <label className="text-sm font-semibold text-slate-700">Fichier Excel</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-2 block w-full rounded-2xl border border-slate-200 p-2.5"
            />
            <div className="mt-2 text-xs text-slate-500">
              Colonnes attendues : contrat + facture + date début + date fin + statut.
            </div>
          </div>

          <button
            disabled={submitting}
            onClick={onSubmit}
            className="rounded-2xl bg-blue-900 text-white px-4 py-2.5 font-semibold disabled:opacity-60"
          >
            {submitting ? "Import..." : "Importer"}
          </button>
        </div>
      </div>

      {result ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="font-semibold text-slate-900">Résultat</div>
          <pre className="mt-2 text-xs bg-slate-50 border border-slate-200 rounded-2xl p-3 overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="font-semibold text-slate-900">Issues</div>
        {issues.length === 0 ? (
          <div className="mt-2 text-sm text-slate-500">Aucune issue (ou batch non récupéré).</div>
        ) : (
          <div className="mt-2 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-300">
                <tr>
                  <th className="text-left px-3 py-2">Sev</th>
                  <th className="text-left px-3 py-2">Row</th>
                  <th className="text-left px-3 py-2">Field</th>
                  <th className="text-left px-3 py-2">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {issues.map((it: any) => (
                  <tr key={it.id} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2 font-semibold">{it.severity}</td>
                    <td className="px-3 py-2">{it.row_number ?? "—"}</td>
                    <td className="px-3 py-2">{it.field ?? "—"}</td>
                    <td className="px-3 py-2">{it.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
