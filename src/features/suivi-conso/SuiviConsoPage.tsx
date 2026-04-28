// src/features/financial/SuiviConsoPage.tsx
// V2 complète — Suivi Conso sans montants financiers
// Focus : Facturée · eFMS · Solaire · Estimation · Target
// Statut affiché : statut TARGET, pas statut marge.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, Dispatch, ReactNode, SetStateAction } from "react";
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  HelpCircle,
  Info,
  Layers,
  LineChart as LineIcon,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Target,
  TrendingUp,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/services/api";

const C = {
  blue: { 950: "#010E2A", 900: "#021A40", 800: "#032566", 700: "#0A3D96", 600: "#1A56C4", 500: "#3272E0", 400: "#5B91F0", 300: "#91B9F8", 200: "#C0D8FB", 100: "#E4EFFE", 50: "#F2F6FE" },
  slate: { 900: "#0F172A", 800: "#1E293B", 700: "#334155", 600: "#475569", 500: "#64748B", 400: "#94A3B8", 300: "#CBD5E1", 200: "#E2E8F0", 100: "#F1F5F9", 50: "#F8FAFC" },
  ok: { main: "#059669", light: "#D1FAE5", mid: "#A7F3D0", dark: "#065F46" },
  nok: { main: "#DC2626", light: "#FEE2E2", mid: "#FECACA", dark: "#991B1B" },
  warn: { main: "#D97706", light: "#FEF3C7", mid: "#FDE68A", dark: "#92400E" },
  teal: { main: "#0891B2", light: "#CFFAFE", dark: "#0E7490" },
  solar: { main: "#F59E0B", light: "#FEF3C7", dark: "#B45309" },
  estim: { main: "#8B5CF6", light: "#EDE9FE", dark: "#5B21B6" },
};

const HDR = "linear-gradient(135deg,#010E2A 0%,#032566 52%,#0A3D96 100%)";
const PAGE_BG = "linear-gradient(180deg,#F8FAFC 0%,#EEF4FF 100%)";
const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

const SITE_PALETTE = [
  { stroke: "#2563EB", fill: "#DBEAFE" },
  { stroke: "#0891B2", fill: "#CFFAFE" },
  { stroke: "#7C3AED", fill: "#EDE9FE" },
  { stroke: "#DB2777", fill: "#FCE7F3" },
  { stroke: "#059669", fill: "#D1FAE5" },
  { stroke: "#D97706", fill: "#FEF3C7" },
  { stroke: "#DC2626", fill: "#FEE2E2" },
  { stroke: "#0284C7", fill: "#E0F2FE" },
];

const SOURCE_COLORS: Record<string, string> = {
  FACTUREE: C.blue[600],
  FMS: C.teal.main,
  ESTIMATION: C.estim.main,
  ACM: C.teal.main,
  GRID: C.blue[600],
  HISTO: C.warn.main,
  TARGET: C.ok.main,
  THEORIQUE: C.estim.main,
  NC: C.slate[400],
  NONE: C.slate[400],
};

type TargetStatus = "OK" | "NOK" | "NO_TARGET" | "NO_DATA";
type TargetSource = "FACTUREE" | "FMS" | "ESTIMATION" | "NONE";
type TabKey =  "table" | "chart" | "synthese";
type ChartMode = "global" | "sites";

type ConsoRow = {
  site_id: string;
  site_name: string | null;
  zone: string | null;
  year: number;
  month: number;
  period?: string;
  nb_jours: number | null;

  conso_kwh: string | null;
  conso_facturee_kwh?: string | null;

  fms_grid_kwh: string | null;
  fms_grid_src: string | null;
  fms_acm_kwh: string | null;
  fms_acm_src: string | null;

  solar_kwh: string | null;
  solar_target: string | null;
  solar_target_kwh?: string | null;
  unavail_hours: number | null;

  conso_estimee_kwh?: string | null;
  source_estimation?: string | null;
  estimation_available?: boolean;
  est_acm_kwh?: string | null;
  est_grid_kwh?: string | null;
  est_histo_kwh?: string | null;
  est_target_kwh?: string | null;
  est_theorique_kwh?: string | null;

  conso_target: string | null;
  typology: string | null;
  load_w: number | null;
  hors_catalogue?: boolean;
};

type ApiListResponse<T> = {
  count: number;
  page?: number;
  page_size?: number;
  pages?: number;
  results: T[];
};

type ChartPoint = {
  key: number;
  label: string;
  period: string;
  facturee: number | null;
  fms: number | null;
  fms_grid: number | null;
  fms_acm: number | null;
  solar: number | null;
  solar_target: number | null;
  estimation: number | null;
  target: number | null;
  ok: number;
  nok: number;
  noTarget: number;
  noData: number;
  rowsCount: number;
  [key: string]: string | number | null;
};

const periodKey = (y: number, m: number) => y * 100 + m;
const keyToYM = (k: number) => ({ year: Math.floor(k / 100), month: k % 100 });
const fmtPeriod = (y: number, m: number) => `${MONTHS_FR[m - 1]} ${y}`;

function buildMonthRange(startKey: number, endKey: number) {
  const out: { year: number; month: number; key: number; label: string; period: string }[] = [];
  let { year, month } = keyToYM(Math.min(startKey, endKey));
  const maxKey = Math.max(startKey, endKey);

  while (periodKey(year, month) <= maxKey) {
    out.push({ year, month, key: periodKey(year, month), label: fmtPeriod(year, month), period: `${year}-${String(month).padStart(2, "0")}` });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
}

const n = (v: string | number | null | undefined): number => {
  if (v === null || v === undefined || v === "") return 0;
  const parsed = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

const maybeNum = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const parsed = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

const fmtInt = (v: number) => v.toLocaleString("fr-FR", { maximumFractionDigits: 0 });

const fmtKwh = (v: string | number | null | undefined): string => {
  const value = maybeNum(v);
  if (value === null) return "—";
  if (Math.abs(value) >= 1000) return `${(value / 1000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MWh`;
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} kWh`;
};

const fmtPct = (v: number | null): string => {
  if (v === null || !Number.isFinite(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
};

const mwhTick = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)} MWh` : `${Math.round(v)} kWh`);

const rowFacturee = (r: ConsoRow) => n(r.conso_facturee_kwh ?? r.conso_kwh);
const rowFmsGrid = (r: ConsoRow) => n(r.fms_grid_kwh);
const rowFmsAcm = (r: ConsoRow) => n(r.fms_acm_kwh);
const rowFmsMain = (r: ConsoRow) => maybeNum(r.fms_grid_kwh) ?? maybeNum(r.fms_acm_kwh) ?? 0;
const rowSolar = (r: ConsoRow) => n(r.solar_kwh);
const rowSolarTarget = (r: ConsoRow) => n(r.solar_target_kwh ?? r.solar_target);
const rowEstim = (r: ConsoRow) => n(r.conso_estimee_kwh);
const rowTarget = (r: ConsoRow) => n(r.conso_target);

function deltaPct(actual: string | number | null | undefined, ref: string | number | null | undefined): number | null {
  const a = maybeNum(actual);
  const b = maybeNum(ref);
  if (a === null || b === null || b === 0) return null;
  return (a / b - 1) * 100;
}

function getReferenceConso(r: ConsoRow): { value: number | null; source: TargetSource } {
  const facturee = maybeNum(r.conso_facturee_kwh ?? r.conso_kwh);
  const fms = maybeNum(r.fms_grid_kwh) ?? maybeNum(r.fms_acm_kwh);
  const estimation = maybeNum(r.conso_estimee_kwh);

  if (facturee !== null && facturee > 0) return { value: facturee, source: "FACTUREE" };
  if (fms !== null && fms > 0) return { value: fms, source: "FMS" };
  if (estimation !== null && estimation > 0) return { value: estimation, source: "ESTIMATION" };
  return { value: null, source: "NONE" };
}

function getTargetStatus(r: ConsoRow): { status: TargetStatus; source: TargetSource; gapPct: number | null; reference: number | null; target: number | null } {
  const target = maybeNum(r.conso_target);
  const ref = getReferenceConso(r);

  if (target === null || target <= 0) return { status: "NO_TARGET", source: ref.source, gapPct: null, reference: ref.value, target };
  if (ref.value === null) return { status: "NO_DATA", source: ref.source, gapPct: null, reference: null, target };

  const gapPct = (ref.value / target - 1) * 100;
  return { status: ref.value <= target ? "OK" : "NOK", source: ref.source, gapPct, reference: ref.value, target };
}

function matchesTargetFilter(row: ConsoRow, filter: string) {
  if (!filter) return true;
  return getTargetStatus(row).status === filter;
}

function HelpTip({ text, light = true }: { text: string; light?: boolean }) {
  return (
    <span title={text} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", color: light ? "rgba(255,255,255,.66)" : C.slate[400], cursor: "help" }}>
      <HelpCircle size={12} />
    </span>
  );
}

function THLabel({ label, help }: { label: string; help?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span>{label}</span>
      {help ? <HelpTip text={help} /> : null}
    </span>
  );
}

function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "blue" | "ok" | "nok" | "warn" | "estim" | "solar" | "teal" }) {
  const map = {
    slate: { bg: C.slate[100], color: C.slate[700], border: C.slate[200] },
    blue: { bg: C.blue[100], color: C.blue[700], border: C.blue[200] },
    ok: { bg: C.ok.light, color: C.ok.dark, border: C.ok.mid },
    nok: { bg: C.nok.light, color: C.nok.dark, border: C.nok.mid },
    warn: { bg: C.warn.light, color: C.warn.dark, border: C.warn.mid },
    estim: { bg: C.estim.light, color: C.estim.dark, border: "#DDD6FE" },
    solar: { bg: C.solar.light, color: C.solar.dark, border: C.warn.mid },
    teal: { bg: C.teal.light, color: C.teal.dark, border: "#A5F3FC" },
  }[tone];

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 999, border: `1px solid ${map.border}`, background: map.bg, color: map.color, fontSize: 10.5, fontWeight: 900, padding: "3px 8px", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function TargetStatusBadge({ row }: { row: ConsoRow }) {
  const st = getTargetStatus(row);
  if (st.status === "NO_TARGET") return <Badge tone="slate">Sans target</Badge>;
  if (st.status === "NO_DATA") return <Badge tone="warn">Sans donnée</Badge>;
  const isOk = st.status === "OK";
  return (
    <span title={isOk ? `Target OK : la consommation de référence (${st.source}) est inférieure ou égale à la target.` : `Target NOK : la consommation de référence (${st.source}) dépasse la target.`} style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
      <Badge tone={isOk ? "ok" : "nok"}>{isOk ? <CheckCircle2 size={12} /> : <XCircle size={12} />} Target {st.status}</Badge>
    </span>
  );
}

function SourceBadge({ source }: { source?: string | null }) {
  if (!source || source === "NONE") return <span style={{ color: C.slate[400] }}>—</span>;
  const src = source.toUpperCase();
  const color = SOURCE_COLORS[src] || C.slate[500];
  return (
    <span title={`Source : ${src}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 999, background: `${color}18`, color, fontSize: 10, fontWeight: 900, border: `1px solid ${color}40`, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: color }} />
      {src}
    </span>
  );
}

function DeltaBadge({ value }: { value: number | null }) {
  if (value === null) return <span style={{ color: C.slate[400], fontSize: 11 }}>—</span>;
  const abs = Math.abs(value);
  const tone = abs <= 10 ? "ok" : abs <= 20 ? "warn" : "nok";
  return <Badge tone={tone}>{value >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}{fmtPct(value)}</Badge>;
}

function SrcDot({ src }: { src: string | null }) {
  const active = src && src !== "none";
  return <span title={active ? `Source : ${src}` : "Source indisponible"} style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: active ? C.ok.main : C.slate[300], marginRight: 4, verticalAlign: "middle" }} />;
}

function TypoBadge({ typo }: { typo: string | null }) {
  if (!typo) return <span style={{ color: C.slate[400], fontSize: 11 }}>—</span>;
  const short = typo.replace(/^[A-Z]\d?_/, "").replace(/\s+(INDOOR|OUTDOOR)$/i, "");
  return <span title={typo} style={{ display: "inline-block", padding: "3px 7px", borderRadius: 7, fontSize: 10, fontWeight: 800, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", background: C.blue[50], color: C.blue[700], border: `1px solid ${C.blue[200]}`, whiteSpace: "nowrap", maxWidth: 118, overflow: "hidden", textOverflow: "ellipsis" }}>{short}</span>;
}

function KpiCard({ label, value, sub, icon, accent, help }: { label: string; value: string; sub?: string; icon: ReactNode; accent: string; help?: string }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 18, background: "rgba(255,255,255,.09)", border: "1px solid rgba(255,255,255,.14)", padding: "15px 16px", minHeight: 92, boxShadow: "inset 0 1px 0 rgba(255,255,255,.12)" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 90% 12%,${accent}30,transparent 32%)` }} />
      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: "rgba(255,255,255,.52)", letterSpacing: ".08em", textTransform: "uppercase" }}>{label}</div>
            {help ? <HelpTip text={help} /> : null}
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", marginTop: 8, letterSpacing: "-.03em", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{value}</div>
          {sub ? <div style={{ fontSize: 11, color: "rgba(255,255,255,.48)", marginTop: 4 }}>{sub}</div> : null}
        </div>
        <div style={{ width: 38, height: 38, borderRadius: 14, background: "rgba(255,255,255,.10)", display: "flex", alignItems: "center", justifyContent: "center", color: accent, flexShrink: 0 }}>{icon}</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, background: `linear-gradient(90deg,${accent},transparent)` }} />
    </div>
  );
}

function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ background: "rgba(255,255,255,.94)", border: `1px solid ${C.slate[200]}`, borderRadius: 20, boxShadow: "0 18px 45px rgba(15,23,42,.07)", overflow: "hidden", ...style }}>{children}</div>;
}

function SectionTitle({ icon, title, subtitle, right }: { icon: ReactNode; title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div style={{ padding: "16px 18px", borderBottom: `1px solid ${C.slate[100]}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 13, background: C.blue[50], color: C.blue[700], display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, color: C.blue[950], letterSpacing: "-.02em" }}>{title}</div>
          {subtitle ? <div style={{ fontSize: 11.5, color: C.slate[500], marginTop: 2 }}>{subtitle}</div> : null}
        </div>
      </div>
      {right}
    </div>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ padding: 56, textAlign: "center", color: C.slate[500] }}>
      <div style={{ width: 52, height: 52, borderRadius: 18, background: C.slate[100], margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center" }}><Search size={22} color={C.slate[400]} /></div>
      <div style={{ fontSize: 15, fontWeight: 900, color: C.slate[700] }}>{title}</div>
      <div style={{ fontSize: 12, marginTop: 5 }}>{subtitle}</div>
    </div>
  );
}

function FilterChip({ label, value, onClear }: { label: string; value: string; onClear?: () => void }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 9px", borderRadius: 999, background: C.blue[50], color: C.blue[800], border: `1px solid ${C.blue[200]}`, fontSize: 11.5, fontWeight: 900 }}>
      <span style={{ color: C.slate[500], fontWeight: 800 }}>{label}:</span> {value}
      {onClear ? <button type="button" onClick={onClear} style={{ border: "none", background: "transparent", color: C.blue[700], cursor: "pointer", padding: 0, display: "inline-flex" }}><X size={12} /></button> : null}
    </span>
  );
}

const PRESETS = [
  { label: "Année 2026", range: [periodKey(2026, 1), periodKey(2026, 12)] },
  { label: "Année 2025", range: [periodKey(2025, 1), periodKey(2025, 12)] },
  { label: "Sep 25 → Déc 25", range: [periodKey(2025, 9), periodKey(2025, 12)] },
  { label: "Juil 24 → Juin 25", range: [periodKey(2024, 7), periodKey(2025, 6)] },
  { label: "Oct 24 → Mar 25", range: [periodKey(2024, 10), periodKey(2025, 3)] },
];

function DateRangePicker({ startKey, endKey, onChange }: { startKey: number; endKey: number; onChange: (s: number, e: number) => void }) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<number | null>(null);
  const [hov, setHov] = useState<number | null>(null);
  const [ly, setLy] = useState(() => keyToYM(startKey).year);
  const [ry, setRy] = useState(() => Math.max(keyToYM(endKey).year, keyToYM(startKey).year + 1));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSel(null);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function getCls(k: number) {
    const lo = Math.min(startKey, endKey);
    const hi = Math.max(startKey, endKey);
    if (sel !== null) {
      const hk = hov ?? k;
      const sl = Math.min(sel, hk);
      const sh = Math.max(sel, hk);
      if (k === sel) return "start";
      if (k === hk) return "end";
      if (k > sl && k < sh) return "inrange";
      return "";
    }
    if (k === lo) return "start";
    if (k === hi) return "end";
    if (k > lo && k < hi) return "inrange";
    return "";
  }

  function pick(y: number, mi: number) {
    const k = periodKey(y, mi + 1);
    if (!sel) {
      setSel(k);
      onChange(k, k);
    } else {
      onChange(Math.min(sel, k), Math.max(sel, k));
      setSel(null);
      setOpen(false);
    }
  }

  const navBtn: CSSProperties = { width: 25, height: 25, borderRadius: 7, border: `1px solid ${C.slate[200]}`, background: "#fff", cursor: "pointer", fontSize: 15, color: C.slate[600], display: "flex", alignItems: "center", justifyContent: "center" };

  function cal(year: number, setY: Dispatch<SetStateAction<number>>) {
    return (
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button style={navBtn} onClick={() => setY((y) => y - 1)} type="button">‹</button>
          <span style={{ fontSize: 13, fontWeight: 900, color: C.blue[900] }}>{year}</span>
          <button style={navBtn} onClick={() => setY((y) => y + 1)} type="button">›</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 5 }}>
          {MONTHS_FR.map((mn, mi) => {
            const k = periodKey(year, mi + 1);
            const cls = getCls(k);
            const selected = cls === "start" || cls === "end";
            return <button key={mn} onClick={() => pick(year, mi)} onMouseEnter={() => setHov(k)} onMouseLeave={() => setHov(null)} type="button" style={{ padding: "7px 4px", borderRadius: 8, fontSize: 11.5, textAlign: "center", cursor: "pointer", background: selected ? C.blue[700] : cls === "inrange" ? C.blue[100] : "#fff", color: selected ? "#fff" : cls === "inrange" ? C.blue[800] : C.slate[700], fontWeight: selected ? 900 : 700, border: `1px solid ${cls ? "transparent" : C.slate[200]}` }}>{mn}</button>;
          })}
        </div>
      </div>
    );
  }

  const lo = Math.min(startKey, endKey);
  const hi = Math.max(startKey, endKey);
  const { year: sy, month: sm } = keyToYM(lo);
  const { year: ey, month: em } = keyToYM(hi);
  const label = lo === hi ? fmtPeriod(sy, sm) : `${fmtPeriod(sy, sm)} → ${fmtPeriod(ey, em)}`;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => { setOpen((v) => !v); setSel(null); }} type="button" style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", border: `1px solid ${open ? "rgba(255,255,255,.50)" : "rgba(255,255,255,.20)"}`, borderRadius: 12, background: "rgba(255,255,255,.10)", cursor: "pointer", whiteSpace: "nowrap", color: "#fff", boxShadow: open ? "0 0 0 3px rgba(255,255,255,.10)" : "none" }}>
        <Calendar size={14} style={{ color: "rgba(255,255,255,.72)" }} />
        <span style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 12 }}>{label}</span>
        <ChevronDown size={13} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .18s" }} />
      </button>

      {open ? (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 300, background: "#fff", border: `1px solid ${C.slate[200]}`, borderRadius: 16, boxShadow: "0 24px 60px rgba(15,23,42,.22)", padding: "16px 16px 62px", width: 500, display: "flex", gap: 16 }}>
          {cal(ly, setLy)}
          <div style={{ width: 1, background: C.slate[200] }} />
          {cal(ry, setRy)}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, borderTop: `1px solid ${C.slate[200]}`, padding: "9px 12px", background: C.slate[50], borderRadius: "0 0 16px 16px", display: "flex", flexWrap: "wrap", gap: 6 }}>
            {PRESETS.map((p) => (
              <button key={p.label} onClick={() => { onChange(p.range[0], p.range[1]); setSel(null); setOpen(false); }} type="button" style={{ padding: "5px 9px", borderRadius: 999, border: `1px solid ${C.slate[200]}`, background: "#fff", fontSize: 11, color: C.slate[700], cursor: "pointer", fontWeight: 700 }}>{p.label}</button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SiteSearchSelect({ sites, selected, onChange }: { sites: string[]; selected: string[]; onChange: (s: string[]) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const filtered = useMemo(() => sites.filter((s) => s.toLowerCase().includes(query.toLowerCase())).slice(0, 60), [sites, query]);
  const toggle = (sid: string) => selected.includes(sid) ? onChange(selected.filter((s) => s !== sid)) : onChange([...selected, sid].slice(0, 8));
  const label = selected.length === 0 ? "Tous les sites" : selected.length === 1 ? selected[0] : `${selected.length} sites`;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen((v) => !v)} type="button" style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 210, padding: "8px 12px", border: `1px solid ${open ? C.blue[500] : C.slate[200]}`, borderRadius: 12, background: open ? C.blue[50] : "#fff", cursor: "pointer", boxShadow: open ? `0 0 0 3px ${C.blue[100]}` : "0 1px 2px rgba(0,0,0,.04)" }}>
        <Layers size={14} color={selected.length ? C.blue[600] : C.slate[400]} />
        {selected.length > 0 && selected.length <= 5 ? <div style={{ display: "flex", gap: 2 }}>{selected.map((_, i) => <span key={i} style={{ width: 8, height: 8, borderRadius: 3, background: SITE_PALETTE[i % SITE_PALETTE.length].stroke }} />)}</div> : null}
        <span style={{ flex: 1, fontSize: 12, fontWeight: selected.length ? 900 : 700, color: selected.length ? C.blue[700] : C.slate[500], textAlign: "left", fontFamily: selected.length === 1 ? "monospace" : "inherit" }}>{label}</span>
        {selected.length ? <span onClick={(e) => { e.stopPropagation(); onChange([]); }} style={{ width: 18, height: 18, borderRadius: 6, background: C.slate[100], color: C.slate[500], display: "flex", alignItems: "center", justifyContent: "center" }}><X size={11} /></span> : null}
        <ChevronDown size={13} color={C.slate[400]} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .18s" }} />
      </button>

      {open ? (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 300, width: 320, background: "#fff", border: `1px solid ${C.slate[200]}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 20px 55px rgba(15,23,42,.18)" }}>
          <div style={{ padding: 10, background: C.slate[50], borderBottom: `1px solid ${C.slate[100]}` }}>
            <div style={{ position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.slate[400] }} />
              <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un site…" style={{ width: "100%", boxSizing: "border-box", padding: "8px 30px 8px 30px", border: `1px solid ${C.slate[200]}`, borderRadius: 10, outline: "none", fontSize: 12, fontFamily: "monospace" }} />
              {query ? <button onClick={() => setQuery("")} type="button" style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", cursor: "pointer", color: C.slate[400] }}><X size={12} /></button> : null}
            </div>
          </div>
          <button type="button" onClick={() => { onChange([]); setOpen(false); setQuery(""); }} style={{ width: "100%", padding: "10px 12px", textAlign: "left", border: "none", background: selected.length === 0 ? C.blue[50] : "#fff", borderBottom: `1px solid ${C.slate[100]}`, cursor: "pointer", fontSize: 12, fontWeight: 900, color: C.blue[700] }}>Tous les sites</button>
          <div style={{ maxHeight: 290, overflow: "auto" }}>
            {filtered.map((sid) => {
              const idx = selected.indexOf(sid);
              const active = idx >= 0;
              const col = SITE_PALETTE[(idx >= 0 ? idx : 0) % SITE_PALETTE.length].stroke;
              return <button key={sid} type="button" onClick={() => toggle(sid)} style={{ width: "100%", padding: "9px 12px", border: "none", borderBottom: `1px solid ${C.slate[100]}`, background: active ? C.blue[50] : "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 9, textAlign: "left" }}><span style={{ width: 16, height: 16, borderRadius: 6, border: `1px solid ${active ? col : C.slate[300]}`, background: active ? col : "#fff" }} /><span style={{ fontFamily: "monospace", fontSize: 12, color: active ? C.blue[700] : C.slate[700], fontWeight: active ? 900 : 700 }}>{sid}</span></button>;
            })}
            {!filtered.length ? <div style={{ padding: 18, textAlign: "center", color: C.slate[400], fontSize: 12 }}>Aucun site trouvé</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.slate[200]}`, borderRadius: 14, padding: "10px 12px", boxShadow: "0 16px 40px rgba(15,23,42,.14)", minWidth: 190 }}>
      <div style={{ fontSize: 12, fontWeight: 900, color: C.blue[900], marginBottom: 8 }}>{label}</div>
      <div style={{ display: "grid", gap: 6 }}>
        {payload.filter((p: any) => p.value !== null && p.value !== undefined).map((p: any) => (
          <div key={p.dataKey} style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", fontSize: 11.5 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, color: C.slate[600] }}><span style={{ width: 8, height: 8, borderRadius: 999, background: p.color || p.fill }} />{p.name || p.dataKey}</span>
            <strong style={{ fontFamily: "monospace", color: C.slate[800] }}>{typeof p.value === "number" ? fmtKwh(p.value) : p.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SuiviConsoPage() {
  const now = new Date();

  const [startKey, setStartKey] = useState(periodKey(now.getFullYear(), 1));
  const [endKey, setEndKey] = useState(periodKey(now.getFullYear(), now.getMonth() + 1));

  const [page, setPage] = useState(1);
  const [pageSize] = useState(100);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const [rows, setRows] = useState<ConsoRow[]>([]);
  const [chartRows, setChartRows] = useState<ConsoRow[]>([]);
  const [chartLimited, setChartLimited] = useState(false);

  const [loading, setLoading] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("table");
  const [chartMode, setChartMode] = useState<ChartMode>("global");
  const [selectedSites, setSelectedSites] = useState<string[]>([]);

  const [zone, setZone] = useState("");
  const [search, setSearch] = useState("");
  const [typoFilter, setTypoFilter] = useState("");
  const [targetStatusFilter, setTargetStatusFilter] = useState("");
  const [showHelp, setShowHelp] = useState(true);

  const minKey = Math.min(startKey, endKey);
  const maxKey = Math.max(startKey, endKey);
  const { year: ys, month: ms } = keyToYM(minKey);
  const { year: ye, month: me } = keyToYM(maxKey);

  const baseParams = useMemo(() => {
    const params: Record<string, string | number> = { year_start: ys, month_start: ms, year_end: ye, month_end: me };
    if (zone) params.zone = zone;
    if (search.trim()) params.search = search.trim();
    if (typoFilter) params.typology = typoFilter;
    return params;
  }, [ys, ms, ye, me, zone, search, typoFilter]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ApiListResponse<ConsoRow>>("/financial/suivi-conso/", { params: { ...baseParams, page, page_size: pageSize } });
      setRows(res.data.results || []);
      setTotal(res.data.count || 0);
      setPages(res.data.pages || Math.max(1, Math.ceil((res.data.count || 0) / pageSize)));
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Erreur lors du chargement du suivi conso.");
      setRows([]);
      setTotal(0);
      setPages(1);
    } finally {
      setLoading(false);
    }
  }, [baseParams, page, pageSize]);

  const fetchChartRows = useCallback(async () => {
    setChartLoading(true);
    setChartLimited(false);
    try {
      const chartPageSize = 500;
      const first = await api.get<ApiListResponse<ConsoRow>>("/financial/suivi-conso/", { params: { ...baseParams, page: 1, page_size: chartPageSize } });
      const all: ConsoRow[] = [...(first.data.results || [])];
      const totalPages = first.data.pages || Math.max(1, Math.ceil((first.data.count || 0) / chartPageSize));
      const maxPages = Math.min(totalPages, 60);
      if (totalPages > maxPages) setChartLimited(true);
      const pageNumbers = Array.from({ length: Math.max(0, maxPages - 1) }, (_, i) => i + 2);
      const chunkSize = 6;
      for (let i = 0; i < pageNumbers.length; i += chunkSize) {
        const responses = await Promise.all(pageNumbers.slice(i, i + chunkSize).map((p) => api.get<ApiListResponse<ConsoRow>>("/financial/suivi-conso/", { params: { ...baseParams, page: p, page_size: chartPageSize } })));
        for (const res of responses) all.push(...(res.data.results || []));
      }
      setChartRows(all);
    } catch {
      setChartRows([]);
    } finally {
      setChartLoading(false);
    }
  }, [baseParams]);

  useEffect(() => { fetchRows(); }, [fetchRows]);
  useEffect(() => { fetchChartRows(); }, [fetchChartRows]);

  const onPeriodChange = (s: number, e: number) => {
    setStartKey(s);
    setEndKey(e);
    setPage(1);
  };

  const resetFilters = () => {
    setZone("");
    setSearch("");
    setTypoFilter("");
    setTargetStatusFilter("");
    setSelectedSites([]);
    setPage(1);
  };

  const exportUrl = useMemo(() => {
    const p = new URLSearchParams();
    p.set("year_start", String(ys));
    p.set("month_start", String(ms));
    p.set("year_end", String(ye));
    p.set("month_end", String(me));
    p.set("export", "csv");
    if (zone) p.set("zone", zone);
    if (search.trim()) p.set("search", search.trim());
    if (typoFilter) p.set("typology", typoFilter);
    return `/api/financial/suivi-conso/?${p.toString()}`;
  }, [ys, ms, ye, me, zone, search, typoFilter]);

  const tableRows = useMemo(() => rows.filter((r) => matchesTargetFilter(r, targetStatusFilter)), [rows, targetStatusFilter]);
  const chartFilteredRows = useMemo(() => chartRows.filter((r) => matchesTargetFilter(r, targetStatusFilter)), [chartRows, targetStatusFilter]);
  const statRows = chartFilteredRows.length ? chartFilteredRows : tableRows;

  const allSites = useMemo(() => Array.from(new Set(chartFilteredRows.concat(tableRows).map((r) => r.site_id))).sort(), [chartFilteredRows, tableRows]);
  const availTypos = useMemo(() => Array.from(new Set(chartFilteredRows.concat(tableRows).map((r) => r.typology).filter(Boolean) as string[])).sort(), [chartFilteredRows, tableRows]);

  const stats = useMemo(() => {
    let ok = 0, nok = 0, noTarget = 0, noData = 0, totalGap = 0, gapCount = 0;
    for (const r of statRows) {
      const st = getTargetStatus(r);
      if (st.status === "OK") ok += 1;
      else if (st.status === "NOK") nok += 1;
      else if (st.status === "NO_TARGET") noTarget += 1;
      else noData += 1;
      if (st.gapPct !== null) { totalGap += st.gapPct; gapCount += 1; }
    }
    const fact = statRows.reduce((a, r) => a + rowFacturee(r), 0);
    const fms = statRows.reduce((a, r) => a + rowFmsMain(r), 0);
    const solar = statRows.reduce((a, r) => a + rowSolar(r), 0);
    const solarTarget = statRows.reduce((a, r) => a + rowSolarTarget(r), 0);
    const estim = statRows.reduce((a, r) => a + rowEstim(r), 0);
    const withFms = statRows.filter((r) => rowFmsMain(r) > 0).length;
    const withEstim = statRows.filter((r) => rowEstim(r) > 0).length;
    return { fact, fms, solar, solarTarget, estim, withFms, withEstim, ok, nok, noTarget, noData, avgGapTarget: gapCount ? totalGap / gapCount : null };
  }, [statRows]);

  const chartData = useMemo<ChartPoint[]>(() => {
    const monthRange = buildMonthRange(minKey, maxKey);
    const map = new Map<number, ChartPoint>();
    for (const m of monthRange) {
      map.set(m.key, { key: m.key, label: m.label, period: m.period, facturee: null, fms: null, fms_grid: null, fms_acm: null, solar: null, solar_target: null, estimation: null, target: null, ok: 0, nok: 0, noTarget: 0, noData: 0, rowsCount: 0 });
    }
    for (const r of chartFilteredRows) {
      const base = map.get(periodKey(r.year, r.month));
      if (!base) continue;
      base.rowsCount += 1;
      base.facturee = (base.facturee ?? 0) + rowFacturee(r);
      base.fms = (base.fms ?? 0) + rowFmsMain(r);
      base.fms_grid = (base.fms_grid ?? 0) + rowFmsGrid(r);
      base.fms_acm = (base.fms_acm ?? 0) + rowFmsAcm(r);
      base.solar = (base.solar ?? 0) + rowSolar(r);
      base.solar_target = (base.solar_target ?? 0) + rowSolarTarget(r);
      base.estimation = (base.estimation ?? 0) + rowEstim(r);
      base.target = (base.target ?? 0) + rowTarget(r);
      const st = getTargetStatus(r);
      if (st.status === "OK") base.ok += 1;
      else if (st.status === "NOK") base.nok += 1;
      else if (st.status === "NO_TARGET") base.noTarget += 1;
      else base.noData += 1;
      if (selectedSites.includes(r.site_id)) base[`site_${r.site_id}`] = Number(base[`site_${r.site_id}`] || 0) + rowFacturee(r);
    }
    return Array.from(map.values()).sort((a, b) => a.key - b.key);
  }, [chartFilteredRows, maxKey, minKey, selectedSites]);

  const statusPie = useMemo(() => [
    { name: "Target OK", value: stats.ok, color: C.ok.main },
    { name: "Target NOK", value: stats.nok, color: C.nok.main },
    { name: "Sans target", value: stats.noTarget, color: C.slate[300] },
    { name: "Sans donnée", value: stats.noData, color: C.warn.main },
  ], [stats.ok, stats.nok, stats.noTarget, stats.noData]);

  const topTargetNok = useMemo(() => statRows.map((r) => ({ row: r, st: getTargetStatus(r) })).filter((x) => x.st.status === "NOK").sort((a, b) => (b.st.gapPct || 0) - (a.st.gapPct || 0)).slice(0, 10), [statRows]);

  const inputStyle: CSSProperties = { padding: "9px 12px", borderRadius: 12, border: `1px solid ${C.slate[200]}`, background: "#fff", fontSize: 12, color: C.slate[700], outline: "none", boxShadow: "0 1px 2px rgba(0,0,0,.04)" };
  const buttonStyle: CSSProperties = { border: "none", borderRadius: 12, padding: "9px 12px", fontSize: 12, fontWeight: 900, display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer" };
  const periodLabel = `${fmtPeriod(ys, ms)} → ${fmtPeriod(ye, me)}`;

  return (
    <div style={{ minHeight: "100vh", background: PAGE_BG, color: C.slate[800] }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } } .suivi-row:hover { background: #EFF6FF !important; } .suivi-table th { position: sticky; top: 0; z-index: 20; } .sticky-site { position: sticky; left: 0; z-index: 12; box-shadow: 12px 0 18px rgba(15,23,42,.04); } .sticky-site-head { position: sticky !important; left: 0; z-index: 30 !important; }`}</style>

      <div style={{ background: HDR, color: "#fff", padding: "22px 24px 18px", boxShadow: "0 16px 38px rgba(1,14,42,.22)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 9px", background: "rgba(255,255,255,.10)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 999, fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,.72)" }}><ShieldCheck size={13} /> Module financier · Suivi conso</div>
            <h1 style={{ margin: "12px 0 4px", fontSize: 27, lineHeight: 1.1, letterSpacing: "-.04em", fontWeight: 950 }}>Suivi consommation facturée, eFMS, solaire & estimations</h1>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.62)", maxWidth: 900 }}>Analyse comparative par site et par mois. Aucun montant financier n’est affiché ici ; cette page se concentre uniquement sur les consommations et les targets.</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <DateRangePicker startKey={startKey} endKey={endKey} onChange={onPeriodChange} />
            <button onClick={() => { fetchRows(); fetchChartRows(); }} type="button" style={{ ...buttonStyle, background: "rgba(255,255,255,.12)", color: "#fff", border: "1px solid rgba(255,255,255,.18)" }}><RefreshCw size={14} /> Actualiser</button>
            <a href={exportUrl} style={{ ...buttonStyle, background: "#fff", color: C.blue[800], textDecoration: "none" }}><Download size={14} /> Export CSV</a>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(6,minmax(150px,1fr))", gap: 12, marginTop: 18 }}>
          <KpiCard label="Facturée" value={fmtKwh(stats.fact)} sub="Conso Sénélec" accent={C.blue[300]} icon={<Zap size={22} />} help="Consommation issue des factures Sénélec." />
          <KpiCard label="eFMS" value={fmtKwh(stats.fms)} sub={`${stats.withFms} lignes avec données`} accent={C.teal.main} icon={<Activity size={22} />} help="Valeur eFMS principale : Grid si disponible, sinon ACM." />
          <KpiCard label="Solaire" value={fmtKwh(stats.solar)} sub={stats.solarTarget ? `Cible ${fmtKwh(stats.solarTarget)}` : "Donnée solaire"} accent={C.solar.main} icon={<Sun size={22} />} help="Données solaires récupérées pour la période." />
          <KpiCard label="Estimée" value={fmtKwh(stats.estim)} sub={`${stats.withEstim} lignes estimées`} accent={C.estim.main} icon={<Target size={22} />} help="Consommation provenant du modèle EstimationResult." />
          <KpiCard label="Target NOK" value={`${stats.nok}`} sub={`${stats.ok} OK · ${stats.noTarget} sans target`} accent={stats.nok ? C.nok.main : C.ok.main} icon={stats.nok ? <XCircle size={22} /> : <CheckCircle2 size={22} />} help="Nombre de lignes dont la consommation de référence dépasse la target." />
          <KpiCard label="Écart target" value={fmtPct(stats.avgGapTarget)} sub="Moyenne des écarts" accent={stats.avgGapTarget === null ? C.slate[300] : Math.abs(stats.avgGapTarget) > 20 ? C.nok.main : C.ok.main} icon={<TrendingUp size={22} />} help="Écart moyen entre la consommation de référence et la target." />
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
                    <div style={{ fontSize: 14, fontWeight: 950, color: C.blue[950] }}>Comprendre le statut target</div>
                    <div style={{ fontSize: 12.5, color: C.slate[600], marginTop: 4, lineHeight: 1.55 }}>Le statut <strong>Target OK / Target NOK</strong> compare une consommation de référence à la target. La référence utilisée suit cet ordre : <strong>Facturée</strong>, sinon <strong>eFMS</strong>, sinon <strong>Estimation</strong>.</div>
                  </div>
                  <button onClick={() => setShowHelp(false)} type="button" style={{ border: "none", background: C.slate[100], color: C.slate[500], width: 28, height: 28, borderRadius: 9, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginTop: 12 }}>
                  <InfoBox tone="ok" icon={<CheckCircle2 size={14} />} title="Target OK" text="La consommation de référence est inférieure ou égale à la target." />
                  <InfoBox tone="nok" icon={<XCircle size={14} />} title="Target NOK" text="La consommation de référence dépasse la target." />
                  <InfoBox tone="slate" icon={<Target size={14} />} title="Sans target" text="Aucune cible de consommation n’est disponible." />
                  <InfoBox tone="warn" icon={<AlertCircle size={14} />} title="Sans donnée" text="Aucune consommation exploitable pour comparer à la target." />
                </div>
              </div>
            </div>
          </Card>
        ) : null}

        <Card>
          <div style={{ padding: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ position: "relative", minWidth: 260 }}>
              <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.slate[400] }} />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Rechercher site, nom…" style={{ ...inputStyle, paddingLeft: 34, width: "100%" }} />
            </div>
            <select value={zone} onChange={(e) => { setZone(e.target.value); setPage(1); }} style={inputStyle}>
              <option value="">Toutes zones</option>
              {["DKR", "THIES", "DIOURBEL", "LOUGA", "KAOLACK", "ZIGUINCHOR", "SAINT-LOUIS", "TAMBACOUNDA", "KOLDA", "FATICK", "MATAM", "KAFFRINE", "SEDHIOU", "KEDOUGOU"].map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
            <select value={typoFilter} onChange={(e) => { setTypoFilter(e.target.value); setPage(1); }} style={{ ...inputStyle, maxWidth: 220 }}>
              <option value="">Toutes typologies</option>
              {availTypos.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={targetStatusFilter} onChange={(e) => { setTargetStatusFilter(e.target.value); setPage(1); }} style={inputStyle}>
              <option value="">Tous statuts target</option>
              <option value="OK">Target OK</option>
              <option value="NOK">Target NOK</option>
              <option value="NO_TARGET">Sans target</option>
              <option value="NO_DATA">Sans donnée</option>
            </select>
            {(zone || typoFilter || targetStatusFilter || search) ? <button onClick={resetFilters} type="button" style={{ ...buttonStyle, background: C.warn.light, color: C.warn.dark, border: `1px solid ${C.warn.mid}` }}><Filter size={13} /> Effacer filtres</button> : null}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, color: C.slate[500], fontSize: 12, fontWeight: 800 }}><SlidersHorizontal size={14} /> {total.toLocaleString("fr-FR")} lignes</div>
          </div>
          <div style={{ padding: "0 14px 14px", display: "flex", flexWrap: "wrap", gap: 8 }}>
            <FilterChip label="Période" value={periodLabel} />
            {zone ? <FilterChip label="Zone" value={zone} onClear={() => { setZone(""); setPage(1); }} /> : null}
            {typoFilter ? <FilterChip label="Typologie" value={typoFilter} onClear={() => { setTypoFilter(""); setPage(1); }} /> : null}
            {search ? <FilterChip label="Recherche" value={search} onClear={() => { setSearch(""); setPage(1); }} /> : null}
            {targetStatusFilter ? <FilterChip label="Statut target" value={targetStatusFilter} onClear={() => setTargetStatusFilter("")} /> : null}
          </div>
        </Card>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          
          {([["table", "Tableau", <BarChart3 size={14} />],
          ["chart", "Graphiques", <LineIcon size={14} />],  ["synthese", "Synthèse", <ShieldCheck size={14} />]] as const).map(([key, label, icon]) => (
            <button key={key} type="button" onClick={() => setActiveTab(key)} style={{ border: `1px solid ${activeTab === key ? C.blue[600] : C.slate[200]}`, background: activeTab === key ? C.blue[700] : "#fff", color: activeTab === key ? "#fff" : C.slate[600], borderRadius: 999, padding: "9px 14px", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 900, cursor: "pointer", boxShadow: activeTab === key ? "0 10px 24px rgba(10,61,150,.22)" : "0 1px 2px rgba(0,0,0,.04)" }}>{icon} {label}</button>
          ))}
          {chartLoading ? <span style={{ marginLeft: 8, display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: C.slate[500], fontWeight: 800 }}><span style={{ width: 13, height: 13, border: `2px solid ${C.blue[100]}`, borderTopColor: C.blue[600], borderRadius: "50%", animation: "spin .8s linear infinite" }} /> Préparation des courbes…</span> : null}
          {chartLimited ? <span style={{ marginLeft: 8 }}><Badge tone="warn">Graphes limités aux premières pages</Badge></span> : null}
        </div>

        {error ? <div style={{ padding: "14px 16px", borderRadius: 16, background: C.nok.light, border: `1px solid ${C.nok.mid}`, color: C.nok.dark, display: "flex", alignItems: "center", gap: 10 }}><AlertCircle size={18} /> {error}</div> : null}
        {loading ? <Card><div style={{ padding: 64, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, color: C.slate[500], fontWeight: 800 }}><div style={{ width: 20, height: 20, border: `3px solid ${C.blue[100]}`, borderTopColor: C.blue[600], borderRadius: "50%", animation: "spin .8s linear infinite" }} />Chargement du suivi conso…</div></Card> : null}

        {!loading && !error && activeTab === "synthese" ? <SyntheseView chartData={chartData} statusPie={statusPie} topTargetNok={topTargetNok} /> : null}
        {!loading && !error && activeTab === "chart" ? <ChartView chartData={chartData} chartMode={chartMode} setChartMode={setChartMode} selectedSites={selectedSites} setSelectedSites={setSelectedSites} allSites={allSites} /> : null}
        {!loading && !error && activeTab === "table" ? <TableView tableRows={tableRows} pages={pages} page={page} setPage={setPage} buttonStyle={buttonStyle} /> : null}
      </div>
    </div>
  );
}

function InfoBox({ tone, icon, title, text }: { tone: "ok" | "nok" | "warn" | "slate"; icon: ReactNode; title: string; text: string }) {
  const map = {
    ok: { bg: C.ok.light, border: C.ok.mid, color: C.ok.dark },
    nok: { bg: C.nok.light, border: C.nok.mid, color: C.nok.dark },
    warn: { bg: C.warn.light, border: C.warn.mid, color: C.warn.dark },
    slate: { bg: C.slate[50], border: C.slate[200], color: C.slate[700] },
  }[tone];
  return <div style={{ padding: 12, borderRadius: 14, background: map.bg, border: `1px solid ${map.border}` }}><div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 950, color: map.color }}>{icon} {title}</div><div style={{ fontSize: 11.5, color: map.color, marginTop: 5, lineHeight: 1.45 }}>{text}</div></div>;
}

function SyntheseView({ chartData, statusPie, topTargetNok }: { chartData: ChartPoint[]; statusPie: { name: string; value: number; color: string }[]; topTargetNok: { row: ConsoRow; st: ReturnType<typeof getTargetStatus> }[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.4fr .9fr", gap: 16 }}>
      <Card>
        <SectionTitle icon={<TrendingUp size={18} />} title="Courbe d’évolution mensuelle" subtitle="Facturée · eFMS · solaire · estimée · target" />
        {chartData.length ? <EvolutionChart chartData={chartData} height={375} /> : <EmptyState title="Aucune donnée" subtitle="Aucune ligne ne correspond aux filtres sélectionnés." />}
      </Card>
      <div style={{ display: "grid", gap: 16 }}>
        <Card>
          <SectionTitle icon={<Target size={18} />} title="Statuts target" subtitle="OK / NOK / sans target / sans donnée" />
          <div style={{ height: 240, padding: 10 }}>
            <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusPie} dataKey="value" nameKey="name" innerRadius={54} outerRadius={86} paddingAngle={3}>{statusPie.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip content={<ChartTooltip />} /></PieChart></ResponsiveContainer>
          </div>
          <div style={{ display: "grid", gap: 8, padding: "0 16px 16px" }}>{statusPie.map((s) => <div key={s.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.slate[600] }}><span style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: s.color }} /> {s.name}</span><strong style={{ color: C.slate[800] }}>{s.value}</strong></div>)}</div>
        </Card>
        <Card>
          <SectionTitle icon={<AlertCircle size={18} />} title="Top Target NOK" subtitle="Plus grands dépassements de target" />
          <div style={{ padding: 12, display: "grid", gap: 8, maxHeight: 260, overflow: "auto" }}>
            {topTargetNok.length ? topTargetNok.map(({ row, st }) => <div key={`${row.site_id}-${row.year}-${row.month}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 10px", borderRadius: 12, background: C.nok.light, border: `1px solid ${C.nok.mid}` }}><div><div style={{ fontSize: 12, fontWeight: 950, color: C.nok.dark, fontFamily: "monospace" }}>{row.site_id}</div><div style={{ fontSize: 10.5, color: C.slate[600] }}>{fmtPeriod(row.year, row.month)} · {row.site_name || "—"}</div></div><div style={{ textAlign: "right" }}><div style={{ fontSize: 12, fontWeight: 950, color: C.nok.dark, fontFamily: "monospace" }}>{fmtPct(st.gapPct)}</div><div style={{ fontSize: 10.5, color: C.slate[500] }}>{st.source}</div></div></div>) : <div style={{ padding: 20, textAlign: "center", color: C.slate[400], fontSize: 12 }}>Aucun dépassement target sur les données chargées.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}

function EvolutionChart({ chartData, height }: { chartData: ChartPoint[]; height: number }) {
  return <div style={{ height, padding: "16px 18px 8px" }}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 6, left: 4 }}><defs><linearGradient id="factureeFillV2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.blue[500]} stopOpacity={0.18} /><stop offset="95%" stopColor={C.blue[500]} stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke={C.slate[100]} vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11, fill: C.slate[500] }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11, fill: C.slate[500] }} axisLine={false} tickLine={false} tickFormatter={mwhTick} width={62} /><Tooltip content={<ChartTooltip />} /><Area type="monotone" dataKey="facturee" name="Facturée" stroke={C.blue[600]} fill="url(#factureeFillV2)" strokeWidth={2.8} dot={{ r: 3 }} connectNulls /><Line type="monotone" dataKey="fms" name="eFMS" stroke={C.teal.main} strokeWidth={2.4} strokeDasharray="6 4" dot={false} connectNulls /><Line type="monotone" dataKey="solar" name="Solaire" stroke={C.solar.main} strokeWidth={2.4} dot={{ r: 3 }} connectNulls /><Line type="monotone" dataKey="estimation" name="Estimée" stroke={C.estim.main} strokeWidth={2.4} dot={{ r: 3 }} connectNulls /><Line type="monotone" dataKey="target" name="Target" stroke={C.slate[400]} strokeWidth={1.8} strokeDasharray="3 4" dot={false} connectNulls /></ComposedChart></ResponsiveContainer></div>;
}

function ChartView({ chartData, chartMode, setChartMode, selectedSites, setSelectedSites, allSites }: { chartData: ChartPoint[]; chartMode: ChartMode; setChartMode: (m: ChartMode) => void; selectedSites: string[]; setSelectedSites: (s: string[]) => void; allSites: string[] }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card>
        <SectionTitle icon={<LineIcon size={18} />} title="Graphiques d’évolution" subtitle="Vue globale ou comparaison multi-sites sur l’intervalle sélectionné" right={<div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><SiteSearchSelect sites={allSites} selected={selectedSites} onChange={setSelectedSites} /><div style={{ display: "flex", border: `1px solid ${C.slate[200]}`, borderRadius: 12, overflow: "hidden" }}>{(["global", "sites"] as const).map((m) => <button key={m} type="button" onClick={() => setChartMode(m)} style={{ border: "none", padding: "8px 13px", fontSize: 12, fontWeight: 900, cursor: "pointer", background: chartMode === m ? C.blue[700] : "#fff", color: chartMode === m ? "#fff" : C.slate[600] }}>{m === "global" ? "Global" : "Sites"}</button>)}</div></div>} />
        <div style={{ height: 410, padding: "18px 20px 10px" }}><ResponsiveContainer width="100%" height="100%">{chartMode === "sites" && selectedSites.length ? <AreaChart data={chartData} margin={{ top: 8, right: 18, bottom: 8, left: 4 }}><CartesianGrid strokeDasharray="3 3" stroke={C.slate[100]} vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11, fill: C.slate[500] }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11, fill: C.slate[500] }} axisLine={false} tickLine={false} tickFormatter={mwhTick} width={62} /><Tooltip content={<ChartTooltip />} />{selectedSites.map((sid, i) => <Line key={sid} type="monotone" dataKey={`site_${sid}`} name={sid} stroke={SITE_PALETTE[i % SITE_PALETTE.length].stroke} strokeWidth={2.4} dot={{ r: 3 }} connectNulls />)}</AreaChart> : <ComposedChart data={chartData} margin={{ top: 8, right: 18, bottom: 8, left: 4 }}><CartesianGrid strokeDasharray="3 3" stroke={C.slate[100]} vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11, fill: C.slate[500] }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11, fill: C.slate[500] }} axisLine={false} tickLine={false} tickFormatter={mwhTick} width={62} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="target" name="Target" fill={C.slate[200]} radius={[6, 6, 0, 0]} opacity={0.36} /><Area type="monotone" dataKey="facturee" name="Facturée" stroke={C.blue[600]} fill={C.blue[100]} strokeWidth={2.8} connectNulls /><Line type="monotone" dataKey="fms" name="eFMS" stroke={C.teal.main} strokeWidth={2.4} strokeDasharray="6 4" dot={false} connectNulls /><Line type="monotone" dataKey="solar" name="Solaire" stroke={C.solar.main} strokeWidth={2.4} dot={{ r: 3 }} connectNulls /><Line type="monotone" dataKey="estimation" name="Estimée" stroke={C.estim.main} strokeWidth={2.4} dot={{ r: 3 }} connectNulls /></ComposedChart>}</ResponsiveContainer></div>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card><SectionTitle icon={<Target size={18} />} title="Écart vs target" subtitle="Consommation facturée / target - 1" /><div style={{ height: 300, padding: 16 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData.map((d) => ({ ...d, gap: d.target && d.facturee ? (d.facturee / d.target - 1) * 100 : null }))}><CartesianGrid strokeDasharray="3 3" stroke={C.slate[100]} vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11, fill: C.slate[500] }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11, fill: C.slate[500] }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} /><Tooltip formatter={(v: any) => [`${Number(v).toFixed(1)}%`, "Écart"]} /><Bar dataKey="gap" name="Écart %" radius={[6, 6, 0, 0]}>{chartData.map((d) => { const gap = d.target && d.facturee ? (d.facturee / d.target - 1) * 100 : 0; return <Cell key={d.key} fill={Math.abs(gap) <= 10 ? C.ok.main : Math.abs(gap) <= 20 ? C.warn.main : C.nok.main} />; })}</Bar></BarChart></ResponsiveContainer></div></Card>
        <Card><SectionTitle icon={<ShieldCheck size={18} />} title="Statuts target par mois" subtitle="OK / NOK / sans target / sans donnée" /><div style={{ height: 300, padding: 16 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke={C.slate[100]} vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11, fill: C.slate[500] }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11, fill: C.slate[500] }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="ok" name="Target OK" stackId="a" fill={C.ok.main} /><Bar dataKey="nok" name="Target NOK" stackId="a" fill={C.nok.main} /><Bar dataKey="noTarget" name="Sans target" stackId="a" fill={C.slate[300]} /><Bar dataKey="noData" name="Sans donnée" stackId="a" fill={C.warn.main} radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
      </div>
    </div>
  );
}

function TableView({ tableRows, pages, page, setPage, buttonStyle }: { tableRows: ConsoRow[]; pages: number; page: number; setPage: Dispatch<SetStateAction<number>>; buttonStyle: CSSProperties }) {
  return (
    <Card style={{ overflow: "hidden" }}>
      <SectionTitle icon={<BarChart3 size={18} />} title="Tableau détaillé" subtitle="Consommations uniquement : facturée, eFMS, solaire, estimation et target. Aucun montant financier." right={<Badge tone="blue">{tableRows.length.toLocaleString("fr-FR")} lignes affichées</Badge>} />
      <div style={{ overflow: "auto", maxHeight: "calc(100vh - 260px)" }}>
        <table className="suivi-table" style={{ width: "100%", minWidth: 1480, borderCollapse: "separate", borderSpacing: 0, fontSize: 11.5 }}>
          <thead>
            <tr style={{ background: C.blue[900] }}><th className="sticky-site-head" colSpan={3} style={groupTh(C.blue[900])}>Site</th><th colSpan={3} style={groupTh(C.blue[800])}>Facturée</th><th colSpan={4} style={groupTh(C.teal.dark)}>eFMS / ACM</th><th colSpan={3} style={groupTh(C.solar.dark)}>Solaire</th><th colSpan={2} style={groupTh(C.estim.dark)}>Estimation</th><th colSpan={4} style={groupTh(C.blue[800])}>Target</th></tr>
            <tr style={{ background: C.blue[700] }}>
              <TH sticky><THLabel label="Site" help="Identifiant et nom du site." /></TH><TH><THLabel label="Zone" help="Zone opérationnelle du site." /></TH><TH><THLabel label="Période" help="Mois de consolidation de la ligne." /></TH>
              <TH right><THLabel label="Jours" help="Nombre de jours couverts par le mois ou la facture." /></TH><TH right><THLabel label="Conso facturée" help="Consommation issue des factures Sénélec." /></TH><TH center><THLabel label="Réf." help="La facturée est prioritaire pour le statut target si elle existe." /></TH>
              <TH right><THLabel label="FMS Grid" help="Consommation remontée par eFMS Grid Report." /></TH><TH right><THLabel label="FMS ACM" help="Consommation remontée via AC Meter." /></TH><TH center><THLabel label="Δ FMS/Fact" help="Écart entre eFMS principal et consommation facturée." /></TH><TH center><THLabel label="Source" help="Source de la donnée eFMS." /></TH>
              <TH right><THLabel label="Solar kWh" help="Donnée solaire réelle sur la période." /></TH><TH right><THLabel label="Solar Target" help="Cible solaire calculée selon typologie, load et jours." /></TH><TH center><THLabel label="Δ Sol/Cible" help="Écart entre le solaire réel et la cible solaire." /></TH>
              <TH right><THLabel label="Conso estimée" help="Consommation estimée depuis EstimationResult." /></TH><TH center><THLabel label="Source estim." help="Source utilisée pour l’estimation : ACM, GRID, HISTO, TARGET, etc." /></TH>
              <TH><THLabel label="Typologie" help="Typologie utilisée pour les règles de target." /></TH><TH right><THLabel label="Conso Target" help="Cible de consommation utilisée pour le statut target." /></TH><TH center><THLabel label="Statut target" help="OK si la consommation de référence est <= target. NOK si elle dépasse la target." /></TH><TH center><THLabel label="Δ vs Target" help="Écart entre la consommation de référence et la target." /></TH>
            </tr>
          </thead>
          <tbody>{!tableRows.length ? <tr><td colSpan={19}><EmptyState title="Aucune donnée" subtitle="Aucune ligne ne correspond aux filtres sélectionnés." /></td></tr> : tableRows.map((r, i) => <ConsoTableRow key={`${r.site_id}-${r.year}-${r.month}-${i}`} r={r} i={i} />)}</tbody>
        </table>
      </div>
      {pages > 1 ? <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.slate[200]}`, background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" }}><div style={{ fontSize: 12, color: C.slate[500] }}>Page {page} / {pages}</div><div style={{ display: "flex", gap: 8 }}><button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} style={{ ...buttonStyle, background: page <= 1 ? C.slate[100] : C.blue[50], color: page <= 1 ? C.slate[400] : C.blue[700], border: `1px solid ${C.slate[200]}` }}><ChevronLeft size={14} /> Précédent</button><button type="button" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))} style={{ ...buttonStyle, background: page >= pages ? C.slate[100] : C.blue[700], color: page >= pages ? C.slate[400] : "#fff" }}>Suivant <ChevronRight size={14} /></button></div></div> : null}
    </Card>
  );
}

function ConsoTableRow({ r, i }: { r: ConsoRow; i: number }) {
  const st = getTargetStatus(r);
  const fmsMain = r.fms_grid_kwh || r.fms_acm_kwh;
  const dFms = deltaPct(fmsMain, r.conso_facturee_kwh ?? r.conso_kwh);
  const dSol = deltaPct(r.solar_kwh, r.solar_target_kwh ?? r.solar_target);
  const bg = st.status === "NOK" ? "#FFF7F7" : i % 2 === 0 ? "#fff" : C.slate[50];
  return (
    <tr className="suivi-row" style={{ background: bg }}>
      <TD sticky><div style={{ fontFamily: "monospace", fontSize: 11.5, fontWeight: 950, color: C.blue[700] }}>{r.site_id}</div><div style={{ fontSize: 10.5, color: C.slate[500], marginTop: 2, maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.site_name || "—"}</div></TD>
      <TD><Badge tone="blue">{r.zone || "—"}</Badge></TD>
      <TD><span style={{ fontFamily: "monospace", fontWeight: 900, color: C.blue[800] }}>{r.year}-{String(r.month).padStart(2, "0")}</span><div style={{ color: C.slate[400], fontSize: 10 }}>{fmtPeriod(r.year, r.month)}</div></TD>
      <TD right>{r.nb_jours ?? "—"}</TD>
      <TD right><strong style={{ color: C.blue[800], fontFamily: "monospace" }}>{fmtKwh(r.conso_facturee_kwh ?? r.conso_kwh)}</strong></TD>
      <TD center>{st.source === "FACTUREE" ? <Badge tone="blue">Référence</Badge> : <span style={{ color: C.slate[400] }}>—</span>}</TD>
      <TD right>{r.fms_grid_kwh ? <><strong style={{ color: C.blue[700], fontFamily: "monospace" }}>{fmtKwh(r.fms_grid_kwh)}</strong><div style={{ fontSize: 10, color: C.slate[400] }}><SrcDot src={r.fms_grid_src} />Grid</div></> : <span style={{ color: C.slate[400] }}>—</span>}</TD>
      <TD right>{r.fms_acm_kwh ? <><strong style={{ color: C.teal.dark, fontFamily: "monospace" }}>{fmtKwh(r.fms_acm_kwh)}</strong><div style={{ fontSize: 10, color: C.slate[400] }}><SrcDot src={r.fms_acm_src} />ACM</div></> : <span style={{ color: C.slate[400] }}>—</span>}</TD>
      <TD center><DeltaBadge value={dFms} /></TD>
      <TD center><span style={{ fontSize: 10.5, color: C.slate[500], fontWeight: 800 }}>{r.fms_grid_src || r.fms_acm_src || "—"}</span></TD>
      <TD right>{r.solar_kwh ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: C.solar.dark, fontWeight: 950, fontFamily: "monospace" }}><Sun size={12} />{fmtKwh(r.solar_kwh)}</span> : <span style={{ color: C.slate[400] }}>—</span>}</TD>
      <TD right>{fmtKwh(r.solar_target_kwh ?? r.solar_target)}</TD>
      <TD center><DeltaBadge value={dSol} /></TD>
      <TD right>{r.conso_estimee_kwh ? <strong style={{ color: C.estim.dark, fontFamily: "monospace" }}>{fmtKwh(r.conso_estimee_kwh)}</strong> : <span style={{ color: C.slate[400] }}>—</span>}</TD>
      <TD center><SourceBadge source={r.source_estimation} /></TD>
      <TD><TypoBadge typo={r.typology} />{r.load_w ? <div style={{ fontSize: 10, color: C.slate[400], marginTop: 3 }}>{fmtInt(r.load_w)} W</div> : null}</TD>
      <TD right>{fmtKwh(r.conso_target)}</TD>
      <TD center><TargetStatusBadge row={r} /></TD>
      <TD center><DeltaBadge value={st.gapPct} /></TD>
    </tr>
  );
}

function groupTh(bg: string): CSSProperties {
  return { padding: "7px 10px", background: bg, color: "rgba(255,255,255,.84)", fontSize: 10, fontWeight: 950, textTransform: "uppercase", letterSpacing: ".08em", borderRight: "1px solid rgba(255,255,255,.14)", textAlign: "center", top: 0 };
}

function TH({ children, right, center, sticky }: { children: ReactNode; right?: boolean; center?: boolean; sticky?: boolean }) {
  return <th className={sticky ? "sticky-site-head" : undefined} style={{ padding: "10px 10px", background: C.blue[700], color: "#fff", fontSize: 10.8, fontWeight: 950, textAlign: right ? "right" : center ? "center" : "left", borderBottom: `1px solid ${C.blue[500]}`, borderRight: "1px solid rgba(255,255,255,.10)", whiteSpace: "nowrap", verticalAlign: "middle", left: sticky ? 0 : undefined, minWidth: sticky ? 210 : undefined }}>{children}</th>;
}

function TD({ children, right, center, sticky }: { children: ReactNode; right?: boolean; center?: boolean; sticky?: boolean }) {
  return <td className={sticky ? "sticky-site" : undefined} style={{ padding: "11px 10px", textAlign: right ? "right" : center ? "center" : "left", borderBottom: `1px solid ${C.slate[200]}`, borderRight: `1px solid ${C.slate[100]}`, verticalAlign: "middle", background: sticky ? "inherit" : undefined, left: sticky ? 0 : undefined, minWidth: sticky ? 210 : undefined }}>{children}</td>;
}
