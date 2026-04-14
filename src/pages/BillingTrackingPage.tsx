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
} from "lucide-react";
import { api } from "@/services/api";
import * as XLSX from "xlsx";

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

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  blue: "#1B3FA0",
  blueL: "#EEF2FF",
  orange: "#D94F1E",
  orangeL: "#FFF1EC",
  red: "#C8202E",
  redL: "#FFF0F0",
  violet: "#6D28D9",
  violetL: "#F5F0FF",
  cyan: "#0E7490",
  cyanL: "#E0F7FA",
  green: "#10B981",
  greenL: "#ECFDF5",
  slate: "#64748B",
  slateL: "#F8FAFC",
  border: "rgba(15,23,42,.08)",
  text: "#0F172A",
  textMid: "#475569",
  textSub: "#94A3B8",
};

// ─── Trend indicator ──────────────────────────────────────────────────────────
function Trend({ current, previous }: { current: number; previous: number }) {
  if (!previous || previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  const up = pct > 0;
  const same = Math.abs(pct) < 0.5;
  const color = same ? T.slate : up ? T.red : T.green;
  const Icon = same ? Minus : up ? ChevronUp : ChevronDown;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontSize: 11,
        fontWeight: 700,
        color,
        background: same ? "#F1F5F9" : up ? "#FFF0F0" : "#F0FDF4",
        borderRadius: 6,
        padding: "2px 7px",
      }}
    >
      <Icon size={10} />
      {same ? "stable" : `${Math.abs(pct).toFixed(1)}%`}
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  icon,
  accent,
  accentLight,
  trend,
  trendPrev,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: ReactNode;
  accent: string;
  accentLight: string;
  trend?: number;
  trendPrev?: number;
}) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: 16,
        padding: "20px",
        border: `1px solid ${T.border}`,
        boxShadow: "0 1px 3px rgba(15,23,42,.05)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        transition: "box-shadow .2s, transform .2s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(15,23,42,.1)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 3px rgba(15,23,42,.05)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: accentLight,
            display: "grid",
            placeItems: "center",
            color: accent,
          }}
        >
          {icon}
        </div>
        {trend !== undefined && trendPrev !== undefined && <Trend current={trend} previous={trendPrev} />}
      </div>

      <div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: T.textSub,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            marginBottom: 5,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: "'Clash Display', 'Syne', sans-serif",
            fontSize: 24,
            fontWeight: 700,
            color: T.text,
            lineHeight: 1,
          }}
        >
          {value}
        </div>
        {sub && <div style={{ fontSize: 11, color: T.textSub, marginTop: 4 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ─── Section title ────────────────────────────────────────────────────────────
function SectionTitle({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
      {icon && (
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: T.blueL,
            display: "grid",
            placeItems: "center",
            color: T.blue,
          }}
        >
          {icon}
        </div>
      )}
      <span
        style={{
          fontFamily: "'Clash Display', 'Syne', sans-serif",
          fontSize: 14,
          fontWeight: 700,
          color: T.text,
          letterSpacing: "-.01em",
        }}
      >
        {children}
      </span>
    </div>
  );
}

// ─── Chart card ───────────────────────────────────────────────────────────────
function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: 16,
        border: `1px solid ${T.border}`,
        boxShadow: "0 1px 3px rgba(15,23,42,.05)",
        padding: "22px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ h }: { h: number }) {
  return <div className="btp-skel" style={{ height: h, borderRadius: 10 }} />;
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        background: "white",
        borderRadius: 12,
        border: `1px solid ${T.border}`,
        boxShadow: "0 8px 24px rgba(15,23,42,.12)",
        padding: "12px 16px",
        minWidth: 180,
      }}
    >
      <div
        style={{
          fontFamily: "'Clash Display', 'Syne', sans-serif",
          fontWeight: 700,
          fontSize: 12,
          color: T.text,
          marginBottom: 8,
        }}
      >
        {label}
      </div>

      {payload.map((p: any, i: number) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 3,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.textMid }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: p.color, display: "inline-block" }} />
            {p.name}
          </span>
          <span style={{ fontWeight: 700, fontSize: 12, color: T.text }}>{fmtM(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Top table ────────────────────────────────────────────────────────────────
function TopTable({
  rows,
  valueKey,
  color,
  filterPositive = false,
}: {
  rows: TopSite[];
  valueKey: keyof TopSite;
  color: string;
  filterPositive?: boolean;
}) {
  const filtered = filterPositive ? rows.filter((r) => Number(r[valueKey]) > 0) : rows;
  const max = Math.max(...filtered.map((r) => Math.abs(Number(r[valueKey]) || 0)), 1);

  if (filtered.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 0",
          gap: 6,
        }}
      >
        <div style={{ fontSize: 20 }}>✓</div>
        <div style={{ fontSize: 12, color: T.textSub, fontWeight: 600 }}>Aucune donnée sur la période</div>
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
            <span
              style={{
                fontFamily: "'Clash Display', 'Syne', sans-serif",
                fontSize: 10,
                fontWeight: 700,
                color: T.textSub,
                width: 18,
                textAlign: "right",
                flexShrink: 0,
              }}
            >
              {i + 1}
            </span>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: T.textMid,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: "58%",
                  }}
                >
                  {r.site_id}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color }}>{fmtM(val)}</span>
              </div>

              <div style={{ height: 4, background: "#F1F5F9", borderRadius: 99, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: color,
                    borderRadius: 99,
                    transition: "width .4s ease",
                  }}
                />
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
  selectedSite,
  onSelect,
  onClear,
}: {
  selectedSite: SiteOption | null;
  onSelect: (site: SiteOption) => void;
  onClear: () => void;
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
    <div ref={wrapperRef} style={{ position: "relative", minWidth: 280 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: selectedSite ? T.blueL : "white",
          border: `1.5px solid ${focused ? T.blue : selectedSite ? "rgba(27,63,160,.25)" : T.border}`,
          borderRadius: 10,
          padding: "8px 12px",
          transition: "border-color .15s, box-shadow .15s",
          boxShadow: focused ? `0 0 0 3px ${T.blueL}` : "none",
        }}
      >
        {selectedSite ? (
          <Building2 size={13} color={T.blue} style={{ flexShrink: 0 }} />
        ) : (
          <Search size={13} color={focused ? T.blue : T.textSub} style={{ flexShrink: 0 }} />
        )}

        {selectedSite ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
            <span
              style={{
                fontFamily: "'Clash Display', 'Syne', sans-serif",
                fontSize: 12,
                fontWeight: 700,
                color: T.blue,
                background: "rgba(27,63,160,.12)",
                borderRadius: 6,
                padding: "1px 8px",
              }}
            >
              {selectedSite.site_id}
            </span>
            <button
              onClick={handleClear}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: T.textSub,
                display: "grid",
                placeItems: "center",
                padding: 2,
                borderRadius: 4,
                transition: "color .1s",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = T.red)}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = T.textSub)}
              title="Vue globale"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              setFocused(true);
              setOpen(true);
            }}
            onBlur={() => setFocused(false)}
            placeholder="Rechercher un site..."
            style={{
              background: "none",
              border: "none",
              outline: "none",
              flex: 1,
              fontSize: 13,
              color: T.text,
              fontFamily: "'DM Sans', sans-serif",
            }}
          />
        )}

        {isFetching && !selectedSite && (
          <div
            className="btp-spin"
            style={{
              width: 13,
              height: 13,
              borderRadius: "50%",
              border: `2px solid ${T.blueL}`,
              borderTopColor: T.blue,
              flexShrink: 0,
            }}
          />
        )}
      </div>

      {showDropdown && !selectedSite && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "white",
            borderRadius: 12,
            border: `1px solid ${T.border}`,
            boxShadow: "0 12px 40px rgba(15,23,42,.14)",
            zIndex: 1000,
            overflow: "hidden",
          }}
        >
          {isFetching && results.length === 0 && (
            <div style={{ padding: "12px 16px", fontSize: 12, color: T.textSub, textAlign: "center" }}>
              Recherche en cours...
            </div>
          )}

          {!isFetching && query.length >= 1 && results.length === 0 && (
            <div style={{ padding: "12px 16px", fontSize: 12, color: T.textSub, textAlign: "center" }}>
              Aucun site trouvé pour « {query} »
            </div>
          )}

          {results.map((site, i) => (
            <button
              key={site.id}
              onMouseDown={() => handleSelect(site)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "10px 14px",
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                borderBottom: i < results.length - 1 ? "1px solid #F8FAFC" : "none",
                transition: "background .1s",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = T.slateL)}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "none")}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  flexShrink: 0,
                  background: T.blueL,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Building2 size={13} color={T.blue} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "'Clash Display', 'Syne', sans-serif",
                    fontSize: 12,
                    fontWeight: 700,
                    color: T.text,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {site.site_id}
                </div>
                <div style={{ fontSize: 11, color: T.textSub, marginTop: 1 }}>{site.numero_compte_contrat}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Metric pill button ───────────────────────────────────────────────────────
function MetricBtn({
  active,
  color,
  label,
  onClick,
}: {
  active: boolean;
  color: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 14px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        transition: "all .15s",
        border: `1px solid ${active ? color : T.border}`,
        background: active ? color : "white",
        color: active ? "white" : T.textMid,
        boxShadow: active ? `0 3px 10px ${color}33` : "none",
        fontFamily: "'DM Sans', sans-serif",
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

  const q = useQuery({
    queryKey: ["billing-tracking", dateStart, dateEnd, siteCode, globalScope],
    queryFn: () => fetchStats(dateStart, dateEnd, siteCode, globalScope),
    staleTime: 5 * 60 * 1000,
  });

  const data = q.data;
  const isLoading = q.isLoading;

  const scopeMeta: Record<GlobalScope, { label: string; color: string }> = {
    ALL: { label: "Brut", color: T.blue },
    PAID: { label: "Payées", color: T.green },
    UNPAID: { label: "Impayées", color: T.red },
    OUT_OF_SCOPE: { label: "Hors scope", color: T.orange },
    UNDEFINED: { label: "Non défini", color: T.slate },
    CERTIFIED: { label: "Certifiées", color: T.green },
    CONTESTED: { label: "Contestées", color: T.red },
    CREATED: { label: "Brutes à traiter", color: T.orange },
  };

  const paymentChartKey =
    globalScope === "PAID"
      ? "paid"
      : globalScope === "UNPAID"
      ? "unpaid"
      : globalScope === "OUT_OF_SCOPE"
      ? "out_of_scope"
      : globalScope === "UNDEFINED"
      ? "undefined"
      : "total";

  const billingCertChartKey =
    globalScope === "CERTIFIED"
      ? "certified"
      : globalScope === "CONTESTED"
      ? "contested"
      : globalScope === "CREATED"
      ? "created"
      : "total";

  const paymentChartMeta = {
    total: { label: "Brut", color: T.blue },
    paid: { label: "Payées", color: T.green },
    unpaid: { label: "Impayées", color: T.red },
    out_of_scope: { label: "Hors scope", color: T.orange },
    undefined: { label: "Non défini", color: T.slate },
  } as const;

  const billingCertChartMeta = {
    total: { label: "Brut", color: T.blue },
    certified: { label: "Certifiées", color: T.green },
    contested: { label: "Contestées", color: T.red },
    created: { label: "Brutes à traiter", color: T.orange },
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
    return data.distribution_ht.parts.map((p) => ({
      name: p.label,
      value: n(p.value),
      percent: p.percent,
    }));
  }, [data]);

  const paymentData = useMemo(() => {
    if (!data?.payment_statuses?.evolution) return [];
    return data.payment_statuses.evolution.map((r) => ({
      period: r.period,
      label: r.period.slice(0, 7),
      total: r.total,
      paid: r.paid,
      unpaid: r.unpaid,
      out_of_scope: r.out_of_scope,
      undefined: r.undefined,
    }));
  }, [data]);

  const billingCertData = useMemo(() => {
    if (!data?.invoice_certification?.evolution) return [];
    return data.invoice_certification.evolution.map((r) => ({
      period: r.period,
      label: r.period.slice(0, 7),
      total: r.total,
      certified: r.certified,
      contested: r.contested,
      created: r.created,
    }));
  }, [data]);

  const metrics = {
    ht: { key: "ht", label: "Montant HT", color: T.blue },
    nrj: { key: "nrj", label: "NRJ", color: T.orange },
    abonnement: { key: "abonnement", label: "Abonnement", color: T.cyan },
    penalite: { key: "penalite", label: "Pénalité Prime", color: T.red },
    cosphi: { key: "cosphi", label: "Cos φ", color: T.violet },
  } as const;

  const DISTRIB_COLORS = [T.blue, T.violet, T.red, T.orange];
  const mc = metrics[activeMetric];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap');

        .btp * { font-family: 'DM Sans', sans-serif; box-sizing: border-box; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        .btp-fade { animation: fadeUp .4s cubic-bezier(.22,1,.36,1) both; }
        .btp-fade:nth-child(1) { animation-delay: .03s; }
        .btp-fade:nth-child(2) { animation-delay: .06s; }
        .btp-fade:nth-child(3) { animation-delay: .09s; }
        .btp-fade:nth-child(4) { animation-delay: .12s; }
        .btp-fade:nth-child(5) { animation-delay: .15s; }
        .btp-fade:nth-child(6) { animation-delay: .18s; }

        .btp-skel {
          background: linear-gradient(90deg, #F1F5F9 25%, #E8EFF6 50%, #F1F5F9 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
        }
        .btp-spin { animation: spin 0.7s linear infinite; }

        .btp input { font-style: normal !important; }
        .btp * { font-style: normal !important; }
      `}</style>

      <div className="btp" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          className="btp-fade"
          style={{
            background: "white",
            borderRadius: 18,
            border: `1px solid ${T.border}`,
            boxShadow: "0 1px 3px rgba(15,23,42,.05)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: 3,
              background: `linear-gradient(90deg, ${T.blue} 0%, ${T.orange} 60%, transparent 100%)`,
            }}
          />

          <div style={{ padding: "20px 24px 0" }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 14,
                marginBottom: 18,
              }}
            >
              <div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    background: T.blueL,
                    border: "1px solid rgba(27,63,160,.15)",
                    borderRadius: 100,
                    padding: "3px 10px",
                    marginBottom: 8,
                  }}
                >
                  <TrendingUp size={10} color={T.blue} />
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: ".1em",
                      color: T.blue,
                      textTransform: "uppercase",
                    }}
                  >
                    Suivi Facturation
                  </span>
                </div>

                <h1
                  style={{
                    fontFamily: "'Syne', sans-serif",
                    fontSize: 22,
                    fontWeight: 800,
                    color: T.text,
                    letterSpacing: "-.03em",
                    margin: 0,
                    lineHeight: 1.2,
                  }}
                >
                  Évolution de la facturation
                </h1>

                <p
                  style={{
                    fontSize: 13,
                    color: T.textSub,
                    margin: "5px 0 0",
                    fontWeight: 400,
                  }}
                >
                  Suivez mois par mois les montants, NRJ, abonnement, pénalités, cos φ et certification.
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: T.slateL,
                    border: `1px solid ${T.border}`,
                    borderRadius: 10,
                    padding: "8px 12px",
                  }}
                >
                  <Calendar size={12} color={T.textSub} />
                  <input
                    type="date"
                    value={dateStart}
                    onChange={(e) => setDateStart(e.target.value)}
                    style={{
                      background: "none",
                      border: "none",
                      outline: "none",
                      fontSize: 13,
                      color: T.text,
                    }}
                  />
                  <span style={{ color: T.textSub, fontSize: 11 }}>→</span>
                  <input
                    type="date"
                    value={dateEnd}
                    onChange={(e) => setDateEnd(e.target.value)}
                    style={{
                      background: "none",
                      border: "none",
                      outline: "none",
                      fontSize: 13,
                      color: T.text,
                    }}
                  />
                </div>

                <button
                  onClick={() => q.refetch()}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 9,
                    border: `1px solid ${T.border}`,
                    background: "white",
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                    color: T.textSub,
                    transition: "all .15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = T.blueL;
                    (e.currentTarget as HTMLButtonElement).style.color = T.blue;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "white";
                    (e.currentTarget as HTMLButtonElement).style.color = T.textSub;
                  }}
                >
                  <RefreshCw size={13} style={{ animation: isLoading ? "spin 1s linear infinite" : "none" }} />
                </button>

                <button
                  disabled={!data}
                  onClick={() => data && exportToExcel(data, siteCode, globalScope)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 16px",
                    borderRadius: 9,
                    background: data ? T.blue : "#CBD5E1",
                    color: "white",
                    border: "none",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: data ? "pointer" : "not-allowed",
                    boxShadow: data ? `0 4px 12px ${T.blue}33` : "none",
                    transition: "all .15s",
                  }}
                >
                  <Download size={13} />
                  Exporter
                </button>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderRadius: 12,
                background: selectedSite ? T.blueL : T.slateL,
                border: `1px solid ${selectedSite ? "rgba(27,63,160,.18)" : T.border}`,
                transition: "all .2s",
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 9,
                    background: selectedSite ? "rgba(27,63,160,.14)" : "#E2E8F0",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  {selectedSite ? <Building2 size={13} color={T.blue} /> : <Globe size={13} color={T.textSub} />}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: T.textSub,
                      textTransform: "uppercase",
                      letterSpacing: ".1em",
                    }}
                  >
                    Vue active
                  </div>
                  <div
                    style={{
                      fontFamily: "'Syne', sans-serif",
                      fontSize: 12,
                      fontWeight: 700,
                      color: selectedSite ? T.blue : T.textMid,
                    }}
                  >
                    {selectedSite ? selectedSite.site_id : "Tous les sites"}
                  </div>
                </div>
              </div>

              <div style={{ width: 1, height: 28, background: T.border }} />

              <div style={{ flex: 1 }}>
                <SiteSearchBar selectedSite={selectedSite} onSelect={setSelectedSite} onClear={() => setSelectedSite(null)} />
              </div>

              {selectedSite && (
                <button
                  onClick={() => setSelectedSite(null)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "6px 12px",
                    borderRadius: 8,
                    background: "white",
                    border: `1px solid ${T.border}`,
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 600,
                    color: T.textMid,
                    flexShrink: 0,
                    transition: "all .15s",
                  }}
                >
                  <Globe size={10} /> Vue globale
                </button>
              )}
            </div>
          </div>

          <div style={{ padding: "0 24px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: T.textSub,
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                }}
              >
                Filtre global
              </span>

              {(
                ["ALL", "PAID", "UNPAID", "OUT_OF_SCOPE", "UNDEFINED", "CERTIFIED", "CONTESTED", "CREATED"] as GlobalScope[]
              ).map((scope) => (
                <MetricBtn
                  key={scope}
                  active={globalScope === scope}
                  color={scopeMeta[scope].color}
                  label={scopeMeta[scope].label}
                  onClick={() => setGlobalScope(scope)}
                />
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12 }}>
          {isLoading ? (
            Array(5)
              .fill(0)
              .map((_, i) => <div key={i} className="btp-fade btp-skel" style={{ height: 118, borderRadius: 16 }} />)
          ) : kpis ? (
            <>
              <div className="btp-fade">
                <KpiCard
                  label="Total HT"
                  value={fmtM(kpis.totalHT)}
                  sub={`${scopeMeta[globalScope].label} · sur ${kpis.moisCount} mois`}
                  icon={<DollarSign size={17} />}
                  accent={T.blue}
                  accentLight={T.blueL}
                  trend={kpis.lastHT}
                  trendPrev={kpis.prevHT}
                />
              </div>

              <div className="btp-fade">
                <KpiCard
                  label="Total NRJ"
                  value={fmtM(kpis.totalNrj)}
                  sub={scopeMeta[globalScope].label}
                  icon={<Zap size={17} />}
                  accent={T.orange}
                  accentLight={T.orangeL}
                />
              </div>

              <div className="btp-fade">
                <KpiCard
                  label="Total Pénalités"
                  value={fmtM(kpis.totalPenalite)}
                  sub={scopeMeta[globalScope].label}
                  icon={<AlertTriangle size={17} />}
                  accent={T.red}
                  accentLight={T.redL}
                  trend={kpis.lastPenalite}
                  trendPrev={kpis.prevPenalite}
                />
              </div>

              <div className="btp-fade">
                <KpiCard
                  label="Total Cos φ"
                  value={fmtM(kpis.totalCosphi)}
                  sub={kpis.totalCosphi >= 0 ? "Pénalité facteur puissance" : "Minoration facteur puissance"}
                  icon={<Activity size={17} />}
                  accent={kpis.totalCosphi >= 0 ? T.violet : T.green}
                  accentLight={kpis.totalCosphi >= 0 ? T.violetL : T.greenL}
                />
              </div>

              <div className="btp-fade">
                <KpiCard
                  label="Total Abonnement"
                  value={fmtM(kpis.totalAbonnement)}
                  sub={scopeMeta[globalScope].label}
                  icon={<BarChart2 size={17} />}
                  accent={T.cyan}
                  accentLight={T.cyanL}
                />
              </div>
            </>
          ) : null}
        </div>

        <div className="btp-fade" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Card>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 18,
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <SectionTitle icon={<CheckCircle2 size={13} />}>Statuts de paiement</SectionTitle>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <MetricBtn active={globalScope === "ALL"} color={T.blue} label="Brut" onClick={() => setGlobalScope("ALL")} />
                <MetricBtn active={globalScope === "PAID"} color={T.green} label="Payées" onClick={() => setGlobalScope("PAID")} />
                <MetricBtn active={globalScope === "UNPAID"} color={T.red} label="Impayées" onClick={() => setGlobalScope("UNPAID")} />
                <MetricBtn
                  active={globalScope === "OUT_OF_SCOPE"}
                  color={T.orange}
                  label="Hors scope"
                  onClick={() => setGlobalScope("OUT_OF_SCOPE")}
                />
                <MetricBtn
                  active={globalScope === "UNDEFINED"}
                  color={T.slate}
                  label="Non défini"
                  onClick={() => setGlobalScope("UNDEFINED")}
                />
              </div>
            </div>

            {isLoading ? (
              <Skeleton h={240} />
            ) : data?.payment_statuses ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 10, marginBottom: 16 }}>
                  <div style={{ padding: "12px 14px", borderRadius: 12, background: T.blueL, border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: T.blue }}>{fmt.format(data.payment_statuses.summary.total)}</div>
                    <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600 }}>Brut</div>
                  </div>
                  <div style={{ padding: "12px 14px", borderRadius: 12, background: T.greenL, border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: T.green }}>{fmt.format(data.payment_statuses.summary.paid)}</div>
                    <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600 }}>Payées</div>
                  </div>
                  <div style={{ padding: "12px 14px", borderRadius: 12, background: T.redL, border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: T.red }}>{fmt.format(data.payment_statuses.summary.unpaid)}</div>
                    <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600 }}>Impayées</div>
                  </div>
                  <div style={{ padding: "12px 14px", borderRadius: 12, background: T.orangeL, border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: T.orange }}>{fmt.format(data.payment_statuses.summary.out_of_scope)}</div>
                    <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600 }}>Hors scope</div>
                  </div>
                  <div style={{ padding: "12px 14px", borderRadius: 12, background: T.slateL, border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: T.slate }}>{fmt.format(data.payment_statuses.summary.undefined)}</div>
                    <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600 }}>Non défini</div>
                  </div>
                </div>

                <div style={{ fontSize: 12, color: T.textMid, fontWeight: 600, marginBottom: 10 }}>
                  Taux payé : <span style={{ color: T.green, fontWeight: 800 }}>{data.payment_statuses.summary.paid_pct}%</span>
                </div>

                <ResponsiveContainer width="100%" height={170}>
                  <BarChart data={paymentData} margin={{ top: 5, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: T.textSub }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: T.textSub }} axisLine={false} tickLine={false} width={38} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey={paymentChartKey}
                      name={paymentChartMeta[paymentChartKey].label}
                      fill={paymentChartMeta[paymentChartKey].color}
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <div style={{ color: T.textSub, fontSize: 12.5, textAlign: "center", padding: "24px 0" }}>
                Aucune donnée de paiement disponible
              </div>
            )}
          </Card>

          <Card>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 18,
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <SectionTitle icon={<CheckCircle2 size={13} />}>Statuts de certification billing</SectionTitle>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <MetricBtn active={globalScope === "ALL"} color={T.blue} label="Brut" onClick={() => setGlobalScope("ALL")} />
                <MetricBtn
                  active={globalScope === "CERTIFIED"}
                  color={T.green}
                  label="Certifiées"
                  onClick={() => setGlobalScope("CERTIFIED")}
                />
                <MetricBtn
                  active={globalScope === "CONTESTED"}
                  color={T.red}
                  label="Contestées"
                  onClick={() => setGlobalScope("CONTESTED")}
                />
                <MetricBtn
                  active={globalScope === "CREATED"}
                  color={T.orange}
                  label="Brutes à traiter"
                  onClick={() => setGlobalScope("CREATED")}
                />
              </div>
            </div>

            {isLoading ? (
              <Skeleton h={240} />
            ) : data?.invoice_certification ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10, marginBottom: 16 }}>
                  <div style={{ padding: "12px 14px", borderRadius: 12, background: T.blueL, border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: T.blue }}>{fmt.format(data.invoice_certification.summary.total)}</div>
                    <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600 }}>Brut</div>
                  </div>
                  <div style={{ padding: "12px 14px", borderRadius: 12, background: T.greenL, border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: T.green }}>{fmt.format(data.invoice_certification.summary.certified)}</div>
                    <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600 }}>Certifiées</div>
                  </div>
                  <div style={{ padding: "12px 14px", borderRadius: 12, background: T.redL, border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: T.red }}>{fmt.format(data.invoice_certification.summary.contested)}</div>
                    <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600 }}>Contestées</div>
                  </div>
                  <div style={{ padding: "12px 14px", borderRadius: 12, background: T.orangeL, border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: T.orange }}>{fmt.format(data.invoice_certification.summary.created)}</div>
                    <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600 }}>Brutes à traiter</div>
                  </div>
                </div>

                <div style={{ fontSize: 12, color: T.textMid, fontWeight: 600, marginBottom: 10 }}>
                  Règle : <span style={{ color: T.green, fontWeight: 800 }}>Payée = Certifiée</span> · Taux de certification :
                  <span style={{ color: T.blue, fontWeight: 800 }}> {data.invoice_certification.summary.taux_certification}%</span>
                </div>

                <ResponsiveContainer width="100%" height={170}>
                  <BarChart data={billingCertData} margin={{ top: 5, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: T.textSub }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: T.textSub }} axisLine={false} tickLine={false} width={38} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey={billingCertChartKey}
                      name={billingCertChartMeta[billingCertChartKey].label}
                      fill={billingCertChartMeta[billingCertChartKey].color}
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <div style={{ color: T.textSub, fontSize: 12.5, textAlign: "center", padding: "24px 0" }}>
                Aucune donnée de certification billing disponible
              </div>
            )}
          </Card>
        </div>

        <div className="btp-fade" style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 12 }}>
          <Card>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 18,
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <SectionTitle icon={<BarChart2 size={13} />}>Évolution mensuelle</SectionTitle>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(Object.keys(metrics) as Array<keyof typeof metrics>).map((k) => (
                  <MetricBtn
                    key={k}
                    active={activeMetric === k}
                    color={metrics[k].color}
                    label={metrics[k].label}
                    onClick={() => setActiveMetric(k)}
                  />
                ))}
              </div>
            </div>

            {isLoading ? (
              <Skeleton h={260} />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData} margin={{ top: 5, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="mainGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={mc.color} stopOpacity={0.12} />
                      <stop offset="95%" stopColor={mc.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: T.textSub }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: T.textSub }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => fmtM(v)}
                    width={52}
                  />
                  <ReferenceLine y={0} stroke="#CBD5E1" strokeDasharray="4 4" />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey={mc.key}
                    name={mc.label}
                    stroke={mc.color}
                    strokeWidth={2.5}
                    fill="url(#mainGrad)"
                    dot={{ fill: mc.color, r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card>
            <SectionTitle icon={<BarChart2 size={13} />}>Répartition HT</SectionTitle>

            {isLoading ? (
              <Skeleton h={260} />
            ) : (
              <div>
                <div style={{ marginBottom: 20 }}>
                  <div
                    style={{
                      fontFamily: "'Syne', sans-serif",
                      fontSize: 22,
                      fontWeight: 800,
                      color: T.text,
                      lineHeight: 1,
                    }}
                  >
                    {fmtM(data?.distribution_ht.total_ht ?? "0")}
                  </div>
                  <div style={{ fontSize: 11, color: T.textSub, fontWeight: 500, marginTop: 3 }}>
                    FCFA total HT · {scopeMeta[globalScope].label}
                  </div>
                </div>

                {distribData.map((d, i) => (
                  <div key={d.name} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, alignItems: "baseline" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: DISTRIB_COLORS[i] }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: T.textMid }}>{d.name}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{fmtM(d.value)}</span>
                        <span style={{ fontSize: 10, color: T.textSub, marginLeft: 5, fontWeight: 500 }}>
                          {d.percent.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    <div style={{ height: 5, background: "#F1F5F9", borderRadius: 99, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.min(d.percent, 100)}%`,
                          background: DISTRIB_COLORS[i],
                          borderRadius: 99,
                          transition: "width .5s ease",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="btp-fade" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Card>
            <SectionTitle icon={<Activity size={13} />}>Nombre de factures par mois</SectionTitle>

            {isLoading ? (
              <Skeleton h={150} />
            ) : (
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={chartData} margin={{ top: 5, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: T.textSub }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: T.textSub }} axisLine={false} tickLine={false} width={38} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="invoices"
                    name="Factures"
                    stroke={T.cyan}
                    strokeWidth={2}
                    dot={{ fill: T.cyan, r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card>
            <SectionTitle icon={<CheckCircle2 size={13} />}>Vue appliquée</SectionTitle>

            <div
              style={{
                minHeight: 150,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: 10,
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  width: "fit-content",
                  padding: "8px 14px",
                  borderRadius: 999,
                  background: scopeMeta[globalScope].color,
                  color: "white",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {scopeMeta[globalScope].label}
              </div>

              <div style={{ fontSize: 13, color: T.textMid, lineHeight: 1.6 }}>
                Toutes les statistiques principales du dashboard sont recalculées sur ce filtre global.
              </div>
            </div>
          </Card>
        </div>

        {!selectedSite && (
          <div className="btp-fade" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Card>
              <SectionTitle>Top sites — Montant HT</SectionTitle>
              {isLoading ? (
                <Skeleton h={180} />
              ) : (
                <TopTable rows={data?.top.conso_vs_montant ?? []} valueKey="montant_ht" color={T.blue} />
              )}
            </Card>

            <Card>
              <SectionTitle>Top sites — Pénalité</SectionTitle>
              {isLoading ? (
                <Skeleton h={180} />
              ) : (
                <TopTable rows={data?.top.pen_prime ?? []} valueKey="penalite_prime" color={T.red} />
              )}
            </Card>

            <Card>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
                <SectionTitle>Top sites — Cos φ</SectionTitle>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: T.violet,
                    background: T.violetL,
                    borderRadius: 6,
                    padding: "2px 8px",
                    flexShrink: 0,
                  }}
                >
                  Positifs uniquement
                </span>
              </div>

              {isLoading ? (
                <Skeleton h={180} />
              ) : (
                <TopTable rows={data?.top.cosphi ?? []} valueKey="montant_cosphi" color={T.violet} filterPositive={true} />
              )}
            </Card>
          </div>
        )}
      </div>
    </>
  );
}