// src/pages/BillingTrackingPage.tsx

import { useState, useMemo, useRef, useEffect, type ReactNode, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import { api } from "@/services/api";
import * as XLSX from "xlsx";
import { getFNPSites, type FNPResponse } from "@/features/sonatelBilling/api";
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

function exportToExcel(data: StatsResponse, siteCode?: string, scope: GlobalScope = "ALL") {
  const wb = XLSX.utils.book_new();

  const evoRows = data.evolution.map((r) => ({
    "Période": r.period,
    "Nb Factures": r.invoices,
    "Montant HT (FCFA)": Number(r.montant_ht),
    "Montant TTC (FCFA)": Number(r.montant_ttc),
    "NRJ (FCFA)": Number(r.nrj),
    "Abonnement (FCFA)": Number(r.abonnement),
    "Pénalité Prime (FCFA)": Number(r.penalite_prime),
    "Cos φ (FCFA)": Number(r.cosphi),
  }));
  const ws1 = XLSX.utils.json_to_sheet(evoRows);
  ws1["!cols"] = [
    { wch: 12 },
    { wch: 12 },
    { wch: 20 },
    { wch: 20 },
    { wch: 16 },
    { wch: 18 },
    { wch: 22 },
    { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, "Évolution mensuelle");

  const topRows = data.top.conso_vs_montant.map((r) => ({
    "Site ID": r.site_id,
    "Site Nom": r.site_name,
    "Montant HT (FCFA)": Number(r.montant_ht),
    "Cos φ (FCFA)": Number(r.montant_cosphi),
    "Pénalité (FCFA)": Number(r.penalite_prime),
    "Abonnement (FCFA)": Number(r.abonnement),
  }));
  const ws2 = XLSX.utils.json_to_sheet(topRows);
  ws2["!cols"] = [{ wch: 14 }, { wch: 28 }, { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Top Sites");

  const distRows = data.distribution_ht.parts.map((p) => ({
    "Composante": p.label,
    "Montant (FCFA)": Number(p.value),
    "% du HT": p.percent,
  }));
  const ws3 = XLSX.utils.json_to_sheet(distRows);
  ws3["!cols"] = [{ wch: 20 }, { wch: 20 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws3, "Distribution HT");

  if (data.payment_statuses) {
    const ws4 = XLSX.utils.json_to_sheet([data.payment_statuses.summary]);
    XLSX.utils.book_append_sheet(wb, ws4, "Paiement résumé");
  }

  if (data.invoice_certification) {
    const ws5 = XLSX.utils.json_to_sheet([data.invoice_certification.summary]);
    XLSX.utils.book_append_sheet(wb, ws5, "Certif billing résumé");
  }

  if (data.certification) {
    const ws6 = XLSX.utils.json_to_sheet([data.certification.summary]);
    XLSX.utils.book_append_sheet(wb, ws6, "Certification tech résumé");
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
  const color = same ? C.slate[400] : up ? "#FCA5A5" : "#86EFAC";
  const Icon = same ? Minus : up ? ChevronUp : ChevronDown;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color, background: "rgba(255,255,255,.10)", borderRadius: 6, padding: "2px 7px" }}>
      <Icon size={10} />
      {same ? "stable" : `${Math.abs(pct).toFixed(1)}%`}
    </span>
  );
}

// ─── KPI Card (style "glass" sur fond dégradé, cf. FinancialPage) ─────────────
function KpiCard({
  label, value, sub, icon, accent, trend, trendPrev,
}: {
  label: string; value: string; sub?: string; icon: ReactNode; accent: string; trend?: number; trendPrev?: number;
}) {
  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 18, background: "rgba(255,255,255,.09)", border: "1px solid rgba(255,255,255,.14)", padding: "15px 16px", minHeight: 96, boxShadow: "inset 0 1px 0 rgba(255,255,255,.12)" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 90% 12%,${accent}33,transparent 32%)` }} />
      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 950, color: "rgba(255,255,255,.55)", letterSpacing: ".08em", textTransform: "uppercase" }}>{label}</div>
            {trend !== undefined && trendPrev !== undefined ? <Trend current={trend} previous={trendPrev} /> : null}
          </div>
          <div style={{ fontSize: 21, fontWeight: 950, color: "#fff", marginTop: 8, letterSpacing: "-.03em", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
          {sub ? <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", marginTop: 4 }}>{sub}</div> : null}
        </div>
        <div style={{ width: 38, height: 38, borderRadius: 14, background: "rgba(255,255,255,.10)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, background: `linear-gradient(90deg,${accent},transparent)` }} />
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
    <div ref={wrapperRef} style={{ position: "relative", minWidth: 280, flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: selectedSite ? "rgba(255,255,255,.14)" : "rgba(255,255,255,.08)", border: `1.5px solid ${focused ? "rgba(255,255,255,.5)" : "rgba(255,255,255,.16)"}`, borderRadius: 12, padding: "9px 12px", transition: "border-color .15s" }}>
        {selectedSite ? <Building2 size={13} color="#fff" style={{ flexShrink: 0 }} /> : <Search size={13} color="rgba(255,255,255,.6)" style={{ flexShrink: 0 }} />}

        {selectedSite ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 900, color: "#fff", background: "rgba(255,255,255,.16)", borderRadius: 6, padding: "1px 8px" }}>
              {selectedSite.site_id}
            </span>
            <button
              onClick={handleClear}
              style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,.7)", display: "grid", placeItems: "center", padding: 2, borderRadius: 4 }}
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
            style={{ background: "none", border: "none", outline: "none", flex: 1, fontSize: 13, color: "#fff" }}
          />
        )}

        {isFetching && !selectedSite ? (
          <Loader2 size={13} style={{ animation: "spin 1s linear infinite", color: "rgba(255,255,255,.7)", flexShrink: 0 }} />
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

  const siteCode = selectedSite?.site_id ?? undefined;
  const [showFNPModal, setShowFNPModal] = useState(false);
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

  const paymentChartKey =
    globalScope === "PAID" ? "paid" : globalScope === "UNPAID" ? "unpaid" : globalScope === "OUT_OF_SCOPE" ? "out_of_scope" : globalScope === "UNDEFINED" ? "undefined" : "total";

  const billingCertChartKey =
    globalScope === "CERTIFIED" ? "certified" : globalScope === "CONTESTED" ? "contested" : globalScope === "CREATED" ? "created" : "total";

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

      {/* ─── En-tête dégradé ────────────────────────────────────────────────── */}
      <div style={{ background: HDR, color: "#fff", padding: "22px 24px 18px", boxShadow: "0 18px 45px rgba(1,14,42,.24)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 9px", background: "rgba(255,255,255,.10)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 999, fontSize: 11, fontWeight: 950, color: "rgba(255,255,255,.72)" }}>
              <TrendingUp size={13} /> Suivi Facturation
            </div>
            <h1 style={{ margin: "12px 0 4px", fontSize: 27, lineHeight: 1.1, letterSpacing: "-.04em", fontWeight: 950 }}>Évolution de la facturation</h1>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.62)", maxWidth: 620 }}>
              Montants, NRJ, abonnement, pénalités, cos φ et certification, mois par mois.
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.16)", borderRadius: 12, padding: "0 12px", height: 38 }}>
              <Calendar size={13} color="rgba(255,255,255,.65)" />
              <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} style={{ background: "none", border: "none", outline: "none", fontSize: 12.5, color: "#fff", colorScheme: "dark" }} />
              <span style={{ color: "rgba(255,255,255,.45)", fontSize: 11 }}>→</span>
              <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} style={{ background: "none", border: "none", outline: "none", fontSize: 12.5, color: "#fff", colorScheme: "dark" }} />
            </div>

            <button type="button" onClick={() => q.refetch()} style={{ ...iconButtonStyle, background: "rgba(255,255,255,.12)", color: "#fff", border: "1px solid rgba(255,255,255,.18)" }}>
              <RefreshCw size={14} style={{ animation: isLoading ? "spin 1s linear infinite" : "none" }} /> Actualiser
            </button>

            <button
              type="button"
              disabled={!data}
              onClick={() => data && exportToExcel(data, siteCode, globalScope)}
              style={{ ...iconButtonStyle, background: data ? "#fff" : "rgba(255,255,255,.16)", color: data ? C.blue[800] : "rgba(255,255,255,.5)", cursor: data ? "pointer" : "not-allowed" }}
            >
              <Download size={14} /> Exporter
            </button>
          </div>
        </div>

        {/* Vue active : recherche site */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(255,255,255,.12)", display: "grid", placeItems: "center" }}>
              {selectedSite ? <Building2 size={13} color="#fff" /> : <Globe size={13} color="rgba(255,255,255,.7)" />}
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 900, color: "rgba(255,255,255,.5)", textTransform: "uppercase", letterSpacing: ".1em" }}>Vue active</div>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#fff" }}>{selectedSite ? selectedSite.site_id : "Tous les sites"}</div>
            </div>
          </div>

          <SiteSearchBar selectedSite={selectedSite} onSelect={setSelectedSite} onClear={() => setSelectedSite(null)} />

          {selectedSite ? (
            <button onClick={() => setSelectedSite(null)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.18)", cursor: "pointer", fontSize: 11.5, fontWeight: 900, color: "#fff", flexShrink: 0 }}>
              <Globe size={11} /> Vue globale
            </button>
          ) : null}
        </div>

        {/* Filtre global */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
          <span style={{ fontSize: 10.5, fontWeight: 900, color: "rgba(255,255,255,.55)", textTransform: "uppercase", letterSpacing: ".08em" }}>Filtre global</span>
          {(["ALL", "PAID", "UNPAID", "OUT_OF_SCOPE", "UNDEFINED", "CERTIFIED", "CONTESTED", "CREATED"] as GlobalScope[]).map((scope) => (
            <button
              key={scope}
              onClick={() => setGlobalScope(scope)}
              style={{
                padding: "6px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 800, cursor: "pointer",
                border: `1px solid ${globalScope === scope ? "rgba(255,255,255,.6)" : "rgba(255,255,255,.16)"}`,
                background: globalScope === scope ? "rgba(255,255,255,.22)" : "rgba(255,255,255,.06)",
                color: "#fff",
              }}
            >
              {scopeMeta[scope].label}
            </button>
          ))}
        </div>

        {/* Bande KPI */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 12, marginTop: 18 }}>
          {isLoading ? (
            Array(5).fill(0).map((_, i) => <div key={i} style={{ height: 96, borderRadius: 18, background: "rgba(255,255,255,.08)" }} />)
          ) : kpis ? (
            <>
              <KpiCard label="Total HT" value={fmtM(kpis.totalHT)} sub={`${scopeMeta[globalScope].label} · ${kpis.moisCount} mois`} icon={<DollarSign size={17} />} accent={C.blue[300]} trend={kpis.lastHT} trendPrev={kpis.prevHT} />
              <KpiCard label="Total NRJ" value={fmtM(kpis.totalNrj)} sub={scopeMeta[globalScope].label} icon={<Zap size={17} />} accent={C.warn.main} />
              <KpiCard label="Total Pénalités" value={fmtM(kpis.totalPenalite)} sub={scopeMeta[globalScope].label} icon={<AlertTriangle size={17} />} accent={C.nok.main} trend={kpis.lastPenalite} trendPrev={kpis.prevPenalite} />
              <KpiCard label="Total Cos φ" value={fmtM(kpis.totalCosphi)} sub={kpis.totalCosphi >= 0 ? "Pénalité facteur puissance" : "Minoration facteur puissance"} icon={<Activity size={17} />} accent={C.purple.main} />
              <KpiCard label="Total Abonnement" value={fmtM(kpis.totalAbonnement)} sub={scopeMeta[globalScope].label} icon={<BarChart2 size={17} />} accent={C.cyan.main} />
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
                    <Badge tone={globalScope === "ALL" ? "blue" : globalScope === "PAID" || globalScope === "CERTIFIED" ? "ok" : globalScope === "UNPAID" || globalScope === "CONTESTED" ? "nok" : "warn"}>
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
                    <MetricBtn active={globalScope === "ALL"} color={C.blue[700]} label="Brut" onClick={() => setGlobalScope("ALL")} />
                    <MetricBtn active={globalScope === "PAID"} color={C.ok.main} label="Payées" onClick={() => setGlobalScope("PAID")} />
                    <MetricBtn active={globalScope === "UNPAID"} color={C.nok.main} label="Impayées" onClick={() => setGlobalScope("UNPAID")} />
                    <MetricBtn active={globalScope === "OUT_OF_SCOPE"} color={C.warn.main} label="Hors scope" onClick={() => setGlobalScope("OUT_OF_SCOPE")} />
                    <MetricBtn active={globalScope === "UNDEFINED"} color={C.slate[500]} label="Non défini" onClick={() => setGlobalScope("UNDEFINED")} />
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
                      <Bar dataKey={paymentChartKey} name={paymentChartMeta[paymentChartKey].label} fill={paymentChartMeta[paymentChartKey].color} radius={[6, 6, 0, 0]} />
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
                    <MetricBtn active={globalScope === "ALL"} color={C.blue[700]} label="Brut" onClick={() => setGlobalScope("ALL")} />
                    <MetricBtn active={globalScope === "CERTIFIED"} color={C.ok.main} label="Certifiées" onClick={() => setGlobalScope("CERTIFIED")} />
                    <MetricBtn active={globalScope === "CONTESTED"} color={C.nok.main} label="Contestées" onClick={() => setGlobalScope("CONTESTED")} />
                    <MetricBtn active={globalScope === "CREATED"} color={C.warn.main} label="Brutes à traiter" onClick={() => setGlobalScope("CREATED")} />
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
                    Règle : <span style={{ color: C.ok.main, fontWeight: 900 }}>Payée = Certifiée</span> · Taux de certification :
                    <span style={{ color: C.blue[700], fontWeight: 900 }}> {data.invoice_certification.summary.taux_certification}%</span>
                  </div>

                  <ResponsiveContainer width="100%" height={170}>
                    <BarChart data={billingCertData} margin={{ top: 5, right: 8, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.slate[100]} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.slate[400] }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: C.slate[400] }} axisLine={false} tickLine={false} width={38} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey={billingCertChartKey} name={billingCertChartMeta[billingCertChartKey].label} fill={billingCertChartMeta[billingCertChartKey].color} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              ) : (
                <div style={{ color: C.slate[400], fontSize: 12.5, textAlign: "center", padding: "24px 0" }}>Aucune donnée de certification billing disponible</div>
              )}
            </Card>
        </div>

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
    </div>
  );
}
