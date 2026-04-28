// src/features/financial/FinancialSiteDetailModal.tsx
// V2 — Drawer d'analyse financière site
// Focus : marges financières, redevances, factures HTVA, billing, diagnostics et comparaison conso.

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BadgeDollarSign,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Database,
  Eye,
  Gauge,
  Info,
  Layers,
  LineChart as LineIcon,
  Loader2,
  PanelRightClose,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Sun,
  TableProperties,
  Target,
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
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/services/api";

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
  solar: { main: "#F59E0B", light: "#FEF3C7", dark: "#B45309" },
  orange: { main: "#E8401C", light: "#FFEDD5", dark: "#C2410C" },
};

const HDR = "linear-gradient(135deg,#010E2A 0%,#032566 54%,#0A3D96 100%)";
const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

// ─────────────────────────────────────────────────────────────────────────────
// Types compatibles avec l'API actuelle
// ─────────────────────────────────────────────────────────────────────────────

type ConsoRow = {
  period: string;
  month: number;
  conso_facturee: string | null;
  montant_htva: string | null;
  conso_fms: string | null;
  conso_acm: string | null;
  conso_target: string | null;
  solar_kwh: number | null;
  solar_target_kwh: string | null;
  unavail_hours: number | null;
  fms_available: boolean;
  acm_available: boolean;
  ratio_fms: string | null;
  nb_jours: number | null;
  cible_kwh_j: string | null;
};

type MargeRow = {
  period: string;
  month: number;
  redevance: string | null;
  montant_htva: string | null;
  marge: string | null;
  marge_statut: "OK" | "NOK" | null;
  load_w: number | null;
  hors_catalogue: boolean;
  recurrence_type: string | null;
  recurrence_mois_nok?: number | null;
};

type BillingRow = {
  period: string;
  montant_hors_tva?: string | null;
  montant_htva?: string | null;
  energie?: string | null;
  abonnement?: string | null;
  montant_cosinus_phi?: string | null;
  penalite_abonnement?: string | null;
  nb_jours?: number | null;
};

type CertificationRow = {
  period: string;
  status: string | null;
  ratio_fms?: string | null;
  variation_montant?: string | null;
};

type Diagnostic = {
  type: string;
  severity: string;
  message: string;
  detail: string;
};

type SiteDetail = {
  site: {
    site_id: string;
    name: string | null;
    zone: string | null;
    typology: string | null;
    configuration: string | null;
  };
  period: { year: number; month_start: number; month_end: number };
  summary: {
    total_marge: string;
    count_ok: number;
    count_nok: number;
    count_hors_catalogue: number;
    billing_total_ht: string;
    billing_total_cosphi: string;
    billing_total_penalite: string;
  };
  current: {
    marge_statut: string | null;
    recurrence_type: string | null;
    redevance: string | null;
    montant_htva: string | null;
    load_w: number | null;
  } | null;
  history: MargeRow[];
  conso_comparison: { rows: ConsoRow[] };
  diagnostics: Diagnostic[];
  billing?: { rows: BillingRow[] };
  certification?: { summary?: Record<string, number | string>; rows?: CertificationRow[] };
};

export type FinancialSiteDetailModalProps = {
  siteId: string;
  siteName?: string;
  year: number;
  monthStart: number;
  monthEnd: number;
  onClose: () => void;
};

type TabKey = "overview" | "marge" | "conso" | "billing" | "diagnostics";
type DisplayMode = "chart" | "table";

// ─────────────────────────────────────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────────────────────────────────────

function toNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function n(v: string | number | null | undefined): number {
  return toNum(v) ?? 0;
}

function fmt(v: string | number | null | undefined, decimals = 0): string {
  const value = toNum(v);
  if (value === null) return "—";
  return value.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtMoney(v: string | number | null | undefined): string {
  const value = toNum(v);
  if (value === null) return "—";
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M FCFA`;
  }
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} FCFA`;
}

function fmtKwh(v: string | number | null | undefined): string {
  const value = toNum(v);
  if (value === null) return "—";
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MWh`;
  }
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} kWh`;
}

function fmtPct(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function monthLabel(period: string, month?: number): string {
  if (month && MONTHS_FR[month - 1]) return MONTHS_FR[month - 1];
  if (period?.length >= 7) {
    const m = Number(period.slice(5, 7));
    return MONTHS_FR[m - 1] || period;
  }
  return period || "—";
}

function deltaPct(a: string | number | null | undefined, b: string | number | null | undefined): number | null {
  const av = toNum(a);
  const bv = toNum(b);
  if (av === null || bv === null || bv === 0) return null;
  return (av / bv - 1) * 100;
}

function sum(rows: Array<Record<string, any>>, key: string): number | null {
  let total = 0;
  let has = false;
  rows.forEach((r) => {
    const v = toNum(r[key]);
    if (v !== null) {
      total += v;
      has = true;
    }
  });
  return has ? total : null;
}

function avg(vals: Array<number | null>): number | null {
  const real = vals.filter((v): v is number => v !== null && Number.isFinite(v));
  if (!real.length) return null;
  return real.reduce((a, b) => a + b, 0) / real.length;
}

function colorByValue(value: number | null, positiveGood = true): string {
  if (value === null) return C.slate[400];
  if (value === 0) return C.slate[500];
  if (positiveGood) return value >= 0 ? C.ok.main : C.nok.main;
  return value <= 0 ? C.ok.main : C.nok.main;
}

function safeStatus(status?: string | null) {
  if (!status) return { label: "—", bg: C.slate[100], color: C.slate[500], border: C.slate[200] };
  const ok = status === "OK" || status.includes("CERTIFIED");
  const nok = status === "NOK" || status.includes("REVIEW") || status.includes("UNAVAILABLE");
  if (ok) return { label: status, bg: C.ok.light, color: C.ok.dark, border: C.ok.mid };
  if (nok) return { label: status, bg: C.nok.light, color: C.nok.dark, border: C.nok.mid };
  return { label: status, bg: C.warn.light, color: C.warn.dark, border: C.warn.mid };
}

function severityConfig(severity: string) {
  const s = severity?.toUpperCase();
  if (s === "CRITICAL") return { label: "Critique", bg: C.nok.light, color: C.nok.dark, border: C.nok.mid, icon: <AlertTriangle size={15} /> };
  if (s === "HIGH" || s === "HAUTE") return { label: "Élevé", bg: C.orange.light, color: C.orange.dark, border: "#FDBA74", icon: <AlertCircle size={15} /> };
  if (s === "MEDIUM" || s === "MOYENNE") return { label: "Moyen", bg: C.warn.light, color: C.warn.dark, border: C.warn.mid, icon: <Info size={15} /> };
  return { label: "Faible", bg: C.ok.light, color: C.ok.dark, border: C.ok.mid, icon: <CheckCircle2 size={15} /> };
}

// ─────────────────────────────────────────────────────────────────────────────
// UI atoms
// ─────────────────────────────────────────────────────────────────────────────

function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "blue" | "ok" | "nok" | "warn" | "purple" | "cyan" | "orange" }) {
  const map = {
    slate: { bg: C.slate[100], color: C.slate[700], border: C.slate[200] },
    blue: { bg: C.blue[100], color: C.blue[700], border: "#BFDBFE" },
    ok: { bg: C.ok.light, color: C.ok.dark, border: C.ok.mid },
    nok: { bg: C.nok.light, color: C.nok.dark, border: C.nok.mid },
    warn: { bg: C.warn.light, color: C.warn.dark, border: C.warn.mid },
    purple: { bg: C.purple.light, color: C.purple.dark, border: "#DDD6FE" },
    cyan: { bg: C.cyan.light, color: C.cyan.dark, border: "#A5F3FC" },
    orange: { bg: C.orange.light, color: C.orange.dark, border: "#FDBA74" },
  }[tone];

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 999, background: map.bg, color: map.color, border: `1px solid ${map.border}`, fontSize: 10.5, fontWeight: 900, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function StatusBadge({ status }: { status?: string | null }) {
  const s = safeStatus(status);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontSize: 10.5, fontWeight: 950 }}>
      {status === "OK" || status?.includes("CERTIFIED") ? <CheckCircle2 size={12} /> : status ? <XCircle size={12} /> : null}
      {s.label}
    </span>
  );
}

function DeltaBadge({ value }: { value: number | null }) {
  if (value === null) return <span style={{ color: C.slate[400], fontSize: 11 }}>—</span>;
  const abs = Math.abs(value);
  const tone = abs <= 10 ? "ok" : abs <= 20 ? "warn" : "nok";
  return (
    <Badge tone={tone}>
      {value >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
      {fmtPct(value)}
    </Badge>
  );
}

function KpiCard({ label, value, sub, icon, color, hint }: { label: string; value: string; sub?: string; icon: ReactNode; color: string; hint?: string }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 18, background: "#fff", border: `1px solid ${C.slate[200]}`, padding: "14px 15px", boxShadow: "0 12px 30px rgba(15,23,42,.06)" }} title={hint}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 92% 10%,${color}22,transparent 30%)` }} />
      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, color: C.slate[500], fontWeight: 950, textTransform: "uppercase", letterSpacing: ".08em" }}>{label}</div>
          <div style={{ marginTop: 7, color, fontSize: 18, fontWeight: 950, letterSpacing: "-.03em", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
          {sub ? <div style={{ marginTop: 4, fontSize: 11, color: C.slate[500], whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div> : null}
        </div>
        <div style={{ width: 38, height: 38, borderRadius: 14, background: `${color}12`, color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
      </div>
    </div>
  );
}

function Panel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.slate[200]}`, borderRadius: 20, boxShadow: "0 14px 38px rgba(15,23,42,.06)", overflow: "hidden", ...style }}>
      {children}
    </div>
  );
}

function PanelTitle({ icon, title, subtitle, right }: { icon: ReactNode; title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div style={{ padding: "15px 17px", borderBottom: `1px solid ${C.slate[100]}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div style={{ display: "flex", gap: 11, alignItems: "center" }}>
        <div style={{ width: 35, height: 35, borderRadius: 13, background: C.blue[50], color: C.blue[700], display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 950, color: C.blue[950], letterSpacing: "-.02em" }}>{title}</div>
          {subtitle ? <div style={{ fontSize: 11.5, color: C.slate[500], marginTop: 2 }}>{subtitle}</div> : null}
        </div>
      </div>
      {right}
    </div>
  );
}

function EmptyBlock({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ padding: 46, textAlign: "center", color: C.slate[500] }}>
      <div style={{ width: 52, height: 52, borderRadius: 18, background: C.slate[100], margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Database size={22} color={C.slate[400]} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 900, color: C.slate[700] }}>{title}</div>
      <div style={{ fontSize: 12, marginTop: 5 }}>{text}</div>
    </div>
  );
}

function MoneyCell({ value, positiveGood = true }: { value?: string | number | null; positiveGood?: boolean }) {
  const val = toNum(value);
  return <strong style={{ color: colorByValue(val, positiveGood), fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{fmtMoney(value)}</strong>;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.slate[200]}`, borderRadius: 14, padding: "10px 12px", boxShadow: "0 16px 40px rgba(15,23,42,.14)", minWidth: 210 }}>
      <div style={{ fontSize: 12, fontWeight: 950, color: C.blue[950], marginBottom: 8 }}>{label}</div>
      <div style={{ display: "grid", gap: 6 }}>
        {payload.filter((p: any) => p.value !== null && p.value !== undefined).map((p: any) => {
          const isMoney = ["marge", "redevance", "facture", "ht", "abonnement", "cosphi", "penalite"].includes(String(p.dataKey));
          return (
            <div key={p.dataKey} style={{ display: "flex", justifyContent: "space-between", gap: 14, fontSize: 11.5 }}>
              <span style={{ display: "flex", gap: 6, alignItems: "center", color: C.slate[600] }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: p.color || p.fill }} />
                {p.name || p.dataKey}
              </span>
              <strong style={{ color: C.slate[800], fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                {isMoney ? fmtMoney(p.value) : fmtKwh(p.value)}
              </strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tables
// ─────────────────────────────────────────────────────────────────────────────

function TableShell({ children, minWidth = 980 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div style={{ overflow: "auto", border: `1px solid ${C.slate[200]}`, borderRadius: 16 }}>
      <table style={{ width: "100%", minWidth, borderCollapse: "separate", borderSpacing: 0, fontSize: 12 }}>{children}</table>
    </div>
  );
}

function Th({ children, right, center }: { children: ReactNode; right?: boolean; center?: boolean }) {
  return (
    <th style={{ position: "sticky", top: 0, zIndex: 2, padding: "10px 12px", background: C.blue[900], color: "rgba(255,255,255,.88)", textAlign: right ? "right" : center ? "center" : "left", fontSize: 10, fontWeight: 950, textTransform: "uppercase", letterSpacing: ".08em", borderBottom: `1px solid ${C.blue[700]}`, whiteSpace: "nowrap" }}>{children}</th>
  );
}

function Td({ children, right, center }: { children: ReactNode; right?: boolean; center?: boolean }) {
  return <td style={{ padding: "11px 12px", textAlign: right ? "right" : center ? "center" : "left", borderBottom: `1px solid ${C.slate[100]}`, color: C.slate[700], verticalAlign: "middle" }}>{children}</td>;
}

function MargeTable({ rows }: { rows: MargeRow[] }) {
  if (!rows.length) return <EmptyBlock title="Aucune marge" text="Aucune évaluation financière disponible sur la période." />;

  return (
    <TableShell minWidth={960}>
      <thead>
        <tr>
          <Th>Période</Th>
          <Th right>Load</Th>
          <Th right>Redevance</Th>
          <Th right>Montant HT</Th>
          <Th right>Marge</Th>
          <Th center>Statut</Th>
          <Th center>Récurrence</Th>
          <Th center>HC</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const isNok = r.marge_statut === "NOK";
          return (
            <tr key={r.period} style={{ background: isNok ? "#FFF7F7" : i % 2 ? C.slate[50] : "#fff" }}>
              <Td><strong style={{ color: C.blue[800], fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{r.period}</strong></Td>
              <Td right>{r.load_w ? `${r.load_w.toLocaleString("fr-FR")} W` : "—"}</Td>
              <Td right><MoneyCell value={r.redevance} /></Td>
              <Td right><MoneyCell value={r.montant_htva} positiveGood={false} /></Td>
              <Td right><MoneyCell value={r.marge} /></Td>
              <Td center><StatusBadge status={r.marge_statut} /></Td>
              <Td center>{r.recurrence_type ? <Badge tone={r.recurrence_type === "critique" ? "nok" : "warn"}>{r.recurrence_type}{r.recurrence_mois_nok ? ` · ${r.recurrence_mois_nok}m` : ""}</Badge> : <span style={{ color: C.slate[400] }}>—</span>}</Td>
              <Td center>{r.hors_catalogue ? <Badge tone="warn">HC</Badge> : <span style={{ color: C.slate[400] }}>—</span>}</Td>
            </tr>
          );
        })}
      </tbody>
    </TableShell>
  );
}

function ConsoTable({ rows }: { rows: ConsoRow[] }) {
  if (!rows.length) return <EmptyBlock title="Aucune consommation" text="Aucune donnée de consommation disponible pour ce site sur la période." />;

  return (
    <TableShell minWidth={1180}>
      <thead>
        <tr>
          <Th>Période</Th>
          <Th right>Jours</Th>
          <Th right>Facturée</Th>
          <Th right>FMS/Grid</Th>
          <Th right>ACM</Th>
          <Th center>Δ FMS</Th>
          <Th right>Target</Th>
          <Th center>Δ Target</Th>
          <Th right>Solaire</Th>
          <Th right>Target sol.</Th>
          <Th center>Δ Sol.</Th>
          <Th right>Indispo</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const fmsMain = r.conso_fms || r.conso_acm;
          const solarDelta = r.solar_kwh !== null && r.solar_target_kwh ? deltaPct(r.solar_kwh, r.solar_target_kwh) : null;
          return (
            <tr key={r.period} style={{ background: i % 2 ? C.slate[50] : "#fff" }}>
              <Td><strong style={{ color: C.blue[800], fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{r.period}</strong></Td>
              <Td right>{r.nb_jours ?? "—"}</Td>
              <Td right><strong style={{ color: C.blue[700], fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{fmtKwh(r.conso_facturee)}</strong></Td>
              <Td right>{r.conso_fms ? <strong style={{ color: C.cyan.dark, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{fmtKwh(r.conso_fms)}</strong> : <span style={{ color: C.slate[400] }}>—</span>}</Td>
              <Td right>{r.conso_acm ? <strong style={{ color: C.purple.dark, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{fmtKwh(r.conso_acm)}</strong> : <span style={{ color: C.slate[400] }}>—</span>}</Td>
              <Td center><DeltaBadge value={deltaPct(fmsMain, r.conso_facturee)} /></Td>
              <Td right>{fmtKwh(r.conso_target)}</Td>
              <Td center><DeltaBadge value={deltaPct(r.conso_facturee, r.conso_target)} /></Td>
              <Td right>{r.solar_kwh !== null ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: C.solar.dark, fontWeight: 900 }}><Sun size={12} />{fmtKwh(r.solar_kwh)}</span> : <span style={{ color: C.slate[400] }}>—</span>}</Td>
              <Td right>{fmtKwh(r.solar_target_kwh)}</Td>
              <Td center><DeltaBadge value={solarDelta} /></Td>
              <Td right>{r.unavail_hours !== null && r.unavail_hours !== undefined ? `${fmt(r.unavail_hours, 1)} h` : "—"}</Td>
            </tr>
          );
        })}
      </tbody>
    </TableShell>
  );
}

function BillingTable({ rows }: { rows: BillingRow[] }) {
  if (!rows.length) return <EmptyBlock title="Aucun billing" text="Aucune ligne billing disponible pour la période." />;

  return (
    <TableShell minWidth={900}>
      <thead>
        <tr>
          <Th>Période</Th>
          <Th right>HT</Th>
          <Th right>Énergie</Th>
          <Th right>Abonnement</Th>
          <Th right>Cos φ</Th>
          <Th right>Pénalité PS</Th>
          <Th right>Jours</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.period} style={{ background: i % 2 ? C.slate[50] : "#fff" }}>
            <Td><strong style={{ color: C.blue[800], fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{r.period}</strong></Td>
            <Td right><MoneyCell value={r.montant_hors_tva ?? r.montant_htva} positiveGood={false} /></Td>
            <Td right>{fmtKwh(r.energie)}</Td>
            <Td right>{fmtMoney(r.abonnement)}</Td>
            <Td right>{fmtMoney(r.montant_cosinus_phi)}</Td>
            <Td right>{fmtMoney(r.penalite_abonnement)}</Td>
            <Td right>{r.nb_jours ?? "—"}</Td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Charts
// ─────────────────────────────────────────────────────────────────────────────

function MargeChart({ rows }: { rows: MargeRow[] }) {
  if (!rows.length) return <EmptyBlock title="Aucune marge" text="Aucune donnée à afficher dans le graphique." />;
  const data = rows.map((r) => ({
    label: monthLabel(r.period, r.month),
    marge: toNum(r.marge),
    redevance: toNum(r.redevance),
    facture: toNum(r.montant_htva),
  }));

  return (
    <div style={{ height: 340, padding: "16px 18px 8px" }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 18, bottom: 8, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.slate[100]} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.slate[500] }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: C.slate[500] }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 1_000_000)}M`} width={58} />
          <Tooltip content={<ChartTooltip />} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="marge" name="Marge" radius={[6, 6, 0, 0]}>
            {data.map((d, i) => <Cell key={i} fill={(d.marge ?? 0) >= 0 ? C.ok.main : C.nok.main} />)}
          </Bar>
          <Line type="monotone" dataKey="redevance" name="Redevance" stroke={C.blue[600]} strokeWidth={2.2} dot={{ r: 3 }} connectNulls />
          <Line type="monotone" dataKey="facture" name="Facture HT" stroke={C.orange.main} strokeWidth={2.2} dot={{ r: 3 }} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function ConsoChart({ rows }: { rows: ConsoRow[] }) {
  if (!rows.length) return <EmptyBlock title="Aucune consommation" text="Aucune donnée à afficher dans le graphique." />;
  const data = rows.map((r) => ({
    label: monthLabel(r.period, r.month),
    facturee: toNum(r.conso_facturee),
    fms: toNum(r.conso_fms) ?? toNum(r.conso_acm),
    target: toNum(r.conso_target),
    solar: toNum(r.solar_kwh),
  }));

  return (
    <div style={{ height: 340, padding: "16px 18px 8px" }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 18, bottom: 8, left: 4 }}>
          <defs>
            <linearGradient id="factFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={C.blue[500]} stopOpacity={0.18} />
              <stop offset="95%" stopColor={C.blue[500]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={C.slate[100]} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.slate[500] }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: C.slate[500] }} axisLine={false} tickLine={false} tickFormatter={(v) => (Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)} MWh` : `${v}`)} width={66} />
          <Tooltip content={<ChartTooltip />} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
          <Area type="monotone" dataKey="facturee" name="Facturée" stroke={C.blue[600]} fill="url(#factFill)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
          <Line type="monotone" dataKey="fms" name="FMS/ACM" stroke={C.cyan.main} strokeWidth={2.2} strokeDasharray="6 4" dot={false} connectNulls />
          <Line type="monotone" dataKey="target" name="Target" stroke={C.ok.main} strokeWidth={2.1} dot={{ r: 3 }} connectNulls />
          <Line type="monotone" dataKey="solar" name="Solaire" stroke={C.solar.main} strokeWidth={2.1} dot={{ r: 3 }} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function BillingChart({ rows }: { rows: BillingRow[] }) {
  if (!rows.length) return <EmptyBlock title="Aucun billing" text="Aucune donnée à afficher dans le graphique." />;
  const data = rows.map((r) => ({
    label: monthLabel(r.period),
    ht: toNum(r.montant_hors_tva ?? r.montant_htva),
    abonnement: toNum(r.abonnement),
    cosphi: toNum(r.montant_cosinus_phi),
    penalite: toNum(r.penalite_abonnement),
  }));

  return (
    <div style={{ height: 330, padding: "16px 18px 8px" }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 18, bottom: 8, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.slate[100]} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.slate[500] }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: C.slate[500] }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 1_000_000)}M`} width={58} />
          <Tooltip content={<ChartTooltip />} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="ht" name="HT" fill={C.blue[600]} radius={[6, 6, 0, 0]} />
          <Bar dataKey="abonnement" name="Abonnement" fill={C.cyan.main} radius={[6, 6, 0, 0]} />
          <Bar dataKey="cosphi" name="Cos φ" fill={C.warn.main} radius={[6, 6, 0, 0]} />
          <Bar dataKey="penalite" name="Pénalité PS" fill={C.nok.main} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DiagnosticsPanel({ diagnostics }: { diagnostics: Diagnostic[] }) {
  if (!diagnostics.length) {
    return (
      <div style={{ padding: 18, background: C.ok.light, color: C.ok.dark, border: `1px solid ${C.ok.mid}`, borderRadius: 16, display: "flex", alignItems: "center", gap: 10, fontWeight: 800 }}>
        <CheckCircle2 size={18} /> Aucun diagnostic critique sur la période.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {diagnostics.map((d, i) => {
        const cfg = severityConfig(d.severity);
        return (
          <div key={`${d.type}-${i}`} style={{ padding: "13px 15px", borderRadius: 16, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 950 }}>
                {cfg.icon} {d.message}
              </div>
              <span style={{ fontSize: 10, fontWeight: 950, textTransform: "uppercase" }}>{cfg.label}</span>
            </div>
            <div style={{ marginTop: 5, fontSize: 12, lineHeight: 1.5, color: C.slate[700] }}>{d.detail}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function FinancialSiteDetailModal({ siteId, siteName, year, monthStart, monthEnd, onClose }: FinancialSiteDetailModalProps) {
  const [data, setData] = useState<SiteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("chart");

  useEffect(() => {
    setLoading(true);
    setError(null);
    setData(null);

    api
      .get<SiteDetail>(`/financial/evaluations/${siteId}/detail/`, {
        params: { year, month_start: monthStart, month_end: monthEnd },
      })
      .then((res) => setData(res.data))
      .catch((e) => setError(e?.response?.data?.detail || e?.message || "Erreur de chargement de l’analyse."))
      .finally(() => setLoading(false));
  }, [siteId, year, monthStart, monthEnd]);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onClose]);

  const consoRows = data?.conso_comparison?.rows ?? [];
  const margeRows = data?.history ?? [];
  const billingRows = data?.billing?.rows ?? [];
  const certificationRows = data?.certification?.rows ?? [];

  const aggregates = useMemo(() => {
    const totalMarge = toNum(data?.summary.total_marge);
    const totalFacturee = sum(consoRows as any[], "conso_facturee");
    const totalFms = sum(consoRows as any[], "conso_fms") ?? sum(consoRows as any[], "conso_acm");
    const totalTarget = sum(consoRows as any[], "conso_target");
    const totalSolar = sum(consoRows as any[], "solar_kwh");
    const totalSolarTarget = sum(consoRows as any[], "solar_target_kwh");
    const totalRedevance = sum(margeRows as any[], "redevance");
    const totalFacture = sum(margeRows as any[], "montant_htva") ?? toNum(data?.summary.billing_total_ht);
    const totalCosphi = toNum(data?.summary.billing_total_cosphi);
    const totalPenalite = toNum(data?.summary.billing_total_penalite);

    const gapFms = totalFacturee !== null && totalFms !== null && totalFms > 0 ? (totalFacturee / totalFms - 1) * 100 : null;
    const gapTarget = totalFacturee !== null && totalTarget !== null && totalTarget > 0 ? (totalFacturee / totalTarget - 1) * 100 : null;
    const gapSolar = totalSolar !== null && totalSolarTarget !== null && totalSolarTarget > 0 ? (totalSolar / totalSolarTarget - 1) * 100 : null;
    const costKwh = totalFacturee !== null && totalFacture !== null && totalFacturee > 0 ? totalFacture / totalFacturee : null;

    return { totalMarge, totalFacturee, totalFms, totalTarget, totalSolar, totalSolarTarget, totalRedevance, totalFacture, totalCosphi, totalPenalite, gapFms, gapTarget, gapSolar, costKwh };
  }, [consoRows, margeRows, data]);

  const statusPie = useMemo(() => {
    const ok = data?.summary.count_ok ?? margeRows.filter((r) => r.marge_statut === "OK").length;
    const nok = data?.summary.count_nok ?? margeRows.filter((r) => r.marge_statut === "NOK").length;
    const hc = data?.summary.count_hors_catalogue ?? margeRows.filter((r) => r.hors_catalogue).length;
    return [
      { name: "Marge OK", value: ok, color: C.ok.main },
      { name: "Marge NOK", value: nok, color: C.nok.main },
      { name: "Hors catalogue", value: hc, color: C.warn.main },
    ];
  }, [data, margeRows]);

  const currentStatus = safeStatus(data?.current?.marge_statut);
  const displayTitle = siteName || data?.site.name || siteId;
  const periodText = `${MONTHS_FR[monthStart - 1]} ${year} → ${MONTHS_FR[monthEnd - 1]} ${year}`;

  const tabs: Array<{ key: TabKey; label: string; icon: ReactNode; count?: number }> = [
    { key: "overview", label: "Synthèse", icon: <Sparkles size={14} /> },
    { key: "marge", label: "Marge", icon: <BadgeDollarSign size={14} />, count: margeRows.length },
    { key: "conso", label: "Consommation", icon: <Activity size={14} />, count: consoRows.length },
    { key: "billing", label: "Billing", icon: <ReceiptText size={14} />, count: billingRows.length },
    { key: "diagnostics", label: "Diagnostics", icon: <AlertTriangle size={14} />, count: data?.diagnostics?.length || 0 },
  ];

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(2,6,23,.62)", backdropFilter: "blur(7px)", display: "flex", justifyContent: "flex-end" }}
    >
      <style>{`
        @keyframes slideInRight { from { transform: translateX(28px); opacity:.3; } to { transform: translateX(0); opacity:1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .fsd-row:hover { background: #EFF6FF !important; }
      `}</style>

      <div style={{ width: "min(1240px, 100vw)", height: "100vh", background: "linear-gradient(180deg,#F8FAFC 0%,#EEF4FF 100%)", boxShadow: "-24px 0 70px rgba(2,6,23,.28)", display: "flex", flexDirection: "column", animation: "slideInRight .20s ease-out" }}>
        {/* Header */}
        <div style={{ background: HDR, color: "#fff", padding: "20px 22px 16px", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Badge tone="blue"><Eye size={12} /> Analyse site</Badge>
                <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, fontWeight: 950, color: "rgba(255,255,255,.85)" }}>{siteId}</span>
                {data?.current?.recurrence_type ? <Badge tone={data.current.recurrence_type === "critique" ? "nok" : "warn"}>{data.current.recurrence_type}</Badge> : null}
                {data?.summary.count_hors_catalogue ? <Badge tone="warn">{data.summary.count_hors_catalogue} HC</Badge> : null}
              </div>

              <h2 style={{ margin: "11px 0 5px", fontSize: 25, lineHeight: 1.08, fontWeight: 950, letterSpacing: "-.04em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {displayTitle}
              </h2>

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12.5, color: "rgba(255,255,255,.62)" }}>
                <span>{periodText}</span>
                {data?.site.zone ? <span>· Zone {data.site.zone}</span> : null}
                {data?.site.typology ? <span>· {data.site.typology}</span> : null}
                {data?.site.configuration ? <span>· {data.site.configuration}</span> : null}
                {data?.current?.load_w ? <span>· Load {(data.current.load_w / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kW</span> : null}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {data?.current?.marge_statut ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, background: "rgba(255,255,255,.10)", border: "1px solid rgba(255,255,255,.15)", color: currentStatus.color, fontWeight: 950, fontSize: 12 }}>
                  {data.current.marge_statut === "OK" ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                  Marge {data.current.marge_statut}
                </span>
              ) : null}

              <button onClick={onClose} type="button" style={{ width: 38, height: 38, borderRadius: 14, border: "1px solid rgba(255,255,255,.18)", background: "rgba(255,255,255,.10)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} title="Fermer">
                <PanelRightClose size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Loading / error */}
        {loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, color: C.slate[500], fontWeight: 800 }}>
            <Loader2 size={26} style={{ animation: "spin .8s linear infinite", color: C.blue[600] }} /> Chargement de l’analyse financière…
          </div>
        ) : error ? (
          <div style={{ flex: 1, padding: 22 }}>
            <Panel>
              <div style={{ padding: 22, color: C.nok.dark, background: C.nok.light, display: "flex", alignItems: "center", gap: 10 }}>
                <XCircle size={18} /> {error}
              </div>
            </Panel>
          </div>
        ) : data ? (
          <>
            {/* KPI strip */}
            <div style={{ padding: 18, display: "grid", gridTemplateColumns: "repeat(6,minmax(145px,1fr))", gap: 10, flexShrink: 0 }}>
              <KpiCard label="Marge cumulée" value={fmtMoney(aggregates.totalMarge)} sub={`${data.summary.count_ok} OK · ${data.summary.count_nok} NOK`} color={colorByValue(aggregates.totalMarge)} icon={aggregates.totalMarge !== null && aggregates.totalMarge < 0 ? <TrendingDown size={19} /> : <TrendingUp size={19} />} />
              <KpiCard label="Redevance" value={fmtMoney(aggregates.totalRedevance)} sub="Total attendu" color={C.blue[600]} icon={<Wallet size={19} />} />
              <KpiCard label="Montant HTVA" value={fmtMoney(aggregates.totalFacture)} sub="Facturé Sénélec" color={C.orange.main} icon={<ReceiptText size={19} />} />
              <KpiCard label="Écart Fact/FMS" value={fmtPct(aggregates.gapFms)} sub="Facturée vs mesure" color={Math.abs(aggregates.gapFms ?? 0) <= 10 ? C.ok.main : C.warn.main} icon={<Gauge size={19} />} />
              <KpiCard label="Coût moyen" value={aggregates.costKwh !== null ? `${fmt(aggregates.costKwh)} FCFA/kWh` : "—"} sub="HTVA / kWh" color={C.cyan.main} icon={<Zap size={19} />} />
              <KpiCard label="Pénalités" value={fmtMoney((aggregates.totalCosphi ?? 0) + (aggregates.totalPenalite ?? 0))} sub="Cos φ + puissance" color={C.nok.main} icon={<AlertTriangle size={19} />} />
            </div>

            {/* Tabs */}
            <div style={{ padding: "0 18px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    style={{ border: `1px solid ${tab === t.key ? C.blue[600] : C.slate[200]}`, background: tab === t.key ? C.blue[700] : "#fff", color: tab === t.key ? "#fff" : C.slate[600], borderRadius: 999, padding: "9px 13px", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 950, cursor: "pointer", boxShadow: tab === t.key ? "0 10px 24px rgba(10,61,150,.22)" : "0 1px 2px rgba(0,0,0,.04)" }}
                  >
                    {t.icon} {t.label}
                    {typeof t.count === "number" ? <span style={{ opacity: .75 }}>({t.count})</span> : null}
                  </button>
                ))}
              </div>

              {(tab === "marge" || tab === "conso" || tab === "billing") ? (
                <div style={{ display: "flex", border: `1px solid ${C.slate[200]}`, borderRadius: 13, overflow: "hidden", background: "#fff" }}>
                  {(["chart", "table"] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setDisplayMode(m)} style={{ border: "none", padding: "8px 12px", fontSize: 12, fontWeight: 950, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, background: displayMode === m ? C.blue[700] : "#fff", color: displayMode === m ? "#fff" : C.slate[600] }}>
                      {m === "chart" ? <LineIcon size={13} /> : <TableProperties size={13} />}
                      {m === "chart" ? "Graphique" : "Tableau"}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflow: "auto", padding: "0 18px 20px" }}>
              {tab === "overview" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1.3fr .7fr", gap: 16 }}>
                  <Panel>
                    <PanelTitle icon={<BarChart3 size={18} />} title="Évolution financière" subtitle="Marge, redevance et montant HTVA" />
                    <MargeChart rows={margeRows} />
                  </Panel>

                  <div style={{ display: "grid", gap: 16 }}>
                    <Panel>
                      <PanelTitle icon={<ShieldCheck size={18} />} title="Répartition" subtitle="Statuts marge" />
                      <div style={{ height: 210, padding: 10 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={statusPie} dataKey="value" nameKey="name" innerRadius={48} outerRadius={76} paddingAngle={3}>
                              {statusPie.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div style={{ display: "grid", gap: 7, padding: "0 16px 16px" }}>
                        {statusPie.map((s) => (
                          <div key={s.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.slate[600] }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: s.color }} />{s.name}</span>
                            <strong style={{ color: C.slate[800] }}>{s.value}</strong>
                          </div>
                        ))}
                      </div>
                    </Panel>

                    <Panel>
                      <PanelTitle icon={<Sparkles size={18} />} title="Diagnostic rapide" subtitle="Points à surveiller" />
                      <div style={{ padding: 14 }}>
                        <DiagnosticsPanel diagnostics={(data.diagnostics || []).slice(0, 3)} />
                      </div>
                    </Panel>
                  </div>

                  <Panel style={{ gridColumn: "1 / -1" }}>
                    <PanelTitle icon={<Activity size={18} />} title="Consommations multi-sources" subtitle="Facturée, FMS/ACM, target et solaire" />
                    <ConsoChart rows={consoRows} />
                  </Panel>
                </div>
              ) : null}

              {tab === "marge" ? (
                <Panel>
                  <PanelTitle icon={<BadgeDollarSign size={18} />} title="Historique des marges" subtitle="Redevance - montant HTVA réel" right={<Badge tone={aggregates.totalMarge !== null && aggregates.totalMarge < 0 ? "nok" : "ok"}>{fmtMoney(aggregates.totalMarge)}</Badge>} />
                  <div style={{ padding: 16 }}>{displayMode === "chart" ? <MargeChart rows={margeRows} /> : <MargeTable rows={margeRows} />}</div>
                </Panel>
              ) : null}

              {tab === "conso" ? (
                <Panel>
                  <PanelTitle icon={<Activity size={18} />} title="Comparaison consommation" subtitle="Facturée vs FMS/ACM vs target vs solaire" right={<Badge tone="cyan">Δ FMS {fmtPct(aggregates.gapFms)}</Badge>} />
                  <div style={{ padding: 16 }}>{displayMode === "chart" ? <ConsoChart rows={consoRows} /> : <ConsoTable rows={consoRows} />}</div>
                </Panel>
              ) : null}

              {tab === "billing" ? (
                <Panel>
                  <PanelTitle icon={<ReceiptText size={18} />} title="Détail billing" subtitle="HTVA, énergie, abonnement, cos φ et pénalités" right={<Badge tone="orange">Pénalités {fmtMoney((aggregates.totalCosphi ?? 0) + (aggregates.totalPenalite ?? 0))}</Badge>} />
                  <div style={{ padding: 16 }}>{displayMode === "chart" ? <BillingChart rows={billingRows} /> : <BillingTable rows={billingRows} />}</div>
                </Panel>
              ) : null}

              {tab === "diagnostics" ? (
                <div style={{ display: "grid", gap: 16 }}>
                  <Panel>
                    <PanelTitle icon={<AlertTriangle size={18} />} title="Diagnostics automatiques" subtitle="Causes potentielles et alertes détectées" />
                    <div style={{ padding: 16 }}><DiagnosticsPanel diagnostics={data.diagnostics || []} /></div>
                  </Panel>

                  {certificationRows.length ? (
                    <Panel>
                      <PanelTitle icon={<ShieldCheck size={18} />} title="Certification" subtitle="Statuts certification sur la période" />
                      <div style={{ padding: 16 }}>
                        <TableShell minWidth={760}>
                          <thead><tr><Th>Période</Th><Th center>Statut</Th><Th right>Ratio FMS</Th><Th right>Variation montant</Th></tr></thead>
                          <tbody>
                            {certificationRows.map((r, i) => (
                              <tr key={`${r.period}-${i}`} style={{ background: i % 2 ? C.slate[50] : "#fff" }}>
                                <Td><strong>{r.period}</strong></Td>
                                <Td center><StatusBadge status={r.status} /></Td>
                                <Td right>{r.ratio_fms || "—"}</Td>
                                <Td right>{r.variation_montant || "—"}</Td>
                              </tr>
                            ))}
                          </tbody>
                        </TableShell>
                      </div>
                    </Panel>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div style={{ padding: "12px 18px", borderTop: `1px solid ${C.slate[200]}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, background: "rgba(255,255,255,.75)", flexShrink: 0 }}>
              <div style={{ fontSize: 11.5, color: C.slate[500], display: "flex", alignItems: "center", gap: 7 }}>
                <Info size={13} /> Marge = Redevance - Montant HTVA réel · NOK si marge négative.
              </div>
              <button onClick={onClose} type="button" style={{ padding: "9px 16px", borderRadius: 12, border: "none", background: C.blue[800], color: "#fff", fontSize: 12, fontWeight: 950, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7 }}>
                Fermer <ChevronRight size={14} />
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
