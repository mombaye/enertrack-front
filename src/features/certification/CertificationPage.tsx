// src/features/certification/CertificationPage.tsx
// v4 — "Precision Finance" design · Grid primaire · ACM fallback · MESURE_A_VERIFIER

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck, Wifi, WifiOff, Upload, FileSpreadsheet,
  X, ChevronDown, ChevronRight, Loader2, CheckCircle2,
  AlertTriangle, RefreshCw, BarChart3, Filter,
  Zap, Clock, Check, Database, Calendar, FileDown,
  Cpu, Receipt, Activity, TrendingUp,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  listCertBatches, launchCertification, pollBatchStatus,
  listCertResults, checkEfmsHealth, pollBillingImportStatus,
} from "@/services/certification";
import {
  CertificationBatch, CertResultStatus, CertificationResult,
} from "@/services/certification";
import { api } from "@/services/api";
import { toast } from "react-toastify";

// ─── Import billing ──────────────────────────────────────────────────────────
async function importBillingFile(file: File, echeance: string) {
  const form = new FormData();
  form.append("file", file);
  form.append("echeance", echeance);
  const { data } = await api.post("/sonatel-billing/batches/import/", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data as { batch: { id: number; source_filename: string }; task_id: string; detail: string };
}

// ─── Config statuts ───────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; dot: string; pill: string }> = {
  PENDING_CERTIFICATION: { label: "En attente",    dot: "bg-slate-300",   pill: "bg-slate-50   text-slate-500  border-slate-200" },
  CERTIFIED_FMS:         { label: "Certifié FMS",  dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CERTIFIED_SENELEC:     { label: "Certifié Sénélec", dot: "bg-sky-500",  pill: "bg-sky-50     text-sky-700    border-sky-200" },
  NEEDS_REVIEW:          { label: "À analyser",    dot: "bg-amber-400",   pill: "bg-amber-50   text-amber-700  border-amber-200" },
  UNKNOWN_CONTRACT:      { label: "Contrat inconnu", dot: "bg-red-400",   pill: "bg-red-50     text-red-600    border-red-200" },
  FMS_UNAVAILABLE:       { label: "FMS indispo",   dot: "bg-orange-400",  pill: "bg-orange-50  text-orange-600 border-orange-200" },
  // ✅ v4
  MESURE_A_VERIFIER:     { label: "Mesure à vérifier", dot: "bg-orange-500", pill: "bg-orange-50 text-orange-700 border-orange-300" },
};

// ✅ Grid primaire / ACM fallback — libellés corrigés
const RULE_LABELS: Record<string, string> = {
  FMS_PERIODE: "Grid · Période",
  FMS_30J:     "Grid · 30j",
  ACM_PERIODE: "ACM · Période",
  ACM_30J:     "ACM · 30j",
  HISTO_3MOIS: "Histo 3 mois",
};

const RULE_PILL: Record<string, string> = {
  FMS_PERIODE: "bg-sky-50    text-sky-800    border-sky-200",
  FMS_30J:     "bg-sky-50    text-sky-800    border-sky-200",
  ACM_PERIODE: "bg-violet-50 text-violet-800 border-violet-200",
  ACM_30J:     "bg-violet-50 text-violet-800 border-violet-200",
  HISTO_3MOIS: "bg-slate-50  text-slate-700  border-slate-200",
};

// ✅ Grid = primaire, ACM = fallback
function getSourceTag(r: CertificationResult): { label: string; cls: string; title: string } {
  if (!r.fms_available && !r.acm_available)
    return { label: "—",    cls: "bg-slate-50   text-slate-400  border-slate-200",  title: "Aucune source eFMS" };
  if (r.acm_available)
    return { label: "ACM",  cls: "bg-violet-50  text-violet-700 border-violet-200", title: "ACM (fallback Grid absent)" };
  return { label: "Grid",   cls: "bg-sky-50     text-sky-700    border-sky-200",    title: "FMS Grid (source primaire)" };
}

// ─── Export Excel ─────────────────────────────────────────────────────────────
function exportResultsToExcel(results: CertificationResult[], label: string) {
  const rows = results.map(r => {
    const src = r.acm_available ? "ACM (fallback)" : r.fms_available ? "Grid (primaire)" : "Indisponible";
    return {
      "N° Facture": r.numero_facture ?? "",
      "N° Contrat": r.numero_compte_contrat ?? "",
      "Site ID": r.site_id ?? "",
      "Site": r.site_name ?? "",
      "Début période": r.date_debut_periode ?? "",
      "Fin période": r.date_fin_periode ?? "",
      "Nb jours": r.nb_jours_facturation ?? "",
      "Montant TTC": r.montant_ttc ? parseFloat(String(r.montant_ttc)) : "",
      "Montant HTVA facturé": r.montant_hors_tva ? parseFloat(String(r.montant_hors_tva)) : "",
      "Conso facturée (kWh)": r.conso_facturee_periode ? parseFloat(String(r.conso_facturee_periode)) : "",
      "Conso norm. 30j (kWh)": r.conso_facturee_30j ? parseFloat(String(r.conso_facturee_30j)) : "",
      "Source eFMS": src,
      "Alerte mesure": r.flag_mesure_alert ? "OUI" : "non", // ✅ v4
      "Grid dispo": r.fms_available ? "Oui" : "Non",
      "Conso Grid période": r.conso_fms_periode ? parseFloat(String(r.conso_fms_periode)) : "",
      "Conso Grid 30j": r.conso_fms_30j ? parseFloat(String(r.conso_fms_30j)) : "",
      "Ratio Grid/période": r.ratio_fms_periode ? parseFloat(String(r.ratio_fms_periode)) : "",
      "Ratio Grid/30j": r.ratio_fms_30j ? parseFloat(String(r.ratio_fms_30j)) : "",
      "ACM dispo": r.acm_available ? "Oui" : "Non",
      "Estim ACM période": r.estim_conso_acm_periode ? parseFloat(String(r.estim_conso_acm_periode)) : "",
      "Estim ACM 30j": r.estim_conso_acm_30j ? parseFloat(String(r.estim_conso_acm_30j)) : "",
      "Ratio ACM/période": r.ratio_acm_periode ? parseFloat(String(r.ratio_acm_periode)) : "",
      "Ratio ACM/30j": r.ratio_acm_30j ? parseFloat(String(r.ratio_acm_30j)) : "",
      "Histo 3M avg": r.histo_3mois_avg ? parseFloat(String(r.histo_3mois_avg)) : "",
      "Ratio Histo 3M": r.ratio_histo_3mois ? parseFloat(String(r.ratio_histo_3mois)) : "",
      "HTVA recalculé": r.montant_htva_calcule ? parseFloat(String(r.montant_htva_calcule)) : "",
      "Variation montant (%)": r.variation_montant_pct ? parseFloat(String(r.variation_montant_pct)) : "",
      "Montant cohérent": r.montant_coherent === null ? "" : r.montant_coherent ? "Oui" : "Non",
      "Statut": STATUS_CFG[r.status]?.label ?? r.status,
      "Règle": r.certified_by_rule ? (RULE_LABELS[r.certified_by_rule] ?? r.certified_by_rule) : "",
      "Erreur FMS": r.fms_error ?? "",
      "Erreur ACM": r.acm_error ?? "",
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = Array(Object.keys(rows[0] ?? {}).length).fill({ wch: 22 });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Résultats");

  // Récap avec ventilation sources
  const byStatus = rows.reduce((a, r) => { a[r["Statut"]] = (a[r["Statut"]] || 0) + 1; return a; }, {} as Record<string, number>);
  const recap = Object.entries(byStatus).map(([s, n]) => ({ "Statut": s, "Nb": n }));
  recap.push(
    { "Statut": "— dont Grid (primaire)", "Nb": rows.filter(r => r["Source eFMS"].includes("Grid")).length },
    { "Statut": "— dont ACM (fallback)",  "Nb": rows.filter(r => r["Source eFMS"].includes("ACM")).length },
    { "Statut": "— dont alerte mesure",   "Nb": rows.filter(r => r["Alerte mesure"] === "OUI").length }, // ✅ v4
    { "Statut": "TOTAL", "Nb": rows.length },
  );
  const wsR = XLSX.utils.json_to_sheet(recap);
  wsR["!cols"] = [{ wch: 28 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsR, "Récapitulatif");
  XLSX.writeFile(wb, `Certification_${label.replace(/[^a-zA-Z0-9_-]/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ─── Formatters ───────────────────────────────────────────────────────────────
function fmt(n: string | number | null, dec = 0) {
  if (n == null) return "—";
  const v = parseFloat(String(n));
  if (isNaN(v)) return "—";
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);
}
function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDT(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
function pct(n: number, t: number) { return t === 0 ? 0 : Math.round((n / t) * 100); }

type Step = "upload" | "certify" | "results";

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepBar({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "upload",  label: "Import" },
    { key: "certify", label: "Certification" },
    { key: "results", label: "Résultats" },
  ];
  const idx = steps.findIndex(s => s.key === current);
  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-semibold tracking-wide transition-all ${i === idx ? "bg-white/10 text-white" : i < idx ? "text-emerald-400" : "text-slate-500"}`}>
            <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold shrink-0 ${i < idx ? "bg-emerald-500 text-white" : i === idx ? "bg-white text-slate-900" : "bg-slate-700 text-slate-500"}`}>
              {i < idx ? <Check className="w-2.5 h-2.5" /> : i + 1}
            </span>
            {s.label}
          </div>
          {i < steps.length - 1 && <div className={`h-px w-4 ${i < idx ? "bg-emerald-700" : "bg-slate-700"}`} />}
        </div>
      ))}
    </div>
  );
}

function EfmsDot({ reachable, loading }: { reachable: boolean | undefined; loading: boolean }) {
  if (loading) return (
    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
      <Loader2 className="w-3 h-3 animate-spin" /> eFMS…
    </div>
  );
  return (
    <div className={`flex items-center gap-1.5 text-[11px] font-medium ${reachable ? "text-emerald-400" : "text-red-400"}`}>
      {reachable ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
      {reachable ? "eFMS connecté" : "eFMS hors ligne"}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.PENDING_CERTIFICATION;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-semibold whitespace-nowrap ${cfg.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function RatioPill({ value, threshold = 0.95 }: { value: string | null; threshold?: number }) {
  if (!value) return <span className="text-slate-300 text-xs">—</span>;
  const v = parseFloat(value);
  const ok = v >= threshold;
  return (
    <span className={`font-mono text-[12px] font-bold tabular-nums ${ok ? "text-emerald-600" : v >= threshold * 0.85 ? "text-amber-600" : "text-slate-400"}`}>
      {(v * 100).toFixed(1)}%
    </span>
  );
}

// ─── Progress complet (avec mesure_alert v4) ──────────────────────────────────
type Counters = {
  total: number; certified_fms: number; certified_senelec: number;
  needs_review: number; unknown_contract: number; fms_unavailable: number;
  mesure_alert?: number; // ✅ v4
};

function CertProgress({ counters, status }: { counters: Counters; status: string }) {
  const t = Math.max(counters.total, 1);
  const processed = counters.certified_fms + counters.certified_senelec + counters.needs_review + counters.unknown_contract + counters.fms_unavailable + (counters.mesure_alert ?? 0);
  const targetPct = counters.total > 0 ? pct(processed, t) : 0;
  const [displayPct, setDisplayPct] = useState(targetPct);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (animRef.current) clearInterval(animRef.current);
    if (status !== "RUNNING" || targetPct === displayPct) { setDisplayPct(targetPct); return; }
    const step = Math.max((targetPct - displayPct) / 25, 0.5);
    animRef.current = setInterval(() => {
      setDisplayPct(prev => {
        const next = Math.min(prev + step, targetPct);
        if (next >= targetPct && animRef.current) { clearInterval(animRef.current); animRef.current = null; }
        return next;
      });
    }, 60);
    return () => { if (animRef.current) clearInterval(animRef.current); };
  }, [targetPct, status]);

  // ✅ Inclut mesure_alert avec couleur orange
  const segments = [
    { val: counters.certified_fms,    color: "bg-emerald-500" },
    { val: counters.certified_senelec,color: "bg-sky-500" },
    { val: counters.mesure_alert ?? 0,color: "bg-orange-400" }, // ✅ v4
    { val: counters.needs_review,      color: "bg-amber-400" },
    { val: counters.unknown_contract,  color: "bg-red-400" },
    { val: counters.fms_unavailable,   color: "bg-slate-300" },
  ];

  const kpis = [
    { label: "Certifié FMS",    val: counters.certified_fms,     cls: "text-emerald-600" },
    { label: "Certifié Sénélec",val: counters.certified_senelec, cls: "text-sky-600" },
    { label: "⚠ Mesure alerte", val: counters.mesure_alert ?? 0, cls: "text-orange-600" }, // ✅ v4
    { label: "À analyser",      val: counters.needs_review,      cls: "text-amber-600" },
    { label: "Inconnu",         val: counters.unknown_contract,   cls: "text-red-500" },
    { label: "FMS indispo",     val: counters.fms_unavailable,    cls: "text-slate-400" },
  ];

  const circumference = 2 * Math.PI * 28;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-5">
        <div className="relative w-16 h-16 shrink-0">
          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" fill="none" stroke="#e2e8f0" strokeWidth="6" />
            <circle cx="32" cy="32" r="28" fill="none"
              stroke={status === "DONE" ? "#10b981" : "#0ea5e9"}
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - displayPct / 100)}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 0.1s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-base font-bold text-slate-800 leading-none tabular-nums">{Math.round(displayPct)}%</span>
          </div>
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            {status === "RUNNING" && <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-500" />}
            {status === "DONE"    && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
            {status === "FAILED"  && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
            <span className="text-[13px] font-semibold text-slate-700">
              {status === "RUNNING" ? "Certification en cours…" : status === "DONE" ? "Terminée" : status === "FAILED" ? "Échec" : status}
            </span>
            <span className="ml-auto text-[11px] text-slate-400 tabular-nums">{processed} / {counters.total}</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
            {segments.map((s, i) => s.val > 0 && (
              <div key={i} className={`${s.color} transition-all duration-700 ease-out`} style={{ width: `${pct(s.val, t)}%` }} />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {kpis.map((k, i) => (
          <div key={i} className="text-center py-2 px-1 rounded-lg bg-slate-50 border border-slate-100">
            <div className={`text-lg font-bold tabular-nums ${k.cls}`}>{k.val}</div>
            <div className="text-[10px] text-slate-400 leading-tight mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────
function DataCard({ title, icon, badge, children }: {
  title: string; icon: React.ReactNode;
  badge?: { label: string; cls: string };
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-50 bg-slate-50/60">
        <span className="text-slate-400 flex items-center">{icon}</span>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{title}</span>
        {badge && <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded border ${badge.cls}`}>{badge.label}</span>}
      </div>
      <div className="p-3 space-y-1.5">{children}</div>
    </div>
  );
}

function DataRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-baseline gap-2">
      <span className="text-[11px] text-slate-400 shrink-0">{label}</span>
      <span className="text-[12px] font-medium text-slate-700 text-right">{children}</span>
    </div>
  );
}

// ─── Table row ────────────────────────────────────────────────────────────────
// src/features/certification/CertificationPage.tsx
// PATCH — affichage double source Grid + ACM
//
// SEUL ResultRow est modifié.
// Logique :
//   - Grid card  : toujours affichée si Grid était disponible (acm_available=False)
//   - ACM card   : toujours affichée si estim_conso_acm_* est non-null
//     · acm_available=True  → badge "Source active"    (ACM utilisé pour la certification)
//     · acm_available=False → badge "Référence"         (ACM affiché pour information, Grid a certifié)
//   - Aucune donnée → "Indisponible" dans les deux cas
//
// Tout le reste du fichier (imports, helpers, autres composants, Page) est identique.

function ResultRow({ result }: { result: CertificationResult }) {
  const [open, setOpen] = useState(false);
  const src = getSourceTag(result);

  // Grid était-il la source de certification ?
  const gridUsed = result.fms_available && !result.acm_available;
  // ACM était-il la source de certification (fallback Grid absent) ?
  const acmUsed  = result.acm_available;
  // Y a-t-il une donnée ACM disponible pour affichage (même si pas utilisée) ?
  const acmDataAvailable =
    result.estim_conso_acm_periode != null ||
    result.estim_conso_acm_30j != null;

  const isAlert = result.flag_mesure_alert;

  return (
    <>
      <tr
        onClick={() => setOpen(o => !o)}
        className={`group border-b border-slate-100 cursor-pointer transition-all hover:bg-slate-50/80 ${isAlert ? "bg-orange-50/30" : ""}`}
      >
        <td className="pl-4 pr-2 py-2.5 w-6">
          <span className="text-slate-300 group-hover:text-slate-500 transition-colors">
            {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </span>
        </td>

        <td className="px-3 py-2.5">
          {isAlert && <AlertTriangle className="w-3 h-3 text-orange-500 inline mr-1 -mt-0.5" />}
          <span className="font-mono text-[12px] font-semibold text-slate-800">{result.numero_facture}</span>
          <div className="text-[10px] text-slate-400 mt-0.5">{result.numero_compte_contrat}</div>
        </td>

        <td className="px-3 py-2.5">
          <div className="text-[12px] font-semibold text-slate-700">{result.site_id ?? "—"}</div>
          <div className="text-[10px] text-slate-400 max-w-[120px] truncate">{result.site_name ?? ""}</div>
        </td>

        <td className="px-3 py-2.5 text-[11px] text-slate-500 whitespace-nowrap tabular-nums">
          {fmtDate(result.date_debut_periode)}<span className="mx-1 text-slate-300">→</span>{fmtDate(result.date_fin_periode)}
        </td>

        <td className="px-3 py-2.5 text-right font-mono text-[12px] font-semibold text-slate-700 tabular-nums">
          {result.montant_ttc ? `${fmt(result.montant_ttc)} F` : "—"}
        </td>

        <td className="px-3 py-2.5"><StatusBadge status={result.status} /></td>

        <td className="px-3 py-2.5 text-center">
          {result.montant_coherent === null ? (
            <span className="text-slate-300 text-[11px]">—</span>
          ) : result.montant_coherent ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
              <Check className="w-2.5 h-2.5" />
              {result.variation_montant_pct ? `${parseFloat(result.variation_montant_pct) >= 0 ? "+" : ""}${parseFloat(result.variation_montant_pct).toFixed(1)}%` : "OK"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
              <AlertTriangle className="w-2.5 h-2.5" />
              {result.variation_montant_pct ? `${parseFloat(result.variation_montant_pct) >= 0 ? "+" : ""}${parseFloat(result.variation_montant_pct).toFixed(1)}%` : "NOK"}
            </span>
          )}
        </td>

        <td className="px-3 py-2.5 text-center">
          <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${src.cls}`} title={src.title}>
            {src.label}
          </span>
        </td>
      </tr>

      {/* ── Detail panel ── */}
      {open && (
        <tr className="border-b border-blue-50 bg-slate-50/40">
          <td colSpan={8} className="px-5 py-4">

            {/* Alerte mesure v4 */}
            {isAlert && (
              <div className="mb-3 flex items-start gap-2.5 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[12px] font-bold text-orange-800">Alerte mesure (v4.1)</div>
                  <div className="text-[11px] text-orange-600 mt-0.5">
                    Consommation facturée anormale (&lt; 50% ou &gt; 150% de la mesure FMS / historique). Vérifier la facture ET la source de mesure.
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5">

              {/* ── Consommations ───────────────────────────────────────── */}
              <DataCard title="Consommations" icon={<Activity className="w-3 h-3" />}>
                <DataRow label="Période">{result.conso_facturee_periode ? `${fmt(result.conso_facturee_periode, 1)} kWh` : "—"}</DataRow>
                <DataRow label="Norm. 30j">{result.conso_facturee_30j ? `${fmt(result.conso_facturee_30j, 1)} kWh` : "—"}</DataRow>
                <DataRow label="Nb jours">{result.nb_jours_facturation ?? "—"}</DataRow>
                <div className="border-t border-slate-50 pt-1.5 mt-0.5">
                  <DataRow label="Histo dernier">{result.histo_last_conso ? `${fmt(result.histo_last_conso, 1)} kWh` : "—"}</DataRow>
                  <DataRow label="Histo 3M avg">{result.histo_3mois_avg ? `${fmt(result.histo_3mois_avg, 1)} kWh` : "—"}</DataRow>
                  <DataRow label="Ratio histo"><RatioPill value={result.ratio_histo_3mois} /></DataRow>
                </div>
              </DataCard>

              {/* ── FMS Grid — source PRIMAIRE ───────────────────────────── */}
              <DataCard
                title="FMS Grid"
                icon={<Database className="w-3 h-3" />}
                badge={
                  gridUsed
                    ? { label: "Source active", cls: "bg-sky-50 text-sky-700 border-sky-200" }
                    : acmUsed
                    ? { label: "Indisponible",  cls: "bg-slate-50 text-slate-400 border-slate-200" }
                    : undefined
                }
              >
                {/* Grid indispo (ACM utilisé à la place) */}
                {acmUsed ? (
                  <p className="text-[11px] text-slate-400 italic">
                    Grid indisponible — ACM utilisé pour la certification
                  </p>
                ) : !result.fms_available ? (
                  <p className="text-[11px] text-slate-400 italic">Aucune donnée eFMS</p>
                ) : (
                  /* Grid disponible et utilisé */
                  <>
                    <DataRow label="Conso période">
                      {result.conso_fms_periode ? `${fmt(result.conso_fms_periode, 1)} kWh` : "—"}
                    </DataRow>
                    <DataRow label="Conso 30j">
                      {result.conso_fms_30j ? `${fmt(result.conso_fms_30j, 1)} kWh` : "—"}
                    </DataRow>
                    <DataRow label="Dernier mois">{fmtDate(result.fms_last_complete_month)}</DataRow>
                    <div className="border-t border-slate-50 pt-1.5 mt-0.5">
                      <DataRow label="Ratio période"><RatioPill value={result.ratio_fms_periode} /></DataRow>
                      <DataRow label="Ratio 30j"><RatioPill value={result.ratio_fms_30j} /></DataRow>
                    </div>
                    {result.fms_error && (
                      <div className="text-[10px] text-orange-600 bg-orange-50 border border-orange-200 rounded px-2 py-1 mt-1">
                        {result.fms_error}
                      </div>
                    )}
                  </>
                )}
              </DataCard>

              {/* ── ACM — fallback OU référence informatif ───────────────── */}
              <DataCard
                title="AC Power Meter"
                icon={<Cpu className="w-3 h-3" />}
                badge={
                  acmUsed
                    // ACM a certifié (Grid était absent)
                    ? { label: "Source active",  cls: "bg-violet-50 text-violet-700 border-violet-200" }
                    : acmDataAvailable
                    // ACM disponible mais Grid a certifié → affichage informatif
                    ? { label: "Référence",      cls: "bg-slate-50 text-slate-500 border-slate-200" }
                    : undefined
                }
              >
                {!acmDataAvailable ? (
                  /* Pas de donnée ACM du tout */
                  <p className="text-[11px] text-slate-400 italic">Indisponible</p>
                ) : (
                  /* Donnée ACM présente — certifié via ACM OU juste affiché */
                  <>
                    <DataRow label="Conso période">
                      {result.estim_conso_acm_periode ? `${fmt(result.estim_conso_acm_periode, 1)} kWh` : "—"}
                    </DataRow>
                    <DataRow label="Conso 30j">
                      {result.estim_conso_acm_30j ? `${fmt(result.estim_conso_acm_30j, 1)} kWh` : "—"}
                    </DataRow>
                    {(result.ratio_acm_periode != null || result.ratio_acm_30j != null) && (
                      <div className="border-t border-slate-50 pt-1.5 mt-0.5">
                        <DataRow label="Ratio période"><RatioPill value={result.ratio_acm_periode} /></DataRow>
                        <DataRow label="Ratio 30j"><RatioPill value={result.ratio_acm_30j} /></DataRow>
                      </div>
                    )}
                    {/* Note informative quand Grid a certifié mais ACM est affiché */}
                    {!acmUsed && (
                      <p className="text-[10px] text-slate-400 italic mt-1.5">
                        Affiché à titre informatif — Grid utilisé pour la certification
                      </p>
                    )}
                    {result.acm_error && (
                      <div className="text-[10px] text-orange-600 bg-orange-50 border border-orange-200 rounded px-2 py-1 mt-1">
                        {result.acm_error}
                      </div>
                    )}
                  </>
                )}
              </DataCard>

              {/* ── Cohérence Montant ────────────────────────────────────── */}
              <DataCard title="Cohérence Montant" icon={<Receipt className="w-3 h-3" />}>
                <DataRow label="HTVA facturé">{result.montant_hors_tva ? `${fmt(result.montant_hors_tva)} F` : "—"}</DataRow>
                <DataRow label="HTVA recalculé">{result.montant_htva_calcule ? `${fmt(result.montant_htva_calcule)} F` : "—"}</DataRow>
                {result.variation_montant_pct != null && (
                  <DataRow label="Variation">
                    <span className={`font-mono font-bold ${result.montant_coherent ? "text-emerald-600" : result.montant_coherent === false ? "text-red-600" : "text-slate-500"}`}>
                      {parseFloat(result.variation_montant_pct) >= 0 ? "+" : ""}{parseFloat(result.variation_montant_pct).toFixed(2)}%
                    </span>
                  </DataRow>
                )}
                <div className="border-t border-slate-50 pt-1.5 mt-0.5">
                  <DataRow label="Tolérance 7%">
                    {result.montant_coherent === null ? (
                      <span className="text-slate-400">—</span>
                    ) : result.montant_coherent ? (
                      <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" /> Cohérent
                      </span>
                    ) : (
                      <span className="text-red-600 font-semibold flex items-center gap-0.5">
                        <AlertTriangle className="w-3 h-3" /> Incohérent
                      </span>
                    )}
                  </DataRow>
                </div>
                {result.montant_check_error && (
                  <div className="text-[10px] text-orange-600 bg-orange-50 border border-orange-200 rounded px-2 py-1 mt-1">
                    {result.montant_check_error}
                  </div>
                )}
              </DataCard>

            </div>

            {/* Règle de certification */}
            {result.certified_by_rule && (
              <div className="mt-2.5 flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] text-slate-500">Certifié par</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${RULE_PILL[result.certified_by_rule] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
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

// ─── Upload zone ──────────────────────────────────────────────────────────────
function UploadZone({ onFile }: { onFile: (f: File) => void }) {
  const [drag, setDrag] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const handle = useCallback((f: File) => {
    if (!f.name.match(/\.(xlsx|xls|csv)$/i)) { toast.error("Format non supporté"); return; }
    onFile(f);
  }, [onFile]);
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handle(f); }}
      onClick={() => ref.current?.click()}
      className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-all duration-200 p-10 text-center group ${drag ? "border-sky-400 bg-sky-50/50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"}`}
    >
      <input ref={ref} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handle(f); }} />
      <div className={`w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center border transition-all ${drag ? "bg-sky-500 border-sky-500 text-white" : "bg-white border-slate-200 text-slate-400 group-hover:border-slate-300"}`}>
        <FileSpreadsheet className="w-6 h-6" />
      </div>
      <p className="text-[13px] font-semibold text-slate-700 mb-0.5">{drag ? "Relâchez pour importer" : "Déposer le fichier Sénélec"}</p>
      <p className="text-[11px] text-slate-400">.xlsx · .xls · .csv</p>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function CertificationPage() {
  const qc = useQueryClient();
  const [step, setStep]       = useState<Step>("upload");
  const [uploadedFile, setUploadedFile]   = useState<File | null>(null);
  const [importResult, setImportResult]   = useState<{
    batchId: number; filename: string; taskId: string | null;
    taskStatus: "PENDING"|"RUNNING"|"SUCCESS"|"FAILURE"|null;
    taskProgress: number; taskMessage: string | null;
    rowsCreated: number; rowsUpdated: number; missingSites: number;
  } | null>(null);
  const [echeance, setEcheance]           = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pollingBatchId, setPollingBatchId] = useState<number | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter]   = useState("");
  const [onlyAlerts, setOnlyAlerts]       = useState(false); // ✅ v4 filtre alerte
  const [isExporting, setIsExporting]     = useState(false);

  const { data: efms, isLoading: efmsLoading } = useQuery({
    queryKey: ["efms-health"], queryFn: checkEfmsHealth, refetchInterval: 60000, retry: false,
  });
  const { data: batchesRaw, refetch: refetchBatches } = useQuery({
    queryKey: ["cert-batches"], queryFn: () => listCertBatches(),
  });
  const certBatches: CertificationBatch[] = Array.isArray(batchesRaw) ? batchesRaw : (batchesRaw as any)?.results ?? [];

  const { data: pollData } = useQuery({
    queryKey: ["cert-batch-status", pollingBatchId],
    queryFn: () => pollBatchStatus(pollingBatchId!),
    enabled: pollingBatchId !== null,
    refetchInterval: (d: any) => (!d || d.status === "RUNNING" || d.status === "PENDING") ? 2500 : false,
  });

  const billingBatchId = importResult?.batchId ?? null;
  const { data: billingPoll } = useQuery({
    queryKey: ["billing-task-status", billingBatchId],
    queryFn: () => pollBillingImportStatus(billingBatchId!),
    enabled: billingBatchId !== null && step === "upload",
    refetchInterval: (d: any) => (!d || d.task_status === "PENDING" || d.task_status === "RUNNING") ? 2000 : false,
  });

  useEffect(() => {
    if (!billingPoll || !importResult) return;
    setImportResult(prev => !prev ? prev : {
      ...prev,
      taskStatus:   billingPoll.task_status ?? null,
      taskProgress: billingPoll.task_progress ?? 0,
      taskMessage:  billingPoll.task_message ?? null,
      rowsCreated:  billingPoll.task_meta?.rows_created ?? 0,
      rowsUpdated:  billingPoll.task_meta?.rows_updated ?? 0,
      missingSites: billingPoll.task_meta?.invoices_missing_site_count ?? 0,
    });
    if (billingPoll.task_status === "SUCCESS") {
      toast.success(`Import terminé — ${(billingPoll.task_meta?.rows_created ?? 0) + (billingPoll.task_meta?.rows_updated ?? 0)} factures`);
      setStep("certify");
    }
    if (billingPoll.task_status === "FAILURE") toast.error(billingPoll.task_message ?? "Échec import");
  }, [billingPoll]);

  useEffect(() => {
    if (pollData?.status === "DONE" || pollData?.status === "FAILED") {
      setPollingBatchId(null);
      qc.invalidateQueries({ queryKey: ["cert-batches"] });
      if (pollData.status === "DONE") {
        toast.success("✓ Certification terminée");
        setSelectedBatchId(pollData.cert_batch_id);
        setTimeout(() => setStep("results"), 600);
      } else {
        toast.error("Certification échouée");
      }
    }
  }, [pollData]);

  const { data: resultsRaw, isLoading: loadingResults } = useQuery({
    queryKey: ["cert-results", selectedBatchId, statusFilter, onlyAlerts],
    queryFn: () => listCertResults({
      cert_batch: selectedBatchId!,
      status: (statusFilter || undefined) as CertResultStatus,
      flag_mesure_alert: onlyAlerts ? true : undefined, // ✅ v4
    }),
    enabled: selectedBatchId !== null,
  });
  const results: CertificationResult[] = Array.isArray(resultsRaw) ? resultsRaw : (resultsRaw as any)?.results ?? [];
  const selectedBatch = certBatches.find(b => b.id === selectedBatchId);

  const handleExport = async () => {
    if (!selectedBatchId || !selectedBatch) return;
    setIsExporting(true);
    try {
      const all: CertificationResult[] = [];
      let page = 1;
      while (true) {
        const raw = await listCertResults({ cert_batch: selectedBatchId, page, page_size: 200 });
        const rows: CertificationResult[] = Array.isArray(raw) ? raw : (raw as any)?.results ?? [];
        all.push(...rows);
        if (Array.isArray(raw) || !(raw as any)?.next || page > 500) break;
        page++;
      }
      exportResultsToExcel(all, selectedBatch.echeance !== "N/A" ? selectedBatch.echeance : `batch-${selectedBatch.id}`);
      toast.success(`Export — ${all.length} factures`);
    } catch { toast.error("Erreur export"); }
    finally { setIsExporting(false); }
  };

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      setUploadProgress(0);
      const iv = setInterval(() => setUploadProgress(p => Math.min(p + 8, 85)), 200);
      try { const r = await importBillingFile(file, echeance); clearInterval(iv); setUploadProgress(100); return r; }
      catch (e) { clearInterval(iv); setUploadProgress(0); throw e; }
    },
    onSuccess: (data) => {
      setImportResult({ batchId: data.batch.id, filename: data.batch.source_filename, taskId: data.task_id ?? null, taskStatus: "PENDING", taskProgress: 0, taskMessage: "En file d'attente…", rowsCreated: 0, rowsUpdated: 0, missingSites: 0 });
      toast.info("Fichier reçu — import en cours…");
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? "Erreur import"),
  });

  const launchMut = useMutation({
    mutationFn: () => launchCertification(importResult!.batchId),
    onSuccess: (data) => {
      toast.success("Certification lancée !");
      setPollingBatchId(data.cert_batch_id);
      setSelectedBatchId(data.cert_batch_id);
      qc.invalidateQueries({ queryKey: ["cert-batches"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? "Erreur lancement");
      if (err?.response?.status === 409) setStep("upload");
    },
  });

  const isRunning    = pollingBatchId !== null;
  const activePoll   = isRunning ? pollData : null;

  // ✅ v4 — filtre "Mesure à vérifier" ajouté
  const STATUS_FILTERS = [
    { val: "", label: "Tous" },
    { val: "CERTIFIED_FMS",     label: "Certifié FMS" },
    { val: "CERTIFIED_SENELEC", label: "Certifié Sénélec" },
    { val: "MESURE_A_VERIFIER", label: "⚠ Mesure alerte" },
    { val: "NEEDS_REVIEW",      label: "À analyser" },
    { val: "UNKNOWN_CONTRACT",  label: "Inconnu" },
    { val: "FMS_UNAVAILABLE",   label: "FMS indispo" },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F3]">

      {/* ── Topbar ── */}
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-0 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto h-12 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-sky-500 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-[13px] font-bold text-white tracking-tight">Certification</span>
            <span className="text-slate-700 mx-1">|</span>
            <span className="text-[11px] text-slate-500 font-medium">Factures Sénélec</span>
          </div>
          <div className="flex items-center gap-5">
            <EfmsDot reachable={efms?.efms_reachable} loading={efmsLoading} />
            <div className="h-3 w-px bg-slate-800" />
            <StepBar current={step} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-4">

        {/* ── STEP 1 : Upload ── */}
        {step === "upload" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Upload className="w-4 h-4 text-slate-400" />
                <h2 className="text-[13px] font-bold text-slate-800">Import des factures</h2>
              </div>

              {!uploadMut.isPending && !importResult && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-[12px] font-semibold text-slate-600">Échéance <span className="text-red-400">*</span></span>
                    <input type="date" value={echeance} onChange={e => setEcheance(e.target.value)}
                      className="ml-auto rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-sky-400 focus:border-sky-400 bg-white" />
                  </div>
                  {!echeance && <p className="text-[11px] text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Sélectionnez la date d'échéance</p>}
                  <div className={!echeance ? "opacity-40 pointer-events-none" : ""}>
                    <UploadZone onFile={f => { setUploadedFile(f); uploadMut.mutate(f); }} />
                  </div>
                </div>
              )}

              {uploadMut.isPending && uploadedFile && (
                <div className="rounded-lg border border-sky-100 bg-sky-50/40 p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <FileSpreadsheet className="w-5 h-5 text-sky-500 shrink-0" />
                    <span className="text-[12px] font-semibold text-slate-700 truncate">{uploadedFile.name}</span>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-500 ml-auto shrink-0" />
                  </div>
                  <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}

              {importResult && (
                <div className={`rounded-lg border p-4 flex items-center gap-3 ${
                  importResult.taskStatus === "SUCCESS" ? "border-emerald-200 bg-emerald-50/40" :
                  importResult.taskStatus === "FAILURE" ? "border-red-200 bg-red-50/40" :
                  "border-sky-200 bg-sky-50/30"
                }`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    importResult.taskStatus === "SUCCESS" ? "bg-emerald-500" :
                    importResult.taskStatus === "FAILURE" ? "bg-red-500" : "bg-sky-500"
                  }`}>
                    {importResult.taskStatus === "SUCCESS" ? <Check className="w-4.5 h-4.5 text-white" /> :
                     importResult.taskStatus === "FAILURE" ? <AlertTriangle className="w-4 h-4 text-white" /> :
                     <Loader2 className="w-4 h-4 text-white animate-spin" />}
                  </div>
                  <div>
                    <div className="text-[12px] font-bold text-slate-800">{importResult.filename}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {importResult.taskStatus === "SUCCESS" ? `${importResult.rowsCreated + importResult.rowsUpdated} factures importées` :
                       importResult.taskStatus === "FAILURE" ? "Import échoué" :
                       `${importResult.taskMessage ?? "En cours…"} (${importResult.taskProgress}%)`}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Campagnes précédentes */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                  <Clock className="w-3 h-3" /> Campagnes
                </div>
                <button onClick={() => setStep("results")} className="text-[11px] text-sky-600 font-semibold hover:underline">Voir tout</button>
              </div>
              {certBatches.length === 0 ? (
                <div className="text-[11px] text-slate-400 py-4 text-center">Aucune campagne</div>
              ) : (
                <div className="space-y-1.5">
                  {certBatches.slice(0, 6).map(b => (
                    <button key={b.id} onClick={() => { setSelectedBatchId(b.id); setStep("results"); }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all text-left">
                      <div>
                        <div className="text-[12px] font-semibold text-slate-700">{b.echeance !== "N/A" ? b.echeance : `#${b.import_batch}`}</div>
                        <div className="text-[10px] text-slate-400">{b.total} factures</div>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                        b.status === "DONE" ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                        b.status === "RUNNING" ? "bg-sky-50 text-sky-600 border-sky-200" :
                        b.status === "FAILED" ? "bg-red-50 text-red-500 border-red-200" :
                        "bg-slate-50 text-slate-400 border-slate-200"
                      }`}>{b.status}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 2 : Certify ── */}
        {step === "certify" && importResult && (
          <div className="space-y-4 max-w-3xl mx-auto">
            {/* fichier importé */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-bold text-slate-800">{importResult.filename}</div>
                <div className="text-[11px] text-slate-500">{importResult.rowsCreated + importResult.rowsUpdated} factures · Batch #{importResult.batchId}{echeance && <> · <span className="font-semibold text-sky-600">{echeance}</span></>}</div>
              </div>
              {!isRunning && (
                <button onClick={() => { setStep("upload"); setImportResult(null); setUploadedFile(null); setUploadProgress(0); uploadMut.reset(); setEcheance(""); }}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition"><X className="w-3.5 h-3.5" /></button>
              )}
            </div>

            {!efmsLoading && !efms?.efms_reachable && (
              <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-[11px]"><span className="font-bold text-amber-800">eFMS hors ligne</span> — certification basée sur l'historique Sénélec uniquement.</div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-8">
              {!isRunning ? (
                <div className="text-center space-y-6">
                  <div className="w-14 h-14 rounded-2xl bg-slate-950 mx-auto flex items-center justify-center">
                    <ShieldCheck className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-slate-900 mb-1.5">Lancer la certification</h3>
                    <p className="text-[12px] text-slate-500 max-w-sm mx-auto leading-relaxed">
                      Chaque facture est certifiée via le <strong>FMS Grid</strong> (source principale), puis l'<strong>ACM</strong> en fallback, l'historique Sénélec et le recalcul du montant HTVA.
                    </p>
                  </div>

                  {/* ✅ Grid en premier */}
                  <div className="flex items-center justify-center gap-6 text-[11px] text-slate-500 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <Database className="w-3 h-3 text-sky-500" />
                      <span className="font-bold text-sky-700">Grid (principal)</span>
                    </div>
                    <span className="text-slate-300">→</span>
                    <div className="flex items-center gap-1.5">
                      <Cpu className="w-3 h-3 text-violet-500" />
                      <span>ACM (fallback)</span>
                    </div>
                    <span className="text-slate-300">→</span>
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-3 h-3 text-slate-400" />
                      <span>Histo Sénélec</span>
                    </div>
                    <span className="text-slate-300">→</span>
                    <div className="flex items-center gap-1.5">
                      <Receipt className="w-3 h-3 text-slate-400" />
                      <span>Recalcul HTVA</span>
                    </div>
                  </div>

                  <button onClick={() => launchMut.mutate()} disabled={launchMut.isPending}
                    className="inline-flex items-center gap-2 px-7 py-2.5 bg-slate-950 text-white font-bold text-[13px] rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-all shadow-lg shadow-slate-950/20 hover:-translate-y-0.5 active:translate-y-0">
                    {launchMut.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Lancement…</> : <><Zap className="w-3.5 h-3.5" /> Lancer la certification</>}
                  </button>
                </div>
              ) : (
                <CertProgress
                  status={activePoll?.status ?? "RUNNING"}
                  counters={{
                    total:             activePoll?.counters?.total ?? (importResult.rowsCreated + importResult.rowsUpdated),
                    certified_fms:     activePoll?.counters?.certified_fms ?? 0,
                    certified_senelec: activePoll?.counters?.certified_senelec ?? 0,
                    needs_review:      activePoll?.counters?.needs_review ?? 0,
                    unknown_contract:  activePoll?.counters?.unknown_contract ?? 0,
                    fms_unavailable:   activePoll?.counters?.fms_unavailable ?? 0,
                    mesure_alert:      activePoll?.counters?.mesure_alert ?? 0,   // ✅ v4
                  }}
                />
              )}
            </div>
          </div>
        )}

        {/* ── STEP 3 : Results ── */}
        {step === "results" && (
          <div className="space-y-3">

            {/* sélecteur campagne */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Campagne</span>
                {certBatches.length === 0 ? (
                  <span className="text-[11px] text-slate-400">Aucune campagne</span>
                ) : (
                  <div className="flex gap-1.5 flex-wrap">
                    {certBatches.map(b => (
                      <button key={b.id} onClick={() => setSelectedBatchId(b.id)}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-all ${
                          selectedBatchId === b.id
                            ? "bg-slate-950 text-white border-slate-950"
                            : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                        }`}>
                        {b.echeance !== "N/A" ? b.echeance : `#${b.import_batch}`}
                        <span className={`ml-1 text-[10px] ${selectedBatchId === b.id ? "text-slate-400" : "text-slate-400"}`}>({b.total})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => refetchBatches()} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition"><RefreshCw className="w-3.5 h-3.5" /></button>
                <button onClick={() => setStep("upload")} className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-100 border border-slate-200 transition">
                  <Upload className="w-3 h-3" /> Nouveau batch
                </button>
              </div>
            </div>

            {!selectedBatchId ? (
              <div className="bg-white rounded-xl border border-slate-200 min-h-[280px] flex flex-col items-center justify-center p-12 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <BarChart3 className="w-8 h-8 text-slate-200 mb-2.5" />
                <div className="text-[13px] text-slate-400 font-medium">Sélectionnez une campagne</div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">

                {/* entête batch */}
                {selectedBatch && (
                  <div className="px-6 py-5 border-b border-slate-100">
                    <div className="flex items-start justify-between mb-5 flex-wrap gap-2">
                      <div>
                        <h3 className="text-[15px] font-bold text-slate-900">Échéance {selectedBatch.echeance}</h3>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {selectedBatch.launched_by_username ?? "—"} · {fmtDT(selectedBatch.launched_at)}
                          {selectedBatch.finished_at && <> · fin {fmtDT(selectedBatch.finished_at)}</>}
                        </div>
                      </div>
                      <span className={`text-[11px] px-2.5 py-1 rounded font-bold border ${
                        selectedBatch.status === "DONE"    ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        selectedBatch.status === "RUNNING" ? "bg-sky-50 text-sky-700 border-sky-200" :
                        "bg-slate-50 text-slate-500 border-slate-200"
                      }`}>{selectedBatch.status}</span>
                    </div>
                    <CertProgress
                      status={selectedBatch.status}
                      counters={{
                        total:             selectedBatch.total,
                        certified_fms:     selectedBatch.certified_fms,
                        certified_senelec: selectedBatch.certified_senelec,
                        needs_review:      selectedBatch.needs_review,
                        unknown_contract:  selectedBatch.unknown_contract,
                        fms_unavailable:   selectedBatch.fms_unavailable,
                        mesure_alert:      selectedBatch.mesure_alert ?? 0, // ✅ v4
                      }}
                    />
                  </div>
                )}

                {/* filtres */}
                <div className="px-5 py-2.5 border-b border-slate-100 flex items-center gap-2 flex-wrap bg-slate-50/50">
                  <Filter className="w-3 h-3 text-slate-300 shrink-0" />
                  {STATUS_FILTERS.map(f => (
                    <button key={f.val} onClick={() => setStatusFilter(f.val)}
                      className={`px-2.5 py-0.5 rounded text-[11px] font-semibold border transition-all ${
                        statusFilter === f.val
                          ? "bg-slate-950 text-white border-slate-950"
                          : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                      }`}>{f.label}</button>
                  ))}

                  {/* ✅ v4 — toggle alerte mesure */}
                  <button onClick={() => setOnlyAlerts(o => !o)}
                    className={`ml-1 flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold border transition-all ${
                      onlyAlerts ? "bg-orange-500 text-white border-orange-500" : "bg-white text-orange-600 border-orange-200 hover:border-orange-300"
                    }`}>
                    <AlertTriangle className="w-3 h-3" /> Alertes seulement
                  </button>

                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 tabular-nums">{results.length} résultats</span>
                    {selectedBatch?.status === "DONE" && (
                      <button onClick={handleExport} disabled={isExporting}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[11px] font-bold transition-all">
                        {isExporting ? <><Loader2 className="w-3 h-3 animate-spin" /> Export…</> : <><FileDown className="w-3 h-3" /> Export Excel</>}
                      </button>
                    )}
                  </div>
                </div>

                {/* table */}
                <div className="overflow-x-auto" style={{ maxHeight: "560px", overflowY: "auto" }}>
                  {loadingResults ? (
                    <div className="flex items-center justify-center py-16 text-slate-400 gap-2 text-[13px]">
                      <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
                    </div>
                  ) : results.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <BarChart3 className="w-6 h-6 mb-2" />
                      <span className="text-[13px]">Aucun résultat</span>
                    </div>
                  ) : (
                    <table className="w-full text-left">
                      <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-100">
                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          <th className="pl-4 pr-2 py-2.5 w-6" />
                          <th className="px-3 py-2.5">Facture</th>
                          <th className="px-3 py-2.5">Site</th>
                          <th className="px-3 py-2.5">Période</th>
                          <th className="px-3 py-2.5 text-right">Montant TTC</th>
                          <th className="px-3 py-2.5">Statut</th>
                          <th className="px-3 py-2.5 text-center">
                            <span className="flex items-center justify-center gap-1"><Receipt className="w-3 h-3" /> Montant</span>
                          </th>
                          {/* ✅ "Source" — Grid primaire */}
                          <th className="px-3 py-2.5 text-center">
                            <span className="flex items-center justify-center gap-1"><Database className="w-3 h-3" /> Source</span>
                          </th>
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
      </main>
    </div>
  );
}