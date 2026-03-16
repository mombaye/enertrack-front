// src/pages/BillingTrackingPage.tsx
// Suivi facturation Sénélec — évolution mensuelle
// Utilise SonatelBillingStatsAPIView (/billing/stats/)

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, Cell,
} from "recharts";
import {
  TrendingUp, TrendingDown, Minus,
  Calendar, Download, RefreshCw,
  DollarSign, Zap, AlertTriangle, Activity,
  BarChart2, ChevronUp, ChevronDown,
} from "lucide-react";
import { api } from "@/services/api";
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────
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

interface StatsResponse {
  range: { start: string; end: string };
  evolution: EvoRow[];
  top: {
    conso_vs_montant: TopSite[];
    cosphi: TopSite[];
    pen_prime: TopSite[];
  };
  distribution_ht: {
    total_ht: string;
    parts: DistribPart[];
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const fmtM = (v: string | number) => {
  const n = Number(v);
  if (isNaN(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `${fmt.format(Math.round(n / 1_000_000))} M`;
  if (Math.abs(n) >= 1_000)    return `${fmt.format(Math.round(n / 1_000))} k`;
  return fmt.format(Math.round(n));
};
const fmtFull = (v: string | number) => `${fmt.format(Math.round(Number(v)))} FCFA`;
const n = (v: string) => Number(v) || 0;

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function defaultRange() {
  const now = new Date();
  return { start: fmtDate(new Date(now.getFullYear(), 0, 1)), end: fmtDate(now) };
}

async function fetchStats(start: string, end: string): Promise<StatsResponse> {
  const { data } = await api.get("/sonatel-billing/stats/", { params: { start, end } });
  return data;
}

// ─── Trend indicator ──────────────────────────────────────────────────────────
function Trend({ current, previous }: { current: number; previous: number }) {
  if (!previous || previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  const up   = pct > 0;
  const same = Math.abs(pct) < 0.5;
  const color = same ? "#94a3b8" : up ? "#ef4444" : "#10b981";
  const Icon  = same ? Minus : up ? ChevronUp : ChevronDown;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 2,
      fontSize: 11, fontWeight: 700, color,
      background: `${color}14`, borderRadius: 6, padding: "1px 6px",
    }}>
      <Icon size={11}/>
      {same ? "stable" : `${Math.abs(pct).toFixed(1)}%`}
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon, accent, trend, trendPrev,
}: {
  label: string; value: string; sub?: string;
  icon: React.ReactNode; accent: string;
  trend?: number; trendPrev?: number;
}) {
  return (
    <div style={{
      background: "white", borderRadius: 18, padding: "20px 22px",
      border: "1px solid rgba(15,23,42,.07)",
      boxShadow: "0 1px 2px rgba(15,23,42,.04), 0 6px 20px rgba(15,23,42,.04)",
      display: "flex", flexDirection: "column", gap: 12,
      transition: "transform .2s, box-shadow .2s",
    }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
      (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 30px rgba(15,23,42,.1)";
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
      (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 2px rgba(15,23,42,.04), 0 6px 20px rgba(15,23,42,.04)";
    }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: `${accent}18`, display: "grid", placeItems: "center",
          color: accent, flexShrink: 0,
        }}>
          {icon}
        </div>
        {trend !== undefined && trendPrev !== undefined && (
          <Trend current={trend} previous={trendPrev} />
        )}
      </div>
      <div>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: "#94a3b8", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          {label}
        </div>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: "#0f172a", letterSpacing: "-.02em", lineHeight: 1.1 }}>
          {value}
        </div>
        {sub && (
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionTitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
      {icon && (
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: "rgba(30,58,138,.08)", display: "grid", placeItems: "center",
          color: "#1e3a8a", flexShrink: 0,
        }}>
          {icon}
        </div>
      )}
      <h2 style={{
        fontFamily: "'Syne', sans-serif",
        fontSize: 15, fontWeight: 800, color: "#0f172a",
        margin: 0, letterSpacing: "-.01em",
      }}>
        {children}
      </h2>
    </div>
  );
}

// ─── Chart card wrapper ───────────────────────────────────────────────────────
function ChartCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "white", borderRadius: 18,
      border: "1px solid rgba(15,23,42,.07)",
      boxShadow: "0 1px 2px rgba(15,23,42,.04)",
      padding: "22px 24px",
      ...style,
    }}>
      {children}
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "white", borderRadius: 12,
      border: "1px solid rgba(15,23,42,.1)",
      boxShadow: "0 8px 24px rgba(15,23,42,.12)",
      padding: "12px 16px", minWidth: 180,
    }}>
      <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 13, color: "#0f172a", marginBottom: 8 }}>
        {label}
      </div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 4 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748b" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, display: "inline-block" }}/>
            {p.name}
          </span>
          <span style={{ fontWeight: 700, fontSize: 12, color: "#0f172a" }}>
            {fmtM(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Top sites table ──────────────────────────────────────────────────────────
function TopTable({
  rows, valueKey, valueLabel, color,
}: {
  rows: TopSite[]; valueKey: keyof TopSite; valueLabel: string; color: string;
}) {
  const max = Math.max(...rows.map(r => Number(r[valueKey]) || 0));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {rows.slice(0, 8).map((r, i) => {
        const val = Number(r[valueKey]) || 0;
        const pct = max > 0 ? (val / max) * 100 : 0;
        return (
          <div key={r.site_id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 11, fontWeight: 800, color: "#cbd5e1",
              width: 20, textAlign: "right", flexShrink: 0,
            }}>
              {i + 1}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{
                  fontSize: 12, fontWeight: 600, color: "#334155",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  maxWidth: "60%",
                }}>
                  {r.site_id}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color, flexShrink: 0 }}>
                  {fmtM(String(val))}
                </span>
              </div>
              <div style={{ height: 5, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${pct}%`,
                  background: `linear-gradient(90deg, ${color}, ${color}99)`,
                  borderRadius: 99, transition: "width .4s ease",
                }}/>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────
function exportToExcel(data: StatsResponse) {
  const wb = XLSX.utils.book_new();

  // Évolution mensuelle
  const evoRows = data.evolution.map(r => ({
    "Période":          r.period,
    "Nb Factures":      r.invoices,
    "Montant HT (FCFA)":  Number(r.montant_ht),
    "Montant TTC (FCFA)": Number(r.montant_ttc),
    "NRJ (FCFA)":       Number(r.nrj),
    "Abonnement (FCFA)": Number(r.abonnement),
    "Pénalité Prime (FCFA)": Number(r.penalite_prime),
    "Cos φ (FCFA)":     Number(r.cosphi),
  }));
  const ws1 = XLSX.utils.json_to_sheet(evoRows);
  ws1["!cols"] = [
    { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 20 },
    { wch: 16 }, { wch: 18 }, { wch: 22 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, "Évolution mensuelle");

  // Top sites
  const topRows = data.top.conso_vs_montant.map(r => ({
    "Site ID":           r.site_id,
    "Site Nom":          r.site_name,
    "Montant HT (FCFA)": Number(r.montant_ht),
    "Cos φ (FCFA)":      Number(r.montant_cosphi),
    "Pénalité (FCFA)":   Number(r.penalite_prime),
    "Abonnement (FCFA)": Number(r.abonnement),
  }));
  const ws2 = XLSX.utils.json_to_sheet(topRows);
  ws2["!cols"] = [{ wch: 14 }, { wch: 28 }, { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Top Sites");

  // Distribution
  const distRows = data.distribution_ht.parts.map(p => ({
    "Composante":   p.label,
    "Montant (FCFA)": Number(p.value),
    "% du HT":      p.percent,
  }));
  const ws3 = XLSX.utils.json_to_sheet(distRows);
  ws3["!cols"] = [{ wch: 20 }, { wch: 20 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws3, "Distribution HT");

  const start = data.range.start.replace(/-/g, "");
  const end   = data.range.end.replace(/-/g, "");
  XLSX.writeFile(wb, `suivi_facturation_${start}_${end}.xlsx`);
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BillingTrackingPage() {
  const defRange = useMemo(() => defaultRange(), []);
  const [dateStart, setDateStart] = useState(defRange.start);
  const [dateEnd,   setDateEnd]   = useState(defRange.end);
  const [activeMetric, setActiveMetric] = useState<"ht" | "nrj" | "penalite" | "cosphi">("ht");

  const q = useQuery({
    queryKey: ["billing-tracking", dateStart, dateEnd],
    queryFn: () => fetchStats(dateStart, dateEnd),
    staleTime: 5 * 60 * 1000,
  });

  const data = q.data;

  // ── Préparer les données graphe
  const chartData = useMemo(() => {
    if (!data?.evolution) return [];
    return data.evolution.map(r => ({
      period:    r.period,
      label:     r.period.slice(0, 7),
      ht:        n(r.montant_ht),
      ttc:       n(r.montant_ttc),
      nrj:       n(r.nrj),
      abonnement: n(r.abonnement),
      penalite:  n(r.penalite_prime),
      cosphi:    Math.abs(n(r.cosphi)),
      invoices:  r.invoices,
    }));
  }, [data]);

  // ── KPIs agrégés
  const kpis = useMemo(() => {
    if (!chartData.length) return null;
    const sum = (k: keyof typeof chartData[0]) =>
      chartData.reduce((a, r) => a + (Number(r[k]) || 0), 0);
    const last  = chartData[chartData.length - 1];
    const prev  = chartData[chartData.length - 2];
    return {
      totalHT:       sum("ht"),
      totalNrj:      sum("nrj"),
      totalPenalite: sum("penalite"),
      totalCosphi:   sum("cosphi"),
      totalInvoices: sum("invoices"),
      lastHT:        last?.ht ?? 0,
      prevHT:        prev?.ht ?? 0,
      lastPenalite:  last?.penalite ?? 0,
      prevPenalite:  prev?.penalite ?? 0,
      moisCount:     chartData.length,
    };
  }, [chartData]);

  // ── Distribution pour donut-like bars
  const distribData = useMemo(() => {
    if (!data?.distribution_ht) return [];
    return data.distribution_ht.parts.map(p => ({
      name:    p.label,
      value:   n(p.value),
      percent: p.percent,
    }));
  }, [data]);

  const metricConfig = {
    ht:       { key: "ht",       label: "Montant HT",     color: "#1e3a8a", gradFrom: "#1e3a8a", gradTo: "#3b82f6" },
    nrj:      { key: "nrj",      label: "NRJ",            color: "#E8401C", gradFrom: "#E8401C", gradTo: "#fb923c" },
    penalite: { key: "penalite", label: "Pénalité Prime",  color: "#dc2626", gradFrom: "#dc2626", gradTo: "#f87171" },
    cosphi:   { key: "cosphi",   label: "Cos φ",          color: "#7c3aed", gradFrom: "#7c3aed", gradTo: "#a78bfa" },
  };

  const DISTRIB_COLORS = ["#1e3a8a", "#E8401C", "#dc2626", "#7c3aed"];

  const isLoading = q.isLoading;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');

        .btp * { font-family: 'DM Sans', sans-serif; box-sizing: border-box; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .btp-fade { animation: fadeUp .45s cubic-bezier(.22,1,.36,1) both; }
        .btp-fade:nth-child(1) { animation-delay: .04s; }
        .btp-fade:nth-child(2) { animation-delay: .08s; }
        .btp-fade:nth-child(3) { animation-delay: .12s; }
        .btp-fade:nth-child(4) { animation-delay: .16s; }
        .btp-fade:nth-child(5) { animation-delay: .20s; }
        .btp-fade:nth-child(6) { animation-delay: .24s; }

        .btp input:focus, .btp select:focus {
          outline: none;
          border-color: #1e3a8a !important;
          box-shadow: 0 0 0 3px rgba(30,58,138,.1) !important;
        }

        .metric-btn {
          padding: 7px 16px; border-radius: 9px;
          font-size: 12px; font-weight: 600;
          cursor: pointer; transition: all .15s;
          border: 1px solid rgba(15,23,42,.1);
          background: white; color: #64748b;
          font-family: 'DM Sans', sans-serif;
        }
        .metric-btn:hover { background: #f8faff; }

        .btp-skeleton {
          background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 8px;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <div className="btp" style={{ display: "flex", flexDirection: "column", gap: 18 }}>

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="btp-fade" style={{
          background: "white", borderRadius: 20,
          border: "1px solid rgba(15,23,42,.07)",
          boxShadow: "0 1px 3px rgba(15,23,42,.04), 0 8px 32px rgba(15,23,42,.05)",
          overflow: "hidden", position: "relative",
        }}>
          {/* Top gradient bar */}
          <div style={{
            height: 3,
            background: "linear-gradient(90deg, #1e3a8a, #3b82f6, #E8401C, transparent)",
            position: "absolute", top: 0, left: 0, right: 0,
          }}/>

          <div style={{ padding: "22px 28px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "rgba(30,58,138,.07)", border: "1px solid rgba(30,58,138,.15)",
                borderRadius: 100, padding: "3px 10px", marginBottom: 8,
              }}>
                <Activity size={11} color="#1e3a8a"/>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".12em", color: "#1e3a8a", textTransform: "uppercase" }}>
                  Suivi Facturation
                </span>
              </div>
              <h1 style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: 24, fontWeight: 800, color: "#0f172a",
                letterSpacing: "-.03em", margin: 0, lineHeight: 1.2,
              }}>
                Évolution de la facturation
              </h1>
              <p style={{ fontSize: 13, color: "#64748b", marginTop: 5, margin: "5px 0 0" }}>
                Suivez mois par mois l'évolution des montants, NRJ, pénalités et cos φ sur votre parc de sites.
              </p>
            </div>

            {/* Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {/* Date range */}
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "#f8faff", border: "1px solid rgba(30,58,138,.12)",
                borderRadius: 12, padding: "8px 14px",
              }}>
                <Calendar size={13} color="#94a3b8"/>
                <input
                  type="date" value={dateStart}
                  onChange={e => setDateStart(e.target.value)}
                  style={{
                    background: "none", border: "none", outline: "none",
                    fontSize: 13, color: "#334155", fontFamily: "'DM Sans', sans-serif",
                  }}
                />
                <span style={{ color: "#cbd5e1", fontSize: 12 }}>→</span>
                <input
                  type="date" value={dateEnd}
                  onChange={e => setDateEnd(e.target.value)}
                  style={{
                    background: "none", border: "none", outline: "none",
                    fontSize: 13, color: "#334155", fontFamily: "'DM Sans', sans-serif",
                  }}
                />
              </div>

              {/* Refresh */}
              <button
                onClick={() => q.refetch()}
                style={{
                  width: 38, height: 38, borderRadius: 10,
                  border: "1px solid rgba(15,23,42,.1)",
                  background: "white", cursor: "pointer",
                  display: "grid", placeItems: "center", color: "#64748b",
                  transition: "all .15s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#f8faff"; (e.currentTarget as HTMLButtonElement).style.color = "#1e3a8a"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "white"; (e.currentTarget as HTMLButtonElement).style.color = "#64748b"; }}
              >
                <RefreshCw size={14} style={{ animation: isLoading ? "spin 1s linear infinite" : "none" }}/>
              </button>

              {/* Export */}
              <button
                disabled={!data}
                onClick={() => data && exportToExcel(data)}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "9px 18px", borderRadius: 10,
                  background: data ? "#1e3a8a" : "#94a3b8",
                  color: "white", border: "none",
                  fontSize: 13, fontWeight: 600,
                  cursor: data ? "pointer" : "not-allowed",
                  boxShadow: data ? "0 4px 12px rgba(30,58,138,.25)" : "none",
                  transition: "all .18s",
                  fontFamily: "'DM Sans', sans-serif",
                }}
                onMouseEnter={e => { if (data) (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; }}
              >
                <Download size={14}/>
                Exporter
              </button>
            </div>
          </div>
        </div>

        {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {isLoading ? (
            Array(5).fill(0).map((_, i) => (
              <div key={i} className="btp-fade btp-skeleton" style={{ height: 120, borderRadius: 18 }}/>
            ))
          ) : kpis ? (
            <>
              <div className="btp-fade">
                <KpiCard
                  label="Total HT"
                  value={fmtM(kpis.totalHT)}
                  sub={`${kpis.moisCount} mois`}
                  icon={<DollarSign size={18}/>}
                  accent="#1e3a8a"
                  trend={kpis.lastHT}
                  trendPrev={kpis.prevHT}
                />
              </div>
              <div className="btp-fade">
                <KpiCard
                  label="Total NRJ"
                  value={fmtM(kpis.totalNrj)}
                  sub="Énergie facturée"
                  icon={<Zap size={18}/>}
                  accent="#E8401C"
                />
              </div>
              <div className="btp-fade">
                <KpiCard
                  label="Total Pénalités"
                  value={fmtM(kpis.totalPenalite)}
                  sub="Dépassement PS"
                  icon={<AlertTriangle size={18}/>}
                  accent="#dc2626"
                  trend={kpis.lastPenalite}
                  trendPrev={kpis.prevPenalite}
                />
              </div>
              <div className="btp-fade">
                <KpiCard
                  label="Total Cos φ"
                  value={fmtM(kpis.totalCosphi)}
                  sub="Impact facteur puissance"
                  icon={<Activity size={18}/>}
                  accent="#7c3aed"
                />
              </div>
              <div className="btp-fade">
                <KpiCard
                  label="Factures traitées"
                  value={fmt.format(kpis.totalInvoices)}
                  sub={`Moy. ${fmt.format(Math.round(kpis.totalInvoices / Math.max(kpis.moisCount, 1)))} / mois`}
                  icon={<BarChart2 size={18}/>}
                  accent="#0891b2"
                />
              </div>
            </>
          ) : null}
        </div>

        {/* ── Main chart + Distribution ─────────────────────────────────────── */}
        <div className="btp-fade" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 14 }}>

          {/* Évolution principale */}
          <ChartCard>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
              <SectionTitle icon={<TrendingUp size={14}/>}>Évolution mensuelle</SectionTitle>
              <div style={{ display: "flex", gap: 6 }}>
                {(Object.keys(metricConfig) as Array<keyof typeof metricConfig>).map(k => {
                  const cfg = metricConfig[k];
                  const active = activeMetric === k;
                  return (
                    <button
                      key={k}
                      className="metric-btn"
                      onClick={() => setActiveMetric(k)}
                      style={{
                        background: active ? cfg.color : "white",
                        color: active ? "white" : "#64748b",
                        border: `1px solid ${active ? cfg.color : "rgba(15,23,42,.1)"}`,
                        boxShadow: active ? `0 4px 10px ${cfg.color}33` : "none",
                      }}
                    >
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {isLoading ? (
              <div className="btp-skeleton" style={{ height: 260 }}/>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="mainGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={metricConfig[activeMetric].gradFrom} stopOpacity={0.15}/>
                      <stop offset="95%" stopColor={metricConfig[activeMetric].gradTo} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}
                    axisLine={false} tickLine={false}
                    tickFormatter={v => fmtM(v)}
                    width={55}
                  />
                  <Tooltip content={<CustomTooltip />}/>
                  <Area
                    type="monotone"
                    dataKey={metricConfig[activeMetric].key}
                    name={metricConfig[activeMetric].label}
                    stroke={metricConfig[activeMetric].color}
                    strokeWidth={2.5}
                    fill="url(#mainGrad)"
                    dot={{ fill: metricConfig[activeMetric].color, r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Distribution HT */}
          <ChartCard>
            <SectionTitle icon={<BarChart2 size={14}/>}>Répartition HT</SectionTitle>
            {isLoading ? (
              <div className="btp-skeleton" style={{ height: 260 }}/>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                <div style={{
                  fontFamily: "'Syne', sans-serif",
                  fontSize: 22, fontWeight: 800, color: "#0f172a",
                  letterSpacing: "-.02em", marginBottom: 18,
                }}>
                  {fmtM(data?.distribution_ht.total_ht ?? "0")}
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", marginLeft: 6 }}>FCFA total</span>
                </div>

                {distribData.map((d, i) => (
                  <div key={d.name} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <div style={{ width: 9, height: 9, borderRadius: 3, background: DISTRIB_COLORS[i] }}/>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>{d.name}</span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{fmtM(String(d.value))}</span>
                        <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 6 }}>({d.percent.toFixed(1)}%)</span>
                      </div>
                    </div>
                    <div style={{ height: 6, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: `${Math.min(d.percent, 100)}%`,
                        background: `linear-gradient(90deg, ${DISTRIB_COLORS[i]}, ${DISTRIB_COLORS[i]}99)`,
                        borderRadius: 99,
                        transition: "width .5s ease",
                      }}/>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        </div>

        {/* ── Stacked bar chart (NRJ + Abonnement + Pénalité + Cosphi) ─────── */}
        <div className="btp-fade">
          <ChartCard>
            <SectionTitle icon={<BarChart2 size={14}/>}>Décomposition mensuelle du HT</SectionTitle>
            {isLoading ? (
              <div className="btp-skeleton" style={{ height: 240 }}/>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }} barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }} axisLine={false} tickLine={false} tickFormatter={v => fmtM(v)} width={55}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Legend
                    wrapperStyle={{ fontSize: 12, fontFamily: "'DM Sans', sans-serif", paddingTop: 12 }}
                    iconType="circle" iconSize={8}
                  />
                  <Bar dataKey="nrj"       name="NRJ"       stackId="a" fill="#1e3a8a" radius={[0,0,0,0]}/>
                  <Bar dataKey="abonnement" name="Abonnement" stackId="a" fill="#0891b2" radius={[0,0,0,0]}/>
                  <Bar dataKey="cosphi"    name="Cos φ"     stackId="a" fill="#7c3aed" radius={[0,0,0,0]}/>
                  <Bar dataKey="penalite"  name="Pénalité"  stackId="a" fill="#dc2626" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {/* ── Nombre de factures ────────────────────────────────────────────── */}
        <div className="btp-fade">
          <ChartCard>
            <SectionTitle icon={<Activity size={14}/>}>Nombre de factures par mois</SectionTitle>
            {isLoading ? (
              <div className="btp-skeleton" style={{ height: 160 }}/>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={40}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Line
                    type="monotone" dataKey="invoices" name="Factures"
                    stroke="#0891b2" strokeWidth={2}
                    dot={{ fill: "#0891b2", r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {/* ── Top sites ─────────────────────────────────────────────────────── */}
        <div className="btp-fade" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <ChartCard>
            <SectionTitle>Top sites · Montant HT</SectionTitle>
            {isLoading
              ? <div className="btp-skeleton" style={{ height: 200 }}/>
              : <TopTable rows={data?.top.conso_vs_montant ?? []} valueKey="montant_ht" valueLabel="HT" color="#1e3a8a"/>
            }
          </ChartCard>
          <ChartCard>
            <SectionTitle>Top sites · Pénalité</SectionTitle>
            {isLoading
              ? <div className="btp-skeleton" style={{ height: 200 }}/>
              : <TopTable rows={data?.top.pen_prime ?? []} valueKey="penalite_prime" valueLabel="Pénalité" color="#dc2626"/>
            }
          </ChartCard>
          <ChartCard>
            <SectionTitle>Top sites · Cos φ</SectionTitle>
            {isLoading
              ? <div className="btp-skeleton" style={{ height: 200 }}/>
              : <TopTable rows={data?.top.cosphi ?? []} valueKey="montant_cosphi" valueLabel="Cos φ" color="#7c3aed"/>
            }
          </ChartCard>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </>
  );
}