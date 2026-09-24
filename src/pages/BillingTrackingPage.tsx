// src/pages/BillingTrackingPage.tsx

import { useState, useMemo, useRef, useEffect, type ReactNode, type CSSProperties } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  Calendar,
  Download,
  RefreshCw,
  DollarSign,
  Zap,
  AlertTriangle,
  Activity,
  BarChart2,
  ChevronUp,
  ChevronDown,
  Minus,
  Search,
  X,
  Building2,
  Globe,
  TrendingUp,
  CheckCircle2,
  PackageX,
  Clock,
  TrendingDown,
  Loader2,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { api } from "@/services/api";
import * as XLSX from "xlsx";
import { getFNPSites, listInvoices, type FNPResponse } from "@/features/sonatelBilling/api";
import FNPModal from "./FNPModal";

// ─── Types ────────────────────────────────────────────────────────────────────
type GlobalScope =
  | "ALL"
  | "PAID"
  | "UNPAID"
  | "OUT_OF_SCOPE"
  | "UNDEFINED"
  | "CERTIFIED"
  | "CONTESTED"
  | "CREATED";

interface EvoRow {
  period: string;
  invoices: number;
  montant_ht: string;
  montant_ttc: string;
  nrj: string;
  abonnement: string;
  penalite_prime: string;
  cosphi: string;
}

interface TopSite {
  site_id: string;
  site_name: string;
  conso: number;
  montant_ht: string;
  montant_cosphi: string;
  penalite_prime: string;
  abonnement: string;
}

interface DistribPart {
  key: string;
  label: string;
  value: string;
  percent: number;
}

interface CertificationSummary {
  total: number;
  certified_total: number;
  certified_fms: number;
  certified_senelec: number;
  needs_review: number;
  unknown_contract: number;
  fms_unavailable: number;
  mesure_alert?: number;
  other: number;
  taux_certification: number;
}

interface CertificationEvolutionRow {
  period: string;
  total: number;
  certified_total: number;
  certified_fms: number;
  certified_senelec: number;
  needs_review: number;
  unknown_contract: number;
  fms_unavailable: number;
  mesure_alert?: number;
  other: number;
}

interface PaymentStatusSummary {
  total: number;
  paid: number;
  unpaid: number;
  out_of_scope: number;
  undefined: number;
  paid_pct: number;
}

interface PaymentStatusEvolutionRow {
  period: string;
  total: number;
  paid: number;
  unpaid: number;
  out_of_scope: number;
  undefined: number;
}

interface InvoiceCertificationSummary {
  total: number;
  certified: number;
  contested: number;
  created: number;
  taux_certification: number;
}

interface InvoiceCertificationEvolutionRow {
  period: string;
  total: number;
  certified: number;
  contested: number;
  created: number;
}

interface StatsResponse {
  range: { start: string; end: string };
  scope?: string;
  evolution: EvoRow[];
  top: {
    conso_vs_montant: TopSite[];
    cosphi: TopSite[];
    pen_prime: TopSite[];
    abonnement: TopSite[];
  };
  distribution_ht: {
    total_ht: string;
    parts: DistribPart[];
  };
  payment_statuses?: {
    summary: PaymentStatusSummary;
    evolution: PaymentStatusEvolutionRow[];
  };
  invoice_certification?: {
    summary: InvoiceCertificationSummary;
    evolution: InvoiceCertificationEvolutionRow[];
  };
  certification?: {
    summary: CertificationSummary;
    evolution: CertificationEvolutionRow[];
  };
}

interface SiteOption {
  id: number;
  numero_compte_contrat: string;
  site_id: string;
  site_pk: number;
}

interface FNPStats {
  fnp_count: number;
  sites_count: number;
  estimated_total_ht: string;
  estimated_total_ttc: string;
  months_covered: number;
  months_with_fnp: number;
  no_history_count: number;
}

// ─── Helpers (logique métier — inchangée) ─────────────────────────────────────
const fmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

const fmtM = (v: string | number) => {
  const val = Number(v);
  if (Number.isNaN(val)) return "—";
  const sign = val < 0 ? "-" : "";
  const abs = Math.abs(val);
  if (abs >= 1_000_000) return `${sign}${fmt.format(Math.round(abs / 1_000_000))} M`;
  if (abs >= 1_000) return `${sign}${fmt.format(Math.round(abs / 1_000))} k`;
  return fmt.format(Math.round(val));
};

const n = (v: string | number | null | undefined) => Number(v) || 0;

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function defaultRange() {
  const now = new Date();
  return {
    start: fmtDate(new Date(now.getFullYear(), 0, 1)),
    end: fmtDate(now),
  };
}

async function fetchStats(
  start: string,
  end: string,
  siteCode?: string,
  scope: GlobalScope = "ALL"
): Promise<StatsResponse> {
  const params: Record<string, string> = { start, end, scope };
  if (siteCode) params.site = siteCode;
  const { data } = await api.get("/sonatel-billing/stats/", { params });
  return data;
}

async function searchSites(q: string): Promise<SiteOption[]> {
  const { data } = await api.get("/sonatel-billing/contract-site-links/", {
    params: { search: q, limit: 20 },
  });
  const list = Array.isArray(data) ? data : (data.results ?? []);
  const seen = new Set<string>();
  return list.filter((s: SiteOption) => {
    if (seen.has(s.site_id)) return false;
    seen.add(s.site_id);
    return true;
  });
}

function exportToExcel(data: StatsResponse, siteCode?: string, scope: GlobalScope = "ALL", fnpData?: import("@/features/sonatelBilling/api").FNPResponse) {
  const wb = XLSX.utils.book_new();

  // ── Onglet 1 : Évolution mensuelle ──────────────────────────────────────────
  const evoRows = data.evolution.map((r) => ({
    "Période": r.period,
    "Filtre appliqué": scope,
    "Nb Factures": r.invoices,
    "Montant HT (FCFA)": Number(r.montant_ht),
    "Montant TTC (FCFA)": Number(r.montant_ttc),
    "NRJ (FCFA)": Number(r.nrj),
    "Abonnement (FCFA)": Number(r.abonnement),
    "Pénalité Prime (FCFA)": Number(r.penalite_prime),
    "Cos φ (FCFA)": Number(r.cosphi),
  }));
  const ws1 = XLSX.utils.json_to_sheet(evoRows);
  ws1["!cols"] = [{ wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 22 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Évolution mensuelle");

  // ── Onglet 2 : Distribution HT ──────────────────────────────────────────────
  const distRows = data.distribution_ht.parts.map((p) => ({
    "Composante": p.label,
    "Montant (FCFA)": Number(p.value),
    "% du HT": p.percent,
    "Total HT (FCFA)": Number(data.distribution_ht.total_ht),
  }));
  const ws2 = XLSX.utils.json_to_sheet(distRows);
  ws2["!cols"] = [{ wch: 22 }, { wch: 20 }, { wch: 10 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Distribution HT");

  // ── Onglet 3 : Top sites (tous classements fusionnés) ───────────────────────
  const allTopIds = new Set([
    ...data.top.conso_vs_montant.map((r) => r.site_id),
    ...data.top.pen_prime.map((r) => r.site_id),
    ...data.top.cosphi.map((r) => r.site_id),
    ...data.top.abonnement.map((r) => r.site_id),
  ]);
  const topMap = new Map<string, TopSite>();
  for (const r of [...data.top.conso_vs_montant, ...data.top.pen_prime, ...data.top.cosphi, ...data.top.abonnement]) {
    if (!topMap.has(r.site_id)) topMap.set(r.site_id, r);
  }
  const topRows = Array.from(allTopIds)
    .map((id) => topMap.get(id)!)
    .filter(Boolean)
    .map((r) => ({
      "Site ID": r.site_id,
      "Site Nom": r.site_name,
      "Montant HT (FCFA)": Number(r.montant_ht),
      "Cos φ (FCFA)": Number(r.montant_cosphi),
      "Pénalité Prime (FCFA)": Number(r.penalite_prime),
      "Abonnement (FCFA)": Number(r.abonnement),
    }));
  const ws3 = XLSX.utils.json_to_sheet(topRows);
  ws3["!cols"] = [{ wch: 14 }, { wch: 30 }, { wch: 20 }, { wch: 16 }, { wch: 22 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws3, "Top Sites");

  // ── Onglet 4 : Statuts paiement — résumé + évolution ───────────────────────
  if (data.payment_statuses) {
    const s = data.payment_statuses.summary;
    const payResume = [{
      "Total factures": s.total,
      "Payées": s.paid,
      "Impayées": s.unpaid,
      "Hors scope": s.out_of_scope,
      "Non défini": s.undefined,
      "Taux payé (%)": s.paid_pct,
    }];
    const ws4a = XLSX.utils.json_to_sheet(payResume);
    ws4a["!cols"] = [{ wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws4a, "Paiement résumé");

    const payEvo = data.payment_statuses.evolution.map((r) => ({
      "Période": r.period,
      "Total": r.total,
      "Payées": r.paid,
      "Impayées": r.unpaid,
      "Hors scope": r.out_of_scope,
      "Non défini": r.undefined,
    }));
    const ws4b = XLSX.utils.json_to_sheet(payEvo);
    ws4b["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws4b, "Paiement évolution");
  }

  // ── Onglet 5 : Certification billing — résumé + évolution ──────────────────
  if (data.invoice_certification) {
    const s = data.invoice_certification.summary;
    const certResume = [{
      "Total factures": s.total,
      "Certifiées (Validées)": s.certified,
      "Contestées": s.contested,
      "Brutes à traiter (Créées)": s.created,
      "Taux certification (%)": s.taux_certification,
    }];
    const ws5a = XLSX.utils.json_to_sheet(certResume);
    ws5a["!cols"] = [{ wch: 16 }, { wch: 24 }, { wch: 14 }, { wch: 28 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws5a, "Certification résumé");

    const certEvo = data.invoice_certification.evolution.map((r) => ({
      "Période": r.period,
      "Total": r.total,
      "Certifiées": r.certified,
      "Contestées": r.contested,
      "Brutes à traiter": r.created,
    }));
    const ws5b = XLSX.utils.json_to_sheet(certEvo);
    ws5b["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws5b, "Certification évolution");
  }

  // ── Onglet 6 : FNP détail ────────────────────────────────────────────────────
  if (fnpData && fnpData.rows.length > 0) {
    const fnpRows = fnpData.rows.map((r) => ({
      "Site ID": r.site_id,
      "Site Nom": r.site_name ?? "",
      "Contrat": r.numero_compte_contrat,
      "Période manquante": r.period,
      "Conso estimée": r.est_conso != null ? Number(r.est_conso) : "",
      "Montant HT estimé (FCFA)": r.est_montant_ht != null ? Number(r.est_montant_ht) : "",
      "Montant TTC estimé (FCFA)": r.est_montant_ttc != null ? Number(r.est_montant_ttc) : "",
      "Abonnement estimé (FCFA)": r.est_abonnement != null ? Number(r.est_abonnement) : "",
      "Pénalité estimée (FCFA)": r.est_penalite != null ? Number(r.est_penalite) : "",
      "NRJ estimée (FCFA)": r.est_nrj != null ? Number(r.est_nrj) : "",
      "Mois historique dispo": r.history_months,
      "Dernière facture reçue": r.last_invoice_period ?? "",
      "Typologie": r.typology ?? "",
    }));
    const ws6 = XLSX.utils.json_to_sheet(fnpRows);
    ws6["!cols"] = [
      { wch: 14 }, { wch: 30 }, { wch: 22 }, { wch: 18 }, { wch: 16 },
      { wch: 24 }, { wch: 26 }, { wch: 24 }, { wch: 24 }, { wch: 20 },
      { wch: 22 }, { wch: 24 }, { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, ws6, "FNP Détail");
  }

  const start = data.range.start.replace(/-/g, "");
  const end = data.range.end.replace(/-/g, "");
  const suffix = siteCode ? `_${siteCode}` : "";
  XLSX.writeFile(wb, `suivi_facturation_${scope}${suffix}_${start}_${end}.xlsx`);
}

// ─── Design tokens — harmonisés avec le module financier ──────────────────────
const C = {
  blue: { 950: "#0B1F4D", 900: "#0F235A", 800: "#123C8C", 700: "#1A56C4", 600: "#2464D6", 500: "#3272E0", 300: "#91B9F8", 100: "#E4EFFE", 50: "#F2F6FE" },
  slate: { 900: "#0F172A", 800: "#1E293B", 700: "#334155", 600: "#475569", 500: "#64748B", 400: "#94A3B8", 300: "#CBD5E1", 200: "#E2E8F0", 100: "#F1F5F9", 50: "#F8FAFC" },
  ok: { main: "#059669", light: "#D1FAE5", mid: "#A7F3D0", dark: "#065F46" },
  nok: { main: "#DC2626", light: "#FEE2E2", mid: "#FECACA", dark: "#991B1B" },
  warn: { main: "#D97706", light: "#FEF3C7", mid: "#FDE68A", dark: "#92400E" },
  cyan: { main: "#0891B2", light: "#CFFAFE", dark: "#0E7490" },
  purple: { main: "#7C3AED", light: "#EDE9FE", dark: "#5B21B6" },
};

const HDR = "linear-gradient(135deg, #0B1F4D 0%, #123C8C 45%, #1A56C4 75%, #3272E0 100%)";
const PAGE_BG = "linear-gradient(180deg,#F8FAFC 0%,#EEF4FF 100%)";

// ─── Trend indicator ──────────────────────────────────────────────────────────
function Trend({ current, previous }: { current: number; previous: number }) {
  if (!previous || previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  const up = pct > 0;
  const same = Math.abs(pct) < 0.5;
  const color = same ? C.slate[400] : up ? C.nok.dark : C.ok.dark;
  const bg = same ? C.slate[100] : up ? C.nok.light : C.ok.light;
  const Icon = same ? Minus : up ? ChevronUp : ChevronDown;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color, background: bg, borderRadius: 6, padding: "2px 7px" }}>
      <Icon size={10} />
      {same ? "stable" : `${Math.abs(pct).toFixed(1)}%`}
    </span>
  );
}

// ─── KPI Card (tuile colorée sur fond blanc) ──────────────────────────────────
function KpiCard({
  label, value, sub, icon, accent, trend, trendPrev,
}: {
  label: string; value: string; sub?: string; icon: ReactNode; accent: string; trend?: number; trendPrev?: number;
}) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, border: `1px solid ${C.slate[200]}`, boxShadow: "0 1px 3px rgba(15,23,42,.04), 0 8px 28px rgba(15,23,42,.06)", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: C.slate[400], letterSpacing: ".06em", textTransform: "uppercase" }}>{label}</span>
          {trend !== undefined && trendPrev !== undefined ? <Trend current={trend} previous={trendPrev} /> : null}
        </div>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: `${accent}15`, display: "grid", placeItems: "center", color: accent, flexShrink: 0 }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", letterSpacing: "-.025em", lineHeight: 1, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {value}
      </div>
      {sub ? <div style={{ fontSize: 11, color: C.slate[400] }}>{sub}</div> : null}
    </div>
  );
}

// ─── Section title ────────────────────────────────────────────────────────────
function SectionTitle({ children, icon, right }: { children: ReactNode; icon?: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {icon ? (
          <div style={{ width: 30, height: 30, borderRadius: 10, background: C.blue[50], display: "grid", placeItems: "center", color: C.blue[700] }}>
            {icon}
          </div>
        ) : null}
        <span style={{ fontSize: 14.5, fontWeight: 900, color: C.blue[950], letterSpacing: "-.01em" }}>{children}</span>
      </div>
      {right}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ background: "rgba(255,255,255,.96)", borderRadius: 20, border: `1px solid ${C.slate[200]}`, boxShadow: "0 18px 45px rgba(15,23,42,.06)", padding: 22, ...style }}>
      {children}
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "blue" | "ok" | "nok" | "warn" | "cyan" | "purple" }) {
  const map = {
    slate: { bg: C.slate[100], color: C.slate[700], border: C.slate[200] },
    blue: { bg: C.blue[100], color: C.blue[700], border: "#BFDBFE" },
    ok: { bg: C.ok.light, color: C.ok.dark, border: C.ok.mid },
    nok: { bg: C.nok.light, color: C.nok.dark, border: C.nok.mid },
    warn: { bg: C.warn.light, color: C.warn.dark, border: C.warn.mid },
    cyan: { bg: C.cyan.light, color: C.cyan.dark, border: "#A5F3FC" },
    purple: { bg: C.purple.light, color: C.purple.dark, border: "#DDD6FE" },
  }[tone];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 999, border: `1px solid ${map.border}`, background: map.bg, color: map.color, fontSize: 10.5, fontWeight: 900, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ h }: { h: number }) {
  return <div className="btp-skel" style={{ height: h, borderRadius: 12 }} />;
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${C.slate[200]}`, boxShadow: "0 16px 40px rgba(15,23,42,.14)", padding: "10px 14px", minWidth: 180 }}>
      <div style={{ fontWeight: 900, fontSize: 12, color: C.blue[950], marginBottom: 8 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 3 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.slate[600] }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: p.color, display: "inline-block" }} />
            {p.name}
          </span>
          <span style={{ fontWeight: 800, fontSize: 12, color: C.slate[900] }}>{fmtM(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Top table ────────────────────────────────────────────────────────────────
function TopTable({
  rows, valueKey, color, filterPositive = false,
}: {
  rows: TopSite[]; valueKey: keyof TopSite; color: string; filterPositive?: boolean;
}) {
  const filtered = filterPositive ? rows.filter((r) => Number(r[valueKey]) > 0) : rows;
  const max = Math.max(...filtered.map((r) => Math.abs(Number(r[valueKey]) || 0)), 1);

  if (filtered.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 0", gap: 6 }}>
        <CheckCircle2 size={20} color={C.slate[300]} />
        <div style={{ fontSize: 12, color: C.slate[400], fontWeight: 700 }}>Aucune donnée sur la période</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {filtered.slice(0, 8).map((r, i) => {
        const val = Number(r[valueKey]) || 0;
        const pct = (Math.abs(val) / max) * 100;

        return (
          <div key={`${r.site_id}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 900, color: C.slate[400], width: 18, textAlign: "right", flexShrink: 0 }}>{i + 1}</span>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.slate[600], overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "58%" }}>
                  {r.site_id}
                </span>
                <span style={{ fontSize: 12, fontWeight: 900, color }}>{fmtM(val)}</span>
              </div>

              <div style={{ height: 4, background: C.slate[100], borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99, transition: "width .4s ease" }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Site Search ──────────────────────────────────────────────────────────────
function SiteSearchBar({
  selectedSite, onSelect, onClear,
}: {
  selectedSite: SiteOption | null; onSelect: (site: SiteOption) => void; onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["site-search", query],
    queryFn: () => searchSites(query),
    enabled: query.trim().length >= 1,
    staleTime: 30_000,
  });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(site: SiteOption) {
    onSelect(site);
    setQuery("");
    setOpen(false);
  }

  function handleClear() {
    onClear();
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  }

  const showDropdown = open && (results.length > 0 || isFetching || query.length >= 1);

  return (
    <div ref={wrapperRef} style={{ position: "relative", minWidth: 260, flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: selectedSite ? C.blue[50] : "#fff", border: `1.5px solid ${focused ? C.blue[300] : C.slate[200]}`, borderRadius: 12, padding: "8px 12px", transition: "border-color .15s" }}>
        {selectedSite ? <Building2 size={13} color={C.blue[700]} style={{ flexShrink: 0 }} /> : <Search size={13} color={C.slate[400]} style={{ flexShrink: 0 }} />}

        {selectedSite ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 900, color: C.blue[800], background: C.blue[100], borderRadius: 6, padding: "1px 8px" }}>
              {selectedSite.site_id}
            </span>
            <button
              onClick={handleClear}
              style={{ background: "none", border: "none", cursor: "pointer", color: C.slate[400], display: "grid", placeItems: "center", padding: 2, borderRadius: 4 }}
              title="Vue globale"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => { setFocused(true); setOpen(true); }}
            onBlur={() => setFocused(false)}
            placeholder="Rechercher un site…"
            style={{ background: "none", border: "none", outline: "none", flex: 1, fontSize: 13, color: C.slate[800] }}
          />
        )}

        {isFetching && !selectedSite ? (
          <Loader2 size={13} style={{ animation: "spin 1s linear infinite", color: C.slate[400], flexShrink: 0 }} />
        ) : null}
      </div>

      {showDropdown && !selectedSite ? (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "#fff", borderRadius: 14, border: `1px solid ${C.slate[200]}`, boxShadow: "0 16px 44px rgba(15,23,42,.18)", zIndex: 1000, overflow: "hidden" }}>
          {isFetching && results.length === 0 ? (
            <div style={{ padding: "12px 16px", fontSize: 12, color: C.slate[400], textAlign: "center" }}>Recherche en cours…</div>
          ) : null}

          {!isFetching && query.length >= 1 && results.length === 0 ? (
            <div style={{ padding: "12px 16px", fontSize: 12, color: C.slate[400], textAlign: "center" }}>Aucun site trouvé pour « {query} »</div>
          ) : null}

          {results.map((site, i) => (
            <button
              key={site.id}
              onMouseDown={() => handleSelect(site)}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", borderBottom: i < results.length - 1 ? `1px solid ${C.slate[100]}` : "none" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = C.slate[50])}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "none")}
            >
              <div style={{ width: 28, height: 28, borderRadius: 9, flexShrink: 0, background: C.blue[50], display: "grid", placeItems: "center" }}>
                <Building2 size={13} color={C.blue[700]} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: C.blue[950], overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {site.site_id}
                </div>
                <div style={{ fontSize: 11, color: C.slate[400], marginTop: 1 }}>{site.numero_compte_contrat}</div>
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ─── Metric / scope pill button ───────────────────────────────────────────────
function MetricBtn({
  active, color, label, onClick,
}: {
  active: boolean; color: string; label: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "7px 14px", borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: "pointer", transition: "all .15s",
        border: `1px solid ${active ? color : C.slate[200]}`,
        background: active ? color : "#fff",
        color: active ? "#fff" : C.slate[600],
        boxShadow: active ? `0 4px 12px ${color}40` : "none",
      }}
    >
      {label}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function BillingTrackingPage() {
  const defRange = useMemo(() => defaultRange(), []);
  const [dateStart, setDateStart] = useState(defRange.start);
  const [dateEnd, setDateEnd] = useState(defRange.end);
  const [activeMetric, setActiveMetric] = useState<"ht" | "nrj" | "abonnement" | "penalite" | "cosphi">("ht");
  const [selectedSite, setSelectedSite] = useState<SiteOption | null>(null);
  const [globalScope, setGlobalScope] = useState<GlobalScope>("ALL");
  const [paymentChartView, setPaymentChartView] = useState<"total" | "paid" | "unpaid" | "out_of_scope" | "undefined">("total");
  const [certChartView, setCertChartView] = useState<"total" | "certified" | "contested" | "created">("total");

  const siteCode = selectedSite?.site_id ?? undefined;
  const [showFNPModal, setShowFNPModal] = useState(false);
  const [showFacturesModal, setShowFacturesModal] = useState(false);
  const [baseFacturePage, setBaseFacturePage] = useState(1);
  const [modalPage, setModalPage] = useState(1);
  const BASE_FACTURE_PAGE_SIZE = 20;
  const MODAL_PAGE_SIZE = 50;

  // Export options inside the modal
  type ExportMode = "current" | "custom" | "all";
  const [exportMode, setExportMode] = useState<ExportMode>("current");
  const [exportFrom, setExportFrom] = useState(dateStart);
  const [exportTo,   setExportTo]   = useState(dateEnd);
  const [exporting,  setExporting]  = useState(false);

  const q = useQuery({
    queryKey: ["billing-tracking", dateStart, dateEnd, siteCode, globalScope],
    queryFn: () => fetchStats(dateStart, dateEnd, siteCode, globalScope),
    staleTime: 5 * 60 * 1000,
  });

  const fnpQ = useQuery({
    queryKey: ["billing-fnp", dateStart, dateEnd, siteCode],
    queryFn: () => getFNPSites({ start: dateStart, end: dateEnd, site: siteCode }),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    setBaseFacturePage(1);
    setModalPage(1);
    setExportFrom(dateStart);
    setExportTo(dateEnd);
  }, [dateStart, dateEnd, siteCode]);

  const baseFactureQ = useQuery({
    queryKey: ["billing-base-facture", dateStart, dateEnd, siteCode, baseFacturePage],
    queryFn: () =>
      listInvoices({
        page: baseFacturePage,
        page_size: BASE_FACTURE_PAGE_SIZE,
        start: dateStart,
        end: dateEnd,
        site: siteCode,
      }),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const modalFacturesQ = useQuery({
    enabled: showFacturesModal,
    queryKey: ["billing-factures-modal", dateStart, dateEnd, siteCode, modalPage],
    queryFn: () =>
      listInvoices({ page: modalPage, page_size: MODAL_PAGE_SIZE, start: dateStart, end: dateEnd, site: siteCode }),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  async function exportFacturesList() {
    setExporting(true);
    try {
      const params: Parameters<typeof listInvoices>[0] = {
        page: 1, page_size: 9999, site: siteCode,
      };
      let suffix = "tout";
      if (exportMode === "current") {
        params.start = dateStart; params.end = dateEnd;
        suffix = `${dateStart}_${dateEnd}`;
      } else if (exportMode === "custom") {
        params.start = exportFrom; params.end = exportTo;
        suffix = `${exportFrom}_${exportTo}`;
      }
      const all = await listInvoices(params);
      const wb = XLSX.utils.book_new();
      const rows = all.results.map((inv) => ({
        "N° Facture":       inv.numero_facture || "",
        "Site ID":          inv.site?.site_id || "",
        "Nom du site":      inv.site?.name || "",
        "Contrat":          inv.numero_compte_contrat || "",
        "Début période":    inv.date_debut_periode || "",
        "Fin période":      inv.date_fin_periode || "",
        "Statut cert.":     inv.status || "",
        "Statut paiement":  inv.payment_status === "PAID" ? "Payée"
                            : inv.payment_status === "UNPAID" ? "Impayée"
                            : inv.payment_status === "OUT_OF_SCOPE" ? "Hors scope" : "—",
        "Montant TTC":      inv.montant_ttc || "",
        "Montant HT":       inv.montant_hors_tva || "",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 22 }, { wch: 14 }, { wch: 24 }, { wch: 22 },
        { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
        { wch: 14 }, { wch: 14 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, "Factures");
      XLSX.writeFile(wb, `factures_${suffix}.xlsx`);
    } finally {
      setExporting(false);
    }
  }

  const fnpData = fnpQ.data;
  const fnpStats = fnpData?.summary;

  const fnpChartData = useMemo(() => {
    if (!fnpData?.rows) return [];
    const byMonth: Record<string, { period: string; fnp_count: number; est_ht: number; sites: Set<string> }> = {};
    for (const r of fnpData.rows) {
      if (!byMonth[r.period]) {
        byMonth[r.period] = { period: r.period, fnp_count: 0, est_ht: 0, sites: new Set() };
      }
      byMonth[r.period].fnp_count += 1;
      byMonth[r.period].est_ht += r.est_montant_ht ? Number(r.est_montant_ht) : 0;
      byMonth[r.period].sites.add(r.site_id);
    }
    return Object.values(byMonth)
      .sort((a, b) => a.period.localeCompare(b.period))
      .map((r) => ({ ...r, label: r.period.slice(0, 7), sites_count: r.sites.size }));
  }, [fnpData]);

  const data = q.data;
  const isLoading = q.isLoading;

  const scopeMeta: Record<GlobalScope, { label: string; color: string }> = {
    ALL: { label: "Brut", color: C.blue[700] },
    PAID: { label: "Payées", color: C.ok.main },
    UNPAID: { label: "Impayées", color: C.nok.main },
    OUT_OF_SCOPE: { label: "Hors scope", color: C.warn.main },
    UNDEFINED: { label: "Non défini", color: C.slate[500] },
    CERTIFIED: { label: "Certifiées", color: C.ok.main },
    CONTESTED: { label: "Contestées", color: C.nok.main },
    CREATED: { label: "Brutes à traiter", color: C.warn.main },
  };


  const paymentChartMeta = {
    total: { label: "Brut", color: C.blue[700] },
    paid: { label: "Payées", color: C.ok.main },
    unpaid: { label: "Impayées", color: C.nok.main },
    out_of_scope: { label: "Hors scope", color: C.warn.main },
    undefined: { label: "Non défini", color: C.slate[500] },
  } as const;

  const billingCertChartMeta = {
    total: { label: "Brut", color: C.blue[700] },
    certified: { label: "Certifiées", color: C.ok.main },
    contested: { label: "Contestées", color: C.nok.main },
    created: { label: "Brutes à traiter", color: C.warn.main },
  } as const;

  const chartData = useMemo(() => {
    if (!data?.evolution) return [];
    return data.evolution.map((r) => ({
      period: r.period,
      label: r.period.slice(0, 7),
      ht: n(r.montant_ht),
      ttc: n(r.montant_ttc),
      nrj: n(r.nrj),
      abonnement: n(r.abonnement),
      penalite: n(r.penalite_prime),
      cosphi: n(r.cosphi),
      invoices: r.invoices,
    }));
  }, [data]);

  const kpis = useMemo(() => {
    if (!chartData.length) return null;
    const sum = (k: keyof (typeof chartData)[number]) => chartData.reduce((a, r) => a + (Number(r[k]) || 0), 0);
    const last = chartData[chartData.length - 1];
    const prev = chartData[chartData.length - 2];
    return {
      totalHT: sum("ht"),
      totalNrj: sum("nrj"),
      totalPenalite: sum("penalite"),
      totalCosphi: sum("cosphi"),
      totalAbonnement: sum("abonnement"),
      totalInvoices: sum("invoices"),
      lastHT: last?.ht ?? 0,
      prevHT: prev?.ht ?? 0,
      lastPenalite: last?.penalite ?? 0,
      prevPenalite: prev?.penalite ?? 0,
      moisCount: chartData.length,
    };
  }, [chartData]);

  const distribData = useMemo(() => {
    if (!data?.distribution_ht) return [];
    return data.distribution_ht.parts.map((p) => ({ name: p.label, value: n(p.value), percent: p.percent }));
  }, [data]);

  const paymentData = useMemo(() => {
    if (!data?.payment_statuses?.evolution) return [];
    return data.payment_statuses.evolution.map((r) => ({
      period: r.period, label: r.period.slice(0, 7), total: r.total, paid: r.paid, unpaid: r.unpaid, out_of_scope: r.out_of_scope, undefined: r.undefined,
    }));
  }, [data]);

  const billingCertData = useMemo(() => {
    if (!data?.invoice_certification?.evolution) return [];
    return data.invoice_certification.evolution.map((r) => ({
      period: r.period, label: r.period.slice(0, 7), total: r.total, certified: r.certified, contested: r.contested, created: r.created,
    }));
  }, [data]);

  const metrics = {
    ht: { key: "ht", label: "Montant HT", color: C.blue[700] },
    nrj: { key: "nrj", label: "NRJ", color: C.warn.main },
    abonnement: { key: "abonnement", label: "Abonnement", color: C.cyan.main },
    penalite: { key: "penalite", label: "Pénalité Prime", color: C.nok.main },
    cosphi: { key: "cosphi", label: "Cos φ", color: C.purple.main },
  } as const;

  const DISTRIB_COLORS = [C.blue[700], C.purple.main, C.nok.main, C.warn.main];
  const mc = metrics[activeMetric];

  const inputStyle: CSSProperties = { height: 38, borderRadius: 12, border: `1px solid ${C.slate[200]}`, background: "#fff", padding: "0 12px", fontSize: 12, color: C.slate[700], outline: "none" };
  const iconButtonStyle: CSSProperties = { height: 38, borderRadius: 12, border: "none", display: "inline-flex", alignItems: "center", gap: 7, padding: "0 12px", fontSize: 12, fontWeight: 950, cursor: "pointer" };

  return (
    <div style={{ minHeight: "100vh", background: PAGE_BG, color: C.slate[800] }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .btp-skel { background: linear-gradient(90deg, #F1F5F9 25%, #E8EFF6 50%, #F1F5F9 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
        .btp-row:hover { background: ${C.blue[50]} !important; }
      `}</style>

      {/* ─── En-tête (fond blanc, compact, fixe) ────────────────────────────── */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "#fff", borderBottom: `1px solid ${C.slate[200]}`, padding: "16px 24px 14px", boxShadow: "0 1px 3px rgba(15,23,42,.04)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: C.blue[700], display: "grid", placeItems: "center", flexShrink: 0 }}>
              <TrendingUp size={17} color="#fff" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 18, lineHeight: 1.15, letterSpacing: "-.02em", fontWeight: 950, color: C.blue[950] }}>Suivi Facturation</h1>
              <div style={{ fontSize: 11.5, color: C.slate[500] }}>
                Montants, NRJ, abonnement, pénalités, cos φ et certification, mois par mois.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: `1px solid ${C.slate[200]}`, borderRadius: 12, padding: "0 12px", height: 36 }}>
              <Calendar size={13} color={C.slate[400]} />
              <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} style={{ background: "none", border: "none", outline: "none", fontSize: 12.5, color: C.slate[700] }} />
              <span style={{ color: C.slate[300], fontSize: 11 }}>→</span>
              <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} style={{ background: "none", border: "none", outline: "none", fontSize: 12.5, color: C.slate[700] }} />
            </div>

            <button type="button" onClick={() => q.refetch()} style={{ ...iconButtonStyle, height: 36, background: C.slate[100], color: C.slate[700], border: `1px solid ${C.slate[200]}` }}>
              <RefreshCw size={14} style={{ animation: isLoading ? "spin 1s linear infinite" : "none" }} /> Actualiser
            </button>

            <button
              type="button"
              disabled={!data}
              onClick={() => data && exportToExcel(data, siteCode, globalScope, fnpData ?? undefined)}
              style={{ ...iconButtonStyle, height: 36, background: data ? C.blue[700] : C.slate[100], color: data ? "#fff" : C.slate[400], border: "none", cursor: data ? "pointer" : "not-allowed" }}
            >
              <Download size={14} /> Exporter
            </button>
          </div>
        </div>

        {/* Vue active : recherche site */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: C.slate[100], display: "grid", placeItems: "center" }}>
              {selectedSite ? <Building2 size={13} color={C.blue[700]} /> : <Globe size={13} color={C.slate[500]} />}
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 900, color: C.slate[400], textTransform: "uppercase", letterSpacing: ".1em" }}>Vue active</div>
              <div style={{ fontSize: 12, fontWeight: 900, color: C.blue[950] }}>{selectedSite ? selectedSite.site_id : "Tous les sites"}</div>
            </div>
          </div>

          <SiteSearchBar selectedSite={selectedSite} onSelect={setSelectedSite} onClear={() => setSelectedSite(null)} />

          {selectedSite ? (
            <button onClick={() => setSelectedSite(null)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 12px", borderRadius: 10, background: C.slate[100], border: `1px solid ${C.slate[200]}`, cursor: "pointer", fontSize: 11.5, fontWeight: 900, color: C.slate[600], flexShrink: 0 }}>
              <Globe size={11} /> Vue globale
            </button>
          ) : null}
        </div>

        {/* Filtre global */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          <span style={{ fontSize: 10.5, fontWeight: 900, color: C.slate[400], textTransform: "uppercase", letterSpacing: ".08em" }}>Filtre global</span>
          {(["ALL", "PAID", "UNPAID", "OUT_OF_SCOPE", "UNDEFINED", "CERTIFIED", "CONTESTED", "CREATED"] as GlobalScope[]).map((scope) => (
            <button
              key={scope}
              onClick={() => setGlobalScope(scope)}
              style={{
                padding: "6px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 800, cursor: "pointer",
                border: `1px solid ${globalScope === scope ? C.blue[700] : C.slate[200]}`,
                background: globalScope === scope ? C.blue[700] : "#fff",
                color: globalScope === scope ? "#fff" : C.slate[600],
              }}
            >
              {scopeMeta[scope].label}
            </button>
          ))}
        </div>

        {/* Bande KPI */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,220px))", gap: 12, marginTop: 16, justifyContent: "center" }}>
          {isLoading ? (
            Array(5).fill(0).map((_, i) => <div key={i} className="btp-skel" style={{ height: 92, borderRadius: 16 }} />)
          ) : kpis ? (
            <>
              <KpiCard label="Total HT" value={fmtM(kpis.totalHT)} sub={`${scopeMeta[globalScope].label} · ${kpis.moisCount} mois`} icon={<DollarSign size={17} />} accent={C.blue[700]} trend={kpis.lastHT} trendPrev={kpis.prevHT} />
              <KpiCard label="Total NRJ" value={fmtM(kpis.totalNrj)} sub={scopeMeta[globalScope].label} icon={<Zap size={17} />} accent={C.warn.main} />
              <KpiCard label="Total Pénalités" value={fmtM(kpis.totalPenalite)} sub={scopeMeta[globalScope].label} icon={<AlertTriangle size={17} />} accent={C.nok.main} trend={kpis.lastPenalite} trendPrev={kpis.prevPenalite} />
              <KpiCard label="Total Cos φ" value={fmtM(kpis.totalCosphi)} sub={kpis.totalCosphi >= 0 ? "Pénalité facteur puissance" : "Minoration facteur puissance"} icon={<Activity size={17} />} accent={C.purple.main} />
              <KpiCard label="Total Abonnement" value={fmtM(kpis.totalAbonnement)} sub={scopeMeta[globalScope].label} icon={<BarChart2 size={17} />} accent={C.cyan.main} />
              <KpiCard
                label="Nb Factures"
                value={baseFactureQ.data ? String(baseFactureQ.data.count) : String(kpis.totalInvoices)}
                sub={scopeMeta[globalScope].label}
                icon={<FileText size={17} />}
                accent={C.blue[700]}
              />
              {!fnpQ.isLoading && fnpStats ? (
                <>
                  <KpiCard label="Factures Non Parvenues" value={String(fnpStats.fnp_count)} sub={`${fnpStats.sites_count} site(s) · ${fnpStats.months_with_fnp} mois`} icon={<PackageX size={17} />} accent={fnpStats.fnp_count > 0 ? C.nok.main : C.ok.main} />
                  <KpiCard label="HT estimé (FNP)" value={fmtM(fnpStats.estimated_total_ht)} sub={`Moy. ${fnpData?.horizon ?? 3} derniers mois`} icon={<TrendingDown size={17} />} accent={C.warn.main} />
                </>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {/* ─── Corps ──────────────────────────────────────────────────────────── */}
      <div style={{ padding: 22, display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16 }}>
              <Card>
                <SectionTitle
                  icon={<BarChart2 size={15} />}
                  right={
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {(Object.keys(metrics) as Array<keyof typeof metrics>).map((k) => (
                        <MetricBtn key={k} active={activeMetric === k} color={metrics[k].color} label={metrics[k].label} onClick={() => setActiveMetric(k)} />
                      ))}
                    </div>
                  }
                >
                  Évolution mensuelle
                </SectionTitle>

                {isLoading ? (
                  <Skeleton h={260} />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={chartData} margin={{ top: 5, right: 8, left: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="mainGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={mc.color} stopOpacity={0.15} />
                          <stop offset="95%" stopColor={mc.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.slate[100]} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.slate[400] }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: C.slate[400] }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtM(v)} width={52} />
                      <ReferenceLine y={0} stroke={C.slate[300]} strokeDasharray="4 4" />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey={mc.key} name={mc.label} stroke={mc.color} strokeWidth={2.5} fill="url(#mainGrad)" dot={{ fill: mc.color, r: 3, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </Card>

              <Card>
                <SectionTitle icon={<BarChart2 size={15} />}>Répartition HT</SectionTitle>
                {isLoading ? (
                  <Skeleton h={260} />
                ) : (
                  <div>
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 22, fontWeight: 950, color: C.blue[950], lineHeight: 1 }}>{fmtM(data?.distribution_ht.total_ht ?? "0")}</div>
                      <div style={{ fontSize: 11, color: C.slate[400], fontWeight: 700, marginTop: 3 }}>FCFA total HT · {scopeMeta[globalScope].label}</div>
                    </div>
                    {distribData.map((d, i) => (
                      <div key={d.name} style={{ marginBottom: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, alignItems: "baseline" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: DISTRIB_COLORS[i] }} />
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.slate[600] }}>{d.name}</span>
                          </div>
                          <div>
                            <span style={{ fontSize: 12, fontWeight: 900, color: C.slate[900] }}>{fmtM(d.value)}</span>
                            <span style={{ fontSize: 10, color: C.slate[400], marginLeft: 5, fontWeight: 700 }}>{d.percent.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div style={{ height: 5, background: C.slate[100], borderRadius: 99, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.min(d.percent, 100)}%`, background: DISTRIB_COLORS[i], borderRadius: 99, transition: "width .5s ease" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Card>
                <SectionTitle icon={<Activity size={15} />}>Nombre de factures par mois</SectionTitle>
                {isLoading ? (
                  <Skeleton h={150} />
                ) : (
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={chartData} margin={{ top: 5, right: 8, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.slate[100]} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.slate[400] }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: C.slate[400] }} axisLine={false} tickLine={false} width={38} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="invoices" name="Factures" stroke={C.cyan.main} strokeWidth={2} dot={{ fill: C.cyan.main, r: 3, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </Card>

              <Card>
                <SectionTitle icon={<CheckCircle2 size={15} />}>Vue appliquée</SectionTitle>
                <div style={{ minHeight: 150, display: "flex", flexDirection: "column", justifyContent: "center", gap: 10 }}>
                  <div>
                    <Badge tone={globalScope === "ALL" ? "blue" : globalScope === "PAID" ? "ok" : globalScope === "CERTIFIED" ? "ok" : globalScope === "UNPAID" || globalScope === "CONTESTED" ? "nok" : "warn"}>
                      {scopeMeta[globalScope].label}
                    </Badge>
                  </div>
                  <div style={{ fontSize: 13, color: C.slate[600], lineHeight: 1.6 }}>
                    Toutes les statistiques principales du dashboard sont recalculées sur ce filtre global.
                  </div>
                </div>
              </Card>
            </div>
          </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Card>
              <SectionTitle
                icon={<CheckCircle2 size={15} />}
                right={
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <MetricBtn active={paymentChartView === "total"} color={C.blue[700]} label="Brut" onClick={() => setPaymentChartView("total")} />
                    <MetricBtn active={paymentChartView === "paid"} color={C.ok.main} label="Payées" onClick={() => setPaymentChartView("paid")} />
                    <MetricBtn active={paymentChartView === "unpaid"} color={C.nok.main} label="Impayées" onClick={() => setPaymentChartView("unpaid")} />
                    <MetricBtn active={paymentChartView === "out_of_scope"} color={C.warn.main} label="Hors scope" onClick={() => setPaymentChartView("out_of_scope")} />
                    <MetricBtn active={paymentChartView === "undefined"} color={C.slate[500]} label="Non défini" onClick={() => setPaymentChartView("undefined")} />
                  </div>
                }
              >
                Statuts de paiement
              </SectionTitle>

              {isLoading ? (
                <Skeleton h={240} />
              ) : data?.payment_statuses ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 10, marginBottom: 16 }}>
                    {[
                      { label: "Brut", value: data.payment_statuses.summary.total, color: C.blue[700], bg: C.blue[50] },
                      { label: "Payées", value: data.payment_statuses.summary.paid, color: C.ok.main, bg: C.ok.light },
                      { label: "Impayées", value: data.payment_statuses.summary.unpaid, color: C.nok.main, bg: C.nok.light },
                      { label: "Hors scope", value: data.payment_statuses.summary.out_of_scope, color: C.warn.main, bg: C.warn.light },
                      { label: "Non défini", value: data.payment_statuses.summary.undefined, color: C.slate[500], bg: C.slate[100] },
                    ].map((tile) => (
                      <div key={tile.label} style={{ padding: "12px 14px", borderRadius: 14, background: tile.bg, border: `1px solid ${C.slate[200]}` }}>
                        <div style={{ fontSize: 18, fontWeight: 950, color: tile.color }}>{fmt.format(tile.value)}</div>
                        <div style={{ fontSize: 11, color: C.slate[600], fontWeight: 700 }}>{tile.label}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: 12, color: C.slate[600], fontWeight: 700, marginBottom: 10 }}>
                    Taux payé : <span style={{ color: C.ok.main, fontWeight: 900 }}>{data.payment_statuses.summary.paid_pct}%</span>
                  </div>

                  <ResponsiveContainer width="100%" height={170}>
                    <BarChart data={paymentData} margin={{ top: 5, right: 8, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.slate[100]} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.slate[400] }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: C.slate[400] }} axisLine={false} tickLine={false} width={38} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey={paymentChartView} name={paymentChartMeta[paymentChartView].label} fill={paymentChartMeta[paymentChartView].color} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              ) : (
                <div style={{ color: C.slate[400], fontSize: 12.5, textAlign: "center", padding: "24px 0" }}>Aucune donnée de paiement disponible</div>
              )}
            </Card>

            <Card>
              <SectionTitle
                icon={<CheckCircle2 size={15} />}
                right={
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <MetricBtn active={certChartView === "total"} color={C.blue[700]} label="Brut" onClick={() => setCertChartView("total")} />
                    <MetricBtn active={certChartView === "certified"} color={C.ok.main} label="Certifiées" onClick={() => setCertChartView("certified")} />
                    <MetricBtn active={certChartView === "contested"} color={C.nok.main} label="Contestées" onClick={() => setCertChartView("contested")} />
                    <MetricBtn active={certChartView === "created"} color={C.warn.main} label="Brutes à traiter" onClick={() => setCertChartView("created")} />
                  </div>
                }
              >
                Statuts de certification billing
              </SectionTitle>

              {isLoading ? (
                <Skeleton h={240} />
              ) : data?.invoice_certification ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10, marginBottom: 16 }}>
                    {[
                      { label: "Brut", value: data.invoice_certification.summary.total, color: C.blue[700], bg: C.blue[50] },
                      { label: "Certifiées", value: data.invoice_certification.summary.certified, color: C.ok.main, bg: C.ok.light },
                      { label: "Contestées", value: data.invoice_certification.summary.contested, color: C.nok.main, bg: C.nok.light },
                      { label: "Brutes à traiter", value: data.invoice_certification.summary.created, color: C.warn.main, bg: C.warn.light },
                    ].map((tile) => (
                      <div key={tile.label} style={{ padding: "12px 14px", borderRadius: 14, background: tile.bg, border: `1px solid ${C.slate[200]}` }}>
                        <div style={{ fontSize: 18, fontWeight: 950, color: tile.color }}>{fmt.format(tile.value)}</div>
                        <div style={{ fontSize: 11, color: C.slate[600], fontWeight: 700 }}>{tile.label}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: 12, color: C.slate[600], fontWeight: 700, marginBottom: 10 }}>
                    Taux de certification :
                    <span style={{ color: C.blue[700], fontWeight: 900 }}> {data.invoice_certification.summary.taux_certification}%</span>
                  </div>

                  <ResponsiveContainer width="100%" height={170}>
                    <BarChart data={billingCertData} margin={{ top: 5, right: 8, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.slate[100]} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.slate[400] }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: C.slate[400] }} axisLine={false} tickLine={false} width={38} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey={certChartView} name={billingCertChartMeta[certChartView].label} fill={billingCertChartMeta[certChartView].color} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              ) : (
                <div style={{ color: C.slate[400], fontSize: 12.5, textAlign: "center", padding: "24px 0" }}>Aucune donnée de certification billing disponible</div>
              )}
            </Card>
        </div>

        {/* ─── Base Facture ─────────────────────────────────────────────────── */}
        <Card>
          <SectionTitle
            icon={<FileText size={15} />}
            right={
              !baseFactureQ.isLoading ? (
                <button
                  onClick={() => { setModalPage(1); setShowFacturesModal(true); }}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 12, background: `linear-gradient(135deg, ${C.blue[700]}, #1d4ed8)`, border: "none", color: "#fff", fontSize: 12, fontWeight: 900, cursor: "pointer", boxShadow: `0 6px 16px ${C.blue[700]}40` }}
                >
                  <FileText size={13} /> Voir la liste des factures
                  {baseFactureQ.data ? ` (${baseFactureQ.data.count.toLocaleString("fr-FR")})` : ""}
                </button>
              ) : undefined
            }
          >
            Base Facture
          </SectionTitle>

          {baseFactureQ.isLoading ? (
            <Skeleton h={120} />
          ) : !baseFactureQ.data || baseFactureQ.data.count === 0 ? (
            <div style={{ color: C.slate[400], fontSize: 12.5, textAlign: "center", padding: "24px 0" }}>
              Aucune facture sur la période sélectionnée.
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", padding: "12px 0" }}>
              <div style={{ padding: "16px 24px", borderRadius: 16, background: C.blue[50], border: `1px solid ${C.slate[200]}` }}>
                <div style={{ fontSize: 10, fontWeight: 900, color: C.slate[500], textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>Nombre de factures</div>
                <div style={{ fontSize: 32, fontWeight: 950, color: C.blue[700] }}>{baseFactureQ.data.count.toLocaleString("fr-FR")}</div>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 12, color: C.slate[600], marginBottom: 8 }}>Aperçu des {Math.min(5, baseFactureQ.data.results.length)} premiers numéros :</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {baseFactureQ.data.results.slice(0, 5).map((inv) => (
                    <span key={inv.id} style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, fontWeight: 700, color: C.blue[700], background: C.blue[50], border: `1px solid ${C.blue[700]}30`, borderRadius: 8, padding: "4px 10px" }}>
                      {inv.numero_facture || "—"}
                    </span>
                  ))}
                  {baseFactureQ.data.count > 5 && (
                    <span style={{ fontSize: 12, color: C.slate[400], padding: "4px 0" }}>+ {baseFactureQ.data.count - 5} autres…</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>
            <Card>
              <SectionTitle
                icon={<PackageX size={15} />}
                right={
                  fnpStats && fnpStats.fnp_count > 0 ? (
                    <button
                      onClick={() => setShowFNPModal(true)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 12, background: `linear-gradient(135deg, ${C.nok.main}, #E8401C)`, border: "none", color: "#fff", fontSize: 12, fontWeight: 900, cursor: "pointer", boxShadow: `0 6px 16px ${C.nok.main}40` }}
                    >
                      <PackageX size={13} /> {fnpStats.fnp_count} FNP · Voir détail
                    </button>
                  ) : undefined
                }
              >
                Factures Non Parvenues — évolution mensuelle
              </SectionTitle>

              {fnpQ.isLoading ? (
                <Skeleton h={200} />
              ) : fnpChartData.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: 8 }}>
                  <CheckCircle2 size={28} color={C.ok.main} />
                  <div style={{ fontSize: 13, fontWeight: 900, color: C.ok.main }}>Aucune FNP sur la période</div>
                  <div style={{ fontSize: 12, color: C.slate[400] }}>Toutes les factures attendues ont été reçues.</div>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={fnpChartData} margin={{ top: 5, right: 8, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.slate[100]} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.slate[400] }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11, fill: C.slate[400] }} axisLine={false} tickLine={false} width={32} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: C.slate[400] }} axisLine={false} tickLine={false} width={52} tickFormatter={(v) => fmtM(v)} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar yAxisId="left" dataKey="fnp_count" name="Nb FNP" fill={C.nok.main} radius={[5, 5, 0, 0]} opacity={0.85} />
                      <Bar yAxisId="right" dataKey="est_ht" name="HT estimé" fill={C.warn.main} radius={[5, 5, 0, 0]} opacity={0.6} />
                    </BarChart>
                  </ResponsiveContainer>

                  <div style={{ marginTop: 16, borderRadius: 14, border: `1px solid ${C.slate[200]}`, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr>
                          {["Mois", "Nb FNP", "Sites", "HT estimé", "TTC estimé"].map((h) => (
                            <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 900, color: C.slate[500], fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", borderBottom: `1px solid ${C.slate[200]}`, background: C.slate[50] }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fnpChartData.map((r, i) => {
                          const monthRows = fnpData?.rows.filter((row) => row.period === r.period) ?? [];
                          const estTtc = monthRows.reduce((s, row) => s + (row.est_montant_ttc ? Number(row.est_montant_ttc) : 0), 0);
                          return (
                            <tr key={r.period} className="btp-row" style={{ borderBottom: `1px solid ${C.slate[100]}`, background: i % 2 === 0 ? "#fff" : C.slate[50] }}>
                              <td style={{ padding: "8px 12px", fontWeight: 900, color: C.nok.main, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{r.label}</td>
                              <td style={{ padding: "8px 12px" }}><Badge tone="nok">{r.fnp_count}</Badge></td>
                              <td style={{ padding: "8px 12px", color: C.slate[600] }}>{r.sites_count}</td>
                              <td style={{ padding: "8px 12px", fontWeight: 900, color: C.slate[900], fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                                {fmtM(r.est_ht)} <Badge tone="warn">EST</Badge>
                              </td>
                              <td style={{ padding: "8px 12px", fontWeight: 800, color: C.blue[700], fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                                {fmtM(estTtc)} <Badge tone="warn">EST</Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Card>

            <Card>
              <SectionTitle icon={<Clock size={15} />}>Résumé estimation FNP</SectionTitle>

              {fnpQ.isLoading ? (
                <Skeleton h={300} />
              ) : !fnpStats ? (
                <div style={{ color: C.slate[400], fontSize: 12, textAlign: "center", padding: "24px 0" }}>Aucune donnée</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ padding: "14px 16px", borderRadius: 14, background: fnpStats.months_with_fnp === 0 ? C.ok.light : C.nok.light, border: `1px solid ${fnpStats.months_with_fnp === 0 ? C.ok.mid : C.nok.mid}` }}>
                    <div style={{ fontSize: 10, fontWeight: 900, color: C.slate[500], textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>Couverture mois</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span style={{ fontSize: 28, fontWeight: 950, color: fnpStats.months_with_fnp === 0 ? C.ok.main : C.nok.main }}>{fnpStats.months_with_fnp}</span>
                      <span style={{ fontSize: 14, color: C.slate[600], fontWeight: 700 }}>/ {fnpStats.months_covered} mois avec FNP</span>
                    </div>
                    <div style={{ marginTop: 8, height: 6, background: "rgba(0,0,0,.06)", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${fnpStats.months_covered > 0 ? (fnpStats.months_with_fnp / fnpStats.months_covered) * 100 : 0}%`, background: fnpStats.months_with_fnp === 0 ? C.ok.main : C.nok.main, borderRadius: 99, transition: "width .5s ease" }} />
                    </div>
                  </div>

                  {[
                    { label: "Total HT estimé", value: fnpStats.estimated_total_ht, color: C.blue[700], bg: C.blue[50] },
                    { label: "Total TTC estimé", value: fnpStats.estimated_total_ttc ?? "0", color: C.cyan.main, bg: C.cyan.light },
                  ].map((item) => (
                    <div key={item.label} style={{ padding: "12px 14px", borderRadius: 14, background: item.bg, border: `1px solid ${C.slate[200]}` }}>
                      <div style={{ fontSize: 10, fontWeight: 900, color: C.slate[500], textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>{item.label}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 20, fontWeight: 950, color: item.color }}>{fmtM(item.value)}</span>
                        <Badge tone="warn">EST</Badge>
                      </div>
                    </div>
                  ))}

                  <div style={{ padding: "10px 14px", borderRadius: 14, background: C.slate[50], border: `1px solid ${C.slate[200]}` }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      {[
                        { label: "Sites concernés", value: String(fnpStats.sites_count), color: C.slate[900] },
                        { label: "Horizon estimation", value: `${fnpData?.horizon ?? 3} mois`, color: C.slate[600] },
                        { label: "Sans historique", value: String(fnpStats.no_history_count), color: fnpStats.no_history_count > 0 ? C.nok.main : C.ok.main },
                      ].map((item) => (
                        <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: C.slate[400], fontWeight: 700 }}>{item.label}</span>
                          <span style={{ fontSize: 12, fontWeight: 900, color: item.color }}>{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ padding: "10px 12px", borderRadius: 12, background: C.warn.light, border: `1px solid ${C.warn.mid}`, fontSize: 11, color: C.warn.dark, lineHeight: 1.5 }}>
                    <strong>Estimation</strong> basée sur la moyenne glissante des {fnpData?.horizon ?? 3} derniers mois de factures reçues par contrat.
                  </div>
                </div>
              )}
            </Card>
        </div>

        {selectedSite ? (
          <Card>
            <div style={{ textAlign: "center", padding: "24px 0", color: C.slate[500] }}>
              <Building2 size={26} color={C.slate[300]} style={{ marginBottom: 10 }} />
              <div style={{ fontWeight: 800 }}>Vue site unique active</div>
              <div style={{ fontSize: 12.5, marginTop: 4 }}>Repassez en "Vue globale" pour voir les classements top sites.</div>
            </div>
          </Card>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <Card>
              <SectionTitle>Top sites — Montant HT</SectionTitle>
              {isLoading ? <Skeleton h={180} /> : <TopTable rows={data?.top.conso_vs_montant ?? []} valueKey="montant_ht" color={C.blue[700]} />}
            </Card>
            <Card>
              <SectionTitle>Top sites — Pénalité</SectionTitle>
              {isLoading ? <Skeleton h={180} /> : <TopTable rows={data?.top.pen_prime ?? []} valueKey="penalite_prime" color={C.nok.main} />}
            </Card>
            <Card>
              <SectionTitle right={<Badge tone="purple">Positifs uniquement</Badge>}>Top sites — Cos φ</SectionTitle>
              {isLoading ? <Skeleton h={180} /> : <TopTable rows={data?.top.cosphi ?? []} valueKey="montant_cosphi" color={C.purple.main} filterPositive={true} />}
            </Card>
          </div>
        )}
      </div>

      {showFNPModal && fnpData ? (
        <FNPModal data={fnpData} horizon={fnpData.horizon} dateStart={dateStart} dateEnd={dateEnd} onClose={() => setShowFNPModal(false)} />
      ) : null}

      {showFacturesModal && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowFacturesModal(false); }}
        >
          <div style={{ background: "#fff", borderRadius: 24, width: "100%", maxWidth: 1060, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 30px 80px rgba(15,23,42,.25)" }}>

            {/* ── Header ── */}
            <div style={{ padding: "20px 24px 14px", borderBottom: `1px solid ${C.slate[200]}`, flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: C.blue[950] }}>
                    Liste des factures
                    {modalFacturesQ.data && (
                      <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 700, color: C.slate[500] }}>
                        — {modalFacturesQ.data.count.toLocaleString("fr-FR")} facture{modalFacturesQ.data.count !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: C.slate[400], marginTop: 2 }}>
                    Filtre actif : {dateStart} → {dateEnd}
                    {siteCode ? ` · Site ${siteCode}` : ""}
                  </div>
                </div>
                <button
                  onClick={() => setShowFacturesModal(false)}
                  style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${C.slate[200]}`, background: C.slate[50], cursor: "pointer", display: "grid", placeItems: "center", color: C.slate[500], flexShrink: 0 }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* ── Barre d'export ── */}
              <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 14, background: C.slate[50], border: `1px solid ${C.slate[200]}`, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.slate[500], textTransform: "uppercase", letterSpacing: ".07em", flexShrink: 0 }}>Exporter :</span>

                {/* Mode chips */}
                {(["current", "custom", "all"] as ExportMode[]).map((m) => {
                  const labels: Record<ExportMode, string> = { current: "Période affichée", custom: "Période personnalisée", all: "Tout exporter" };
                  return (
                    <button
                      key={m}
                      onClick={() => setExportMode(m)}
                      style={{
                        padding: "5px 13px", borderRadius: 100, fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer",
                        background: exportMode === m ? C.blue[700] : C.slate[100],
                        color: exportMode === m ? "#fff" : C.slate[600],
                        transition: "all .15s",
                      }}
                    >
                      {labels[m]}
                    </button>
                  );
                })}

                {/* Custom date inputs */}
                {exportMode === "custom" && (
                  <>
                    <input
                      type="date" value={exportFrom}
                      onChange={(e) => setExportFrom(e.target.value)}
                      style={{ padding: "4px 10px", borderRadius: 9, border: `1.5px solid ${C.slate[300]}`, fontSize: 12, outline: "none", color: C.slate[800] }}
                    />
                    <span style={{ fontSize: 11, color: C.slate[400] }}>→</span>
                    <input
                      type="date" value={exportTo}
                      onChange={(e) => setExportTo(e.target.value)}
                      style={{ padding: "4px 10px", borderRadius: 9, border: `1.5px solid ${C.slate[300]}`, fontSize: 12, outline: "none", color: C.slate[800] }}
                    />
                  </>
                )}

                {exportMode === "all" && (
                  <span style={{ fontSize: 11, color: C.slate[400], fontStyle: "italic" }}>Toutes les factures en base (sans filtre de date)</span>
                )}

                {/* Export button */}
                <button
                  onClick={exportFacturesList}
                  disabled={exporting || (exportMode === "custom" && (!exportFrom || !exportTo))}
                  style={{
                    marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 7,
                    padding: "7px 16px", borderRadius: 12, border: "none", cursor: exporting ? "wait" : "pointer",
                    background: exporting ? C.slate[300] : C.ok.main,
                    color: "#fff", fontSize: 12, fontWeight: 900,
                    opacity: (exportMode === "custom" && (!exportFrom || !exportTo)) ? 0.5 : 1,
                  }}
                >
                  <Download size={13} />
                  {exporting ? "Export en cours…" : "Télécharger Excel"}
                </button>
              </div>
            </div>

            {/* ── Table ── */}
            <div style={{ flex: 1, overflow: "auto" }}>
              {modalFacturesQ.isLoading ? (
                <div style={{ padding: 40, textAlign: "center", color: C.slate[400] }}>Chargement…</div>
              ) : !modalFacturesQ.data || modalFacturesQ.data.count === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: C.slate[400] }}>Aucune facture sur la période.</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                    <tr>
                      {["N° Facture", "Site ID", "Nom du site", "Contrat", "Début période", "Fin période", "Certif.", "Paiement"].map((h) => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 900, color: C.slate[500], fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", borderBottom: `1px solid ${C.slate[200]}`, background: C.slate[50], whiteSpace: "nowrap" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {modalFacturesQ.data.results.map((inv, i) => {
                      const ps = inv.payment_status;
                      const psColor = ps === "PAID" ? C.ok.main : ps === "UNPAID" ? C.nok.main : C.slate[400];
                      const psLabel = ps === "PAID" ? "Payée" : ps === "UNPAID" ? "Impayée" : ps === "OUT_OF_SCOPE" ? "Hors scope" : "—";
                      const certColor = inv.status === "VALIDATED" ? C.ok.main : inv.status === "CONTESTED" ? C.nok.main : C.slate[400];
                      const certLabel = inv.status === "VALIDATED" ? "Validée" : inv.status === "CONTESTED" ? "Contestée" : "Créée";
                      const hasSite = !!inv.site;
                      return (
                        <tr key={inv.id} className="btp-row" style={{ borderBottom: `1px solid ${C.slate[100]}`, background: i % 2 === 0 ? "#fff" : C.slate[50] }}>
                          <td style={{ padding: "8px 14px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 700, color: C.blue[700], whiteSpace: "nowrap" }}>{inv.numero_facture || "—"}</td>
                          <td style={{ padding: "8px 14px" }}>
                            {hasSite
                              ? <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 700, color: C.blue[800], background: C.blue[50], borderRadius: 6, padding: "2px 7px", fontSize: 11 }}>{inv.site!.site_id}</span>
                              : <span style={{ color: C.slate[300], fontStyle: "italic", fontSize: 11 }}>non lié</span>
                            }
                          </td>
                          <td style={{ padding: "8px 14px", color: hasSite && inv.site!.name ? C.slate[700] : C.slate[300], fontStyle: hasSite && inv.site!.name ? "normal" : "italic", fontSize: 11 }}>
                            {(hasSite && inv.site!.name) ? inv.site!.name : "—"}
                          </td>
                          <td style={{ padding: "8px 14px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: C.slate[600], fontSize: 11 }}>{inv.numero_compte_contrat || "—"}</td>
                          <td style={{ padding: "8px 14px", color: C.slate[600], whiteSpace: "nowrap" }}>{inv.date_debut_periode || "—"}</td>
                          <td style={{ padding: "8px 14px", color: C.slate[600], whiteSpace: "nowrap" }}>{inv.date_fin_periode || "—"}</td>
                          <td style={{ padding: "8px 14px" }}><span style={{ fontSize: 11, fontWeight: 700, color: certColor }}>{certLabel}</span></td>
                          <td style={{ padding: "8px 14px" }}><span style={{ fontWeight: 700, color: psColor }}>{psLabel}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── Pagination ── */}
            {modalFacturesQ.data && modalFacturesQ.data.count > MODAL_PAGE_SIZE && (
              <div style={{ padding: "12px 20px", borderTop: `1px solid ${C.slate[200]}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, background: C.slate[50] }}>
                <div style={{ fontSize: 12, color: C.slate[500] }}>
                  Page <strong style={{ color: C.slate[800] }}>{modalPage}</strong> / {Math.ceil(modalFacturesQ.data.count / MODAL_PAGE_SIZE)}
                  {" — "}<strong style={{ color: C.slate[800] }}>{modalFacturesQ.data.count}</strong> factures
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button disabled={modalPage <= 1} onClick={() => setModalPage((p) => p - 1)} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.slate[200]}`, background: "#fff", cursor: modalPage <= 1 ? "not-allowed" : "pointer", opacity: modalPage <= 1 ? 0.4 : 1, display: "grid", placeItems: "center" }}>
                    <ChevronLeft size={14} />
                  </button>
                  <button disabled={modalPage >= Math.ceil(modalFacturesQ.data.count / MODAL_PAGE_SIZE)} onClick={() => setModalPage((p) => p + 1)} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.slate[200]}`, background: "#fff", cursor: modalPage >= Math.ceil(modalFacturesQ.data.count / MODAL_PAGE_SIZE) ? "not-allowed" : "pointer", opacity: modalPage >= Math.ceil(modalFacturesQ.data.count / MODAL_PAGE_SIZE) ? 0.4 : 1, display: "grid", placeItems: "center" }}>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
