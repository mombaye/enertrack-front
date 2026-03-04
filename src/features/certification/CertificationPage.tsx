// src/features/certification/CertificationPage.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck, Wifi, WifiOff, Upload, FileSpreadsheet,
  X, ChevronDown, ChevronRight, Loader2, CheckCircle2,
  AlertTriangle, HelpCircle, RefreshCw, ArrowRight,
  BarChart3, Filter, Zap, Activity, Clock, Check,
  Database, Calendar, FileDown,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  listCertBatches, launchCertification, pollBatchStatus,
  listCertResults, checkEfmsHealth,
} from "@/services/certification";
import type {
  CertificationBatch, CertResultStatus, CertificationResult,
} from "@/services/certification";
import { api } from "@/services/api";
import { toast } from "react-toastify";

// ─── Billing import helper ────────────────────────────────────────────────────
// Utilise le bon endpoint /sonatel-billing/batches/import/ avec echeance obligatoire
async function importBillingFile(
  file: File,
  echeance: string,
): Promise<{
  batch: { id: number; source_filename: string };
  rows_created: number;
  rows_updated: number;
  invoices_missing_site_count: number;
}> {
  const form = new FormData();
  form.append("file", file);
  form.append("echeance", echeance); // YYYY-MM-DD obligatoire
  const { data } = await api.post("/sonatel-billing/batches/import/", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}


// ─── Export Excel ─────────────────────────────────────────────────────────────
function exportResultsToExcel(
  results: CertificationResult[],
  batchLabel: string,
) {
  const STATUS_LABELS: Record<string, string> = {
    CERTIFIED_FMS:        "Certifié FMS",
    CERTIFIED_SENELEC:    "Certifié Sénélec",
    NEEDS_REVIEW:         "À analyser",
    UNKNOWN_CONTRACT:     "Contrat inconnu",
    FMS_UNAVAILABLE:      "FMS indispo",
    PENDING_CERTIFICATION:"En attente",
  };

  const rows = results.map(r => ({
    "N° Facture":           r.numero_facture ?? "",
    "N° Contrat":           r.numero_compte_contrat ?? "",
    "Site ID":              r.site_id ?? "",
    "Site":                 r.site_name ?? "",
    "Début période":        r.date_debut_periode ?? "",
    "Fin période":          r.date_fin_periode ?? "",
    "Nb jours":             r.nb_jours_facturation ?? "",
    "Montant TTC (F)":      r.montant_ttc ? parseFloat(String(r.montant_ttc)) : "",
    "Conso facturée (kWh)": r.conso_facturee_periode ? parseFloat(String(r.conso_facturee_periode)) : "",
    "Conso norm. 30j (kWh)":r.conso_facturee_30j ? parseFloat(String(r.conso_facturee_30j)) : "",
    "FMS dispo":            r.fms_available ? "Oui" : "Non",
    "Conso FMS période":    r.conso_fms_periode ? parseFloat(String(r.conso_fms_periode)) : "",
    "Conso FMS 30j":        r.conso_fms_30j ? parseFloat(String(r.conso_fms_30j)) : "",
    "Dernier mois FMS":     r.fms_last_complete_month ?? "",
    "Ratio FMS/période":    r.ratio_fms_periode ? parseFloat(String(r.ratio_fms_periode)) : "",
    "Ratio FMS/30j":        r.ratio_fms_30j ? parseFloat(String(r.ratio_fms_30j)) : "",
    "Ratio histo 3M":       r.ratio_histo_3mois ? parseFloat(String(r.ratio_histo_3mois)) : "",
    "Statut":               STATUS_LABELS[r.status] ?? r.status,
    "Règle certification":  r.certified_by_rule ?? "",
    "Erreur FMS":           r.fms_error ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // Largeurs de colonnes
  ws["!cols"] = [
    { wch: 20 }, { wch: 20 }, { wch: 14 }, { wch: 28 },
    { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 16 },
    { wch: 20 }, { wch: 22 }, { wch: 10 }, { wch: 18 },
    { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 30 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Résultats");

  // Onglet récap
  const recapData = Object.entries(
    rows.reduce((acc, r) => {
      acc[r["Statut"]] = (acc[r["Statut"]] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([statut, count]) => ({ "Statut": statut, "Nb factures": count }));
  recapData.push({ "Statut": "TOTAL", "Nb factures": rows.length });
  const wsRecap = XLSX.utils.json_to_sheet(recapData);
  wsRecap["!cols"] = [{ wch: 24 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsRecap, "Récapitulatif");

  const filename = `Certification_${batchLabel.replace(/[^a-zA-Z0-9_-]/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: string | number | null, decimals = 0) {
  if (n == null) return "N/A";
  const v = parseFloat(String(n));
  if (isNaN(v)) return "N/A";
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(v);
}
function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
function pct(n: number, t: number) { return t === 0 ? 0 : Math.round((n / t) * 100); }

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = "upload" | "certify" | "results";

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepBar({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "upload",  label: "Import factures" },
    { key: "certify", label: "Certification"   },
    { key: "results", label: "Résultats"       },
  ];
  const idx = steps.findIndex(s => s.key === current);
  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            i < idx  ? "text-emerald-600"
            : i === idx ? "text-blue-900 bg-blue-50 ring-1 ring-blue-900/20"
            : "text-slate-400"
          }`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              i < idx  ? "bg-emerald-500 text-white"
              : i === idx ? "bg-blue-900 text-white"
              : "bg-slate-200 text-slate-400"
            }`}>
              {i < idx ? <Check className="w-3 h-3" /> : i + 1}
            </span>
            {s.label}
          </div>
          {i < steps.length - 1 && (
            <div className={`h-px w-6 mx-1 ${i < idx ? "bg-emerald-300" : "bg-slate-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── eFMS badge ───────────────────────────────────────────────────────────────
function EfmsBadge({ reachable, loading }: { reachable: boolean | undefined; loading: boolean }) {
  if (loading) return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-400">
      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Vérification eFMS...
    </div>
  );
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
      reachable
        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
        : "bg-red-50 border-red-200 text-red-600"
    }`}>
      <span className={`w-2 h-2 rounded-full ${reachable ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
      {reachable
        ? <><Wifi className="w-3.5 h-3.5" /> eFMS connecté</>
        : <><WifiOff className="w-3.5 h-3.5" /> eFMS hors ligne</>}
    </div>
  );
}

// ─── Upload Zone ──────────────────────────────────────────────────────────────
function UploadZone({ onFile }: { onFile: (f: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = useCallback((f: File) => {
    if (!f.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error("Format non supporté — .xlsx, .xls ou .csv uniquement");
      return;
    }
    onFile(f);
  }, [onFile]);

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handle(f); }}
      onClick={() => inputRef.current?.click()}
      className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200 p-12 text-center group ${
        dragging
          ? "border-blue-900 bg-blue-50/60 scale-[1.01]"
          : "border-slate-200 bg-slate-50/50 hover:border-blue-900/40 hover:bg-blue-50/20"
      }`}
    >
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handle(f); }} />
      <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center transition-all ${
        dragging
          ? "bg-blue-900 text-white scale-110"
          : "bg-white border border-slate-200 text-slate-400 group-hover:bg-blue-900 group-hover:text-white group-hover:border-blue-900"
      }`}>
        <FileSpreadsheet className="w-8 h-8" />
      </div>
      <p className="text-slate-700 font-semibold text-base mb-1">
        {dragging ? "Relâchez pour importer" : "Déposer le fichier de factures"}
      </p>
      <p className="text-slate-400 text-sm">ou cliquez pour parcourir — .xlsx, .xls, .csv</p>
    </div>
  );
}

// ─── Certification progress ───────────────────────────────────────────────────
type Counters = {
  total: number;
  certified_fms: number;
  certified_senelec: number;
  needs_review: number;
  unknown_contract: number;
  fms_unavailable: number;
};

function CertProgress({ counters, status }: { counters: Counters; status: string }) {
  const t = counters.total || 1;
  const processed = counters.certified_fms + counters.certified_senelec
    + counters.needs_review + counters.unknown_contract + counters.fms_unavailable;

  // Pourcentage réel depuis le backend
  const targetPct = counters.total > 0 ? pct(processed, t) : 0;

  // Interpolation optimiste : entre deux polls (2500ms), on anime vers targetPct
  const [displayPct, setDisplayPct] = useState(targetPct);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (animRef.current) clearInterval(animRef.current);
    if (status !== "RUNNING" || targetPct === displayPct) {
      setDisplayPct(targetPct);
      return;
    }
    // Avance de ~0.3% toutes les 80ms entre deux polls → animation fluide
    const step = Math.max((targetPct - displayPct) / 30, 0.3);
    animRef.current = setInterval(() => {
      setDisplayPct(prev => {
        const next = Math.min(prev + step, targetPct);
        if (next >= targetPct && animRef.current) {
          clearInterval(animRef.current);
          animRef.current = null;
        }
        return next;
      });
    }, 80);
    return () => { if (animRef.current) clearInterval(animRef.current); };
  }, [targetPct, status]);

  const circumference = 2 * Math.PI * 34;

  const bars = [
    { label: "Certifié FMS",     val: counters.certified_fms,     color: "bg-emerald-500", light: "bg-emerald-50",  text: "text-emerald-700" },
    { label: "Certifié Sénélec", val: counters.certified_senelec, color: "bg-blue-500",    light: "bg-blue-50",     text: "text-blue-700"    },
    { label: "À analyser",       val: counters.needs_review,      color: "bg-amber-400",   light: "bg-amber-50",    text: "text-amber-700"   },
    { label: "Inconnu",          val: counters.unknown_contract,  color: "bg-red-400",     light: "bg-red-50",      text: "text-red-700"     },
    { label: "FMS indispo",      val: counters.fms_unavailable,   color: "bg-slate-300",   light: "bg-slate-50",    text: "text-slate-500"   },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-6">
        {/* Ring — animé via displayPct interpolé */}
        <div className="relative w-20 h-20 shrink-0">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="#e2e8f0" strokeWidth="8" />
            <circle cx="40" cy="40" r="34" fill="none"
              stroke={status === "DONE" ? "#10b981" : "#1e3a8a"}
              strokeWidth="8"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={`${circumference * (1 - displayPct / 100)}`}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 0.15s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold text-slate-800 leading-none">
              {Math.round(displayPct)}%
            </span>
          </div>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {status === "RUNNING" && <Loader2 className="w-4 h-4 animate-spin text-blue-900" />}
            {status === "DONE"    && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            {status === "FAILED"  && <AlertTriangle className="w-4 h-4 text-red-500" />}
            <span className="font-semibold text-slate-800 text-sm">
              {status === "RUNNING" ? "Certification en cours..."
               : status === "DONE" ? "Certification terminée"
               : status === "FAILED" ? "Échec de la certification"
               : status}
            </span>
          </div>
          <p className="text-sm text-slate-400">{processed} / {counters.total} factures traitées</p>
          {/* Stacked bar */}
          <div className="mt-3 h-2.5 rounded-full overflow-hidden bg-slate-100 flex">
            {bars.map((b, i) => b.val > 0 && (
              <div key={i} className={`${b.color} transition-all duration-500 ease-out`}
                style={{ width: `${pct(b.val, t)}%` }} />
            ))}
          </div>
        </div>
      </div>

      {/* Legend grid */}
      <div className="grid grid-cols-5 gap-2">
        {bars.map((b, i) => (
          <div key={i} className={`rounded-xl px-3 py-2.5 text-center ${b.light}`}>
            <div className={`text-xl font-bold ${b.text}`}>{b.val}</div>
            <div className="text-xs text-slate-400 mt-0.5 leading-tight">{b.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  PENDING_CERTIFICATION: { label: "En attente",       color: "text-slate-500",   bg: "bg-slate-50",    border: "border-slate-200"   },
  UNKNOWN_CONTRACT:      { label: "Contrat inconnu",  color: "text-red-600",     bg: "bg-red-50",      border: "border-red-200"     },
  FMS_UNAVAILABLE:       { label: "FMS indispo",      color: "text-orange-500",  bg: "bg-orange-50",   border: "border-orange-200"  },
  CERTIFIED_FMS:         { label: "Certifié FMS",     color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200" },
  CERTIFIED_SENELEC:     { label: "Certifié Sénélec", color: "text-blue-700",    bg: "bg-blue-50",     border: "border-blue-200"    },
  NEEDS_REVIEW:          { label: "À analyser",       color: "text-amber-700",   bg: "bg-amber-50",    border: "border-amber-200"   },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.PENDING_CERTIFICATION;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      {cfg.label}
    </span>
  );
}

function RatioCell({ value, threshold }: { value: string | null; threshold: number }) {
  if (!value) return <span className="text-slate-400 text-xs">N/A</span>;
  const v = parseFloat(value);
  const ok = v >= threshold;
  return (
    <span className={`font-mono text-sm font-bold ${ok ? "text-emerald-600" : "text-red-500"}`}>
      {(v * 100).toFixed(1)}%
      <span className={`ml-1 text-xs font-normal ${ok ? "text-emerald-400" : "text-red-300"}`}>{ok ? "✓" : "✗"}</span>
    </span>
  );
}

function ResultRow({ result }: { result: CertificationResult }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className="border-b border-slate-100 hover:bg-blue-50/20 cursor-pointer transition-colors"
        onClick={() => setOpen(!open)}>
        <td className="px-4 py-3 w-6 text-slate-300">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </td>
        <td className="px-4 py-3">
          <div className="font-mono text-sm text-slate-800 font-medium">{result.numero_facture}</div>
          <div className="text-xs text-slate-400">{result.numero_compte_contrat}</div>
        </td>
        <td className="px-4 py-3">
          <div className="text-sm font-medium text-slate-700">{result.site_id ?? "—"}</div>
          <div className="text-xs text-slate-400 max-w-[140px] truncate">{result.site_name ?? ""}</div>
        </td>
        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
          {fmtDate(result.date_debut_periode)} — {fmtDate(result.date_fin_periode)}
        </td>
        <td className="px-4 py-3 text-right font-mono text-sm text-slate-700">
          {result.montant_ttc ? `${fmt(result.montant_ttc)} F` : "—"}
        </td>
        <td className="px-4 py-3"><StatusBadge status={result.status} /></td>
        <td className="px-4 py-3 text-center">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
            result.fms_available
              ? "bg-emerald-50 text-emerald-600 border-emerald-200"
              : "bg-slate-50 text-slate-400 border-slate-200"
          }`}>
            {result.fms_available ? "Oui" : "Non"}
          </span>
        </td>
      </tr>
      {open && (
        <tr className="bg-blue-50/10 border-b border-blue-100">
          <td colSpan={7} className="px-8 py-5">
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Consommations</div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-slate-400">Période</span><span className="font-medium">{result.conso_facturee_periode ? `${fmt(result.conso_facturee_periode, 1)} kWh` : "N/A"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Normalisé 30j</span><span className="font-medium">{result.conso_facturee_30j ? `${fmt(result.conso_facturee_30j, 1)} kWh` : "N/A"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Jours</span><span className="font-medium">{result.nb_jours_facturation ?? "N/A"}</span></div>
                </div>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Données FMS</div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-slate-400">FMS période</span><span className="font-medium">{result.conso_fms_periode ? `${fmt(result.conso_fms_periode, 1)} kWh` : "N/A"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">FMS 30j</span><span className="font-medium">{result.conso_fms_30j ? `${fmt(result.conso_fms_30j, 1)} kWh` : "N/A"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Dernier mois</span><span className="font-medium">{fmtDate(result.fms_last_complete_month)}</span></div>
                  {result.fms_error && (
                    <div className="text-orange-500 bg-orange-50 border border-orange-200 rounded px-2 py-1 mt-1">{result.fms_error}</div>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Ratios cohérence</div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center"><span className="text-slate-400">FMS / période (&gt;0.9)</span><RatioCell value={result.ratio_fms_periode} threshold={0.9} /></div>
                  <div className="flex justify-between items-center"><span className="text-slate-400">FMS / 30j (&gt;0.9)</span><RatioCell value={result.ratio_fms_30j} threshold={0.9} /></div>
                  <div className="flex justify-between items-center"><span className="text-slate-400">Histo 3M (&gt;0.85)</span><RatioCell value={result.ratio_histo_3mois} threshold={0.85} /></div>
                  {result.certified_by_rule && (
                    <div className="mt-2 text-xs font-semibold text-blue-900 bg-blue-50 border border-blue-200 rounded px-2 py-1">
                      Règle : {result.certified_by_rule}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CertificationPage() {
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>("upload");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{
    batchId: number;
    filename: string;
    rows_created: number;
    rows_updated: number;
    missing_sites: number;
  } | null>(null);
  const [echeance, setEcheance] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pollingBatchId, setPollingBatchId] = useState<number | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  // eFMS health
  const { data: efmsHealth, isLoading: efmsLoading } = useQuery({
    queryKey: ["efms-health"],
    queryFn: checkEfmsHealth,
    refetchInterval: 60000,
    retry: false,
  });

  // Cert batches
  const { data: certBatchesRaw, refetch: refetchBatches } = useQuery({
    queryKey: ["cert-batches"],
    queryFn: () => listCertBatches(),
  });
  const certBatches: CertificationBatch[] = Array.isArray(certBatchesRaw)
    ? certBatchesRaw : (certBatchesRaw as any)?.results ?? [];

  // Poll
  const { data: pollData } = useQuery({
    queryKey: ["cert-batch-status", pollingBatchId],
    queryFn: () => pollBatchStatus(pollingBatchId!),
    enabled: pollingBatchId !== null,
    refetchInterval: (data: any) => {
      if (!data || data.status === "RUNNING" || data.status === "PENDING") return 2500;
      return false;
    },
  });

  useEffect(() => {
    if (pollData?.status === "DONE" || pollData?.status === "FAILED") {
      setPollingBatchId(null);
      qc.invalidateQueries({ queryKey: ["cert-batches"] });
      if (pollData.status === "DONE") {
        toast.success("✓ Certification terminée avec succès");
        setSelectedBatchId(pollData.cert_batch_id);
        setTimeout(() => setStep("results"), 800);
      } else {
        toast.error("Certification échouée");
      }
    }
  }, [pollData]);

  // Results
  const { data: resultsRaw, isLoading: loadingResults } = useQuery({
    queryKey: ["cert-results", selectedBatchId, statusFilter],
    queryFn: () => listCertResults({
      cert_batch: selectedBatchId!,
      status: (statusFilter || undefined) as CertResultStatus,
    }),
    enabled: selectedBatchId !== null,
  });
  const results: CertificationResult[] = Array.isArray(resultsRaw)
    ? resultsRaw : (resultsRaw as any)?.results ?? [];

  // Export state — fetch ALL results (sans filtre) pour l'export complet
  const [isExporting, setIsExporting] = useState(false);
  const handleExport = async () => {
    if (!selectedBatchId || !selectedBatch) return;
    setIsExporting(true);
    try {
      const raw = await listCertResults({ cert_batch: selectedBatchId, page_size: 9999 });
      const all: CertificationResult[] = Array.isArray(raw) ? raw : (raw as any)?.results ?? [];
      const label = selectedBatch.echeance !== "N/A" ? selectedBatch.echeance : `batch-${selectedBatch.id}`;
      exportResultsToExcel(all, label);
      toast.success(`Export Excel — ${all.length} factures`);
    } catch {
      toast.error("Erreur lors de l'export");
    } finally {
      setIsExporting(false);
    }
  };

  // Upload mutation
  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      setUploadProgress(0);
      const interval = setInterval(() =>
        setUploadProgress(p => Math.min(p + 10, 85)), 180);
      try {
        const res = await importBillingFile(file, echeance);
        clearInterval(interval);
        setUploadProgress(100);
        return res;
      } catch (e) {
        clearInterval(interval);
        setUploadProgress(0);
        throw e;
      }
    },
    onSuccess: (data) => {
      setImportResult({
        batchId: data.batch.id,
        filename: data.batch.source_filename,
        rows_created: data.rows_created,
        rows_updated: data.rows_updated,
        missing_sites: data.invoices_missing_site_count,
      });
      setTimeout(() => setStep("certify"), 600);
      const total = data.rows_created + data.rows_updated;
      toast.success(`Import réussi — ${total} factures`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? "Erreur lors de l'import");
    },
  });

  // Launch mutation
  const launchMut = useMutation({
    mutationFn: () => launchCertification(importResult!.batchId),
    onSuccess: (data) => {
      toast.success("Certification lancée !");
      setPollingBatchId(data.cert_batch_id);
      setSelectedBatchId(data.cert_batch_id);
      qc.invalidateQueries({ queryKey: ["cert-batches"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? "Erreur lors du lancement");
    },
  });

  const isRunning = pollingBatchId !== null;
  const activePoll = isRunning ? pollData : null;
  const selectedBatch = certBatches.find(b => b.id === selectedBatchId);

  const STATUS_FILTERS = [
    { val: "", label: "Tous" },
    { val: "CERTIFIED_FMS",     label: "Certifié FMS"    },
    { val: "CERTIFIED_SENELEC", label: "Certifié Sénélec" },
    { val: "NEEDS_REVIEW",      label: "À analyser"      },
    { val: "UNKNOWN_CONTRACT",  label: "Contrat inconnu" },
    { val: "FMS_UNAVAILABLE",   label: "FMS indispo"     },
  ];

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-900 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">Certification Factures</h1>
              <p className="text-xs text-slate-400">Validation automatique Sénélec × FMS</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <EfmsBadge reachable={efmsHealth?.efms_reachable} loading={efmsLoading} />
            <div className="h-4 w-px bg-slate-200" />
            <StepBar current={step} />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8 space-y-6">

        {/* ══════════════ STEP 1 : UPLOAD ══════════════ */}
        {step === "upload" && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
              <div className="flex items-center gap-2 mb-6">
                <Upload className="w-5 h-5 text-blue-900" />
                <h2 className="text-sm font-bold text-slate-900">Importer les factures Sénélec</h2>
              </div>

              {/* Idle upload zone */}
              {!uploadMut.isPending && !uploadMut.isSuccess && (
                <div className="space-y-4">
                  {/* Echeance picker — obligatoire */}
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <Calendar className="w-4 h-4 text-blue-900 shrink-0" />
                    <label className="text-sm font-semibold text-slate-700 shrink-0">
                      Date d'échéance <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={echeance}
                      onChange={e => setEcheance(e.target.value)}
                      className="ml-auto rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 bg-white"
                    />
                  </div>
                  {!echeance && (
                    <p className="text-xs text-amber-600 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> Sélectionnez d'abord la date d'échéance avant de déposer le fichier
                    </p>
                  )}
                  <div className={echeance ? "" : "opacity-50 pointer-events-none"}>
                    <UploadZone onFile={f => { setUploadedFile(f); uploadMut.mutate(f); }} />
                  </div>
                </div>
              )}

              {/* In-progress */}
              {uploadMut.isPending && uploadedFile && (
                <div className="rounded-2xl border border-blue-100 bg-blue-50/30 p-6">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-6 h-6 text-blue-900" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-800 truncate text-sm">{uploadedFile.name}</div>
                      <div className="text-xs text-slate-400">{(uploadedFile.size / 1024).toFixed(0)} KB</div>
                    </div>
                    <Loader2 className="w-4 h-4 animate-spin text-blue-900 shrink-0" />
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-900 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <p className="text-xs text-slate-400 mt-2">Import en cours... {uploadProgress}%</p>
                </div>
              )}

              {/* Success */}
              {uploadMut.isSuccess && importResult && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
                    <Check className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="font-bold text-emerald-800 text-sm">{importResult.filename}</div>
                    <div className="text-xs text-emerald-600">{(importResult.rows_created + importResult.rows_updated)} factures importées · redirection vers la certification...</div>
                  </div>
                </div>
              )}
            </div>

            {/* Historique */}
            {certBatches.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Campagnes précédentes</h3>
                  </div>
                  <button onClick={() => setStep("results")}
                    className="text-xs text-blue-900 font-semibold hover:underline flex items-center gap-1">
                    Voir résultats <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-2">
                  {certBatches.slice(0, 4).map(b => (
                    <button key={b.id}
                      onClick={() => { setSelectedBatchId(b.id); setStep("results"); }}
                      className="w-full text-left flex items-center justify-between px-4 py-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/20 transition-all">
                      <div className="flex items-center gap-3">
                        <Database className="w-4 h-4 text-slate-300" />
                        <span className="text-sm font-medium text-slate-700">
                          {b.echeance !== "N/A" ? b.echeance : `Batch #${b.import_batch}`}
                        </span>
                        <span className="text-xs text-slate-400">{b.total} factures</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
                          b.status === "DONE"    ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                          : b.status === "RUNNING" ? "bg-blue-50 text-blue-700 border-blue-200"
                          : b.status === "FAILED"  ? "bg-red-50 text-red-600 border-red-200"
                          : "bg-slate-50 text-slate-500 border-slate-200"
                        }`}>{b.status}</span>
                        <ChevronRight className="w-4 h-4 text-slate-200" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════ STEP 2 : CERTIFY ══════════════ */}
        {step === "certify" && importResult && (
          <div className="space-y-5">

            {/* Import summary */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-sm font-bold text-slate-900">{importResult.filename}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {(importResult.rows_created + importResult.rows_updated)} factures · Batch #{importResult.batchId}
                    {echeance && <> · <span className="font-semibold text-blue-900">{echeance}</span></>}
                  </p>
                </div>
                {!isRunning && (
                  <button onClick={() => { setStep("upload"); setImportResult(null); setUploadedFile(null); setUploadProgress(0); uploadMut.reset(); setEcheance(""); }}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* eFMS offline warning */}
            {!efmsLoading && !efmsHealth?.efms_reachable && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-amber-800">eFMS hors ligne</div>
                  <div className="text-xs text-amber-600 mt-0.5">
                    La certification sera basée uniquement sur l'historique Sénélec. Les ratios FMS ne seront pas calculés.
                  </div>
                </div>
              </div>
            )}

            {/* Certification card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
              {!isRunning && !(activePoll?.status === "DONE") ? (
                <div className="text-center space-y-5">
                  <div className="w-16 h-16 rounded-2xl bg-blue-900 mx-auto flex items-center justify-center">
                    <ShieldCheck className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-1.5">Lancer la certification</h3>
                    <p className="text-sm text-slate-500 max-w-md mx-auto">
                      Chaque facture sera comparée aux données FMS et à l'historique Sénélec pour déterminer sa conformité.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-6 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Données FMS</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Historique Sénélec</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Analyse manuelle</div>
                  </div>
                  <button
                    onClick={() => launchMut.mutate()}
                    disabled={launchMut.isPending}
                    className="inline-flex items-center gap-2.5 px-8 py-3 bg-blue-900 text-white font-bold text-sm rounded-xl hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-900/20 hover:shadow-blue-900/30 hover:-translate-y-0.5 active:translate-y-0"
                  >
                    {launchMut.isPending
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Lancement...</>
                      : <><Zap className="w-4 h-4" /> Lancer la certification</>}
                  </button>
                </div>
              ) : (
                <CertProgress
                  status={activePoll?.status ?? "RUNNING"}
                  counters={{
                    total: activePoll?.counters?.total ?? (importResult.rows_created + importResult.rows_updated),
                    certified_fms: activePoll?.counters?.certified_fms ?? 0,
                    certified_senelec: activePoll?.counters?.certified_senelec ?? 0,
                    needs_review: activePoll?.counters?.needs_review ?? 0,
                    unknown_contract: activePoll?.counters?.unknown_contract ?? 0,
                    fms_unavailable: activePoll?.counters?.fms_unavailable ?? 0,
                  }}
                />
              )}
            </div>
          </div>
        )}

        {/* ══════════════ STEP 3 : RESULTS ══════════════ */}
        {step === "results" && (
          <div className="space-y-4">

            {/* Batch tabs */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">Campagne :</span>
                  {certBatches.length === 0 ? (
                    <span className="text-xs text-slate-400">Aucune campagne disponible</span>
                  ) : (
                    <div className="flex gap-1.5 flex-wrap">
                      {certBatches.map(b => (
                        <button key={b.id} onClick={() => setSelectedBatchId(b.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            selectedBatchId === b.id
                              ? "bg-blue-900 text-white border-blue-900"
                              : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                          }`}>
                          {b.echeance !== "N/A" ? b.echeance : `#${b.import_batch}`}
                          <span className={`ml-1 ${selectedBatchId === b.id ? "text-blue-300" : "text-slate-400"}`}>
                            ({b.total})
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => refetchBatches()}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setStep("upload")}
                    className="flex items-center gap-1.5 text-xs text-blue-900 font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-50 transition border border-blue-100">
                    <Upload className="w-3.5 h-3.5" /> Nouveau batch
                  </button>
                </div>
              </div>
            </div>

            {!selectedBatchId ? (
              <div className="bg-white rounded-2xl border border-slate-200 min-h-[300px] flex flex-col items-center justify-center p-12 text-center">
                <BarChart3 className="w-10 h-10 text-slate-200 mb-3" />
                <div className="text-slate-500 font-medium text-sm">Sélectionnez une campagne ci-dessus</div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                {/* Batch header */}
                {selectedBatch && (
                  <div className="px-6 py-5 border-b border-slate-100">
                    <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">Échéance {selectedBatch.echeance}</h3>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {selectedBatch.launched_by_username ?? "—"} · {fmtDateTime(selectedBatch.launched_at)}
                          {selectedBatch.finished_at && <> · Fini {fmtDateTime(selectedBatch.finished_at)}</>}
                        </div>
                      </div>
                      <span className={`text-xs px-3 py-1.5 rounded-full font-bold border ${
                        selectedBatch.status === "DONE"    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : selectedBatch.status === "RUNNING" ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-slate-50 text-slate-500 border-slate-200"
                      }`}>{selectedBatch.status}</span>
                    </div>
                    <CertProgress
                      status={selectedBatch.status}
                      counters={{
                        total: selectedBatch.total,
                        certified_fms: selectedBatch.certified_fms,
                        certified_senelec: selectedBatch.certified_senelec,
                        needs_review: selectedBatch.needs_review,
                        unknown_contract: selectedBatch.unknown_contract,
                        fms_unavailable: selectedBatch.fms_unavailable,
                      }}
                    />
                  </div>
                )}

                {/* Filters */}
                <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-2 flex-wrap">
                  <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  {STATUS_FILTERS.map(f => (
                    <button key={f.val} onClick={() => setStatusFilter(f.val)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                        statusFilter === f.val
                          ? "bg-blue-900 text-white border-blue-900"
                          : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                      }`}>
                      {f.label}
                    </button>
                  ))}
                  <div className="ml-auto flex items-center gap-3">
                    <span className="text-xs text-slate-400">{results.length} résultats</span>
                    {selectedBatch?.status === "DONE" && (
                      <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-sm"
                      >
                        {isExporting
                          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Export...</>
                          : <><FileDown className="w-3.5 h-3.5" /> Export Excel</>}
                      </button>
                    )}
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
                  {loadingResults ? (
                    <div className="flex items-center justify-center py-16 text-slate-400 gap-2 text-sm">
                      <Loader2 className="w-5 h-5 animate-spin" /> Chargement...
                    </div>
                  ) : results.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <HelpCircle className="w-7 h-7 mb-2" />
                      <span className="text-sm">Aucun résultat</span>
                    </div>
                  ) : (
                    <table className="w-full text-left">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                          <th className="px-4 py-3 w-6" />
                          <th className="px-4 py-3">Facture</th>
                          <th className="px-4 py-3">Site</th>
                          <th className="px-4 py-3">Période</th>
                          <th className="px-4 py-3 text-right">Montant TTC</th>
                          <th className="px-4 py-3">Statut</th>
                          <th className="px-4 py-3 text-center">FMS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map(r => <ResultRow key={r.id} result={r} />)}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}