// src/features/financial/FinancialPage.tsx
// V2 — Page financière complète
// Focus : marges financières, redevances, montant HTVA, récurrence NOK, imports et analyse site.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  Eye,
  FileUp,
  Filter,
  HelpCircle,
  Layers,
  LineChart as LineIcon,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Upload,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { financialLock, financialUnlock, isFinancialUnlocked } from "./FinancialAccessGate";
import FinancialAccessGate from "./FinancialAccessGate";
import FinancialDataPage from "./FinancialDataPage";
import FinancialSiteDetailModal from "./FinancialSiteDetailModal";
import {
  exportEvaluationsCSV,
  fetchAnalyticsFullReport,
  fetchEvaluationStats,
  fetchEvaluations,
  fetchFacturesVsRedevances,
  fetchMargeParSite,
  fetchSitesRecurrents,
  importFeeRules,
  importMonthlyLoads,
  runEvaluation,
  type AnalyticsFullReport,
  type EvaluationStats,
  type EvaluateResult,
  type FacturesRedevancesPeriod,
  type FinancialEvaluation,
  type SiteMargeRow,
  type SiteRecurrentRow,
} from "./api";

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  blue: {
    950: "#010E2A",
    900: "#021A40",
    800: "#032566",
    700: "#0A3D96",
    600: "#1A56C4",
    500: "#3272E0",
    300: "#91B9F8",
    100: "#E4EFFE",
    50: "#F2F6FE",
  },
  slate: {
    950: "#020617",
    900: "#0F172A",
    800: "#1E293B",
    700: "#334155",
    600: "#475569",
    500: "#64748B",
    400: "#94A3B8",
    300: "#CBD5E1",
    200: "#E2E8F0",
    100: "#F1F5F9",
    50: "#F8FAFC",
  },
  ok: { main: "#059669", light: "#D1FAE5", mid: "#A7F3D0", dark: "#065F46" },
  nok: { main: "#DC2626", light: "#FEE2E2", mid: "#FECACA", dark: "#991B1B" },
  warn: { main: "#D97706", light: "#FEF3C7", mid: "#FDE68A", dark: "#92400E" },
  cyan: { main: "#0891B2", light: "#CFFAFE", dark: "#0E7490" },
  purple: { main: "#7C3AED", light: "#EDE9FE", dark: "#5B21B6" },
  orange: { main: "#E8401C", light: "#FFEDD5", dark: "#C2410C" },
};

const PAGE_BG = "linear-gradient(180deg,#F8FAFC 0%,#EEF4FF 100%)";
const HDR = "linear-gradient(135deg,#010E2A 0%,#032566 55%,#0A3D96 100%)";
const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const ZONES = ["DKR", "THIES", "DIOURBEL", "LOUGA", "KAOLACK", "ZIGUINCHOR", "SAINT-LOUIS", "TAMBACOUNDA", "KOLDA", "FATICK", "MATAM", "KAFFRINE", "SEDHIOU", "KEDOUGOU"];

type TabKey = "evaluations" | "dashboard" | "recurrents" | "analyse" | "donnees";
type EvalRow = FinancialEvaluation & {
  id: number;
  site_id: string;
  site_name?: string | null;
  zone?: string | null;
  year: number;
  month: number;
  load_w?: number | null;
  typology?: string | null;
  configuration?: string | null;
  redevance?: string | null;
  montant_htva?: string | null;
  marge?: string | null;
  marge_statut?: "OK" | "NOK" | null;
  hors_catalogue?: boolean;
  periode_courte?: boolean;
  nb_jours_factures?: number | null;
  recurrence_mois_nok?: number | null;
  recurrence_type?: string | null;
};

type ModalSite = {
  siteId: string;
  siteName: string;
  year: number;
  monthStart: number;
  monthEnd: number;
} | null;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const periodKey = (y: number, m: number) => y * 100 + m;
const keyToYM = (k: number) => ({ year: Math.floor(k / 100), month: k % 100 });
const periodLabel = (y: number, m: number) => `${MONTHS[m - 1]} ${y}`;

function toNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const value = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function n(v: string | number | null | undefined): number {
  return toNum(v) ?? 0;
}

function fmtInt(v: string | number | null | undefined): string {
  const value = toNum(v);
  if (value === null) return "—";
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}

function fmtMoney(v: string | number | null | undefined): string {
  const value = toNum(v);
  if (value === null) return "—";
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M FCFA`;
  }
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} FCFA`;
}

function fmtMoneyShort(v: string | number | null | undefined): string {
  const value = toNum(v);
  if (value === null) return "—";
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M`;
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1000).toLocaleString("fr-FR")} k`;
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}

function fmtPct(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function moneyColor(v: string | number | null | undefined, positiveGood = true): string {
  const value = toNum(v);
  if (value === null) return C.slate[400];
  if (value === 0) return C.slate[600];
  return positiveGood ? (value >= 0 ? C.ok.main : C.nok.main) : value <= 0 ? C.ok.main : C.nok.main;
}

function periodText(startKey: number, endKey: number) {
  const lo = Math.min(startKey, endKey);
  const hi = Math.max(startKey, endKey);
  const a = keyToYM(lo);
  const b = keyToYM(hi);
  if (lo === hi) return periodLabel(a.year, a.month);
  return `${periodLabel(a.year, a.month)} → ${periodLabel(b.year, b.month)}`;
}

function getKpiDelta(redevance?: string | null, facture?: string | null) {
  const r = toNum(redevance);
  const f = toNum(facture);
  if (r === null || f === null || f === 0) return null;
  return (r / f - 1) * 100;
}

function buildMonthOptions(yearStart = 2024, yearEnd = new Date().getFullYear() + 1) {
  const out: Array<{ key: number; label: string }> = [];
  for (let y = yearStart; y <= yearEnd; y += 1) {
    for (let m = 1; m <= 12; m += 1) out.push({ key: periodKey(y, m), label: periodLabel(y, m) });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// UI atoms
// ─────────────────────────────────────────────────────────────────────────────

function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "blue" | "ok" | "nok" | "warn" | "cyan" | "purple" | "orange" }) {
  const map = {
    slate: { bg: C.slate[100], color: C.slate[700], border: C.slate[200] },
    blue: { bg: C.blue[100], color: C.blue[700], border: "#BFDBFE" },
    ok: { bg: C.ok.light, color: C.ok.dark, border: C.ok.mid },
    nok: { bg: C.nok.light, color: C.nok.dark, border: C.nok.mid },
    warn: { bg: C.warn.light, color: C.warn.dark, border: C.warn.mid },
    cyan: { bg: C.cyan.light, color: C.cyan.dark, border: "#A5F3FC" },
    purple: { bg: C.purple.light, color: C.purple.dark, border: "#DDD6FE" },
    orange: { bg: C.orange.light, color: C.orange.dark, border: "#FDBA74" },
  }[tone];

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 999, border: `1px solid ${map.border}`, background: map.bg, color: map.color, fontSize: 10.5, fontWeight: 900, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function HelpTip({ text }: { text: string }) {
  return <HelpCircle size={12} style={{ color: "rgba(255,255,255,.58)", cursor: "help" }} title={text} />;
}

function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return <Badge>—</Badge>;
  if (status === "OK") return <Badge tone="ok"><CheckCircle2 size={12} /> Marge OK</Badge>;
  if (status === "NOK") return <Badge tone="nok"><XCircle size={12} /> Marge NOK</Badge>;
  return <Badge tone="warn">{status}</Badge>;
}

function RecurrenceBadge({ type, months }: { type?: string | null; months?: number | null }) {
  if (!type) return <span style={{ color: C.slate[400] }}>—</span>;
  const isCrit = type === "critique";
  return <Badge tone={isCrit ? "nok" : "warn"}>{isCrit ? <AlertTriangle size={12} /> : <Activity size={12} />}{isCrit ? "Critique" : "Light"}{months ? ` · ${months}m` : ""}</Badge>;
}

function DeltaBadge({ value }: { value: number | null }) {
  if (value === null) return <span style={{ color: C.slate[400] }}>—</span>;
  const tone = Math.abs(value) <= 10 ? "ok" : Math.abs(value) <= 20 ? "warn" : "nok";
  return <Badge tone={tone}>{value >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}{fmtPct(value)}</Badge>;
}

function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ background: "rgba(255,255,255,.94)", border: `1px solid ${C.slate[200]}`, borderRadius: 20, boxShadow: "0 18px 45px rgba(15,23,42,.07)", overflow: "hidden", ...style }}>{children}</div>;
}

function SectionTitle({ icon, title, subtitle, right }: { icon: ReactNode; title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div style={{ padding: "16px 18px", borderBottom: `1px solid ${C.slate[100]}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 13, background: C.blue[50], color: C.blue[700], display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 950, color: C.blue[950], letterSpacing: "-.02em" }}>{title}</div>
          {subtitle ? <div style={{ fontSize: 11.5, color: C.slate[500], marginTop: 2 }}>{subtitle}</div> : null}
        </div>
      </div>
      {right}
    </div>
  );
}

function KpiCard({ label, value, sub, icon, accent, help, negative }: { label: string; value: string; sub?: string; icon: ReactNode; accent: string; help?: string; negative?: boolean }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 18, background: "rgba(255,255,255,.09)", border: "1px solid rgba(255,255,255,.14)", padding: "15px 16px", minHeight: 94, boxShadow: "inset 0 1px 0 rgba(255,255,255,.12)" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 90% 12%,${accent}33,transparent 32%)` }} />
      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 950, color: "rgba(255,255,255,.52)", letterSpacing: ".08em", textTransform: "uppercase" }}>{label}</div>
            {help ? <HelpTip text={help} /> : null}
          </div>
          <div style={{ fontSize: 21, fontWeight: 950, color: negative ? "#FCA5A5" : "#fff", marginTop: 8, letterSpacing: "-.03em", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
          {sub ? <div style={{ fontSize: 11, color: "rgba(255,255,255,.48)", marginTop: 4 }}>{sub}</div> : null}
        </div>
        <div style={{ width: 38, height: 38, borderRadius: 14, background: "rgba(255,255,255,.10)", color: accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, background: `linear-gradient(90deg,${accent},transparent)` }} />
    </div>
  );
}

function EmptyState({ title, text, icon = <Database size={22} /> }: { title: string; text: string; icon?: ReactNode }) {
  return (
    <div style={{ padding: 54, textAlign: "center", color: C.slate[500] }}>
      <div style={{ width: 54, height: 54, borderRadius: 18, background: C.slate[100], margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center", color: C.slate[400] }}>{icon}</div>
      <div style={{ color: C.slate[700], fontSize: 15, fontWeight: 950 }}>{title}</div>
      <div style={{ fontSize: 12, marginTop: 5 }}>{text}</div>
    </div>
  );
}

function FilterChip({ label, value, onClear }: { label: string; value: string; onClear?: () => void }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 9px", borderRadius: 999, background: C.blue[50], color: C.blue[800], border: "1px solid #BFDBFE", fontSize: 11.5, fontWeight: 900 }}>
      <span style={{ color: C.slate[500], fontWeight: 800 }}>{label}:</span> {value}
      {onClear ? <button type="button" onClick={onClear} style={{ border: "none", background: "transparent", color: C.blue[700], cursor: "pointer", padding: 0, display: "inline-flex" }}><X size={12} /></button> : null}
    </span>
  );
}

function UploadModal({ title, description, accept = ".xlsx,.xls,.csv", onClose, onUpload }: { title: string; description: string; accept?: string; onClose: () => void; onUpload: (file: File) => Promise<any> }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const res = await onUpload(file);
      setResult(res);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Erreur lors de l'import.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div onClick={(e) => e.currentTarget === e.target && !loading && onClose()} style={{ position: "fixed", inset: 0, zIndex: 700, background: "rgba(2,6,23,.62)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "min(480px,100%)", background: "#fff", borderRadius: 24, boxShadow: "0 30px 90px rgba(2,6,23,.28)", padding: 26 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 950, color: C.blue[950] }}>{title}</div>
            <div style={{ fontSize: 12.5, color: C.slate[500], marginTop: 4 }}>{description}</div>
          </div>
          {!loading ? <button type="button" onClick={onClose} style={{ width: 30, height: 30, borderRadius: 10, border: "none", background: C.slate[100], color: C.slate[500], cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={15} /></button> : null}
        </div>

        {!result ? (
          <>
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); }}
              style={{ border: `2px dashed ${dragging ? C.blue[600] : file ? C.ok.main : C.slate[300]}`, borderRadius: 18, padding: "30px 18px", textAlign: "center", cursor: "pointer", background: dragging ? C.blue[50] : file ? "#F0FDF4" : C.slate[50], transition: "all .18s", marginBottom: 14 }}
            >
              <input ref={inputRef} type="file" accept={accept} style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} />
              <FileUp size={30} color={file ? C.ok.main : C.slate[400]} style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 13, fontWeight: 900, color: file ? C.ok.dark : C.slate[700] }}>{file ? file.name : "Glisser-déposer ou cliquer pour sélectionner"}</div>
              <div style={{ fontSize: 11.5, color: C.slate[400], marginTop: 3 }}>{file ? `${(file.size / 1024).toFixed(1)} KB` : accept}</div>
            </div>

            {error ? <div style={{ padding: "10px 12px", borderRadius: 13, background: C.nok.light, border: `1px solid ${C.nok.mid}`, color: C.nok.dark, fontSize: 12, fontWeight: 800, marginBottom: 12 }}>⚠ {error}</div> : null}

            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={onClose} disabled={loading} style={{ flex: 1, padding: "10px 0", borderRadius: 13, border: `1px solid ${C.slate[200]}`, background: "#fff", color: C.slate[700], fontWeight: 900, cursor: "pointer" }}>Annuler</button>
              <button type="button" onClick={submit} disabled={!file || loading} style={{ flex: 2, padding: "10px 0", borderRadius: 13, border: "none", background: file && !loading ? C.blue[800] : C.blue[200], color: "#fff", fontWeight: 950, cursor: file && !loading ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                {loading ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Upload size={15} />}
                {loading ? "Import en cours…" : "Importer"}
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center" }}>
            <CheckCircle2 size={42} color={C.ok.main} style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 16, fontWeight: 950, color: C.slate[800], marginBottom: 14 }}>Import terminé</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 9, marginBottom: 16 }}>
              {[
                { label: "Créés", value: result.created ?? 0, color: C.ok.main },
                { label: "Maj", value: result.updated ?? 0, color: C.cyan.main },
                { label: "Ignorés", value: result.skipped ?? result.skipped_sites_inconnus ?? 0, color: C.warn.main },
              ].map((x) => <div key={x.label} style={{ padding: 12, borderRadius: 14, background: C.slate[50], border: `1px solid ${C.slate[200]}` }}><div style={{ color: x.color, fontSize: 21, fontWeight: 950 }}>{x.value}</div><div style={{ fontSize: 11, color: C.slate[500], fontWeight: 800 }}>{x.label}</div></div>)}
            </div>
            <button type="button" onClick={onClose} style={{ width: "100%", padding: "10px 0", border: "none", borderRadius: 13, background: C.blue[800], color: "#fff", fontWeight: 950, cursor: "pointer" }}>Fermer</button>
          </div>
        )}
      </div>
    </div>
  );
}

function PeriodPicker({ startKey, endKey, onChange }: { startKey: number; endKey: number; onChange: (s: number, e: number) => void }) {
  const options = useMemo(() => buildMonthOptions(2024, new Date().getFullYear() + 1), []);
  const commonSelect: CSSProperties = { height: 38, borderRadius: 12, border: "1px solid rgba(255,255,255,.20)", background: "rgba(255,255,255,.10)", color: "#fff", padding: "0 10px", fontSize: 12, fontWeight: 900, outline: "none" };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Calendar size={15} color="rgba(255,255,255,.65)" />
      <select value={Math.min(startKey, endKey)} onChange={(e) => onChange(Number(e.target.value), endKey)} style={commonSelect}>
        {options.map((o) => <option key={o.key} value={o.key} style={{ color: C.slate[800] }}>{o.label}</option>)}
      </select>
      <span style={{ color: "rgba(255,255,255,.45)", fontWeight: 900 }}>→</span>
      <select value={Math.max(startKey, endKey)} onChange={(e) => onChange(startKey, Number(e.target.value))} style={commonSelect}>
        {options.map((o) => <option key={o.key} value={o.key} style={{ color: C.slate[800] }}>{o.label}</option>)}
      </select>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.slate[200]}`, borderRadius: 14, padding: "10px 12px", boxShadow: "0 16px 40px rgba(15,23,42,.14)", minWidth: 210 }}>
      <div style={{ fontSize: 12, fontWeight: 950, color: C.blue[950], marginBottom: 8 }}>{label}</div>
      <div style={{ display: "grid", gap: 6 }}>
        {payload.filter((p: any) => p.value !== null && p.value !== undefined).map((p: any) => (
          <div key={p.dataKey} style={{ display: "flex", justifyContent: "space-between", gap: 14, fontSize: 11.5 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: C.slate[600] }}><span style={{ width: 8, height: 8, borderRadius: 999, background: p.color || p.fill }} />{p.name || p.dataKey}</span>
            <strong style={{ color: C.slate[800], fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{typeof p.value === "number" ? fmtMoneyShort(p.value) : p.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main module
// ─────────────────────────────────────────────────────────────────────────────

function FinancialModuleContent({ onLock }: { onLock: () => void }) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [startKey, setStartKey] = useState(periodKey(currentYear, Math.max(1, currentMonth - 2)));
  const [endKey, setEndKey] = useState(periodKey(currentYear, currentMonth));
  const [runYear, setRunYear] = useState(currentYear);
  const [runMonth, setRunMonth] = useState(currentMonth);

  const lo = Math.min(startKey, endKey);
  const hi = Math.max(startKey, endKey);
  const { year: yearStart, month: monthStart } = keyToYM(lo);
  const { year: yearEnd, month: monthEnd } = keyToYM(hi);

  const [activeTab, setActiveTab] = useState<TabKey>("evaluations");
  const [evaluations, setEvaluations] = useState<EvalRow[]>([]);
  const [evalStats, setEvalStats] = useState<EvaluationStats | null>(null);
  const [chartData, setChartData] = useState<FacturesRedevancesPeriod[]>([]);
  const [margeData, setMargeData] = useState<SiteMargeRow[]>([]);
  const [recData, setRecData] = useState<SiteRecurrentRow[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsFullReport | null>(null);

  const [loadingEval, setLoadingEval] = useState(false);
  const [loadingChart, setLoadingChart] = useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [runningCalc, setRunningCalc] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [evalResult, setEvalResult] = useState<EvaluateResult | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);

  const [filterStatut, setFilterStatut] = useState<"" | "OK" | "NOK">("");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterTypo, setFilterTypo] = useState("");
  const [filterZone, setFilterZone] = useState("");
  const [filterRecurrence, setFilterRecurrence] = useState("");
  const [filterHC, setFilterHC] = useState(false);
  const [evalPage, setEvalPage] = useState(1);
  const [evalTotal, setEvalTotal] = useState(0);
  const [evalPages, setEvalPages] = useState(1);

  const [showUploadFee, setShowUploadFee] = useState(false);
  const [showUploadLoad, setShowUploadLoad] = useState(false);
  const [modalSite, setModalSite] = useState<ModalSite>(null);

  const baseParams = useMemo(() => ({ year_start: yearStart, month_start: monthStart, year_end: yearEnd, month_end: monthEnd }), [yearStart, monthStart, yearEnd, monthEnd]);

  const loadStats = useCallback(async () => {
    try {
      const s = await fetchEvaluationStats(baseParams as any);
      setEvalStats(s);
    } catch {
      setEvalStats(null);
    }
  }, [baseParams]);

  const loadEvaluations = useCallback(async () => {
    setLoadingEval(true);
    try {
      const params: any = { ...baseParams, page: evalPage, page_size: 100 };
      if (filterStatut) params.statut = filterStatut;
      if (filterSearch.trim()) params.search = filterSearch.trim();
      if (filterTypo.trim()) params.typology = filterTypo.trim();
      if (filterZone) params.zone = filterZone;
      if (filterRecurrence) params.recurrence_type = filterRecurrence;
      if (filterHC) params.hors_catalogue = "true";
      const res = await fetchEvaluations(params);
      setEvaluations((res.results || []) as EvalRow[]);
      setEvalTotal(res.count || 0);
      setEvalPages(res.pages || Math.max(1, Math.ceil((res.count || 0) / 100)));
    } finally {
      setLoadingEval(false);
    }
  }, [baseParams, evalPage, filterStatut, filterSearch, filterTypo, filterZone, filterRecurrence, filterHC]);

  const loadDashboard = useCallback(async () => {
    setLoadingChart(true);
    try {
      const [chart, marge, rec] = await Promise.all([
        fetchFacturesVsRedevances(baseParams as any),
        fetchMargeParSite({ ...baseParams, limit: 50 } as any),
        fetchSitesRecurrents(baseParams as any),
      ]);
      setChartData(chart || []);
      setMargeData(marge || []);
      setRecData(rec || []);
    } catch {
      setChartData([]);
      setMargeData([]);
      setRecData([]);
    } finally {
      setLoadingChart(false);
    }
  }, [baseParams]);

  const loadAnalytics = useCallback(async () => {
    if (activeTab !== "analyse") return;
    setLoadingAnalytics(true);
    try {
      const data = await fetchAnalyticsFullReport(baseParams as any);
      setAnalytics(data);
    } catch {
      setAnalytics(null);
    } finally {
      setLoadingAnalytics(false);
    }
  }, [activeTab, baseParams]);

  useEffect(() => setEvalPage(1), [startKey, endKey, filterStatut, filterSearch, filterTypo, filterZone, filterRecurrence, filterHC]);
  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadEvaluations(); }, [loadEvaluations]);
  useEffect(() => { if (activeTab === "dashboard" || activeTab === "recurrents") loadDashboard(); }, [activeTab, loadDashboard]);
  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

  async function refreshAll() {
    await Promise.all([loadStats(), loadEvaluations()]);
    if (activeTab === "dashboard" || activeTab === "recurrents") await loadDashboard();
    if (activeTab === "analyse") await loadAnalytics();
  }

  async function handleEvaluate() {
    setRunningCalc(true);
    setEvalResult(null);
    setEvalError(null);
    try {
      const res = await runEvaluation({ year: runYear, month: runMonth });
      setEvalResult(res);
      await refreshAll();
    } catch (e: any) {
      setEvalError(e?.response?.data?.detail || e?.message || "Erreur lors du calcul financier.");
    } finally {
      setRunningCalc(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      await exportEvaluationsCSV({
        ...baseParams,
        statut: filterStatut || undefined,
        search: filterSearch.trim() || undefined,
        typology: filterTypo.trim() || undefined,
        zone: filterZone || undefined,
        recurrence_type: filterRecurrence || undefined,
        hors_catalogue: filterHC ? "true" : undefined,
      } as any);
    } finally {
      setExporting(false);
    }
  }

  function openDetail(ev: EvalRow) {
    const sameYear = yearStart === yearEnd;
    setModalSite({
      siteId: ev.site_id,
      siteName: ev.site_name || ev.site_id,
      year: sameYear ? yearStart : ev.year,
      monthStart: sameYear ? monthStart : ev.month,
      monthEnd: sameYear ? monthEnd : ev.month,
    });
  }

  const stats = useMemo(() => {
    const totalRedevance = n((evalStats as any)?.total_redevance);
    const totalFacture = n((evalStats as any)?.total_facture);
    const totalMarge = n((evalStats as any)?.total_marge);
    const countOk = Number((evalStats as any)?.count_ok || 0);
    const countNok = Number((evalStats as any)?.count_nok || 0);
    const countHc = Number((evalStats as any)?.count_hc || 0);
    const countPc = Number((evalStats as any)?.count_pc || 0);
    const countTotal = Number((evalStats as any)?.count_total || 0);
    const ratio = totalFacture ? (totalRedevance / totalFacture - 1) * 100 : null;
    return { totalRedevance, totalFacture, totalMarge, countOk, countNok, countHc, countPc, countTotal, ratio };
  }, [evalStats]);

  const activeFilters = [
    { label: "Période", value: periodText(startKey, endKey) },
    filterZone ? { label: "Zone", value: filterZone, clear: () => setFilterZone("") } : null,
    filterStatut ? { label: "Statut", value: `Marge ${filterStatut}`, clear: () => setFilterStatut("") } : null,
    filterRecurrence ? { label: "Récurrence", value: filterRecurrence, clear: () => setFilterRecurrence("") } : null,
    filterHC ? { label: "Hors catalogue", value: "Oui", clear: () => setFilterHC(false) } : null,
    filterSearch ? { label: "Recherche", value: filterSearch, clear: () => setFilterSearch("") } : null,
    filterTypo ? { label: "Typologie", value: filterTypo, clear: () => setFilterTypo("") } : null,
  ].filter(Boolean) as Array<{ label: string; value: string; clear?: () => void }>;

  const chartRows = useMemo(() => (chartData || []).map((r: any) => ({
    period: r.period,
    label: r.period?.slice(5) || r.period,
    redevance: n(r.total_redevance),
    facture: n(r.total_facture),
    marge: n(r.total_marge),
    ok: Number(r.sites_ok || 0),
    nok: Number(r.sites_nok || 0),
  })), [chartData]);

  const inputStyle: CSSProperties = { height: 38, borderRadius: 12, border: `1px solid ${C.slate[200]}`, background: "#fff", padding: "0 12px", fontSize: 12, color: C.slate[700], outline: "none", boxShadow: "0 1px 2px rgba(0,0,0,.04)" };
  const iconButtonStyle: CSSProperties = { height: 38, borderRadius: 12, border: "none", display: "inline-flex", alignItems: "center", gap: 7, padding: "0 12px", fontSize: 12, fontWeight: 950, cursor: "pointer" };

  return (
    <div style={{ minHeight: "100vh", background: PAGE_BG, color: C.slate[800] }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fin-row:hover { background: #EFF6FF !important; }
        .fin-table th { position: sticky; top: 0; z-index: 20; }
        .fin-sticky { position: sticky; left: 0; z-index: 12; box-shadow: 12px 0 18px rgba(15,23,42,.04); }
        .fin-sticky-head { position: sticky !important; left: 0; z-index: 30 !important; }
      `}</style>

      <div style={{ background: HDR, color: "#fff", padding: "22px 24px 18px", boxShadow: "0 18px 45px rgba(1,14,42,.24)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 9px", background: "rgba(255,255,255,.10)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 999, fontSize: 11, fontWeight: 950, color: "rgba(255,255,255,.72)" }}>
              <Wallet size={13} /> Module financier · Marges & redevances
            </div>
            <h1 style={{ margin: "12px 0 4px", fontSize: 27, lineHeight: 1.1, letterSpacing: "-.04em", fontWeight: 950 }}>Analyse financière des marges Aktivco</h1>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.62)", maxWidth: 900 }}>Suivi des redevances, factures HTVA, marges, récurrences NOK et analyse détaillée par site.</div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <PeriodPicker startKey={startKey} endKey={endKey} onChange={(s, e) => { setStartKey(s); setEndKey(e); }} />
            <button type="button" onClick={refreshAll} style={{ ...iconButtonStyle, background: "rgba(255,255,255,.12)", color: "#fff", border: "1px solid rgba(255,255,255,.18)" }}><RefreshCw size={14} className={loadingEval || loadingChart ? "spin" : ""} /> Actualiser</button>
            <button type="button" onClick={onLock} style={{ ...iconButtonStyle, background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.82)", border: "1px solid rgba(255,255,255,.12)" }}><Lock size={14} /> Verrouiller</button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(6,minmax(150px,1fr))", gap: 12, marginTop: 18 }}>
          <KpiCard label="Marge cumulée" value={fmtMoney(stats.totalMarge)} sub={`${stats.countOk} OK · ${stats.countNok} NOK`} accent={moneyColor(stats.totalMarge)} icon={stats.totalMarge < 0 ? <TrendingDown size={22} /> : <TrendingUp size={22} />} negative={stats.totalMarge < 0} help="Somme des marges : redevance - montant HTVA réel." />
          <KpiCard label="Redevance" value={fmtMoney(stats.totalRedevance)} sub="Total attendu" accent={C.blue[300]} icon={<Wallet size={22} />} help="Somme des redevances calculées depuis le catalogue." />
          <KpiCard label="Facture HTVA" value={fmtMoney(stats.totalFacture)} sub="Total réel Sénélec" accent={C.orange.main} icon={<Database size={22} />} help="Montant hors TVA réel facturé." />
          <KpiCard label="Marge NOK" value={String(stats.countNok)} sub={`${stats.countTotal} lignes analysées`} accent={stats.countNok ? C.nok.main : C.ok.main} icon={stats.countNok ? <XCircle size={22} /> : <CheckCircle2 size={22} />} help="Nombre de lignes dont la marge est négative." />
          <KpiCard label="Hors catalogue" value={String(stats.countHc)} sub={`${stats.countPc} périodes courtes`} accent={stats.countHc ? C.warn.main : C.cyan.main} icon={<AlertTriangle size={22} />} help="Sites dont le load a nécessité un fallback catalogue." />
          <KpiCard label="Redev./Fact." value={fmtPct(stats.ratio)} sub="Écart global" accent={stats.ratio === null ? C.slate[300] : stats.ratio >= 0 ? C.ok.main : C.nok.main} icon={<Target size={22} />} help="Écart entre la redevance attendue et le montant HTVA réel." />
        </div>
      </div>

      <div style={{ padding: 22, display: "grid", gap: 16 }}>
        <Card>
          <div style={{ padding: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ position: "relative", minWidth: 260 }}>
              <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.slate[400] }} />
              <input value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} placeholder="Rechercher site, nom…" style={{ ...inputStyle, paddingLeft: 34, width: "100%" }} />
            </div>
            <select value={filterZone} onChange={(e) => setFilterZone(e.target.value)} style={inputStyle}><option value="">Toutes zones</option>{ZONES.map((z) => <option key={z} value={z}>{z}</option>)}</select>
            <input value={filterTypo} onChange={(e) => setFilterTypo(e.target.value)} placeholder="Typologie…" style={{ ...inputStyle, width: 170 }} />
            <select value={filterStatut} onChange={(e) => setFilterStatut(e.target.value as "" | "OK" | "NOK")} style={inputStyle}><option value="">Tous statuts marge</option><option value="OK">Marge OK</option><option value="NOK">Marge NOK</option></select>
            <select value={filterRecurrence} onChange={(e) => setFilterRecurrence(e.target.value)} style={inputStyle}><option value="">Toutes récurrences</option><option value="light">Light</option><option value="critique">Critique</option></select>
            <button type="button" onClick={() => setFilterHC((v) => !v)} style={{ ...iconButtonStyle, background: filterHC ? C.warn.light : "#fff", color: filterHC ? C.warn.dark : C.slate[600], border: `1px solid ${filterHC ? C.warn.mid : C.slate[200]}` }}>HC</button>

            {(filterSearch || filterZone || filterTypo || filterStatut || filterRecurrence || filterHC) ? <button type="button" onClick={() => { setFilterSearch(""); setFilterZone(""); setFilterTypo(""); setFilterStatut(""); setFilterRecurrence(""); setFilterHC(false); }} style={{ ...iconButtonStyle, background: C.warn.light, color: C.warn.dark, border: `1px solid ${C.warn.mid}` }}><Filter size={14} /> Effacer</button> : null}

            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              <button type="button" onClick={() => setShowUploadFee(true)} style={{ ...iconButtonStyle, background: C.blue[50], color: C.blue[700], border: `1px solid ${C.blue[100]}` }}><Upload size={14} /> Catalogue</button>
              <button type="button" onClick={() => setShowUploadLoad(true)} style={{ ...iconButtonStyle, background: C.cyan.light, color: C.cyan.dark, border: "1px solid #A5F3FC" }}><Layers size={14} /> Loads</button>
              <button type="button" onClick={handleExport} disabled={exporting} style={{ ...iconButtonStyle, background: "#fff", color: exporting ? C.slate[400] : C.slate[700], border: `1px solid ${C.slate[200]}` }}>{exporting ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={14} />} Export</button>
            </div>
          </div>

          <div style={{ padding: "0 14px 14px", display: "flex", gap: 8, flexWrap: "wrap" }}>
            {activeFilters.map((f) => <FilterChip key={`${f.label}-${f.value}`} label={f.label} value={f.value} onClear={f.clear} />)}
          </div>
        </Card>

        <Card>
          <div style={{ padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Badge tone="blue"><Sparkles size={12} /> Calcul financier</Badge>
              <select value={runMonth} onChange={(e) => setRunMonth(Number(e.target.value))} style={inputStyle}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
              <input type="number" value={runYear} onChange={(e) => setRunYear(Number(e.target.value))} style={{ ...inputStyle, width: 100 }} />
              <button type="button" onClick={handleEvaluate} disabled={runningCalc} style={{ ...iconButtonStyle, background: C.blue[800], color: "#fff" }}>{runningCalc ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={14} />} Lancer l’évaluation</button>
            </div>
            <div style={{ fontSize: 12, color: C.slate[500] }}>{evalResult ? <Badge tone="ok"><CheckCircle2 size={12} /> {String((evalResult as any).message || "Évaluation terminée")}</Badge> : evalError ? <Badge tone="nok"><XCircle size={12} /> {evalError}</Badge> : "L’évaluation recalcule les marges du mois sélectionné."}</div>
          </div>
        </Card>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {([
            ["evaluations", "Évaluations", <ShieldCheck size={14} />],
            ["dashboard", "Dashboard", <BarChart3 size={14} />],
            ["recurrents", "Récurrents", <AlertTriangle size={14} />],
            ["donnees", "Données & imports", <Database size={14} />],
          ] as const).map(([key, label, icon]) => <button key={key} type="button" onClick={() => setActiveTab(key)} style={{ border: `1px solid ${activeTab === key ? C.blue[600] : C.slate[200]}`, background: activeTab === key ? C.blue[700] : "#fff", color: activeTab === key ? "#fff" : C.slate[600], borderRadius: 999, padding: "9px 14px", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 950, cursor: "pointer", boxShadow: activeTab === key ? "0 10px 24px rgba(10,61,150,.22)" : "0 1px 2px rgba(0,0,0,.04)" }}>{icon}{label}</button>)}
        </div>

        {activeTab === "evaluations" ? (
          <EvaluationsView rows={evaluations} loading={loadingEval} total={evalTotal} page={evalPage} pages={evalPages} setPage={setEvalPage} onOpenDetail={openDetail} />
        ) : null}

        {activeTab === "dashboard" ? (
          <DashboardView loading={loadingChart} chartRows={chartRows} margeData={margeData} />
        ) : null}

        {activeTab === "recurrents" ? (
          <RecurrentsView loading={loadingChart} rows={recData} onOpenDetail={(siteId, siteName) => setModalSite({ siteId, siteName: siteName || siteId, year: yearStart === yearEnd ? yearStart : yearEnd, monthStart: yearStart === yearEnd ? monthStart : 1, monthEnd: yearStart === yearEnd ? monthEnd : 12 })} />
        ) : null}

        {activeTab === "analyse" ? (
          <AnalyticsView loading={loadingAnalytics} analytics={analytics} />
        ) : null}

        {activeTab === "donnees" ? (
          <Card style={{ padding: 18 }}><FinancialDataPage /></Card>
        ) : null}
      </div>

      {modalSite ? <FinancialSiteDetailModal siteId={modalSite.siteId} siteName={modalSite.siteName} year={modalSite.year} monthStart={modalSite.monthStart} monthEnd={modalSite.monthEnd} onClose={() => setModalSite(null)} /> : null}

      {showUploadFee ? <UploadModal title="Catalogue redevances" description="Fichier Redevance_et_Cible_Akt.xlsx — Typologie | Load | Config | Redevance | Cible" accept=".xlsx,.xls" onClose={() => setShowUploadFee(false)} onUpload={async (file) => importFeeRules(file)} /> : null}
      {showUploadLoad ? <UploadModal title="Loads mensuels" description="CSV/XLSX : Site_ID | Site_Name | Année | Mois | Load | Source" accept=".csv,.xlsx,.xls" onClose={() => setShowUploadLoad(false)} onUpload={async (file) => importMonthlyLoads(file)} /> : null}
    </div>
  );
}

function EvaluationsView({ rows, loading, total, page, pages, setPage, onOpenDetail }: { rows: EvalRow[]; loading: boolean; total: number; page: number; pages: number; setPage: React.Dispatch<React.SetStateAction<number>>; onOpenDetail: (ev: EvalRow) => void }) {
  return (
    <Card>
      <SectionTitle icon={<ShieldCheck size={18} />} title="Évaluations financières" subtitle="Redevance, montant HTVA, marge et statut par site × mois" right={<Badge tone="blue">{total.toLocaleString("fr-FR")} lignes</Badge>} />
      {loading && !rows.length ? <EmptyState title="Chargement…" text="Récupération des évaluations financières." icon={<Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} />} /> : null}
      {!loading && !rows.length ? <EmptyState title="Aucune évaluation" text="Aucune donnée ne correspond aux filtres sélectionnés." /> : null}
      {rows.length ? <EvaluationTable rows={rows} onOpenDetail={onOpenDetail} /> : null}
      {pages > 1 ? <Pagination page={page} pages={pages} total={total} setPage={setPage} /> : null}
    </Card>
  );
}

function EvaluationTable({ rows, onOpenDetail }: { rows: EvalRow[]; onOpenDetail: (ev: EvalRow) => void }) {
  return (
    <div style={{ overflow: "auto", maxHeight: "calc(100vh - 320px)" }}>
      <table className="fin-table" style={{ width: "100%", minWidth: 1360, borderCollapse: "separate", borderSpacing: 0, fontSize: 11.5 }}>
        <thead>
          <tr>
            <Th sticky>Site</Th><Th>Zone</Th><Th>Période</Th><Th>Typologie</Th><Th center>Config</Th><Th right>Load</Th><Th right>Redevance</Th><Th right>Montant HT</Th><Th right>Marge</Th><Th center>Statut</Th><Th center>Récurrence</Th><Th center>Flags</Th><Th center>Analyse</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((ev, i) => {
            const isNok = ev.marge_statut === "NOK";
            const bg = isNok ? "#FFF7F7" : i % 2 ? C.slate[50] : "#fff";
            return (
              <tr key={ev.id} className="fin-row" style={{ background: bg }}>
                <Td sticky><button type="button" onClick={() => onOpenDetail(ev)} style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", textAlign: "left" }}><div style={{ display: "flex", alignItems: "center", gap: 5, color: C.blue[700], fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 950 }}>{ev.site_id}<Eye size={12} /></div><div style={{ maxWidth: 170, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 10.5, color: C.slate[500], marginTop: 2 }}>{ev.site_name || "—"}</div></button></Td>
                <Td><Badge tone="blue">{ev.zone || "—"}</Badge></Td>
                <Td><strong style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: C.blue[800] }}>{ev.year}-{String(ev.month).padStart(2, "0")}</strong><div style={{ fontSize: 10, color: C.slate[400] }}>{periodLabel(ev.year, ev.month)}</div></Td>
                <Td><span title={ev.typology || ""} style={{ display: "inline-block", maxWidth: 170, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 800, color: C.slate[700] }}>{ev.typology || "—"}</span></Td>
                <Td center>{ev.configuration ? <Badge tone={ev.configuration === "OUTDOOR" ? "ok" : "cyan"}>{ev.configuration}</Badge> : "—"}</Td>
                <Td right>{ev.load_w ? `${ev.load_w.toLocaleString("fr-FR")} W` : "—"}</Td>
                <Td right><strong style={{ color: C.blue[700], fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{fmtMoney(ev.redevance)}</strong></Td>
                <Td right><strong style={{ color: C.orange.dark, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{fmtMoney(ev.montant_htva)}</strong></Td>
                <Td right><strong style={{ color: moneyColor(ev.marge), fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{fmtMoney(ev.marge)}</strong></Td>
                <Td center><StatusBadge status={ev.marge_statut} /></Td>
                <Td center><RecurrenceBadge type={ev.recurrence_type} months={ev.recurrence_mois_nok} /></Td>
                <Td center><div style={{ display: "inline-flex", gap: 5 }}>{ev.hors_catalogue ? <Badge tone="warn">HC</Badge> : null}{ev.periode_courte ? <Badge tone="cyan">PC</Badge> : null}{!ev.hors_catalogue && !ev.periode_courte ? <span style={{ color: C.slate[400] }}>—</span> : null}</div></Td>
                <Td center><button type="button" onClick={() => onOpenDetail(ev)} style={{ height: 30, padding: "0 10px", borderRadius: 10, border: "none", background: C.blue[700], color: "#fff", fontSize: 11.5, fontWeight: 950, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}><Eye size={13} /> Analyse</button></Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DashboardView({ loading, chartRows, margeData }: { loading: boolean; chartRows: any[]; margeData: SiteMargeRow[] }) {
  if (loading) return <Card><EmptyState title="Chargement du dashboard…" text="Préparation des graphiques financiers." icon={<Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} />} /></Card>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.35fr .65fr", gap: 16 }}>
      <Card>
        <SectionTitle icon={<TrendingUp size={18} />} title="Évolution financière mensuelle" subtitle="Redevance, montant HTVA réel et marge" />
        <div style={{ height: 380, padding: 18 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartRows} margin={{ top: 8, right: 18, bottom: 8, left: 4 }}>
              <defs><linearGradient id="margeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.ok.main} stopOpacity={0.18} /><stop offset="95%" stopColor={C.ok.main} stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.slate[100]} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.slate[500] }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.slate[500] }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 1_000_000)}M`} width={58} />
              <Tooltip content={<ChartTooltip />} /><Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="marge" name="Marge" stroke={C.ok.main} fill="url(#margeFill)" strokeWidth={2.3} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="redevance" name="Redevance" stroke={C.blue[600]} strokeWidth={2.2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="facture" name="Facture HT" stroke={C.orange.main} strokeWidth={2.2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <SectionTitle icon={<ShieldCheck size={18} />} title="Statuts par mois" subtitle="Sites OK / NOK" />
        <div style={{ height: 380, padding: 18 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.slate[100]} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.slate[500] }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.slate[500] }} axisLine={false} tickLine={false} />
              <Tooltip /><Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="ok" name="OK" stackId="s" fill={C.ok.main} radius={[0, 0, 0, 0]} />
              <Bar dataKey="nok" name="NOK" stackId="s" fill={C.nok.main} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card style={{ gridColumn: "1 / -1" }}>
        <SectionTitle icon={<TrendingDown size={18} />} title="Top marges faibles" subtitle="Sites les plus défavorables sur la période" />
        <div style={{ padding: 16 }}>
          {margeData.length ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 10 }}>{margeData.slice(0, 12).map((r: any) => <div key={r.site_id} style={{ padding: 13, borderRadius: 16, border: `1px solid ${C.slate[200]}`, background: n(r.marge_moyenne) < 0 ? C.nok.light : "#fff" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><div><div style={{ color: C.blue[800], fontWeight: 950, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{r.site_id}</div><div style={{ fontSize: 11, color: C.slate[500], marginTop: 2 }}>{r.site_name || "—"}</div></div><div style={{ textAlign: "right" }}><div style={{ color: moneyColor(r.marge_moyenne), fontWeight: 950 }}>{fmtMoney(r.marge_moyenne)}</div><div style={{ fontSize: 11, color: C.slate[500] }}>{r.nb_nok || 0} NOK / {r.nb_mois || 0} mois</div></div></div></div>)}</div> : <EmptyState title="Aucune donnée" text="Aucune marge par site disponible." />}
        </div>
      </Card>
    </div>
  );
}

function RecurrentsView({ loading, rows, onOpenDetail }: { loading: boolean; rows: SiteRecurrentRow[]; onOpenDetail: (siteId: string, siteName?: string) => void }) {
  if (loading) return <Card><EmptyState title="Chargement des récurrences…" text="Recherche des sites NOK récurrents." icon={<Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} />} /></Card>;

  return (
    <Card>
      <SectionTitle icon={<AlertTriangle size={18} />} title="Sites récurrents NOK" subtitle="Suivi des anomalies financières répétées" right={<Badge tone={rows.length ? "nok" : "ok"}>{rows.length} sites</Badge>} />
      <div style={{ padding: 16 }}>
        {rows.length ? <div style={{ overflow: "auto", border: `1px solid ${C.slate[200]}`, borderRadius: 16 }}><table style={{ width: "100%", minWidth: 820, borderCollapse: "separate", borderSpacing: 0, fontSize: 12 }}><thead><tr><Th>Site</Th><Th center>Type</Th><Th right>Mois NOK</Th><Th right>Marge moyenne</Th><Th center>Analyse</Th></tr></thead><tbody>{rows.map((r: any, i) => <tr key={`${r.site_id}-${r.recurrence_type}`} className="fin-row" style={{ background: i % 2 ? C.slate[50] : "#fff" }}><Td><strong style={{ color: C.blue[800], fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{r.site_id}</strong><div style={{ fontSize: 11, color: C.slate[500] }}>{r.site_name || "—"}</div></Td><Td center><RecurrenceBadge type={r.recurrence_type} months={r.mois_nok} /></Td><Td right>{r.mois_nok}</Td><Td right><strong style={{ color: moneyColor(r.marge_moyenne) }}>{fmtMoney(r.marge_moyenne)}</strong></Td><Td center><button type="button" onClick={() => onOpenDetail(r.site_id, r.site_name)} style={{ height: 30, padding: "0 10px", border: "none", borderRadius: 10, background: C.blue[700], color: "#fff", cursor: "pointer", fontSize: 11.5, fontWeight: 950 }}><Eye size={13} /> Analyse</button></Td></tr>)}</tbody></table></div> : <EmptyState title="Aucun site récurrent NOK" text="Aucune anomalie de marge répétée sur la période sélectionnée." icon={<CheckCircle2 size={22} />} />}
      </div>
    </Card>
  );
}

function AnalyticsView({ loading, analytics }: { loading: boolean; analytics: AnalyticsFullReport | null }) {
  if (loading) return <Card><EmptyState title="Chargement de l’analyse globale…" text="Consolidation des indicateurs avancés." icon={<Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} />} /></Card>;
  if (!analytics) return <Card><EmptyState title="Aucune analyse disponible" text="L’endpoint d’analyse globale n’a retourné aucune donnée." icon={<LineIcon size={22} />} /></Card>;

  const data: any = analytics as any;
  const summary = data.summary || data.resume || data.totaux || {};
  const entries = Object.entries(summary).slice(0, 8);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card>
        <SectionTitle icon={<Sparkles size={18} />} title="Analyse globale" subtitle="Vue consolidée retournée par le backend" />
        <div style={{ padding: 16 }}>
          {entries.length ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>{entries.map(([k, v]) => <div key={k} style={{ padding: 14, borderRadius: 16, background: C.slate[50], border: `1px solid ${C.slate[200]}` }}><div style={{ fontSize: 10, color: C.slate[500], fontWeight: 950, textTransform: "uppercase", letterSpacing: ".08em" }}>{k.replaceAll("_", " ")}</div><div style={{ marginTop: 7, fontSize: 17, fontWeight: 950, color: C.blue[800], fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{typeof v === "number" ? fmtInt(v) : String(v ?? "—")}</div></div>)}</div> : <EmptyState title="Résumé vide" text="Le rapport existe mais ne contient pas de bloc summary exploitable." />}
        </div>
      </Card>
      <Card>
        <SectionTitle icon={<Database size={18} />} title="Données brutes" subtitle="Aide au diagnostic technique" />
        <pre style={{ margin: 0, padding: 16, maxHeight: 420, overflow: "auto", fontSize: 11.5, color: C.slate[700], background: C.slate[50] }}>{JSON.stringify(analytics, null, 2)}</pre>
      </Card>
    </div>
  );
}

function Pagination({ page, pages, total, setPage }: { page: number; pages: number; total: number; setPage: React.Dispatch<React.SetStateAction<number>> }) {
  const pageNumbers = Array.from({ length: Math.min(7, pages) }, (_, i) => {
    const p = page <= 4 ? i + 1 : page - 3 + i;
    return p >= 1 && p <= pages ? p : null;
  }).filter(Boolean) as number[];

  return (
    <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.slate[200]}`, background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div style={{ color: C.slate[500], fontSize: 12 }}>Page {page}/{pages} — {total.toLocaleString("fr-FR")} résultats</div>
      <div style={{ display: "flex", gap: 6 }}>
        <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} style={pageBtn(page <= 1)}><ChevronLeft size={13} /> Préc.</button>
        {pageNumbers.map((p) => <button key={p} onClick={() => setPage(p)} style={{ width: 31, height: 31, borderRadius: 9, border: `1px solid ${p === page ? C.blue[700] : C.slate[200]}`, background: p === page ? C.blue[700] : "#fff", color: p === page ? "#fff" : C.slate[700], fontWeight: 900, cursor: "pointer" }}>{p}</button>)}
        <button disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))} style={pageBtn(page >= pages)}>Suiv. <ChevronRight size={13} /></button>
      </div>
    </div>
  );
}

function pageBtn(disabled: boolean): CSSProperties {
  return { height: 31, padding: "0 10px", borderRadius: 9, border: `1px solid ${C.slate[200]}`, background: "#fff", color: disabled ? C.slate[300] : C.slate[700], cursor: disabled ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 900, display: "inline-flex", alignItems: "center", gap: 4 };
}

function Th({ children, right, center, sticky }: { children: ReactNode; right?: boolean; center?: boolean; sticky?: boolean }) {
  return <th className={sticky ? "fin-sticky-head" : undefined} style={{ padding: "10px 12px", background: C.blue[900], color: "rgba(255,255,255,.88)", fontSize: 10, fontWeight: 950, textTransform: "uppercase", letterSpacing: ".08em", textAlign: right ? "right" : center ? "center" : "left", borderBottom: `1px solid ${C.blue[700]}`, whiteSpace: "nowrap", left: sticky ? 0 : undefined, minWidth: sticky ? 210 : undefined }}>{children}</th>;
}

function Td({ children, right, center, sticky }: { children: ReactNode; right?: boolean; center?: boolean; sticky?: boolean }) {
  return <td className={sticky ? "fin-sticky" : undefined} style={{ padding: "11px 12px", textAlign: right ? "right" : center ? "center" : "left", borderBottom: `1px solid ${C.slate[200]}`, borderRight: `1px solid ${C.slate[100]}`, verticalAlign: "middle", background: sticky ? "inherit" : undefined, left: sticky ? 0 : undefined, minWidth: sticky ? 210 : undefined }}>{children}</td>;
}

export default function FinancialPage() {
  const [unlocked, setUnlocked] = useState(isFinancialUnlocked);

  const handleUnlock = () => {
    financialUnlock();
    setUnlocked(true);
  };

  const handleLock = () => {
    financialLock();
    setUnlocked(false);
  };

  if (!unlocked) return <FinancialAccessGate onUnlock={handleUnlock} />;
  return <FinancialModuleContent onLock={handleLock} />;
}
