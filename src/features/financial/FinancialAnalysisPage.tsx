// src/features/financial/FinancialAnalysisPage.tsx

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  fetchAnalyticsFullReport,
  type AnalyticsFullReport,
  type EvolutionMonth,
  type TopSiteNOK,
  type Recommandation,
  type CauseDetail,
} from "./api";
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Target, Zap, Battery, Settings, FileWarning, HelpCircle,
  ChevronRight, ArrowUpRight, ArrowDownRight, Minus,
  Calendar, Filter, Download, RefreshCw, Loader2,
  BarChart3, PieChart, Activity, AlertCircle, Lightbulb,
  Building2, Gauge, CircleDollarSign, Percent,
} from "lucide-react";

// ─── Design Tokens ────────────────────────────────────────────────────────────
const COLORS = {
  primary: "#0f172a",
  primaryLight: "#1e3a8a",
  accent: "#3b82f6",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  dangerLight: "#fecaca",
  neutral: {
    50: "#f8fafc",
    100: "#f1f5f9",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#334155",
    800: "#1e293b",
    900: "#0f172a",
  },
  chart: {
    blue: "#3b82f6",
    indigo: "#6366f1",
    purple: "#8b5cf6",
    pink: "#ec4899",
    red: "#ef4444",
    orange: "#f97316",
    amber: "#f59e0b",
    emerald: "#10b981",
    teal: "#14b8a6",
    cyan: "#06b6d4",
  },
};

const MONTHS_SHORT = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Août", "Sep", "Oct", "Nov", "Déc"];
const MONTHS_FULL = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(v: string | null | undefined, opts?: { suffix?: string; compact?: boolean }): string {
  if (!v || v === "0.000" || v === "0") return "—";
  const n = parseFloat(v);
  if (isNaN(n)) return "—";
  const suffix = opts?.suffix ?? " FCFA";
  if (opts?.compact) {
    if (Math.abs(n) >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(".", ",") + " Md" + suffix;
    if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".", ",") + " M" + suffix;
    if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + " k" + suffix;
  }
  return n.toLocaleString("fr-FR") + suffix;
}

function fmtPct(v: number | undefined): string {
  if (v === undefined || isNaN(v)) return "—";
  return v.toFixed(1).replace(".", ",") + "%";
}

function cn(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

// ─── Components ───────────────────────────────────────────────────────────────

// Period selector
function PeriodSelector({
  year, monthStart, monthEnd,
  onYearChange, onMonthStartChange, onMonthEndChange,
}: {
  year: number;
  monthStart: number;
  monthEnd: number;
  onYearChange: (y: number) => void;
  onMonthStartChange: (m: number) => void;
  onMonthEndChange: (m: number) => void;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "6px 12px", borderRadius: 12,
      background: "white", border: "1px solid rgba(0,0,0,0.08)",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}>
      <Calendar size={14} color={COLORS.neutral[400]} />
      
      <select
        value={year}
        onChange={e => onYearChange(Number(e.target.value))}
        style={{
          border: "none", background: "transparent", outline: "none",
          fontSize: 13, fontWeight: 600, color: COLORS.primary,
          cursor: "pointer", padding: "2px 4px",
        }}
      >
        {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
      </select>

      <span style={{ color: COLORS.neutral[300], fontSize: 13 }}>|</span>

      <select
        value={monthStart}
        onChange={e => {
          const m = Number(e.target.value);
          onMonthStartChange(m);
          if (m > monthEnd) onMonthEndChange(m);
        }}
        style={{
          border: "none", background: "transparent", outline: "none",
          fontSize: 13, fontWeight: 500, color: COLORS.neutral[600],
          cursor: "pointer", padding: "2px 4px",
        }}
      >
        {MONTHS_SHORT.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
      </select>

      <span style={{ color: COLORS.neutral[400], fontSize: 12 }}>→</span>

      <select
        value={monthEnd}
        onChange={e => onMonthEndChange(Number(e.target.value))}
        style={{
          border: "none", background: "transparent", outline: "none",
          fontSize: 13, fontWeight: 500, color: COLORS.neutral[600],
          cursor: "pointer", padding: "2px 4px",
        }}
      >
        {MONTHS_SHORT.map((m, i) => (
          <option key={i} value={i + 1} disabled={i + 1 < monthStart}>{m}</option>
        ))}
      </select>
    </div>
  );
}

// Stat card
function StatCard({
  label, value, subValue, icon, trend, color = "blue",
  onClick,
}: {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  trend?: { value: number; label?: string };
  color?: "blue" | "green" | "red" | "orange" | "purple";
  onClick?: () => void;
}) {
  const colorMap = {
    blue:   { bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.15)", text: "#3b82f6" },
    green:  { bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.15)", text: "#10b981" },
    red:    { bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.15)",  text: "#ef4444" },
    orange: { bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.15)", text: "#f97316" },
    purple: { bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.15)", text: "#8b5cf6" },
  };
  const c = colorMap[color];

  return (
    <div
      onClick={onClick}
      style={{
        background: "white",
        borderRadius: 16,
        padding: "20px 22px",
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02)",
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.2s ease",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={e => {
        if (onClick) {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.04)";
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02)";
      }}
    >
      {/* Icon */}
      <div style={{
        width: 42, height: 42, borderRadius: 12,
        background: c.bg, border: `1px solid ${c.border}`,
        display: "grid", placeItems: "center",
        marginBottom: 14, color: c.text,
      }}>
        {icon}
      </div>

      {/* Value */}
      <div style={{
        fontSize: 26, fontWeight: 800, color: COLORS.primary,
        letterSpacing: "-0.02em", marginBottom: 4,
        fontFamily: "'Inter', sans-serif",
      }}>
        {value}
      </div>

      {/* Label */}
      <div style={{
        fontSize: 13, fontWeight: 500, color: COLORS.neutral[500],
        marginBottom: subValue ? 6 : 0,
      }}>
        {label}
      </div>

      {/* Sub value */}
      {subValue && (
        <div style={{ fontSize: 12, color: COLORS.neutral[400] }}>
          {subValue}
        </div>
      )}

      {/* Trend badge */}
      {trend && (
        <div style={{
          position: "absolute", top: 16, right: 16,
          display: "flex", alignItems: "center", gap: 3,
          padding: "4px 8px", borderRadius: 6,
          background: trend.value >= 0 ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
          fontSize: 11, fontWeight: 600,
          color: trend.value >= 0 ? COLORS.success : COLORS.danger,
        }}>
          {trend.value >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {Math.abs(trend.value).toFixed(1)}%
        </div>
      )}
    </div>
  );
}

// Cause breakdown card
function CauseCard({
  title, icon, data, color, totalEcart,
}: {
  title: string;
  icon: React.ReactNode;
  data: CauseDetail;
  color: string;
  totalEcart: number;
}) {
  const pct = data.pct_ecart || 0;
  
  return (
    <div style={{
      background: "white",
      borderRadius: 14,
      padding: "16px 18px",
      border: "1px solid rgba(0,0,0,0.06)",
      display: "flex", alignItems: "center", gap: 14,
    }}>
      {/* Icon */}
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: `${color}12`,
        display: "grid", placeItems: "center",
        color: color, flexShrink: 0,
      }}>
        {icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: COLORS.primary,
          marginBottom: 2,
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 12, color: COLORS.neutral[500],
        }}>
          {data.sites_count} site{data.sites_count > 1 ? "s" : ""} · {fmt(data.contribution_ecart, { compact: true })}
        </div>
      </div>

      {/* Percentage */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "flex-end",
      }}>
        <div style={{
          fontSize: 18, fontWeight: 700, color: color,
        }}>
          {pct.toFixed(0)}%
        </div>
        <div style={{
          width: 60, height: 4, borderRadius: 2,
          background: COLORS.neutral[100], marginTop: 4,
          overflow: "hidden",
        }}>
          <div style={{
            width: `${Math.min(pct, 100)}%`, height: "100%",
            background: color, borderRadius: 2,
            transition: "width 0.5s ease",
          }} />
        </div>
      </div>
    </div>
  );
}

// Mini bar chart
function EvolutionChart({ data }: { data: EvolutionMonth[] }) {
  if (!data.length) return null;

  const maxMarge = Math.max(...data.map(d => Math.abs(parseFloat(d.total_marge) || 0)));
  const maxNok = Math.max(...data.map(d => d.count_nok || 0));

  return (
    <div style={{
      display: "flex", gap: 6, alignItems: "flex-end",
      height: 120, padding: "0 4px",
    }}>
      {data.map((d, i) => {
        const marge = parseFloat(d.total_marge) || 0;
        const h = maxMarge ? (Math.abs(marge) / maxMarge) * 100 : 0;
        const isPositive = marge >= 0;

        return (
          <div
            key={i}
            style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", gap: 4,
            }}
          >
            {/* Bar */}
            <div style={{
              width: "100%", maxWidth: 32,
              height: Math.max(h, 4),
              borderRadius: "4px 4px 0 0",
              background: isPositive
                ? `linear-gradient(180deg, ${COLORS.success}, ${COLORS.success}cc)`
                : `linear-gradient(180deg, ${COLORS.danger}, ${COLORS.danger}cc)`,
              transition: "height 0.4s ease",
              position: "relative",
            }}>
              {/* NOK count badge */}
              {d.count_nok > 0 && (
                <div style={{
                  position: "absolute", top: -18, left: "50%",
                  transform: "translateX(-50%)",
                  fontSize: 9, fontWeight: 700, color: COLORS.danger,
                  background: COLORS.dangerLight,
                  padding: "1px 4px", borderRadius: 4,
                }}>
                  {d.count_nok}
                </div>
              )}
            </div>

            {/* Label */}
            <span style={{
              fontSize: 10, color: COLORS.neutral[400],
              fontWeight: 500,
            }}>
              {MONTHS_SHORT[d.month - 1]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Donut chart for distribution
function DonutChart({
  data,
  size = 180,
  thickness = 28,
}: {
  data: Array<{ label: string; value: number; color: string }>;
  size?: number;
  thickness?: number;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentAngle = 0;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {data.map((d, i) => {
          const percentage = total > 0 ? d.value / total : 0;
          const strokeLength = percentage * circumference;
          const strokeOffset = currentAngle * circumference;
          currentAngle += percentage;

          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={d.color}
              strokeWidth={thickness}
              strokeDasharray={`${strokeLength} ${circumference}`}
              strokeDashoffset={-strokeOffset}
              style={{ transition: "stroke-dasharray 0.5s ease" }}
            />
          );
        })}
      </svg>

      {/* Center text */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          fontSize: 22, fontWeight: 800, color: COLORS.primary,
        }}>
          {fmt(String(total), { compact: true, suffix: "" })}
        </div>
        <div style={{ fontSize: 11, color: COLORS.neutral[400] }}>
          Total HT
        </div>
      </div>
    </div>
  );
}

// Recommandation card
function RecommandationCard({ rec }: { rec: Recommandation }) {
  const prioriteStyles = {
    CRITIQUE: { bg: "#fef2f2", border: "#fecaca", text: "#dc2626", icon: "🚨" },
    HAUTE:    { bg: "#fff7ed", border: "#fed7aa", text: "#ea580c", icon: "⚠️" },
    MOYENNE:  { bg: "#fefce8", border: "#fef08a", text: "#ca8a04", icon: "💡" },
    BASSE:    { bg: "#f0fdf4", border: "#bbf7d0", text: "#16a34a", icon: "ℹ️" },
  };
  const style = prioriteStyles[rec.priorite] || prioriteStyles.MOYENNE;

  return (
    <div style={{
      background: style.bg,
      borderRadius: 14,
      border: `1px solid ${style.border}`,
      padding: "16px 18px",
      transition: "transform 0.2s ease",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span style={{ fontSize: 20 }}>{style.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 6,
          }}>
            <span style={{
              fontSize: 10, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.05em", color: style.text,
              background: "white", padding: "2px 8px", borderRadius: 4,
            }}>
              {rec.priorite}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 600, color: COLORS.neutral[500],
              textTransform: "uppercase", letterSpacing: "0.03em",
            }}>
              {rec.categorie}
            </span>
          </div>
          
          <h4 style={{
            fontSize: 14, fontWeight: 700, color: COLORS.primary,
            margin: "0 0 6px",
          }}>
            {rec.titre}
          </h4>
          
          <p style={{
            fontSize: 12.5, color: COLORS.neutral[600],
            margin: "0 0 10px", lineHeight: 1.5,
          }}>
            {rec.description}
          </p>

          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            fontSize: 12, color: COLORS.neutral[500],
          }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Target size={12} />
              {rec.action}
            </span>
            {rec.impact_potentiel !== "—" && (
              <span style={{
                fontWeight: 600, color: style.text,
              }}>
                Impact: {fmt(rec.impact_potentiel, { compact: true })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Top sites table
function TopSitesTable({ sites }: { sites: TopSiteNOK[] }) {
  return (
    <div style={{
      borderRadius: 14, border: "1px solid rgba(0,0,0,0.06)",
      overflow: "hidden", background: "white",
    }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: COLORS.neutral[50] }}>
            {["#", "Site", "Marge totale", "Mois NOK", "Cosphi", "Pénalité PS"].map((h, i) => (
              <th
                key={i}
                style={{
                  padding: "12px 14px",
                  textAlign: i === 0 ? "center" : "left",
                  fontSize: 11, fontWeight: 600,
                  color: COLORS.neutral[500],
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                  borderBottom: `1px solid ${COLORS.neutral[100]}`,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sites.slice(0, 10).map((site, i) => (
            <tr
              key={site.site_id}
              style={{
                borderBottom: `1px solid ${COLORS.neutral[100]}`,
                transition: "background 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = COLORS.neutral[50]}
              onMouseLeave={e => e.currentTarget.style.background = "white"}
            >
              <td style={{
                padding: "12px 14px", textAlign: "center",
                fontSize: 12, fontWeight: 700, color: COLORS.neutral[400],
              }}>
                {i + 1}
              </td>
              <td style={{ padding: "12px 14px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.primary }}>
                  {site.site_id}
                </div>
                <div style={{
                  fontSize: 11, color: COLORS.neutral[400],
                  maxWidth: 180, overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {site.site_name}
                </div>
              </td>
              <td style={{
                padding: "12px 14px",
                fontSize: 13, fontWeight: 700, color: COLORS.danger,
              }}>
                {fmt(site.marge_totale, { compact: true })}
              </td>
              <td style={{ padding: "12px 14px" }}>
                <span style={{
                  padding: "3px 8px", borderRadius: 6,
                  background: COLORS.dangerLight,
                  fontSize: 12, fontWeight: 600, color: COLORS.danger,
                }}>
                  {site.nb_mois_nok} mois
                </span>
              </td>
              <td style={{
                padding: "12px 14px",
                fontSize: 12, color: parseFloat(site.montant_cosphi) > 0 ? COLORS.warning : COLORS.neutral[400],
                fontWeight: parseFloat(site.montant_cosphi) > 0 ? 600 : 400,
              }}>
                {parseFloat(site.montant_cosphi) > 0 ? fmt(site.montant_cosphi, { compact: true }) : "—"}
              </td>
              <td style={{
                padding: "12px 14px",
                fontSize: 12, color: parseFloat(site.montant_penalite) > 0 ? COLORS.warning : COLORS.neutral[400],
                fontWeight: parseFloat(site.montant_penalite) > 0 ? 600 : 400,
              }}>
                {parseFloat(site.montant_penalite) > 0 ? fmt(site.montant_penalite, { compact: true }) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FinancialAnalysisPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [monthStart, setMonthStart] = useState(1);
  const [monthEnd, setMonthEnd] = useState(new Date().getMonth() + 1);

  const [data, setData] = useState<AnalyticsFullReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const report = await fetchAnalyticsFullReport({
        year, month_start: monthStart, month_end: monthEnd,
      });
      setData(report);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  }, [year, monthStart, monthEnd]);

  useEffect(() => { loadData(); }, [loadData]);

  const summary = data?.summary;
  const decomp = data?.decomposition;
  const evolution = data?.evolution || [];
  const topSites = data?.top_sites || [];
  const impact = data?.impact;
  const recs = data?.recommandations || [];

  // Calculate distribution data for donut
  const distributionData = useMemo(() => {
    if (!impact) return [];
    return impact.facteurs.map(f => ({
      label: f.label,
      value: parseFloat(f.montant) || 0,
      color: f.color,
    }));
  }, [impact]);

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>

      {/* ─── Header ───────────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 16, marginBottom: 28,
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: `linear-gradient(135deg, ${COLORS.primaryLight}, ${COLORS.accent})`,
              display: "grid", placeItems: "center",
              boxShadow: "0 4px 16px rgba(59,130,246,0.25)",
            }}>
              <Activity size={22} color="white" />
            </div>
            <div>
              <h1 style={{
                fontSize: 24, fontWeight: 800, color: COLORS.primary,
                letterSpacing: "-0.02em", margin: 0,
              }}>
                Analyse des Marges
              </h1>
              <p style={{
                fontSize: 14, color: COLORS.neutral[500], margin: 0,
              }}>
                Diagnostic approfondi • Causes • Recommandations
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <PeriodSelector
            year={year}
            monthStart={monthStart}
            monthEnd={monthEnd}
            onYearChange={setYear}
            onMonthStartChange={setMonthStart}
            onMonthEndChange={setMonthEnd}
          />

          <button
            onClick={loadData}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 10,
              border: "none", cursor: loading ? "not-allowed" : "pointer",
              background: loading ? COLORS.neutral[200] : `linear-gradient(135deg, ${COLORS.primaryLight}, ${COLORS.accent})`,
              color: "white", fontSize: 13, fontWeight: 600,
              boxShadow: "0 2px 8px rgba(59,130,246,0.2)",
              transition: "all 0.2s ease",
            }}
          >
            {loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={14} />}
            {loading ? "Chargement…" : "Actualiser"}
          </button>
        </div>
      </div>

      {/* ─── Loading state ────────────────────────────────────────────────────── */}
      {loading && !data && (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: "80px 20px",
        }}>
          <Loader2 size={40} color={COLORS.accent} style={{ animation: "spin 1s linear infinite", marginBottom: 16 }} />
          <p style={{ fontSize: 14, color: COLORS.neutral[500] }}>Chargement de l'analyse…</p>
        </div>
      )}

      {/* ─── Error state ──────────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          padding: "20px 24px", borderRadius: 14,
          background: "#fef2f2", border: "1px solid #fecaca",
          display: "flex", alignItems: "center", gap: 12,
          marginBottom: 24,
        }}>
          <AlertCircle size={20} color={COLORS.danger} />
          <span style={{ fontSize: 14, color: COLORS.danger, fontWeight: 500 }}>{error}</span>
        </div>
      )}

      {/* ─── Main content ─────────────────────────────────────────────────────── */}
      {data && !loading && (
        <div style={{ animation: "fadeIn 0.3s ease" }}>
          {/* KPI Cards */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16, marginBottom: 28,
          }}>
            <StatCard
              label="Marge Globale"
              value={fmt(summary?.total_marge, { compact: true })}
              subValue={`Moy: ${fmt(summary?.avg_marge, { compact: true })}`}
              icon={<CircleDollarSign size={20} />}
              color={parseFloat(summary?.total_marge || "0") >= 0 ? "green" : "red"}
            />
            <StatCard
              label="Sites NOK"
              value={String(summary?.count_nok || 0)}
              subValue={`${fmtPct(summary?.taux_nok_pct)} du total`}
              icon={<AlertTriangle size={20} />}
              color="red"
            />
            <StatCard
              label="Écart négatif total"
              value={fmt(summary?.marge_negative_totale, { compact: true })}
              icon={<TrendingDown size={20} />}
              color="red"
            />
            <StatCard
              label="Récurrence critique"
              value={String(summary?.count_critique || 0)}
              subValue={`+ ${summary?.count_light || 0} light`}
              icon={<AlertCircle size={20} />}
              color="orange"
            />
          </div>

          {/* Grid layout */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 20,
          }}>
            {/* Left column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Causes breakdown */}
              <div style={{
                background: "white", borderRadius: 18, padding: 24,
                border: "1px solid rgba(0,0,0,0.06)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  marginBottom: 20,
                }}>
                  <h3 style={{
                    fontSize: 16, fontWeight: 700, color: COLORS.primary, margin: 0,
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <PieChart size={18} color={COLORS.accent} />
                    Décomposition des écarts NOK
                  </h3>
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: COLORS.neutral[400],
                  }}>
                    Total: {fmt(decomp?.total_ecart_negatif, { compact: true })}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {decomp?.causes && (
                    <>
                      <CauseCard
                        title="Pénalité Cos φ"
                        icon={<Gauge size={18} />}
                        data={decomp.causes.cosphi}
                        color={COLORS.danger}
                        totalEcart={parseFloat(decomp.total_ecart_negatif)}
                      />
                      <CauseCard
                        title="Dépassement puissance"
                        icon={<Zap size={18} />}
                        data={decomp.causes.depassement_puissance}
                        color={COLORS.warning}
                        totalEcart={parseFloat(decomp.total_ecart_negatif)}
                      />
                      <CauseCard
                        title="Hors catalogue"
                        icon={<FileWarning size={18} />}
                        data={decomp.causes.hors_catalogue}
                        color={COLORS.chart.purple}
                        totalEcart={parseFloat(decomp.total_ecart_negatif)}
                      />
                      <CauseCard
                        title="Load manquant"
                        icon={<HelpCircle size={18} />}
                        data={decomp.causes.load_manquant}
                        color={COLORS.neutral[500]}
                        totalEcart={parseFloat(decomp.total_ecart_negatif)}
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Distribution HT */}
              <div style={{
                background: "white", borderRadius: 18, padding: 24,
                border: "1px solid rgba(0,0,0,0.06)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}>
                <h3 style={{
                  fontSize: 16, fontWeight: 700, color: COLORS.primary, margin: "0 0 20px",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <BarChart3 size={18} color={COLORS.accent} />
                  Répartition du montant HT
                </h3>

                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-around",
                }}>
                  <DonutChart data={distributionData} />

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {impact?.facteurs.map(f => (
                      <div key={f.key} style={{
                        display: "flex", alignItems: "center", gap: 10,
                      }}>
                        <div style={{
                          width: 12, height: 12, borderRadius: 3,
                          background: f.color,
                        }} />
                        <span style={{ fontSize: 12, color: COLORS.neutral[600], minWidth: 100 }}>
                          {f.label}
                        </span>
                        <span style={{
                          fontSize: 12, fontWeight: 600, color: COLORS.primary,
                        }}>
                          {fmtPct(f.pct)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Evolution chart */}
              <div style={{
                background: "white", borderRadius: 18, padding: 24,
                border: "1px solid rgba(0,0,0,0.06)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}>
                <h3 style={{
                  fontSize: 16, fontWeight: 700, color: COLORS.primary, margin: "0 0 20px",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <Activity size={18} color={COLORS.accent} />
                  Évolution mensuelle
                </h3>

                <EvolutionChart data={evolution} />

                <div style={{
                  display: "flex", justifyContent: "center", gap: 16, marginTop: 16,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 12, height: 4, borderRadius: 2, background: COLORS.success }} />
                    <span style={{ fontSize: 11, color: COLORS.neutral[500] }}>Marge positive</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 12, height: 4, borderRadius: 2, background: COLORS.danger }} />
                    <span style={{ fontSize: 11, color: COLORS.neutral[500] }}>Marge négative</span>
                  </div>
                </div>
              </div>

              {/* Top sites */}
              <div style={{
                background: "white", borderRadius: 18, padding: 24,
                border: "1px solid rgba(0,0,0,0.06)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}>
                <h3 style={{
                  fontSize: 16, fontWeight: 700, color: COLORS.primary, margin: "0 0 16px",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <Building2 size={18} color={COLORS.accent} />
                  Top 10 sites NOK
                </h3>

                <TopSitesTable sites={topSites} />
              </div>
            </div>
          </div>

          {/* Recommandations */}
          <div style={{
            marginTop: 24, background: "white", borderRadius: 18, padding: 24,
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}>
            <h3 style={{
              fontSize: 16, fontWeight: 700, color: COLORS.primary, margin: "0 0 20px",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <Lightbulb size={18} color={COLORS.warning} />
              Recommandations d'action
            </h3>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
              gap: 14,
            }}>
              {recs.map((rec, i) => (
                <RecommandationCard key={i} rec={rec} />
              ))}
            </div>

            {recs.length === 0 && (
              <div style={{
                padding: "32px 20px", textAlign: "center",
                color: COLORS.neutral[400],
              }}>
                <CheckCircle2 size={32} style={{ marginBottom: 8 }} />
                <p style={{ margin: 0, fontSize: 14 }}>
                  Aucune recommandation — les marges sont globalement saines.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}