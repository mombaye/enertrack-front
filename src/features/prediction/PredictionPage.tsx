// src/features/prediction/PredictionForecastPage.tsx
// V2 — Front prédiction consommation EnerTrack
// Objectif : prédiction hybride avec historique, prévision, mois partiels, météo, événements et marge prévisionnelle.

import { useCallback, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  CloudRain,
  Database,
  Download,
  Gauge,
  HelpCircle,
  Info,
  Layers,
  LineChart as LineIcon,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  ThermometerSun,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
  XCircle,
  Zap,
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
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/services/api";

// ─────────────────────────────────────────────────────────────────────────────
// API types + helper
// Tu peux aussi déplacer ces types dans src/features/prediction/api.ts
// ─────────────────────────────────────────────────────────────────────────────

export type PredictionEvent = {
  name: string;
  date: string;
  window_start?: string;
  window_end?: string;
  days_in_month?: number;
  zone_weight?: number;
  pressure?: number;
};

export type PredictionMeteo = {
  temp_max_mean?: number;
  temp_min_mean?: number;
  precip_total?: number;
  humidity_max?: number;
  et0_mean?: number;
  is_hivernage?: number;
  meteo_source?: string;
};

export type PredictionBaseline = {
  lag_1m?: number;
  lag_3m?: number;
  lag_6m?: number;
  lag_12m?: number;
  same_month_avg?: number;
  rolling_3m?: number;
  rolling_6m?: number;
  trend_3m_vs_12m?: number;
};

export type PredictionEstimationSignal = {
  available?: boolean;
  source?: string | null;
  conso_estimee_kwh?: number | null;
  source_score?: number;
};

export type PredictionMonth = {
  period: string;
  year: number;
  month: number;

  conso_pred: number;
  conso_full_month_model?: number | null;
  conso_rule_based?: number | null;
  conso_ml?: number | null;

  observed_kwh?: number;
  remaining_pred_kwh?: number;
  is_partial_month?: boolean;
  observed_days?: number;
  remaining_days?: number;

  ht_pred: number;
  redevance?: number;
  marge_pred: number;
  marge_ok: boolean;

  ic_lo: number;
  ic_hi: number;
  confidence: number;
  fnp_score: number;

  baseline?: PredictionBaseline;
  events?: PredictionEvent[];
  event_pressure?: number;
  meteo?: PredictionMeteo;
  estimation?: PredictionEstimationSignal;
  explanation?: string[];

  // Compat ancienne version
  top_factors?: { feature: string; impact: number }[];
};

export type PredictionHistoricMonth = {
  period: string;
  conso?: number;
  conso_full?: number;
  ht?: number;
  days?: number;
  is_partial?: boolean;
};

export type PredictionResponse = {
  site_id: string;
  site_name?: string | null;
  zone?: string;
  zone_raw?: string;
  zone_normalized?: string;
  horizon: number;
  period_start?: string;
  period_end?: string;
  generated_at: string;
  model_version: string;
  model_used?: boolean;
  historic: PredictionHistoricMonth[];
  predictions: PredictionMonth[];
};

export function getPrediction(params: {
  site: string;
  horizon?: number;
  year_start?: number;
  month_start?: number;
  year_end?: number;
  month_end?: number;
}) {
  return api.get<PredictionResponse>("/prediction/forecast/", { params }).then((r) => r.data);
}


export type PredictionBulkSummary = {
  period_start: string;
  period_end: string;
  zone?: string | null;
  sites_requested: number;
  sites_processed: number;
  sites_error: number;
  months_predicted: number;
  total_conso_pred: number;
  total_ht_pred: number;
  total_marge_pred: number;
  months_marge_nok: number;
  avg_confidence: number;
};

export type PredictionBulkResponse = {
  mode: "bulk";
  generated_at: string;
  summary: PredictionBulkSummary;
  results: PredictionResponse[];
  errors: { "Site ID": string; Erreur: string }[];
};

export function getPredictionBulk(params: {
  horizon?: number;
  year_start?: number;
  month_start?: number;
  year_end?: number;
  month_end?: number;
  zone?: string;
  search?: string;
  limit?: number;
}) {
  return api
    .get<PredictionBulkResponse>("/prediction/forecast-bulk/", { params })
    .then((r) => r.data);
}

export async function exportPredictionBulkExcel(params: {
  horizon?: number;
  year_start?: number;
  month_start?: number;
  year_end?: number;
  month_end?: number;
  zone?: string;
  search?: string;
  limit?: number;
}) {
  const response = await api.get("/prediction/forecast-bulk/", {
    params: { ...params, export: "xlsx" },
    responseType: "blob",
  });

  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `prediction_parc_${params.year_start || ""}_${params.month_start || ""}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}


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
    200: "#C0D8FB",
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
  orange: { main: "#EA580C", light: "#FFEDD5", dark: "#C2410C" },
  rose: { main: "#DB2777", light: "#FCE7F3", dark: "#9D174D" },
};

const HDR = "linear-gradient(135deg,#010E2A 0%,#032566 54%,#0A3D96 100%)";
const PAGE_BG = "linear-gradient(180deg,#F8FAFC 0%,#EEF4FF 100%)";
const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const periodKey = (y: number, m: number) => y * 100 + m;
const keyToYM = (k: number) => ({ year: Math.floor(k / 100), month: k % 100 });
const fmtPeriod = (y: number, m: number) => `${MONTHS_FR[m - 1]} ${y}`;

function n(v: number | string | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0;
  const parsed = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function maybe(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const parsed = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function fmtKwh(v: number | string | null | undefined): string {
  const value = maybe(v);
  if (value === null) return "—";
  if (Math.abs(value) >= 1000) return `${(value / 1000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MWh`;
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} kWh`;
}

function fmtMoney(v: number | string | null | undefined): string {
  const value = maybe(v);
  if (value === null) return "—";
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M FCFA`;
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} FCFA`;
}

function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function fmtConfidence(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${Math.round(v * 100)}%`;
}

function fmtDate(d?: string | null): string {
  if (!d) return "—";
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function mwhTick(v: number) {
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)} MWh`;
  return `${Math.round(v)} kWh`;
}

function moneyTick(v: number) {
  if (Math.abs(v) >= 1_000_000) return `${Math.round(v / 1_000_000)}M`;
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k`;
  return `${Math.round(v)}`;
}

function periodFromKey(k: number) {
  const { year, month } = keyToYM(k);
  return `${year}-${String(month).padStart(2, "0")}`;
}

function buildMonthOptions(fromYear = 2024, toYear = new Date().getFullYear() + 2) {
  const out: Array<{ key: number; label: string }> = [];
  for (let y = fromYear; y <= toYear; y += 1) {
    for (let m = 1; m <= 12; m += 1) out.push({ key: periodKey(y, m), label: fmtPeriod(y, m) });
  }
  return out;
}

function cleanEventName(name: string) {
  const map: Record<string, string> = {
    magal: "Magal",
    gamou: "Gamou",
    tabaski: "Tabaski",
    korite: "Korité",
    tamkharit: "Tamkharit",
    magal_darou: "Magal Darou",
    layene: "Appel Layène",
  };
  return map[name] || name.replaceAll("_", " ");
}

function confidenceColor(conf: number) {
  if (conf >= 0.78) return C.ok.main;
  if (conf >= 0.62) return C.warn.main;
  return C.nok.main;
}

function riskTone(score: number): "ok" | "warn" | "nok" {
  if (score >= 0.65) return "nok";
  if (score >= 0.35) return "warn";
  return "ok";
}

function riskLabel(score: number) {
  if (score >= 0.65) return "Risque élevé";
  if (score >= 0.35) return "Risque moyen";
  return "Risque faible";
}

// ─────────────────────────────────────────────────────────────────────────────
// UI atoms
// ─────────────────────────────────────────────────────────────────────────────

function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "blue" | "ok" | "nok" | "warn" | "cyan" | "purple" | "orange" | "rose" }) {
  const map = {
    slate: { bg: C.slate[100], color: C.slate[700], border: C.slate[200] },
    blue: { bg: C.blue[100], color: C.blue[700], border: C.blue[200] },
    ok: { bg: C.ok.light, color: C.ok.dark, border: C.ok.mid },
    nok: { bg: C.nok.light, color: C.nok.dark, border: C.nok.mid },
    warn: { bg: C.warn.light, color: C.warn.dark, border: C.warn.mid },
    cyan: { bg: C.cyan.light, color: C.cyan.dark, border: "#A5F3FC" },
    purple: { bg: C.purple.light, color: C.purple.dark, border: "#DDD6FE" },
    orange: { bg: C.orange.light, color: C.orange.dark, border: "#FDBA74" },
    rose: { bg: C.rose.light, color: C.rose.dark, border: "#FBCFE8" },
  }[tone];

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 999, border: `1px solid ${map.border}`, background: map.bg, color: map.color, fontSize: 10.5, fontWeight: 900, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function HelpTip({ text, light = false }: { text: string; light?: boolean }) {
  return <HelpCircle size={12} style={{ color: light ? "rgba(255,255,255,.58)" : C.slate[400], cursor: "help" }} title={text} />;
}

function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ background: "rgba(255,255,255,.94)", border: `1px solid ${C.slate[200]}`, borderRadius: 20, boxShadow: "0 18px 45px rgba(15,23,42,.07)", overflow: "hidden", ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, title, subtitle, right }: { icon: ReactNode; title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div style={{ padding: "16px 18px", borderBottom: `1px solid ${C.slate[100]}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
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

function KpiCard({ label, value, sub, icon, accent, help, danger }: { label: string; value: string; sub?: string; icon: ReactNode; accent: string; help?: string; danger?: boolean }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 18, background: "rgba(255,255,255,.09)", border: "1px solid rgba(255,255,255,.14)", padding: "15px 16px", minHeight: 92, boxShadow: "inset 0 1px 0 rgba(255,255,255,.12)" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 90% 12%,${accent}33,transparent 32%)` }} />
      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 950, color: "rgba(255,255,255,.52)", letterSpacing: ".08em", textTransform: "uppercase" }}>{label}</div>
            {help ? <HelpTip text={help} light /> : null}
          </div>
          <div style={{ fontSize: 22, fontWeight: 950, color: danger ? "#FCA5A5" : "#fff", marginTop: 8, letterSpacing: "-.03em", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
          {sub ? <div style={{ fontSize: 11, color: "rgba(255,255,255,.48)", marginTop: 4 }}>{sub}</div> : null}
        </div>
        <div style={{ width: 38, height: 38, borderRadius: 14, background: "rgba(255,255,255,.10)", color: accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, background: `linear-gradient(90deg,${accent},transparent)` }} />
    </div>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ padding: 58, textAlign: "center", color: C.slate[500] }}>
      <div style={{ width: 56, height: 56, borderRadius: 18, background: C.slate[100], margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center", color: C.slate[400] }}>
        <Search size={23} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 950, color: C.slate[700] }}>{title}</div>
      <div style={{ fontSize: 12, marginTop: 5 }}>{subtitle}</div>
    </div>
  );
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div style={{ height: 8, background: C.slate[100], borderRadius: 999, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: color }} />
    </div>
  );
}

function PeriodSelect({ startKey, endKey, onChange }: { startKey: number; endKey: number; onChange: (s: number, e: number) => void }) {
  const options = useMemo(() => buildMonthOptions(2024, new Date().getFullYear() + 2), []);
  const common: CSSProperties = { height: 38, borderRadius: 12, border: "1px solid rgba(255,255,255,.20)", background: "rgba(255,255,255,.10)", color: "#fff", padding: "0 10px", fontSize: 12, fontWeight: 900, outline: "none" };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Calendar size={15} color="rgba(255,255,255,.65)" />
      <select value={Math.min(startKey, endKey)} onChange={(e) => onChange(Number(e.target.value), endKey)} style={common}>
        {options.map((o) => <option key={o.key} value={o.key} style={{ color: C.slate[800] }}>{o.label}</option>)}
      </select>
      <span style={{ color: "rgba(255,255,255,.45)", fontWeight: 900 }}>→</span>
      <select value={Math.max(startKey, endKey)} onChange={(e) => onChange(startKey, Number(e.target.value))} style={common}>
        {options.map((o) => <option key={o.key} value={o.key} style={{ color: C.slate[800] }}>{o.label}</option>)}
      </select>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.slate[200]}`, borderRadius: 14, padding: "10px 12px", boxShadow: "0 16px 40px rgba(15,23,42,.14)", minWidth: 220 }}>
      <div style={{ fontSize: 12, fontWeight: 950, color: C.blue[950], marginBottom: 8 }}>{label}</div>
      <div style={{ display: "grid", gap: 6 }}>
        {payload.filter((p: any) => p.value !== null && p.value !== undefined).map((p: any) => {
          const key = String(p.dataKey || "");
          const isMoney = key.includes("marge") || key.includes("ht") || key.includes("redevance");
          const isPct = key.includes("confidence") || key.includes("fnp");
          return (
            <div key={p.dataKey} style={{ display: "flex", justifyContent: "space-between", gap: 14, fontSize: 11.5 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: C.slate[600] }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: p.color || p.fill }} />
                {p.name || p.dataKey}
              </span>
              <strong style={{ color: C.slate[800], fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                {isPct ? fmtConfidence(Number(p.value)) : isMoney ? fmtMoney(p.value) : fmtKwh(p.value)}
              </strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

type ViewTab = "forecast" | "details" | "factors";
type PredictionMode = "site" | "bulk";

export default function PredictionForecastPage() {
  const now = new Date();
  const defaultStart = periodKey(now.getFullYear(), now.getMonth() + 1);
  const defaultEnd = periodKey(now.getFullYear(), Math.min(now.getMonth() + 6, 12));

  const [site, setSite] = useState("");
  const [mode, setMode] = useState<PredictionMode>("site");
  const [bulkData, setBulkData] = useState<PredictionBulkResponse | null>(null);
  const [bulkZone, setBulkZone] = useState("");
  const [bulkSearch, setBulkSearch] = useState("");
  const [bulkLimit, setBulkLimit] = useState<number>(0);
  const [exportingBulk, setExportingBulk] = useState(false);
  const [startKey, setStartKey] = useState(defaultStart);
  const [endKey, setEndKey] = useState(defaultEnd < defaultStart ? periodKey(now.getFullYear() + 1, 6) : defaultEnd);
  const [horizon, setHorizon] = useState(6);
  const [useInterval, setUseInterval] = useState(true);
  const [tab, setTab] = useState<ViewTab>("forecast");
  const [showHelp, setShowHelp] = useState(true);

  const [data, setData] = useState<PredictionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { year: ys, month: ms } = keyToYM(Math.min(startKey, endKey));
  const { year: ye, month: me } = keyToYM(Math.max(startKey, endKey));

  const runPrediction = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (mode === "bulk") {
        const res = await getPredictionBulk(
          useInterval
            ? {
                year_start: ys,
                month_start: ms,
                year_end: ye,
                month_end: me,
                zone: bulkZone || undefined,
                search: bulkSearch || undefined,
                limit: bulkLimit || undefined,
              }
            : {
                horizon,
                zone: bulkZone || undefined,
                search: bulkSearch || undefined,
                limit: bulkLimit || undefined,
              },
        );

        setBulkData(res);
        setData(null);
        setTab("forecast");
        return;
      }

      const cleanSite = site.trim();
      if (!cleanSite) {
        setError("Renseigne d’abord un Site ID.");
        return;
      }

      const res = await getPrediction(
        useInterval
          ? { site: cleanSite, year_start: ys, month_start: ms, year_end: ye, month_end: me }
          : { site: cleanSite, horizon },
      );

      setData(res);
      setBulkData(null);
      setTab("forecast");
    } catch (e: any) {
      setData(null);
      setBulkData(null);
      setError(
        e?.response?.data?.detail ||
          e?.response?.data?.site ||
          e?.message ||
          "Erreur lors de la prédiction.",
      );
    } finally {
      setLoading(false);
    }
  }, [mode, site, useInterval, ys, ms, ye, me, horizon, bulkZone, bulkSearch, bulkLimit]);

  const chartData = useMemo(() => {
    if (!data) return [];
    const historic = (data.historic || []).map((h) => ({
      period: h.period,
      label: h.period.slice(5),
      historic: n(h.conso_full ?? h.conso),
      historic_raw: n(h.conso),
      prediction: null as number | null,
      ic_lo: null as number | null,
      ic_hi: null as number | null,
      observed: null as number | null,
      remaining: null as number | null,
      marge: null as number | null,
      confidence: null as number | null,
      type: "Historique",
    }));

    const preds = (data.predictions || []).map((p) => ({
      period: p.period,
      label: p.period.slice(5),
      historic: null as number | null,
      historic_raw: null as number | null,
      prediction: n(p.conso_pred),
      ic_lo: n(p.ic_lo),
      ic_hi: n(p.ic_hi),
      observed: n(p.observed_kwh),
      remaining: n(p.remaining_pred_kwh),
      marge: n(p.marge_pred),
      ht: n(p.ht_pred),
      redevance: n(p.redevance),
      confidence: n(p.confidence),
      fnp: n(p.fnp_score),
      type: "Prévision",
    }));

    return [...historic, ...preds];
  }, [data]);

  const stats = useMemo(() => {
    const preds = data?.predictions || [];
    const totalPred = preds.reduce((a, p) => a + n(p.conso_pred), 0);
    const totalObserved = preds.reduce((a, p) => a + n(p.observed_kwh), 0);
    const totalRemaining = preds.reduce((a, p) => a + n(p.remaining_pred_kwh), 0);
    const totalHt = preds.reduce((a, p) => a + n(p.ht_pred), 0);
    const totalMarge = preds.reduce((a, p) => a + n(p.marge_pred), 0);
    const avgConf = preds.length ? preds.reduce((a, p) => a + n(p.confidence), 0) / preds.length : 0;
    const avgRisk = preds.length ? preds.reduce((a, p) => a + n(p.fnp_score), 0) / preds.length : 0;
    const partialCount = preds.filter((p) => p.is_partial_month).length;
    const eventCount = preds.reduce((a, p) => a + (p.events?.length || 0), 0);
    const nokCount = preds.filter((p) => !p.marge_ok).length;
    return { totalPred, totalObserved, totalRemaining, totalHt, totalMarge, avgConf, avgRisk, partialCount, eventCount, nokCount };
  }, [data]);

  const nextPrediction = data?.predictions?.[0] || null;
  const zoneNorm = data?.zone_normalized || data?.zone || "—";
  const zoneRaw = data?.zone_raw && data.zone_raw !== zoneNorm ? data.zone_raw : null;

  const buttonStyle: CSSProperties = {
    border: "none",
    borderRadius: 12,
    padding: "9px 12px",
    fontSize: 12,
    fontWeight: 950,
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    cursor: "pointer",
  };

  const inputStyle: CSSProperties = {
    height: 38,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.20)",
    background: "rgba(255,255,255,.10)",
    color: "#fff",
    padding: "0 12px",
    fontSize: 12,
    fontWeight: 900,
    outline: "none",
  };

  return (
    <div style={{ minHeight: "100vh", background: PAGE_BG, color: C.slate[800] }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: translateY(0); } }
        .pred-row:hover { background:#EFF6FF !important; }
        .pred-input::placeholder { color: rgba(255,255,255,.45); }
      `}</style>

      <div style={{ background: HDR, color: "#fff", padding: "22px 24px 18px", boxShadow: "0 18px 45px rgba(1,14,42,.24)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 9px", background: "rgba(255,255,255,.10)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 999, fontSize: 11, fontWeight: 950, color: "rgba(255,255,255,.72)" }}>
              <Sparkles size={13} /> Module prédiction · Conso intelligente
            </div>
            <h1 style={{ margin: "12px 0 4px", fontSize: 28, lineHeight: 1.1, letterSpacing: "-.04em", fontWeight: 950 }}>
              Prévision consommation, météo & événements
            </h1>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.62)", maxWidth: 900 }}>
              Prévision hybride basée sur l’historique factures, eFMS, estimations, météo, saisonnalité annuelle et événements mensuels.
            </div>
          </div>

          <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
            {mode === "site" ? (
                <div style={{ position: "relative" }}>
                  <Search
                    size={14}
                    style={{
                      position: "absolute",
                      left: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "rgba(255,255,255,.58)",
                    }}
                  />
                  <input
                    className="pred-input"
                    value={site}
                    onChange={(e) => setSite(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && runPrediction()}
                    placeholder="Site ID ex: BKL_0004"
                    style={{
                      ...inputStyle,
                      paddingLeft: 34,
                      width: 220,
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    }}
                  />
                </div>
              ) : (
                <>
                  <input
                    value={bulkZone}
                    onChange={(e) => setBulkZone(e.target.value)}
                    placeholder="Zone ex: DKR"
                    style={{ ...inputStyle, width: 120 }}
                  />

                  <input
                    value={bulkSearch}
                    onChange={(e) => setBulkSearch(e.target.value)}
                    placeholder="Recherche site..."
                    style={{ ...inputStyle, width: 170 }}
                  />

                  <input
                    type="number"
                    value={bulkLimit || ""}
                    onChange={(e) => setBulkLimit(Number(e.target.value || 0))}
                    placeholder="Limite"
                    style={{ ...inputStyle, width: 90 }}
                  />
                </>
              )}

            <div style={{ display: "flex", border: "1px solid rgba(255,255,255,.18)", borderRadius: 12, overflow: "hidden" }}>
              {(["site", "bulk"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setError(null);
                    setData(null);
                    setBulkData(null);
                  }}
                  style={{
                    border: "none",
                    padding: "9px 12px",
                    background: mode === m ? "#fff" : "rgba(255,255,255,.08)",
                    color: mode === m ? C.blue[800] : "#fff",
                    fontSize: 12,
                    fontWeight: 950,
                    cursor: "pointer",
                  }}
                >
                  {m === "site" ? "Par site" : "Parc global"}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setUseInterval((v) => !v)} style={{ ...buttonStyle, background: useInterval ? "rgba(255,255,255,.16)" : "rgba(255,255,255,.08)", color: "#fff", border: "1px solid rgba(255,255,255,.18)" }}>
              {useInterval ? <Calendar size={14} /> : <Layers size={14} />}
              {useInterval ? "Période" : "Horizon"}
            </button>

            {useInterval ? (
              <PeriodSelect startKey={startKey} endKey={endKey} onChange={(s, e) => { setStartKey(s); setEndKey(e); }} />
            ) : (
              <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} style={inputStyle}>
                {[3, 6, 9, 12, 18].map((h) => <option key={h} value={h} style={{ color: C.slate[800] }}>{h} mois</option>)}
              </select>
            )}

            <button type="button" onClick={runPrediction} disabled={loading} style={{ ...buttonStyle, background: "#fff", color: loading ? C.slate[400] : C.blue[800] }}>
              {loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={14} />}
              Prédire
            </button>
            {mode === "bulk" ? (
                <button
                  type="button"
                  disabled={exportingBulk}
                  onClick={async () => {
                    setExportingBulk(true);
                    try {
                      await exportPredictionBulkExcel(
                        useInterval
                          ? {
                              year_start: ys,
                              month_start: ms,
                              year_end: ye,
                              month_end: me,
                              zone: bulkZone || undefined,
                              search: bulkSearch || undefined,
                              limit: bulkLimit || undefined,
                            }
                          : {
                              horizon,
                              zone: bulkZone || undefined,
                              search: bulkSearch || undefined,
                              limit: bulkLimit || undefined,
                            },
                      );
                    } finally {
                      setExportingBulk(false);
                    }
                  }}
                  style={{
                    ...buttonStyle,
                    background: "rgba(255,255,255,.12)",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,.18)",
                  }}
                >
                  {exportingBulk ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={14} />}
                  Export Excel
                </button>
              ) : null}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(6,minmax(150px,1fr))", gap: 12, marginTop: 18 }}>
          <KpiCard label="Conso prévue" value={data ? fmtKwh(stats.totalPred) : "—"} sub={data ? `${data.predictions.length} mois prévus` : "Lancer une prédiction"} accent={C.blue[300]} icon={<Zap size={22} />} help="Somme des consommations prédites sur la période." />
          <KpiCard label="Déjà observé" value={data ? fmtKwh(stats.totalObserved) : "—"} sub={data && stats.partialCount ? `${stats.partialCount} mois partiel(s)` : "Mois partiels"} accent={C.cyan.main} icon={<Database size={22} />} help="Part déjà facturée ou observée pour les mois partiels." />
          <KpiCard label="Reste estimé" value={data ? fmtKwh(stats.totalRemaining) : "—"} sub="Projection fin de mois" accent={C.purple.main} icon={<Target size={22} />} help="Consommation restante prédite pour les mois partiels." />
          <KpiCard label="Marge prévue" value={data ? fmtMoney(stats.totalMarge) : "—"} sub={data ? `${stats.nokCount} mois marge NOK` : "Prévision financière"} accent={stats.totalMarge < 0 ? C.nok.main : C.ok.main} danger={stats.totalMarge < 0} icon={stats.totalMarge < 0 ? <TrendingDown size={22} /> : <TrendingUp size={22} />} help="Redevance - montant HT prédit." />
          <KpiCard label="Confiance" value={data ? fmtConfidence(stats.avgConf) : "—"} sub={data ? data.model_used ? "Modèle ML actif" : "Fallback règle" : "Qualité prévision"} accent={confidenceColor(stats.avgConf)} icon={<Gauge size={22} />} help="Indice de confiance moyen sur la période." />
          <KpiCard label="Événements" value={data ? String(stats.eventCount) : "—"} sub={data ? `${zoneNorm}${zoneRaw ? ` · ${zoneRaw}` : ""}` : "Zone normalisée"} accent={stats.eventCount ? C.warn.main : C.slate[300]} icon={<MapPin size={22} />} help="Événements religieux ou mensuels détectés sur la zone." />
        </div>
      </div>

      <div style={{ padding: 22, display: "grid", gap: 16 }}>
        {showHelp ? (
          <Card style={{ animation: "fadeUp .22s ease-out" }}>
            <div style={{ padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 13 }}>
              <div style={{ width: 38, height: 38, borderRadius: 14, background: C.blue[50], color: C.blue[700], display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Info size={19} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 950, color: C.blue[950] }}>Comment lire la prédiction</div>
                    <div style={{ fontSize: 12.5, color: C.slate[600], marginTop: 4, lineHeight: 1.55 }}>
                      Pour un mois partiel, la prévision devient <strong>déjà consommé + reste estimé</strong>. Le modèle tient aussi compte du même mois des années précédentes, de la tendance récente, de la météo et des événements détectés sur la zone normalisée.
                    </div>
                  </div>
                  <button onClick={() => setShowHelp(false)} type="button" style={{ border: "none", background: C.slate[100], color: C.slate[500], width: 28, height: 28, borderRadius: 9, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginTop: 12 }}>
                  <HelpBox tone="blue" icon={<LineIcon size={14} />} title="Historique" text="Compare la tendance récente et le même mois de N-1 / N-2." />
                  <HelpBox tone="cyan" icon={<Activity size={14} />} title="eFMS & estimation" text="Utilise les signaux ACM, Grid et EstimationResult quand ils sont disponibles." />
                  <HelpBox tone="warn" icon={<CloudRain size={14} />} title="Météo & événements" text="Intègre hivernage, chaleur, pluie, Magal, Gamou, Korité, Tabaski…" />
                  <HelpBox tone="purple" icon={<Target size={14} />} title="Mois partiel" text="Sépare la consommation observée et le reste prédit." />
                </div>
              </div>
            </div>
          </Card>
        ) : null}

        {error ? (
          <div style={{ padding: "14px 16px", borderRadius: 16, background: C.nok.light, border: `1px solid ${C.nok.mid}`, color: C.nok.dark, display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 800 }}>
            <AlertCircle size={18} /> {error}
          </div>
        ) : null}

        {!data && !loading ? (
          <Card>
            <EmptyState title="Aucune prédiction lancée" subtitle="Renseigne un Site ID, choisis une période ou un horizon, puis clique sur Prédire." />
          </Card>
        ) : null}

        {loading ? (
          <Card>
            <div style={{ padding: 66, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, color: C.slate[500], fontWeight: 850 }}>
              <Loader2 size={24} style={{ animation: "spin 1s linear infinite", color: C.blue[600] }} /> Calcul de la prédiction hybride…
            </div>
          </Card>
        ) : null}

        {bulkData && !loading ? (
          <Card>
            <SectionTitle
              icon={<Database size={18} />}
              title="Prévision globale parc"
              subtitle={`${bulkData.summary.period_start} → ${bulkData.summary.period_end}`}
              right={<Badge tone="blue">{bulkData.summary.sites_processed} sites traités</Badge>}
            />

            <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
              <MiniMetric label="Conso prévue" value={fmtKwh(bulkData.summary.total_conso_pred)} icon={<Zap size={14} />} color={C.blue[600]} />
              <MiniMetric label="HT prédit" value={fmtMoney(bulkData.summary.total_ht_pred)} icon={<Wallet size={14} />} color={C.orange.main} />
              <MiniMetric label="Marge prévue" value={fmtMoney(bulkData.summary.total_marge_pred)} icon={<TrendingUp size={14} />} color={bulkData.summary.total_marge_pred >= 0 ? C.ok.main : C.nok.main} />
              <MiniMetric label="Mois marge NOK" value={String(bulkData.summary.months_marge_nok)} icon={<XCircle size={14} />} color={bulkData.summary.months_marge_nok ? C.nok.main : C.ok.main} />
              <MiniMetric label="Confiance moyenne" value={fmtConfidence(bulkData.summary.avg_confidence)} icon={<Gauge size={14} />} color={confidenceColor(bulkData.summary.avg_confidence)} />
            </div>

            <div style={{ padding: "0 16px 16px", overflow: "auto", maxHeight: 420 }}>
              <table style={{ width: "100%", minWidth: 900, borderCollapse: "separate", borderSpacing: 0, fontSize: 12 }}>
                <thead>
                  <tr>
                    <Th>Site</Th>
                    <Th>Zone</Th>
                    <Th right>Conso prévue</Th>
                    <Th right>HT prédit</Th>
                    <Th right>Marge</Th>
                    <Th center>Mois NOK</Th>
                    <Th center>Confiance moy.</Th>
                  </tr>
                </thead>
                <tbody>
                  {bulkData.results.map((r) => {
                    const totalConso = r.predictions.reduce((a, p) => a + n(p.conso_pred), 0);
                    const totalHt = r.predictions.reduce((a, p) => a + n(p.ht_pred), 0);
                    const totalMarge = r.predictions.reduce((a, p) => a + n(p.marge_pred), 0);
                    const nok = r.predictions.filter((p) => !p.marge_ok).length;
                    const conf = r.predictions.length
                      ? r.predictions.reduce((a, p) => a + n(p.confidence), 0) / r.predictions.length
                      : 0;

                    return (
                      <tr key={r.site_id} className="pred-row">
                        <Td>
                          <strong style={{ color: C.blue[800], fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                            {r.site_id}
                          </strong>
                          <div style={{ fontSize: 11, color: C.slate[500] }}>{r.site_name || "—"}</div>
                        </Td>
                        <Td>{r.zone_normalized || r.zone || "—"}</Td>
                        <Td right>{fmtKwh(totalConso)}</Td>
                        <Td right>{fmtMoney(totalHt)}</Td>
                        <Td right>
                          <strong style={{ color: totalMarge >= 0 ? C.ok.dark : C.nok.dark }}>
                            {fmtMoney(totalMarge)}
                          </strong>
                        </Td>
                        <Td center>
                          <Badge tone={nok ? "nok" : "ok"}>{nok}</Badge>
                        </Td>
                        <Td center>
                          <Badge tone={conf >= 0.78 ? "ok" : conf >= 0.62 ? "warn" : "nok"}>
                            {fmtConfidence(conf)}
                          </Badge>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {bulkData.errors.length ? (
                <div style={{ marginTop: 12, padding: 12, borderRadius: 14, background: C.warn.light, color: C.warn.dark, fontSize: 12 }}>
                  {bulkData.errors.length} site(s) non traités. Les détails sont disponibles dans l’export Excel.
                </div>
              ) : null}
            </div>
          </Card>
        ) : null}

        {data && !loading ? (
          <>
            <Card>
              <div style={{ padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <Badge tone="blue"><ShieldCheck size={12} /> {data.site_id}</Badge>
                  {data.site_name ? <span style={{ fontSize: 13, fontWeight: 900, color: C.slate[700] }}>{data.site_name}</span> : null}
                  <Badge tone="cyan"><MapPin size={12} /> Zone {zoneNorm}</Badge>
                  {zoneRaw ? <Badge tone="warn">Normalisée depuis {zoneRaw}</Badge> : null}
                  <Badge tone={data.model_used === false ? "warn" : "ok"}>{data.model_used === false ? "Fallback règle" : "Modèle ML"}</Badge>
                  <span style={{ fontSize: 12, color: C.slate[500] }}>Généré le {fmtDate(data.generated_at)} · {data.model_version}</span>
                </div>
              </div>
            </Card>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {([
                ["forecast", "Prévision", <LineIcon size={14} />],
                ["details", "Détail mensuel", <BarChart3 size={14} />],
                ["factors", "Facteurs & explications", <Sparkles size={14} />],
              ] as const).map(([key, label, icon]) => (
                <button key={key} type="button" onClick={() => setTab(key)} style={{ border: `1px solid ${tab === key ? C.blue[600] : C.slate[200]}`, background: tab === key ? C.blue[700] : "#fff", color: tab === key ? "#fff" : C.slate[600], borderRadius: 999, padding: "9px 14px", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 950, cursor: "pointer", boxShadow: tab === key ? "0 10px 24px rgba(10,61,150,.22)" : "0 1px 2px rgba(0,0,0,.04)" }}>
                  {icon} {label}
                </button>
              ))}
            </div>

            {tab === "forecast" ? <ForecastTab data={data} chartData={chartData} nextPrediction={nextPrediction} /> : null}
            {tab === "details" ? <DetailsTab predictions={data.predictions || []} /> : null}
            {tab === "factors" ? <FactorsTab predictions={data.predictions || []} historic={data.historic || []} /> : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

function HelpBox({ tone, icon, title, text }: { tone: "blue" | "cyan" | "warn" | "purple"; icon: ReactNode; title: string; text: string }) {
  const map = {
    blue: { bg: C.blue[50], color: C.blue[800], border: C.blue[200] },
    cyan: { bg: C.cyan.light, color: C.cyan.dark, border: "#A5F3FC" },
    warn: { bg: C.warn.light, color: C.warn.dark, border: C.warn.mid },
    purple: { bg: C.purple.light, color: C.purple.dark, border: "#DDD6FE" },
  }[tone];
  return <div style={{ padding: 12, borderRadius: 14, background: map.bg, border: `1px solid ${map.border}` }}><div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 950, color: map.color }}>{icon} {title}</div><div style={{ fontSize: 11.5, color: map.color, marginTop: 5, lineHeight: 1.45 }}>{text}</div></div>;
}

function ForecastTab({ data, chartData, nextPrediction }: { data: PredictionResponse; chartData: any[]; nextPrediction: PredictionMonth | null }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.35fr .65fr", gap: 16 }}>
      <Card>
        <SectionTitle icon={<TrendingUp size={18} />} title="Courbe historique + prévision" subtitle="Avec intervalle de confiance et séparation observé / reste estimé" />
        <div style={{ height: 410, padding: "18px 20px 10px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 18, bottom: 8, left: 4 }}>
              <defs>
                <linearGradient id="histFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.blue[500]} stopOpacity={0.18} /><stop offset="95%" stopColor={C.blue[500]} stopOpacity={0} /></linearGradient>
                <linearGradient id="predFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.purple.main} stopOpacity={0.16} /><stop offset="95%" stopColor={C.purple.main} stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.slate[100]} vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: C.slate[500] }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.slate[500] }} axisLine={false} tickLine={false} tickFormatter={mwhTick} width={66} />
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="historic" name="Historique normalisé" stroke={C.blue[600]} fill="url(#histFill)" strokeWidth={2.6} dot={{ r: 3 }} connectNulls />
              <ReferenceArea y1={0} y2={0} />
              <Area type="monotone" dataKey="prediction" name="Prévision" stroke={C.purple.main} fill="url(#predFill)" strokeWidth={2.8} dot={{ r: 3 }} connectNulls />
              <Line type="monotone" dataKey="ic_lo" name="IC bas" stroke={C.slate[300]} strokeWidth={1.3} strokeDasharray="4 4" dot={false} connectNulls />
              <Line type="monotone" dataKey="ic_hi" name="IC haut" stroke={C.slate[300]} strokeWidth={1.3} strokeDasharray="4 4" dot={false} connectNulls />
              <Bar dataKey="observed" name="Déjà observé" fill={C.cyan.main} radius={[6, 6, 0, 0]} opacity={0.45} />
              <Bar dataKey="remaining" name="Reste estimé" fill={C.warn.main} radius={[6, 6, 0, 0]} opacity={0.36} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div style={{ display: "grid", gap: 16 }}>
        <Card>
          <SectionTitle icon={<Gauge size={18} />} title="Prochain mois" subtitle={nextPrediction ? nextPrediction.period : "—"} />
          {nextPrediction ? <NextMonthCard p={nextPrediction} /> : <EmptyState title="Aucune prévision" subtitle="Aucun mois disponible." />}
        </Card>

        <Card>
          <SectionTitle icon={<MapPin size={18} />} title="Événements détectés" subtitle="Sur la période prédite" />
          <div style={{ padding: 14, display: "grid", gap: 8, maxHeight: 280, overflow: "auto" }}>
            {data.predictions.flatMap((p) => (p.events || []).map((e) => ({ ...e, period: p.period }))).length ? data.predictions.flatMap((p) => (p.events || []).map((e) => ({ ...e, period: p.period }))).map((e, i) => (
              <div key={`${e.name}-${e.period}-${i}`} style={{ padding: "10px 11px", borderRadius: 14, background: C.warn.light, border: `1px solid ${C.warn.mid}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <strong style={{ color: C.warn.dark, fontSize: 12 }}>{cleanEventName(e.name)}</strong>
                  <span style={{ color: C.slate[500], fontSize: 11, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{e.period}</span>
                </div>
                <div style={{ marginTop: 4, color: C.slate[600], fontSize: 11.5 }}>{fmtDate(e.date)} · pression {n(e.pressure).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</div>
              </div>
            )) : <div style={{ padding: 20, textAlign: "center", color: C.slate[400], fontSize: 12 }}>Aucun événement détecté.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}

function NextMonthCard({ p }: { p: PredictionMonth }) {
  const risk = riskTone(n(p.fnp_score));
  const confColor = confidenceColor(n(p.confidence));
  const observedPct = p.conso_pred ? Math.min(100, (n(p.observed_kwh) / n(p.conso_pred)) * 100) : 0;

  return (
    <div style={{ padding: 16, display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 950, color: C.blue[800], letterSpacing: "-.04em", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{fmtKwh(p.conso_pred)}</div>
          <div style={{ fontSize: 12, color: C.slate[500], marginTop: 2 }}>Intervalle : {fmtKwh(p.ic_lo)} → {fmtKwh(p.ic_hi)}</div>
        </div>
        <Badge tone={p.marge_ok ? "ok" : "nok"}>{p.marge_ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />} Marge {p.marge_ok ? "OK" : "NOK"}</Badge>
      </div>

      {p.is_partial_month ? (
        <div style={{ padding: 12, borderRadius: 15, background: C.cyan.light, border: "1px solid #A5F3FC" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, fontWeight: 900, color: C.cyan.dark }}>
            <span>Mois partiel</span>
            <span>{p.observed_days || 0}j observés · {p.remaining_days || 0}j restants</span>
          </div>
          <div style={{ marginTop: 9 }}><ProgressBar value={observedPct} color={C.cyan.main} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10, fontSize: 11.5 }}>
            <div><span style={{ color: C.slate[500] }}>Déjà consommé</span><br /><strong style={{ color: C.cyan.dark }}>{fmtKwh(p.observed_kwh)}</strong></div>
            <div><span style={{ color: C.slate[500] }}>Reste estimé</span><br /><strong style={{ color: C.warn.dark }}>{fmtKwh(p.remaining_pred_kwh)}</strong></div>
          </div>
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <MiniMetric label="HT prédit" value={fmtMoney(p.ht_pred)} icon={<Wallet size={14} />} color={C.orange.main} />
        <MiniMetric label="Marge" value={fmtMoney(p.marge_pred)} icon={p.marge_pred >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />} color={p.marge_pred >= 0 ? C.ok.main : C.nok.main} />
        <MiniMetric label="Confiance" value={fmtConfidence(p.confidence)} icon={<Gauge size={14} />} color={confColor} />
        <MiniMetric label="Risque FNP" value={riskLabel(n(p.fnp_score))} icon={<AlertCircle size={14} />} color={risk === "nok" ? C.nok.main : risk === "warn" ? C.warn.main : C.ok.main} />
      </div>
    </div>
  );
}

function MiniMetric({ label, value, icon, color }: { label: string; value: string; icon: ReactNode; color: string }) {
  return <div style={{ padding: 11, borderRadius: 14, background: C.slate[50], border: `1px solid ${C.slate[200]}` }}><div style={{ display: "flex", alignItems: "center", gap: 6, color, fontSize: 11, fontWeight: 950 }}>{icon} {label}</div><div style={{ marginTop: 5, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 950, color: C.slate[800], fontSize: 12 }}>{value}</div></div>;
}

function DetailsTab({ predictions }: { predictions: PredictionMonth[] }) {
  return (
    <Card>
      <SectionTitle icon={<BarChart3 size={18} />} title="Détail mensuel des prévisions" subtitle="Consommation, finance, confiance, météo et événements" right={<Badge tone="blue">{predictions.length} mois</Badge>} />
      <div style={{ overflow: "auto", maxHeight: "calc(100vh - 280px)" }}>
        <table style={{ width: "100%", minWidth: 1420, borderCollapse: "separate", borderSpacing: 0, fontSize: 11.5 }}>
          <thead>
            <tr>
              <Th>Période</Th>
              <Th right>Prévision</Th>
              <Th right>IC bas</Th>
              <Th right>IC haut</Th>
              <Th right>Observé</Th>
              <Th right>Reste</Th>
              <Th center>Mois partiel</Th>
              <Th right>HT prédit</Th>
              <Th right>Redevance</Th>
              <Th right>Marge</Th>
              <Th center>Statut</Th>
              <Th center>Confiance</Th>
              <Th center>Risque FNP</Th>
              <Th center>Météo</Th>
              <Th center>Événements</Th>
            </tr>
          </thead>
          <tbody>
            {predictions.map((p, i) => {
              const risk = riskTone(n(p.fnp_score));
              return (
                <tr key={p.period} className="pred-row" style={{ background: p.marge_ok ? (i % 2 ? C.slate[50] : "#fff") : "#FFF7F7" }}>
                  <Td><strong style={{ color: C.blue[800], fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{p.period}</strong></Td>
                  <Td right><strong style={{ color: C.blue[700], fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{fmtKwh(p.conso_pred)}</strong></Td>
                  <Td right>{fmtKwh(p.ic_lo)}</Td>
                  <Td right>{fmtKwh(p.ic_hi)}</Td>
                  <Td right>{fmtKwh(p.observed_kwh)}</Td>
                  <Td right>{fmtKwh(p.remaining_pred_kwh)}</Td>
                  <Td center>{p.is_partial_month ? <Badge tone="cyan">{p.observed_days}j + {p.remaining_days}j</Badge> : <span style={{ color: C.slate[400] }}>—</span>}</Td>
                  <Td right>{fmtMoney(p.ht_pred)}</Td>
                  <Td right>{fmtMoney(p.redevance)}</Td>
                  <Td right><strong style={{ color: p.marge_pred >= 0 ? C.ok.dark : C.nok.dark, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{fmtMoney(p.marge_pred)}</strong></Td>
                  <Td center><Badge tone={p.marge_ok ? "ok" : "nok"}>{p.marge_ok ? "Marge OK" : "Marge NOK"}</Badge></Td>
                  <Td center><Badge tone={p.confidence >= 0.78 ? "ok" : p.confidence >= 0.62 ? "warn" : "nok"}>{fmtConfidence(p.confidence)}</Badge></Td>
                  <Td center><Badge tone={risk}>{riskLabel(n(p.fnp_score))}</Badge></Td>
                  <Td center><WeatherMini meteo={p.meteo} /></Td>
                  <Td center>{p.events?.length ? <Badge tone="warn">{p.events.length} événement(s)</Badge> : <span style={{ color: C.slate[400] }}>—</span>}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function WeatherMini({ meteo }: { meteo?: PredictionMeteo }) {
  if (!meteo) return <span style={{ color: C.slate[400] }}>—</span>;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: C.slate[600], fontSize: 11 }}><ThermometerSun size={12} color={C.orange.main} />{n(meteo.temp_max_mean).toFixed(1)}° <CloudRain size={12} color={C.cyan.main} />{n(meteo.precip_total).toFixed(0)}mm</span>;
}

function FactorsTab({ predictions, historic }: { predictions: PredictionMonth[]; historic: PredictionHistoricMonth[] }) {
  const factorRows = predictions.map((p) => ({
    period: p.period,
    lag12: n(p.baseline?.lag_12m),
    same: n(p.baseline?.same_month_avg),
    rolling3: n(p.baseline?.rolling_3m),
    ml: n(p.conso_ml),
    rule: n(p.conso_rule_based),
    pred: n(p.conso_pred),
  }));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 16 }}>
      <Card>
        <SectionTitle icon={<Layers size={18} />} title="Comparaison des signaux" subtitle="Même mois N-1, moyenne saisonnière, tendance récente, ML et règle" />
        <div style={{ height: 350, padding: 18 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={factorRows} margin={{ top: 8, right: 18, bottom: 8, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.slate[100]} vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: C.slate[500] }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.slate[500] }} axisLine={false} tickLine={false} tickFormatter={mwhTick} width={66} />
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="same" name="Même mois moy." fill={C.slate[300]} opacity={0.35} radius={[6, 6, 0, 0]} />
              <Line type="monotone" dataKey="rolling3" name="Rolling 3m" stroke={C.cyan.main} strokeWidth={2.2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="ml" name="ML" stroke={C.purple.main} strokeWidth={2.2} strokeDasharray="6 4" dot={false} />
              <Line type="monotone" dataKey="rule" name="Règle" stroke={C.warn.main} strokeWidth={2.2} strokeDasharray="3 4" dot={false} />
              <Line type="monotone" dataKey="pred" name="Final" stroke={C.blue[700]} strokeWidth={2.8} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <SectionTitle icon={<Sparkles size={18} />} title="Explications par mois" subtitle="Pourquoi le modèle prédit cette valeur" />
        <div style={{ padding: 14, display: "grid", gap: 10, maxHeight: 350, overflow: "auto" }}>
          {predictions.map((p) => (
            <div key={p.period} style={{ padding: 12, borderRadius: 15, background: "#fff", border: `1px solid ${C.slate[200]}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                <strong style={{ color: C.blue[800], fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{p.period}</strong>
                <Badge tone={p.marge_ok ? "ok" : "nok"}>{fmtKwh(p.conso_pred)}</Badge>
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {(p.explanation || []).length ? p.explanation?.map((x, i) => <div key={i} style={{ display: "flex", gap: 7, color: C.slate[600], fontSize: 12, lineHeight: 1.45 }}><CheckCircle2 size={13} color={C.ok.main} style={{ marginTop: 1, flexShrink: 0 }} />{x}</div>) : <div style={{ color: C.slate[400], fontSize: 12 }}>Aucune explication retournée.</div>}
              </div>
              {p.estimation?.available ? <div style={{ marginTop: 8 }}><Badge tone="purple">Signal estimation : {p.estimation.source} · {fmtKwh(p.estimation.conso_estimee_kwh)}</Badge></div> : null}
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ gridColumn: "1 / -1" }}>
        <SectionTitle icon={<Database size={18} />} title="Historique utilisé" subtitle="Derniers mois facturés, avec normalisation mois complet si partiel" />
        <div style={{ overflow: "auto" }}>
          <table style={{ width: "100%", minWidth: 820, borderCollapse: "separate", borderSpacing: 0, fontSize: 11.5 }}>
            <thead><tr><Th>Période</Th><Th right>Conso brute</Th><Th right>Conso normalisée</Th><Th right>Montant HT</Th><Th right>Jours</Th><Th center>Partiel</Th></tr></thead>
            <tbody>
              {historic.map((h, i) => <tr key={h.period} className="pred-row" style={{ background: i % 2 ? C.slate[50] : "#fff" }}><Td><strong style={{ color: C.blue[800] }}>{h.period}</strong></Td><Td right>{fmtKwh(h.conso)}</Td><Td right>{fmtKwh(h.conso_full ?? h.conso)}</Td><Td right>{fmtMoney(h.ht)}</Td><Td right>{h.days || "—"}</Td><Td center>{h.is_partial ? <Badge tone="warn">Partiel</Badge> : <span style={{ color: C.slate[400] }}>—</span>}</Td></tr>)}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Th({ children, right, center }: { children: ReactNode; right?: boolean; center?: boolean }) {
  return <th style={{ position: "sticky", top: 0, zIndex: 5, padding: "10px 12px", background: C.blue[900], color: "rgba(255,255,255,.88)", fontSize: 10, fontWeight: 950, textTransform: "uppercase", letterSpacing: ".08em", textAlign: right ? "right" : center ? "center" : "left", borderBottom: `1px solid ${C.blue[700]}`, whiteSpace: "nowrap" }}>{children}</th>;
}

function Td({ children, right, center }: { children: ReactNode; right?: boolean; center?: boolean }) {
  return <td style={{ padding: "11px 12px", borderBottom: `1px solid ${C.slate[200]}`, borderRight: `1px solid ${C.slate[100]}`, color: C.slate[700], textAlign: right ? "right" : center ? "center" : "left", verticalAlign: "middle" }}>{children}</td>;
}
