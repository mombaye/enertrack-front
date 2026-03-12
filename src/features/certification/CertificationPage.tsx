// src/features/certification/CertificationPage.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck, Wifi, WifiOff, Upload, FileSpreadsheet,
  X, ChevronDown, ChevronRight, Loader2, CheckCircle2,
  AlertTriangle, HelpCircle, RefreshCw, ArrowRight,
  BarChart3, Filter, Zap, Clock, Check,
  Database, Calendar, FileDown, Cpu, Receipt, Activity,
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

async function importBillingFile(file: File, echeance: string) {
  const form = new FormData();
  form.append("file", file);
  form.append("echeance", echeance);
  const { data } = await api.post("/sonatel-billing/batches/import/", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data as {
    batch: { id: number; source_filename: string };
    rows_created: number; rows_updated: number; invoices_missing_site_count: number;
  };
}

const STATUS_LABELS: Record<string, string> = {
  CERTIFIED_FMS: "Certifié FMS", CERTIFIED_SENELEC: "Certifié Sénélec",
  NEEDS_REVIEW: "À analyser", UNKNOWN_CONTRACT: "Contrat inconnu",
  FMS_UNAVAILABLE: "FMS indispo", PENDING_CERTIFICATION: "En attente",
};

// ✅ Labels complets ACM + Grid
const RULE_LABELS: Record<string, string> = {
  FMS_PERIODE: "Grid · Période",
  FMS_30J:     "Grid · 30j",
  ACM_PERIODE: "ACM · Période",
  ACM_30J:     "ACM · 30j",
  HISTO_3MOIS: "Histo 3 mois",
};

// ✅ Couleur du badge selon la règle
const RULE_BADGE_CLASS: Record<string, string> = {
  ACM_PERIODE: "bg-emerald-50 border-emerald-200 text-emerald-800",
  ACM_30J:     "bg-emerald-50 border-emerald-200 text-emerald-800",
  FMS_PERIODE: "bg-blue-50   border-blue-200   text-blue-800",
  FMS_30J:     "bg-blue-50   border-blue-200   text-blue-800",
  HISTO_3MOIS: "bg-purple-50 border-purple-200 text-purple-800",
};

// ✅ Source FMS courte pour la colonne du tableau
function getSourceLabel(r: CertificationResult): { label: string; cls: string } {
  if (r.acm_available)  return { label: "ACM",  cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (r.fms_available)  return { label: "Grid", cls: "bg-blue-50   text-blue-700   border-blue-200" };
  return { label: "—", cls: "bg-slate-50 text-slate-400 border-slate-200" };
}

// ✅ Export Excel — colonne "Source eFMS" ajoutée
function exportResultsToExcel(results: CertificationResult[], batchLabel: string) {
  const rows = results.map(r => {
    const src = r.acm_available ? "ACM" : r.fms_available ? "Grid" : "Indisponible";
    return {
      "N° Facture": r.numero_facture ?? "",
      "N° Contrat": r.numero_compte_contrat ?? "",
      "Site ID": r.site_id ?? "", "Site": r.site_name ?? "",
      "Début période": r.date_debut_periode ?? "", "Fin période": r.date_fin_periode ?? "",
      "Nb jours": r.nb_jours_facturation ?? "",
      "Montant TTC (F)": r.montant_ttc ? parseFloat(String(r.montant_ttc)) : "",
      "Montant HTVA facturé": r.montant_hors_tva ? parseFloat(String(r.montant_hors_tva)) : "",
      "Conso facturée (kWh)": r.conso_facturee_periode ? parseFloat(String(r.conso_facturee_periode)) : "",
      "Conso norm. 30j (kWh)": r.conso_facturee_30j ? parseFloat(String(r.conso_facturee_30j)) : "",
      // ✅ Source eFMS en premier pour la lisibilité audit
      "Source eFMS": src,
      "ACM dispo": r.acm_available ? "Oui" : "Non",
      "Estim ACM période": r.estim_conso_acm_periode ? parseFloat(String(r.estim_conso_acm_periode)) : "",
      "Estim ACM 30j": r.estim_conso_acm_30j ? parseFloat(String(r.estim_conso_acm_30j)) : "",
      "Ratio ACM/période": r.ratio_acm_periode ? parseFloat(String(r.ratio_acm_periode)) : "",
      "Ratio ACM/30j": r.ratio_acm_30j ? parseFloat(String(r.ratio_acm_30j)) : "",
      "FMS Grid dispo": r.fms_available ? "Oui" : "Non",
      "Conso FMS période": r.conso_fms_periode ? parseFloat(String(r.conso_fms_periode)) : "",
      "Conso FMS 30j": r.conso_fms_30j ? parseFloat(String(r.conso_fms_30j)) : "",
      "Ratio FMS/période": r.ratio_fms_periode ? parseFloat(String(r.ratio_fms_periode)) : "",
      "Ratio FMS/30j": r.ratio_fms_30j ? parseFloat(String(r.ratio_fms_30j)) : "",
      "HTVA recalculé (F)": r.montant_htva_calcule ? parseFloat(String(r.montant_htva_calcule)) : "",
      "Variation montant (%)": r.variation_montant_pct ? parseFloat(String(r.variation_montant_pct)) : "",
      "Montant cohérent": r.montant_coherent === null ? "" : r.montant_coherent ? "Oui" : "Non",
      "Histo 3M avg": r.histo_3mois_avg ? parseFloat(String(r.histo_3mois_avg)) : "",
      "Ratio Histo 3M": r.ratio_histo_3mois ? parseFloat(String(r.ratio_histo_3mois)) : "",
      "Statut": STATUS_LABELS[r.status] ?? r.status,
      "Règle": r.certified_by_rule ? (RULE_LABELS[r.certified_by_rule] ?? r.certified_by_rule) : "",
      "Erreur FMS": r.fms_error ?? "", "Erreur ACM": r.acm_error ?? "",
      "Erreur montant": r.montant_check_error ?? "",
    };
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = Array(Object.keys(rows[0] ?? {}).length).fill({ wch: 20 });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Résultats");
  const recapData = Object.entries(
    rows.reduce((acc, r) => { acc[r["Statut"]] = (acc[r["Statut"]] || 0) + 1; return acc; }, {} as Record<string, number>)
  ).map(([statut, count]) => ({ "Statut": statut, "Nb factures": count }));
  // ✅ Ventilation ACM vs Grid dans le récap
  const nbAcm  = rows.filter(r => r["Source eFMS"] === "ACM").length;
  const nbGrid = rows.filter(r => r["Source eFMS"] === "Grid").length;
  recapData.push({ "Statut": "  dont ACM",  "Nb factures": nbAcm });
  recapData.push({ "Statut": "  dont Grid", "Nb factures": nbGrid });
  recapData.push({ "Statut": "TOTAL", "Nb factures": rows.length });
  const wsRecap = XLSX.utils.json_to_sheet(recapData);
  wsRecap["!cols"] = [{ wch: 24 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsRecap, "Récapitulatif");
  XLSX.writeFile(wb, `Certification_${batchLabel.replace(/[^a-zA-Z0-9_-]/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function fmt(n: string | number | null, decimals = 0) {
  if (n == null) return "N/A";
  const v = parseFloat(String(n));
  if (isNaN(v)) return "N/A";
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);
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

type Step = "upload" | "certify" | "results";

function StepBar({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "Import factures" },
    { key: "certify", label: "Certification" },
    { key: "results", label: "Résultats" },
  ];
  const idx = steps.findIndex(s => s.key === current);
  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${i < idx ? "text-emerald-600" : i === idx ? "text-blue-900 bg-blue-50 ring-1 ring-blue-900/20" : "text-slate-400"}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i < idx ? "bg-emerald-500 text-white" : i === idx ? "bg-blue-900 text-white" : "bg-slate-200 text-slate-400"}`}>
              {i < idx ? <Check className="w-3 h-3" /> : i + 1}
            </span>
            {s.label}
          </div>
          {i < steps.length - 1 && <div className={`h-px w-6 mx-1 ${i < idx ? "bg-emerald-300" : "bg-slate-200"}`} />}
        </div>
      ))}
    </div>
  );
}

function EfmsBadge({ reachable, loading }: { reachable: boolean | undefined; loading: boolean }) {
  if (loading) return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-400">
      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Vérification eFMS...
    </div>
  );
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${reachable ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-600"}`}>
      <span className={`w-2 h-2 rounded-full ${reachable ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
      {reachable ? <><Wifi className="w-3.5 h-3.5" /> eFMS connecté</> : <><WifiOff className="w-3.5 h-3.5" /> eFMS hors ligne</>}
    </div>
  );
}

function UploadZone({ onFile }: { onFile: (f: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const handle = useCallback((f: File) => {
    if (!f.name.match(/\.(xlsx|xls|csv)$/i)) { toast.error("Format non supporté"); return; }
    onFile(f);
  }, [onFile]);
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handle(f); }}
      onClick={() => inputRef.current?.click()}
      className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200 p-12 text-center group ${dragging ? "border-blue-900 bg-blue-50/60 scale-[1.01]" : "border-slate-200 bg-slate-50/50 hover:border-blue-900/40 hover:bg-blue-50/20"}`}
    >
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handle(f); }} />
      <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center transition-all ${dragging ? "bg-blue-900 text-white scale-110" : "bg-white border border-slate-200 text-slate-400 group-hover:bg-blue-900 group-hover:text-white group-hover:border-blue-900"}`}>
        <FileSpreadsheet className="w-8 h-8" />
      </div>
      <p className="text-slate-700 font-semibold text-base mb-1">{dragging ? "Relâchez pour importer" : "Déposer le fichier de factures"}</p>
      <p className="text-slate-400 text-sm">ou cliquez pour parcourir — .xlsx, .xls, .csv</p>
    </div>
  );
}

type Counters = { total: number; certified_fms: number; certified_senelec: number; needs_review: number; unknown_contract: number; fms_unavailable: number; };

function CertProgress({ counters, status }: { counters: Counters; status: string }) {
  const t = counters.total || 1;
  const processed = counters.certified_fms + counters.certified_senelec + counters.needs_review + counters.unknown_contract + counters.fms_unavailable;
  const targetPct = counters.total > 0 ? pct(processed, t) : 0;
  const [displayPct, setDisplayPct] = useState(targetPct);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (animRef.current) clearInterval(animRef.current);
    if (status !== "RUNNING" || targetPct === displayPct) { setDisplayPct(targetPct); return; }
    const step = Math.max((targetPct - displayPct) / 30, 0.3);
    animRef.current = setInterval(() => {
      setDisplayPct(prev => { const next = Math.min(prev + step, targetPct); if (next >= targetPct && animRef.current) { clearInterval(animRef.current); animRef.current = null; } return next; });
    }, 80);
    return () => { if (animRef.current) clearInterval(animRef.current); };
  }, [targetPct, status]);
  const circumference = 2 * Math.PI * 34;
  const bars = [
    { label: "Certifié FMS", val: counters.certified_fms, color: "bg-emerald-500", light: "bg-emerald-50", text: "text-emerald-700" },
    { label: "Certifié Sénélec", val: counters.certified_senelec, color: "bg-blue-500", light: "bg-blue-50", text: "text-blue-700" },
    { label: "À analyser", val: counters.needs_review, color: "bg-amber-400", light: "bg-amber-50", text: "text-amber-700" },
    { label: "Inconnu", val: counters.unknown_contract, color: "bg-red-400", light: "bg-red-50", text: "text-red-700" },
    { label: "FMS indispo", val: counters.fms_unavailable, color: "bg-slate-300", light: "bg-slate-50", text: "text-slate-500" },
  ];
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-6">
        <div className="relative w-20 h-20 shrink-0">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="#e2e8f0" strokeWidth="8" />
            <circle cx="40" cy="40" r="34" fill="none" stroke={status === "DONE" ? "#10b981" : "#1e3a8a"} strokeWidth="8" strokeDasharray={`${circumference}`} strokeDashoffset={`${circumference * (1 - displayPct / 100)}`} strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.15s linear" }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold text-slate-800 leading-none">{Math.round(displayPct)}%</span>
          </div>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {status === "RUNNING" && <Loader2 className="w-4 h-4 animate-spin text-blue-900" />}
            {status === "DONE" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            {status === "FAILED" && <AlertTriangle className="w-4 h-4 text-red-500" />}
            <span className="font-semibold text-slate-800 text-sm">
              {status === "RUNNING" ? "Certification en cours..." : status === "DONE" ? "Certification terminée" : status === "FAILED" ? "Échec" : status}
            </span>
          </div>
          <p className="text-sm text-slate-400">{processed} / {counters.total} factures traitées</p>
          <div className="mt-3 h-2.5 rounded-full overflow-hidden bg-slate-100 flex">
            {bars.map((b, i) => b.val > 0 && <div key={i} className={`${b.color} transition-all duration-500 ease-out`} style={{ width: `${pct(b.val, t)}%` }} />)}
          </div>
        </div>
      </div>
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

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  PENDING_CERTIFICATION: { label: "En attente", color: "text-slate-500", bg: "bg-slate-50", border: "border-slate-200" },
  UNKNOWN_CONTRACT: { label: "Contrat inconnu", color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
  FMS_UNAVAILABLE: { label: "FMS indispo", color: "text-orange-500", bg: "bg-orange-50", border: "border-orange-200" },
  CERTIFIED_FMS: { label: "Certifié FMS", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  CERTIFIED_SENELEC: { label: "Certifié Sénélec", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
  NEEDS_REVIEW: { label: "À analyser", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.PENDING_CERTIFICATION;
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color} ${cfg.bg} ${cfg.border}`}>{cfg.label}</span>;
}

function RatioCell({ value, threshold }: { value: string | null; threshold: number }) {
  if (!value) return <span className="text-slate-400 text-xs">N/A</span>;
  const v = parseFloat(value);
  const ok = v >= threshold;
  return (
    <span className={`font-mono text-sm font-bold ${ok ? "text-emerald-600" : "text-slate-500"}`}>
      {(v * 100).toFixed(1)}%
      <span className={`ml-1 text-xs font-normal ${ok ? "text-emerald-400" : "text-slate-300"}`}>{ok ? "✓" : "✗"}</span>
    </span>
  );
}

function MontantBadge({ coherent, variation }: { coherent: boolean | null; variation: string | null }) {
  if (coherent === null) return <span className="text-slate-400 text-xs">—</span>;
  const v = variation ? parseFloat(variation) : null;
  const sign = v !== null ? (v > 0 ? "+" : "") : "";
  return coherent ? (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
      <Check className="w-3 h-3" />{v !== null ? `${sign}${v.toFixed(1)}%` : "OK"}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
      <AlertTriangle className="w-3 h-3" />{v !== null ? `${sign}${v.toFixed(1)}%` : "NOK"}
    </span>
  );
}

function Sect({ title, icon, children, highlight }: { title: string; icon: React.ReactNode; children: React.ReactNode; highlight?: "acm" | "grid" | "none" }) {
  const ring = highlight === "acm"
    ? "ring-1 ring-emerald-200 bg-emerald-50/30"
    : highlight === "grid"
    ? "ring-1 ring-blue-200 bg-blue-50/30"
    : "bg-white";
  return (
    <div className={`rounded-xl border border-slate-100 p-4 ${ring}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-slate-400">{icon}</span>
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</span>
        {highlight === "acm"  && <span className="ml-auto text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full">Source principale</span>}
        {highlight === "grid" && <span className="ml-auto text-xs font-bold text-blue-700 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full">Fallback</span>}
      </div>
      <div className="space-y-2 text-xs">{children}</div>
    </div>
  );
}

function DR({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-slate-400 shrink-0">{label}</span>
      <span className="font-medium text-right">{children}</span>
    </div>
  );
}

function ResultRow({ result }: { result: CertificationResult }) {
  const [open, setOpen] = useState(false);

  // ✅ Dériver quelle source a été utilisée
  const acmUsed  = result.acm_available;
  const gridUsed = !result.acm_available && result.fms_available;
  const src = getSourceLabel(result);

  return (
    <>
      <tr className="border-b border-slate-100 hover:bg-blue-50/20 cursor-pointer transition-colors" onClick={() => setOpen(!open)}>
        <td className="px-4 py-3 w-6 text-slate-300">{open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</td>
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
          <MontantBadge coherent={result.montant_coherent} variation={result.variation_montant_pct} />
        </td>
        {/* ✅ Colonne "Source" remplace "FMS" — distingue ACM / Grid / — */}
        <td className="px-4 py-3 text-center">
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${src.cls}`}>
            {src.label}
          </span>
        </td>
      </tr>

      {open && (
        <tr className="bg-slate-50/60 border-b border-blue-100">
          <td colSpan={8} className="px-6 py-5">
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">

              {/* Section 1 : Consommations — inchangée */}
              <Sect title="Consommations" icon={<Activity className="w-3.5 h-3.5" />}>
                <DR label="Conso période">{result.conso_facturee_periode ? `${fmt(result.conso_facturee_periode, 1)} kWh` : "N/A"}</DR>
                <DR label="Normalisé 30j">{result.conso_facturee_30j ? `${fmt(result.conso_facturee_30j, 1)} kWh` : "N/A"}</DR>
                <DR label="Nb jours">{result.nb_jours_facturation ?? "N/A"}</DR>
                <div className="border-t border-slate-100 pt-2 mt-1">
                  <DR label="Histo dernier">{result.histo_last_conso ? `${fmt(result.histo_last_conso, 1)} kWh` : "N/A"}</DR>
                  <DR label="Histo 3M avg">{result.histo_3mois_avg ? `${fmt(result.histo_3mois_avg, 1)} kWh` : "N/A"}</DR>
                </div>
              </Sect>

              {/* ✅ Section 2 : ACM (source PRIMAIRE) */}
              <Sect
                title="AC Power Meter"
                icon={<Cpu className="w-3.5 h-3.5" />}
                highlight={acmUsed ? "acm" : "none"}
              >
                {!result.fms_available && !result.acm_available ? (
                  // Ni ACM ni Grid disponibles
                  <p className="text-slate-400 italic">Aucune donnée eFMS disponible pour ce site</p>
                ) : acmUsed ? (
                  // ACM disponible et utilisé comme source principale
                  <>
                    <DR label="Conso période">{result.estim_conso_acm_periode ? `${fmt(result.estim_conso_acm_periode, 1)} kWh` : "N/A"}</DR>
                    <DR label="Conso 30j">{result.estim_conso_acm_30j ? `${fmt(result.estim_conso_acm_30j, 1)} kWh` : "N/A"}</DR>
                    <div className="border-t border-slate-100 pt-2 mt-1">
                      <DR label="Ratio période"><RatioCell value={result.ratio_acm_periode} threshold={0.9} /></DR>
                      <DR label="Ratio 30j"><RatioCell value={result.ratio_acm_30j} threshold={0.9} /></DR>
                    </div>
                    {result.acm_error && (
                      <div className="text-orange-600 bg-orange-50 border border-orange-200 rounded px-2 py-1 mt-1">{result.acm_error}</div>
                    )}
                  </>
                ) : (
                  // ACM absent → Grid utilisé à la place
                  <p className="text-slate-400 italic">Indisponible — Grid utilisé en fallback</p>
                )}
              </Sect>

              {/* ✅ Section 3 : Grid (source SECONDAIRE / fallback) */}
              <Sect
                title="FMS Grid"
                icon={<Database className="w-3.5 h-3.5" />}
                highlight={gridUsed ? "grid" : "none"}
              >
                {!result.fms_available && !result.acm_available ? (
                  <p className="text-slate-400 italic">Indisponible</p>
                ) : acmUsed ? (
                  // Grid non requis car ACM pris en priorité
                  <p className="text-slate-400 italic">Non requis — ACM disponible en source principale</p>
                ) : (
                  // Grid utilisé comme fallback
                  <>
                    <DR label="Conso période">{result.conso_fms_periode ? `${fmt(result.conso_fms_periode, 1)} kWh` : "N/A"}</DR>
                    <DR label="Conso 30j">{result.conso_fms_30j ? `${fmt(result.conso_fms_30j, 1)} kWh` : "N/A"}</DR>
                    <DR label="Dernier mois">{fmtDate(result.fms_last_complete_month)}</DR>
                    <div className="border-t border-slate-100 pt-2 mt-1">
                      <DR label="Ratio période"><RatioCell value={result.ratio_fms_periode} threshold={0.9} /></DR>
                      <DR label="Ratio 30j"><RatioCell value={result.ratio_fms_30j} threshold={0.9} /></DR>
                      <DR label="Ratio Histo 3M"><RatioCell value={result.ratio_histo_3mois} threshold={0.85} /></DR>
                    </div>
                    {result.fms_error && (
                      <div className="text-orange-600 bg-orange-50 border border-orange-200 rounded px-2 py-1 mt-1">{result.fms_error}</div>
                    )}
                  </>
                )}
              </Sect>

              {/* Section 4 : Cohérence montant — inchangée */}
              <Sect title="Cohérence Montant" icon={<Receipt className="w-3.5 h-3.5" />}>
                <DR label="HTVA facturé">{result.montant_hors_tva ? `${fmt(result.montant_hors_tva)} F` : "N/A"}</DR>
                <DR label="HTVA recalculé">{result.montant_htva_calcule ? `${fmt(result.montant_htva_calcule)} F` : "N/A"}</DR>
                {result.variation_montant_pct != null && (
                  <DR label="Variation">
                    <span className={`font-mono font-bold ${result.montant_coherent ? "text-emerald-600" : result.montant_coherent === false ? "text-red-600" : "text-slate-500"}`}>
                      {parseFloat(result.variation_montant_pct) >= 0 ? "+" : ""}{parseFloat(result.variation_montant_pct).toFixed(2)}%
                    </span>
                  </DR>
                )}
                <div className="pt-1">
                  <DR label="Résultat">
                    {result.montant_coherent === null ? (
                      <span className="text-slate-400">Non calculé</span>
                    ) : result.montant_coherent ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold"><CheckCircle2 className="w-3.5 h-3.5" /> Cohérent ≤7%</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-600 font-semibold"><AlertTriangle className="w-3.5 h-3.5" /> Incohérent &gt;7%</span>
                    )}
                  </DR>
                </div>
                {result.montant_check_error && (
                  <div className="text-orange-600 bg-orange-50 border border-orange-200 rounded px-2 py-1 mt-1">{result.montant_check_error}</div>
                )}
              </Sect>
            </div>

            {/* ✅ Badge "Certifié par" avec couleur selon source */}
            {result.certified_by_rule && (
              <div className="mt-3 flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-900" />
                <span className="text-xs font-bold text-blue-900">Certifié par :</span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${RULE_BADGE_CLASS[result.certified_by_rule] ?? "bg-blue-50 border-blue-200 text-blue-800"}`}>
                  {RULE_LABELS[result.certified_by_rule] ?? result.certified_by_rule}
                </span>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export default function CertificationPage() {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>("upload");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{ batchId: number; filename: string; rows_created: number; rows_updated: number; missing_sites: number; } | null>(null);
  const [echeance, setEcheance] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pollingBatchId, setPollingBatchId] = useState<number | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const { data: efmsHealth, isLoading: efmsLoading } = useQuery({ queryKey: ["efms-health"], queryFn: checkEfmsHealth, refetchInterval: 60000, retry: false });
  const { data: certBatchesRaw, refetch: refetchBatches } = useQuery({ queryKey: ["cert-batches"], queryFn: () => listCertBatches() });
  const certBatches: CertificationBatch[] = Array.isArray(certBatchesRaw) ? certBatchesRaw : (certBatchesRaw as any)?.results ?? [];

  const { data: pollData } = useQuery({
    queryKey: ["cert-batch-status", pollingBatchId],
    queryFn: () => pollBatchStatus(pollingBatchId!),
    enabled: pollingBatchId !== null,
    refetchInterval: (data: any) => (!data || data.status === "RUNNING" || data.status === "PENDING") ? 2500 : false,
  });

  useEffect(() => {
    if (pollData?.status === "DONE" || pollData?.status === "FAILED") {
      setPollingBatchId(null);
      qc.invalidateQueries({ queryKey: ["cert-batches"] });
      if (pollData.status === "DONE") {
        toast.success("✓ Certification terminée"); setSelectedBatchId(pollData.cert_batch_id);
        setTimeout(() => setStep("results"), 800);
      } else { toast.error("Certification échouée"); }
    }
  }, [pollData]);

  const { data: resultsRaw, isLoading: loadingResults } = useQuery({
    queryKey: ["cert-results", selectedBatchId, statusFilter],
    queryFn: () => listCertResults({ cert_batch: selectedBatchId!, status: (statusFilter || undefined) as CertResultStatus }),
    enabled: selectedBatchId !== null,
  });
  const results: CertificationResult[] = Array.isArray(resultsRaw) ? resultsRaw : (resultsRaw as any)?.results ?? [];
  const selectedBatch = certBatches.find(b => b.id === selectedBatchId);

  const handleExport = async () => {
    if (!selectedBatchId || !selectedBatch) return;
    setIsExporting(true);
    try {
      const raw = await listCertResults({ cert_batch: selectedBatchId, page_size: 9999 });
      const all: CertificationResult[] = Array.isArray(raw) ? raw : (raw as any)?.results ?? [];
      const label = selectedBatch.echeance !== "N/A" ? selectedBatch.echeance : `batch-${selectedBatch.id}`;
      exportResultsToExcel(all, label);
      toast.success(`Export — ${all.length} factures`);
    } catch { toast.error("Erreur export"); }
    finally { setIsExporting(false); }
  };

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      setUploadProgress(0);
      const iv = setInterval(() => setUploadProgress(p => Math.min(p + 10, 85)), 180);
      try { const r = await importBillingFile(file, echeance); clearInterval(iv); setUploadProgress(100); return r; }
      catch (e) { clearInterval(iv); setUploadProgress(0); throw e; }
    },
    onSuccess: (data) => {
      setImportResult({ batchId: data.batch.id, filename: data.batch.source_filename, rows_created: data.rows_created, rows_updated: data.rows_updated, missing_sites: data.invoices_missing_site_count });
      setTimeout(() => setStep("certify"), 600);
      toast.success(`Import réussi — ${data.rows_created + data.rows_updated} factures`);
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? "Erreur import"),
  });

  const launchMut = useMutation({
    mutationFn: () => launchCertification(importResult!.batchId),
    onSuccess: (data) => {
      toast.success("Certification lancée !");
      setPollingBatchId(data.cert_batch_id); setSelectedBatchId(data.cert_batch_id);
      qc.invalidateQueries({ queryKey: ["cert-batches"] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? "Erreur lancement"),
  });

  const isRunning = pollingBatchId !== null;
  const activePoll = isRunning ? pollData : null;

  const STATUS_FILTERS = [
    { val: "", label: "Tous" }, { val: "CERTIFIED_FMS", label: "Certifié FMS" },
    { val: "CERTIFIED_SENELEC", label: "Certifié Sénélec" }, { val: "NEEDS_REVIEW", label: "À analyser" },
    { val: "UNKNOWN_CONTRACT", label: "Contrat inconnu" }, { val: "FMS_UNAVAILABLE", label: "FMS indispo" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-900 flex items-center justify-center shrink-0"><ShieldCheck className="w-5 h-5 text-white" /></div>
            <div><h1 className="text-base font-bold text-slate-900 leading-tight">Certification Factures</h1><p className="text-xs text-slate-400">Validation automatique Sénélec × eFMS</p></div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <EfmsBadge reachable={efmsHealth?.efms_reachable} loading={efmsLoading} />
            <div className="h-4 w-px bg-slate-200" />
            <StepBar current={step} />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8 space-y-6">

        {/* STEP 1 — inchangé */}
        {step === "upload" && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
              <div className="flex items-center gap-2 mb-6"><Upload className="w-5 h-5 text-blue-900" /><h2 className="text-sm font-bold text-slate-900">Importer les factures Sénélec</h2></div>
              {!uploadMut.isPending && !uploadMut.isSuccess && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <Calendar className="w-4 h-4 text-blue-900 shrink-0" />
                    <label className="text-sm font-semibold text-slate-700 shrink-0">Date d'échéance <span className="text-red-500">*</span></label>
                    <input type="date" value={echeance} onChange={e => setEcheance(e.target.value)} className="ml-auto rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 bg-white" />
                  </div>
                  {!echeance && <p className="text-xs text-amber-600 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Sélectionnez d'abord la date d'échéance</p>}
                  <div className={echeance ? "" : "opacity-50 pointer-events-none"}>
                    <UploadZone onFile={f => { setUploadedFile(f); uploadMut.mutate(f); }} />
                  </div>
                </div>
              )}
              {uploadMut.isPending && uploadedFile && (
                <div className="rounded-2xl border border-blue-100 bg-blue-50/30 p-6">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0"><FileSpreadsheet className="w-6 h-6 text-blue-900" /></div>
                    <div className="flex-1 min-w-0"><div className="font-semibold text-slate-800 truncate text-sm">{uploadedFile.name}</div><div className="text-xs text-slate-400">{(uploadedFile.size / 1024).toFixed(0)} KB</div></div>
                    <Loader2 className="w-4 h-4 animate-spin text-blue-900 shrink-0" />
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-900 rounded-full transition-all duration-300 ease-out" style={{ width: `${uploadProgress}%` }} /></div>
                  <p className="text-xs text-slate-400 mt-2">Import en cours... {uploadProgress}%</p>
                </div>
              )}
              {uploadMut.isSuccess && importResult && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0"><Check className="w-6 h-6 text-white" /></div>
                  <div><div className="font-bold text-emerald-800 text-sm">{importResult.filename}</div><div className="text-xs text-emerald-600">{importResult.rows_created + importResult.rows_updated} factures · redirection...</div></div>
                </div>
              )}
            </div>
            {certBatches.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-slate-400" /><h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Campagnes précédentes</h3></div>
                  <button onClick={() => setStep("results")} className="text-xs text-blue-900 font-semibold hover:underline flex items-center gap-1">Voir résultats <ArrowRight className="w-3 h-3" /></button>
                </div>
                <div className="space-y-2">
                  {certBatches.slice(0, 4).map(b => (
                    <button key={b.id} onClick={() => { setSelectedBatchId(b.id); setStep("results"); }} className="w-full text-left flex items-center justify-between px-4 py-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/20 transition-all">
                      <div className="flex items-center gap-3"><Database className="w-4 h-4 text-slate-300" /><span className="text-sm font-medium text-slate-700">{b.echeance !== "N/A" ? b.echeance : `Batch #${b.import_batch}`}</span><span className="text-xs text-slate-400">{b.total} factures</span></div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${b.status === "DONE" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : b.status === "RUNNING" ? "bg-blue-50 text-blue-700 border-blue-200" : b.status === "FAILED" ? "bg-red-50 text-red-600 border-red-200" : "bg-slate-50 text-slate-500 border-slate-200"}`}>{b.status}</span>
                        <ChevronRight className="w-4 h-4 text-slate-200" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2 — ✅ ordre sources modifié : ACM en premier */}
        {step === "certify" && importResult && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0"><FileSpreadsheet className="w-6 h-6 text-emerald-600" /></div>
                <div className="flex-1"><h2 className="text-sm font-bold text-slate-900">{importResult.filename}</h2><p className="text-xs text-slate-500 mt-0.5">{importResult.rows_created + importResult.rows_updated} factures · Batch #{importResult.batchId}{echeance && <> · <span className="font-semibold text-blue-900">{echeance}</span></>}</p></div>
                {!isRunning && <button onClick={() => { setStep("upload"); setImportResult(null); setUploadedFile(null); setUploadProgress(0); uploadMut.reset(); setEcheance(""); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition shrink-0"><X className="w-4 h-4" /></button>}
              </div>
            </div>
            {!efmsLoading && !efmsHealth?.efms_reachable && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div><div className="text-xs font-bold text-amber-800">eFMS hors ligne</div><div className="text-xs text-amber-600 mt-0.5">Certification basée uniquement sur l'historique Sénélec.</div></div>
              </div>
            )}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
              {!isRunning && !(activePoll?.status === "DONE") ? (
                <div className="text-center space-y-5">
                  <div className="w-16 h-16 rounded-2xl bg-blue-900 mx-auto flex items-center justify-center"><ShieldCheck className="w-8 h-8 text-white" /></div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-1.5">Lancer la certification</h3>
                    <p className="text-sm text-slate-500 max-w-md mx-auto">Chaque facture est certifiée via le compteur ACM (source principale) ou le FMS Grid (fallback), puis validée par l'historique Sénélec et le recalcul du montant HTVA.</p>
                  </div>
                  {/* ✅ ACM en premier dans la liste des sources */}
                  <div className="flex items-center justify-center gap-6 text-xs text-slate-500 flex-wrap">
                    <div className="flex items-center gap-1.5"><Cpu className="w-3 h-3 text-emerald-600" /><span className="font-semibold text-emerald-700">ACM (principal)</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-400" /><span>Grid (fallback)</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Historique Sénélec</div>
                    <div className="flex items-center gap-1.5"><Receipt className="w-3 h-3 text-violet-500" /> Recalcul montant</div>
                  </div>
                  <button onClick={() => launchMut.mutate()} disabled={launchMut.isPending} className="inline-flex items-center gap-2.5 px-8 py-3 bg-blue-900 text-white font-bold text-sm rounded-xl hover:bg-blue-800 disabled:opacity-50 transition-all shadow-lg shadow-blue-900/20 hover:-translate-y-0.5 active:translate-y-0">
                    {launchMut.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Lancement...</> : <><Zap className="w-4 h-4" /> Lancer la certification</>}
                  </button>
                </div>
              ) : (
                <CertProgress status={activePoll?.status ?? "RUNNING"} counters={{ total: activePoll?.counters?.total ?? (importResult.rows_created + importResult.rows_updated), certified_fms: activePoll?.counters?.certified_fms ?? 0, certified_senelec: activePoll?.counters?.certified_senelec ?? 0, needs_review: activePoll?.counters?.needs_review ?? 0, unknown_contract: activePoll?.counters?.unknown_contract ?? 0, fms_unavailable: activePoll?.counters?.fms_unavailable ?? 0 }} />
              )}
            </div>
          </div>
        )}

        {/* STEP 3 — inchangé sauf en-tête colonne "Source" */}
        {step === "results" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">Campagne :</span>
                  {certBatches.length === 0 ? <span className="text-xs text-slate-400">Aucune campagne</span> : (
                    <div className="flex gap-1.5 flex-wrap">
                      {certBatches.map(b => (
                        <button key={b.id} onClick={() => setSelectedBatchId(b.id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${selectedBatchId === b.id ? "bg-blue-900 text-white border-blue-900" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"}`}>
                          {b.echeance !== "N/A" ? b.echeance : `#${b.import_batch}`}
                          <span className={`ml-1 ${selectedBatchId === b.id ? "text-blue-300" : "text-slate-400"}`}>({b.total})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => refetchBatches()} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition"><RefreshCw className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setStep("upload")} className="flex items-center gap-1.5 text-xs text-blue-900 font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-50 transition border border-blue-100"><Upload className="w-3.5 h-3.5" /> Nouveau batch</button>
                </div>
              </div>
            </div>

            {!selectedBatchId ? (
              <div className="bg-white rounded-2xl border border-slate-200 min-h-[300px] flex flex-col items-center justify-center p-12 text-center">
                <BarChart3 className="w-10 h-10 text-slate-200 mb-3" /><div className="text-slate-500 font-medium text-sm">Sélectionnez une campagne ci-dessus</div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {selectedBatch && (
                  <div className="px-6 py-5 border-b border-slate-100">
                    <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">Échéance {selectedBatch.echeance}</h3>
                        <div className="text-xs text-slate-400 mt-0.5">{selectedBatch.launched_by_username ?? "—"} · {fmtDateTime(selectedBatch.launched_at)}{selectedBatch.finished_at && <> · Fini {fmtDateTime(selectedBatch.finished_at)}</>}</div>
                      </div>
                      <span className={`text-xs px-3 py-1.5 rounded-full font-bold border ${selectedBatch.status === "DONE" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : selectedBatch.status === "RUNNING" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-50 text-slate-500 border-slate-200"}`}>{selectedBatch.status}</span>
                    </div>
                    <CertProgress status={selectedBatch.status} counters={{ total: selectedBatch.total, certified_fms: selectedBatch.certified_fms, certified_senelec: selectedBatch.certified_senelec, needs_review: selectedBatch.needs_review, unknown_contract: selectedBatch.unknown_contract, fms_unavailable: selectedBatch.fms_unavailable }} />
                  </div>
                )}

                <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-2 flex-wrap">
                  <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  {STATUS_FILTERS.map(f => (
                    <button key={f.val} onClick={() => setStatusFilter(f.val)} className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${statusFilter === f.val ? "bg-blue-900 text-white border-blue-900" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}>{f.label}</button>
                  ))}
                  <div className="ml-auto flex items-center gap-3">
                    <span className="text-xs text-slate-400">{results.length} résultats</span>
                    {selectedBatch?.status === "DONE" && (
                      <button onClick={handleExport} disabled={isExporting} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-sm">
                        {isExporting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Export...</> : <><FileDown className="w-3.5 h-3.5" /> Export Excel</>}
                      </button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
                  {loadingResults ? (
                    <div className="flex items-center justify-center py-16 text-slate-400 gap-2 text-sm"><Loader2 className="w-5 h-5 animate-spin" /> Chargement...</div>
                  ) : results.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400"><HelpCircle className="w-7 h-7 mb-2" /><span className="text-sm">Aucun résultat</span></div>
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
                          <th className="px-4 py-3 text-center" title="Cohérence montant HTVA (±7%)">
                            <span className="flex items-center justify-center gap-1"><Receipt className="w-3 h-3" /> Montant</span>
                          </th>
                          {/* ✅ "Source" remplace "FMS" */}
                          <th className="px-4 py-3 text-center" title="Source eFMS utilisée pour la certification">
                            <span className="flex items-center justify-center gap-1"><Cpu className="w-3 h-3" /> Source</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>{results.map(r => <ResultRow key={r.id} result={r} />)}</tbody>
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