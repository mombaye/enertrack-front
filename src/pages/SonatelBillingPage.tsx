// src/features/sonatelBilling/SonatelBillingPage.tsx
import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  UploadCloud, RefreshCw, FileSpreadsheet, AlertTriangle,
  ChevronLeft, ChevronRight, TrendingUp, Zap, DollarSign,
  BarChart3, Filter, Search, Calendar, ShieldAlert,Download
} from "lucide-react";

import { DataTable, Col } from "@/components/DataTable";
import { StatusPill, money, num } from "@/features/sonatelBilling/ui";
import { useAuth } from "@/auth/AuthContext";

import {
  listInvoices, listMonthly, listContractMonths,
  SonatelInvoice, MonthlySynthesis, ContractMonth,
} from "@/features/sonatelBilling/api";
import { getBatchIssues, importInvoices, listBatches, ImportIssue } from "@/features/sonatelBilling/admin/importApi";
import { SeverityPill } from "@/features/sonatelBilling/admin/ui";
import SonatelBillingStatsTab from "@/features/sonatelBilling/SonatelBillingStatsTab";
import { exportImpactedSitesToExcel } from "@/utils/exportImpactedSites";


// ─── API call for impacted sites ──────────────────────────────────────────────

// Remplacer l'import apiClient + la fonction fetchImpactedSites inline par :
import { fetchImpactedSites, ImpactedSitesResponse, ImpactedMonth, ImpactedSiteRow } from "@/services/sonatelBilling";

interface ImpactedSiteSummary {
  total_cosphi: string;
  total_penalty: string;
  sites_cosphi_count: number;
  sites_penalty_count: number;
}






type Tab = "INVOICES" | "MONTHLY" | "CONTRACT" | "IMPORT" | "STATS" | "PENALITES";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function defaultRange() {
  const now = new Date();
  return { start: fmtDate(new Date(now.getFullYear(), 0, 1)), end: fmtDate(now) };
}

// ─── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon, accent }: {
  label: string; value: string; icon: React.ReactNode; accent?: string;
}) {
  return (
    <div style={{
      background: "white",
      borderRadius: 16,
      padding: "18px 20px",
      border: "1px solid rgba(30,58,138,.08)",
      boxShadow: "0 1px 3px rgba(30,58,138,.04), 0 8px 24px rgba(30,58,138,.05)",
      display: "flex", flexDirection: "column", gap: 10,
      transition: "box-shadow .2s, transform .2s",
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(30,58,138,.1)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)"; }}
    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 3px rgba(30,58,138,.04), 0 8px 24px rgba(30,58,138,.05)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", letterSpacing: ".04em", textTransform: "uppercase" }}>{label}</span>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: accent ? `${accent}15` : "rgba(30,58,138,.07)",
          display: "grid", placeItems: "center",
          color: accent || "#1e3a8a",
        }}>{icon}</div>
      </div>
      <div style={{
        fontFamily: "'Outfit',sans-serif",
        fontSize: 20, fontWeight: 800,
        color: "#0f172a", letterSpacing: "-.02em",
      }}>{value}</div>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────
function Pagination({ page, total, pageSize, onPage }: {
  page: number; total: number; pageSize: number; onPage: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      marginTop: 16, padding: "12px 16px",
      background: "white", borderRadius: 12,
      border: "1px solid rgba(30,58,138,.07)",
    }}>
      <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>
        Page <strong>{page}</strong> / {totalPages} &nbsp;·&nbsp; <strong>{total.toLocaleString("fr-FR")}</strong> résultats
      </span>
      <div style={{ display: "flex", gap: 6 }}>
        {[
          { label: <ChevronLeft size={14}/>, disabled: page <= 1, fn: () => onPage(page - 1) },
          { label: <ChevronRight size={14}/>, disabled: page >= totalPages, fn: () => onPage(page + 1) },
        ].map(({ label, disabled, fn }, i) => (
          <button key={i} disabled={disabled} onClick={fn} style={{
            width: 32, height: 32, borderRadius: 8,
            display: "grid", placeItems: "center",
            border: "1px solid rgba(30,58,138,.12)",
            background: "white", cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? .4 : 1,
            color: "#1e3a8a",
            transition: "background .15s",
          }}
          onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = "#f0f4ff"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "white"; }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Stat mini ────────────────────────────────────────────────────────────────
function StatMini({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      background: "#f8faff", borderRadius: 12, padding: "12px 14px",
      border: "1px solid rgba(30,58,138,.08)",
    }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div>
      <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 18, fontWeight: 800, color: "#1e3a8a", marginTop: 4 }}>{value}</div>
    </div>
  );
}

// ─── Tab button ───────────────────────────────────────────────────────────────
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 16px", borderRadius: 10,
      border: active ? "1px solid #1e3a8a" : "1px solid rgba(30,58,138,.12)",
      background: active ? "#1e3a8a" : "white",
      color: active ? "white" : "#475569",
      fontFamily: "'DM Sans',sans-serif",
      fontSize: 13, fontWeight: 600,
      cursor: "pointer",
      transition: "all .18s",
      display: "flex", alignItems: "center", gap: 6,
      boxShadow: active ? "0 4px 12px rgba(30,58,138,.2)" : "none",
      whiteSpace: "nowrap",
    }}
    onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.background = "#f0f4ff"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(30,58,138,.25)"; }}}
    onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.background = "white"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(30,58,138,.12)"; }}}
    >
      {children}
    </button>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "white", borderRadius: 12,
      border: "1px solid rgba(30,58,138,.1)",
      padding: "10px 14px",
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", background: "#f8faff",
  border: "1.5px solid #dde5ff",
  borderRadius: 8, padding: "8px 12px",
  fontSize: 13, color: "#1e3a8a",
  fontFamily: "'DM Sans',sans-serif",
  outline: "none",
};

// ─── Pct bar mini ─────────────────────────────────────────────────────────────
function PctBar({ value, color }: { value: number; color: string }) {
  const capped = Math.min(Math.abs(value), 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{
        flex: 1, height: 5, background: "#f1f5f9", borderRadius: 99, overflow: "hidden",
      }}>
        <div style={{
          height: "100%", width: `${capped}%`,
          background: color, borderRadius: 99,
          transition: "width .3s ease",
        }}/>
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 36, textAlign: "right" }}>
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

// ─── Cos Phi badge ────────────────────────────────────────────────────────────
function CosPhiBadge({ value }: { value: number | null }) {
  if (value === null) return <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>;
  const isGood   = value >= 0.8 && value <= 0.95;
  const isExcel  = value > 0.95;
  const color    = isGood ? "#10b981" : isExcel ? "#3b82f6" : "#ef4444";
  const bg       = isGood ? "#f0fdf4" : isExcel ? "#eff6ff" : "#fef2f2";
  const border   = isGood ? "#bbf7d0" : isExcel ? "#bfdbfe" : "#fecaca";
  const label    = isExcel ? "Bonus" : isGood ? "OK" : "Pénalité";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12, fontWeight: 700, color,
      }}>
        {value.toFixed(2)}
      </span>
      <span style={{
        fontSize: 10, fontWeight: 700,
        background: bg, border: `1px solid ${border}`,
        color, borderRadius: 6, padding: "1px 6px",
      }}>
        {label}
      </span>
    </div>
  );
}

// ─── Penalites Tab ────────────────────────────────────────────────────────────
// ── Patch à appliquer dans SonatelBillingPage.tsx ────────────────────────────
// 1. Ajouter l'import en haut du fichier :
//    import { exportImpactedSitesToExcel } from "@/utils/exportImpactedSites";
//    import { Download } from "lucide-react";
//
// 2. Remplacer le composant PenalitesTab par celui-ci :

function PenalitesTab({ start, end }: { start: string; end: string }) {
  const [filterMode, setFilterMode] = useState<"both" | "cosphi" | "penalty">("both");
  const [minAmount, setMinAmount]   = useState("");
  const [expanded, setExpanded]     = useState<Set<string>>(new Set());
  const [exporting, setExporting]   = useState(false);

  const q = useQuery({
    queryKey: ["impacted-sites", start, end, filterMode, minAmount],
    queryFn: () => fetchImpactedSites({
      start, end,
      filter: filterMode,
      min_amount: minAmount ? Number(minAmount) : undefined,
    }),
    placeholderData: keepPreviousData,
  });

  const data = q.data;

  function toggleMonth(period: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(period) ? next.delete(period) : next.add(period);
      return next;
    });
  }

  function handleExport() {
    if (!data) return;
    setExporting(true);
    try {
      exportImpactedSitesToExcel(data);
    } finally {
      setExporting(false);
    }
  }

  const filterBtns: Array<{ key: "both" | "cosphi" | "penalty"; label: string; color: string }> = [
    { key: "both",    label: "Tous",           color: "#1e3a8a" },
    { key: "cosphi",  label: "Cos φ seul",     color: "#7c3aed" },
    { key: "penalty", label: "Pénalité seule", color: "#dc2626" },
  ];

  const hasData = data && data.by_month.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Controls bar */}
      <div style={{
        background: "#f8faff", borderRadius: 14,
        border: "1px solid rgba(30,58,138,.1)",
        padding: "14px 20px",
        display: "flex", alignItems: "center",
        justifyContent: "space-between",
        gap: 16, flexWrap: "wrap",
      }}>

        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          {/* Filter mode buttons */}
          <div style={{ display: "flex", gap: 6 }}>
            {filterBtns.map(b => (
              <button
                key={b.key}
                onClick={() => setFilterMode(b.key)}
                style={{
                  padding: "6px 14px", borderRadius: 8,
                  border: `1px solid ${filterMode === b.key ? b.color : "rgba(30,58,138,.15)"}`,
                  background: filterMode === b.key ? b.color : "white",
                  color: filterMode === b.key ? "white" : "#64748b",
                  fontSize: 12, fontWeight: 600,
                  cursor: "pointer", transition: "all .15s",
                }}
              >
                {b.label}
              </button>
            ))}
          </div>

          {/* Min amount */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>
              Montant min. (FCFA)
            </span>
            <input
              type="number"
              value={minAmount}
              onChange={e => setMinAmount(e.target.value)}
              placeholder="ex: 5000"
              style={{
                width: 130, background: "#f8faff",
                border: "1.5px solid #dde5ff", borderRadius: 8,
                padding: "7px 12px", fontSize: 13, color: "#1e3a8a",
                fontFamily: "'DM Sans',sans-serif", outline: "none",
              }}
            />
          </div>

          {q.isLoading && (
            <div style={{ fontSize: 12, color: "#94a3b8", display: "flex", alignItems: "center", gap: 6 }}>
              <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }}/>
              Chargement…
            </div>
          )}
        </div>

        {/* Export button */}
        <button
          onClick={handleExport}
          disabled={!hasData || exporting}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "9px 18px", borderRadius: 10,
            background: (!hasData || exporting) ? "#94a3b8" : "#10b981",
            color: "white", border: "none",
            fontSize: 13, fontWeight: 700,
            cursor: (!hasData || exporting) ? "not-allowed" : "pointer",
            transition: "background .18s, transform .15s",
            boxShadow: (!hasData || exporting) ? "none" : "0 4px 12px rgba(16,185,129,.25)",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
          onMouseEnter={e => {
            if (hasData && !exporting)
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
          }}
        >
          <Download size={14}/>
          {exporting ? "Export…" : "Exporter Excel"}
        </button>
      </div>

      {/* ── Summary KPIs */}
      {data && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
          {[
            { label: "Total Cos φ",          value: money(data.summary.total_cosphi),         icon: <Zap size={14}/>,           accent: "#7c3aed" },
            { label: "Total Pénalité Prime",  value: money(data.summary.total_penalty),        icon: <AlertTriangle size={14}/>,  accent: "#dc2626" },
            { label: "Sites Cos φ",           value: String(data.summary.sites_cosphi_count),  icon: <ShieldAlert size={14}/>,    accent: "#7c3aed" },
            { label: "Sites Pénalité",        value: String(data.summary.sites_penalty_count), icon: <ShieldAlert size={14}/>,    accent: "#dc2626" },
          ].map((k, i) => <KpiCard key={i} {...k} />)}
        </div>
      )}

      {/* ── Empty state */}
      {data && data.by_month.length === 0 && (
        <div style={{
          padding: "48px 24px", textAlign: "center",
          color: "#94a3b8", fontSize: 14,
          background: "white", borderRadius: 14,
          border: "1px solid rgba(30,58,138,.08)",
        }}>
          Aucun site impacté sur cette période avec les filtres sélectionnés.
        </div>
      )}

      {/* ── By month accordion */}
      {data?.by_month.map(monthData => {
        const isOpen     = expanded.has(monthData.period);
        const hasCosphi  = Number(monthData.totaux.montant_cosphi) !== 0;
        const hasPenalty = Number(monthData.totaux.penalite_prime)  !== 0;

        return (
          <div
            key={monthData.period}
            style={{
              background: "white", borderRadius: 14,
              border: "1px solid rgba(30,58,138,.09)",
              boxShadow: "0 1px 3px rgba(30,58,138,.04)",
              overflow: "hidden",
            }}
          >
            {/* Month header */}
            <button
              onClick={() => toggleMonth(monthData.period)}
              style={{
                width: "100%", background: "none", border: "none",
                padding: "14px 20px", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 12,
                borderBottom: isOpen ? "1px solid rgba(30,58,138,.08)" : "none",
                transition: "background .15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#f8faff"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 14, fontWeight: 700, color: "#1e3a8a",
                  background: "#f0f4ff",
                  border: "1px solid rgba(30,58,138,.15)",
                  borderRadius: 8, padding: "3px 10px",
                }}>
                  {monthData.period}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>
                  {monthData.totaux.sites_count} site{monthData.totaux.sites_count > 1 ? "s" : ""}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                {hasCosphi && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>Cos φ</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#7c3aed", fontFamily: "'Outfit', sans-serif" }}>
                      {money(monthData.totaux.montant_cosphi)}
                    </div>
                  </div>
                )}
                {hasPenalty && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>Pénalité</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#dc2626", fontFamily: "'Outfit', sans-serif" }}>
                      {money(monthData.totaux.penalite_prime)}
                    </div>
                  </div>
                )}
                <ChevronRight size={16} style={{
                  color: "#94a3b8",
                  transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                  transition: "transform .2s",
                  flexShrink: 0,
                }}/>
              </div>
            </button>

            {/* Sites table */}
            {isOpen && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8faff", borderBottom: "1px solid rgba(30,58,138,.07)" }}>
                      {["Site", "Contrat", "Cos φ", "Montant Cos φ", "% HT", "Pénalité Prime", "% HT", "Montant HT"].map(h => (
                        <th key={h} style={{
                          padding: "9px 14px", textAlign: "left",
                          fontSize: 10.5, fontWeight: 700, color: "#64748b",
                          textTransform: "uppercase", letterSpacing: ".07em",
                          whiteSpace: "nowrap",
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthData.sites.map((site, idx) => (
                      <tr
                        key={`${site.site_id}-${idx}`}
                        style={{ borderBottom: "1px solid rgba(30,58,138,.05)", transition: "background .12s" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "#f8faff"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = ""; }}
                      >
                        <td style={{ padding: "10px 14px", minWidth: 160 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{site.site_id}</div>
                          <div style={{ fontSize: 11, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }}>
                            {site.site_name}
                          </div>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#64748b" }}>
                            {site.numero_compte_contrat}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px", minWidth: 100 }}>
                          <CosPhiBadge value={site.valeur_cosinus_phi} />
                        </td>
                        <td style={{ padding: "10px 14px", minWidth: 130 }}>
                          <span style={{
                            fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 800,
                            color: Number(site.montant_cosphi) < 0 ? "#10b981" : Number(site.montant_cosphi) > 0 ? "#7c3aed" : "#94a3b8",
                          }}>
                            {money(site.montant_cosphi)}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px", minWidth: 120 }}>
                          <PctBar value={site.pct_cosphi_sur_ht} color="#7c3aed" />
                        </td>
                        <td style={{ padding: "10px 14px", minWidth: 130 }}>
                          <span style={{
                            fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 800,
                            color: Number(site.penalite_prime) > 0 ? "#dc2626" : "#94a3b8",
                          }}>
                            {money(site.penalite_prime)}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px", minWidth: 120 }}>
                          <PctBar value={site.pct_penalty_sur_ht} color="#dc2626" />
                        </td>
                        <td style={{ padding: "10px 14px", minWidth: 120 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>
                            {money(site.montant_hors_tva)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}



// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SonatelBillingPage() {
  const { user } = useAuth();
  const role = user?.role || "analyst";
  const isAdmin = role === "admin";
  const qc = useQueryClient();

  const [tab, setTab]         = useState<Tab>("INVOICES");
  const [search, setSearch]   = useState("");
  const [status, setStatus]   = useState("");
  const [site, setSite]       = useState("");
  const [page, setPage]       = useState(1);

  const defRange = useMemo(() => defaultRange(), []);
  const [dateStart, setDateStart] = useState(defRange.start);
  const [dateEnd,   setDateEnd]   = useState(defRange.end);

  const pageSize = 20;

  const tabs = useMemo(() => {
    const base: Array<{ key: Tab; label: string; icon: React.ReactNode }> = [
      { key: "INVOICES",  label: "Factures",           icon: <FileSpreadsheet size={13}/> },
      { key: "MONTHLY",   label: "Synthèse mensuelle", icon: <BarChart3 size={13}/> },
      { key: "CONTRACT",  label: "Contrat × Mois",     icon: <TrendingUp size={13}/> },
      { key: "STATS",     label: "Statistiques",       icon: <Zap size={13}/> },
      { key: "PENALITES", label: "Pénalités & Cos φ",  icon: <ShieldAlert size={13}/> },
    ];
    if (isAdmin) base.push({ key: "IMPORT", label: "Import", icon: <UploadCloud size={13}/> });
    return base;
  }, [isAdmin]);

  // ── Queries
  const invoicesQ = useQuery({
    enabled: tab === "INVOICES",
    queryKey: ["sb-invoices", { page, search, status, site, dateStart, dateEnd }],
    queryFn: () => listInvoices({ page, page_size: pageSize, search, status, site, start: dateStart, end: dateEnd }),
    placeholderData: keepPreviousData,
  });
  const monthlyQ = useQuery({
    enabled: tab === "MONTHLY",
    queryKey: ["sb-monthly", { page, status, site, search, dateStart, dateEnd }],
    queryFn: () => listMonthly({ page, page_size: pageSize, status: status||undefined, site: site||undefined, account: search||undefined, start: dateStart, end: dateEnd }),
    placeholderData: keepPreviousData,
  });
  const contractQ = useQuery({
    enabled: tab === "CONTRACT",
    queryKey: ["sb-contract-months", { page, status, site, search, dateStart, dateEnd }],
    queryFn: () => listContractMonths({ page, page_size: pageSize, status: status||undefined, site: site||undefined, account: search||undefined, start: dateStart, end: dateEnd }),
    placeholderData: keepPreviousData,
  });

  // ── Columns
  const invoiceCols: Col<SonatelInvoice>[] = useMemo(() => [
    { key:"site",   title:"Site",     render:(r) => <div style={{minWidth:160}}><div style={{fontWeight:600,fontSize:13}}>{(r as any)?.site?.site_id||(r as any)?.site_id||"—"}</div><div style={{fontSize:11,color:"#94a3b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:140}}>{(r as any)?.site?.name||(r as any)?.site_name||""}</div></div> },
    { key:"contract",title:"Contrat", render:(r) => <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12}}>{r.numero_compte_contrat}</span> },
    { key:"fact",   title:"Facture",  render:(r) => <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12}}>{r.numero_facture}</span> },
    { key:"period", title:"Période",  render:(r) => <div style={{fontSize:12,whiteSpace:"nowrap"}}><div>{r.date_debut_periode||"—"}</div><div style={{color:"#94a3b8"}}>→ {r.date_fin_periode||"—"}</div></div> },
    { key:"echeance",title:"Échéance",render:(r) => <span style={{fontSize:12,whiteSpace:"nowrap"}}>{(r as any)?.echeance||"—"}</span> },
    { key:"ht",     title:"HT",       render:(r) => <span style={{whiteSpace:"nowrap",fontSize:13,fontWeight:600}}>{money((r as any)?.montant_hors_tva)}</span> },
    { key:"ttc",    title:"TTC",      render:(r) => <span style={{whiteSpace:"nowrap",fontSize:13,fontWeight:700,color:"#1e3a8a"}}>{money((r as any)?.montant_ttc)}</span> },
    { key:"cosinus",title:"Cos φ",    render:(r) => <span style={{whiteSpace:"nowrap",fontSize:12}}>{money((r as any)?.montant_cosinus_phi)}</span> },
    { key:"abo",    title:"Abo.",      render:(r) => <span style={{whiteSpace:"nowrap",fontSize:12}}>{money((r as any)?.abonnement_calcule)}</span> },
    { key:"pen",    title:"PenPrime", render:(r) => <span style={{whiteSpace:"nowrap",fontSize:12}}>{money((r as any)?.penalite_abonnement_calculee)}</span> },
    { key:"nrj",    title:"NRJ",      render:(r) => <span style={{whiteSpace:"nowrap",fontSize:12}}>{money((r as any)?.energie_calculee)}</span> },
    { key:"status", title:"Statut",   render:(r) => <StatusPill v={(r as any)?.status} /> },
  ], []);

  const monthlyCols: Col<MonthlySynthesis>[] = useMemo(() => [
    { key:"site",   title:"Site",     render:(r) => <div style={{minWidth:160}}><div style={{fontWeight:600,fontSize:13}}>{(r as any).site_id||"—"}</div><div style={{fontSize:11,color:"#94a3b8",maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{(r as any).site_name||""}</div></div> },
    { key:"contract",title:"Contrat", render:(r) => <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12}}>{r.numero_compte_contrat}</span> },
    { key:"fact",   title:"Facture",  render:(r) => <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12}}>{r.numero_facture}</span> },
    { key:"ym",     title:"Mois",     render:(r) => <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:600}}>{`${r.year}-${String(r.month).padStart(2,"0")}`}</span> },
    { key:"conso",  title:"Conso",    render:(r) => <span style={{whiteSpace:"nowrap",fontSize:12}}>{num((r as any).conso)}</span> },
    { key:"ht",     title:"HT",       render:(r) => <span style={{whiteSpace:"nowrap",fontSize:13,fontWeight:600}}>{money((r as any).montant_hors_tva)}</span> },
    { key:"ttc",    title:"TTC",      render:(r) => <span style={{whiteSpace:"nowrap",fontSize:13,fontWeight:700,color:"#1e3a8a"}}>{money((r as any).montant_ttc)}</span> },
    { key:"abo",    title:"Abo.",      render:(r) => <span style={{whiteSpace:"nowrap",fontSize:12}}>{money((r as any).abonnement_calcule)}</span> },
    { key:"pen",    title:"PenPrime", render:(r) => <span style={{whiteSpace:"nowrap",fontSize:12}}>{money((r as any).penalite_abonnement_calculee)}</span> },
    { key:"nrj",    title:"NRJ",      render:(r) => <span style={{whiteSpace:"nowrap",fontSize:12}}>{money((r as any).energie_calculee)}</span> },
    { key:"status", title:"Statut",   render:(r) => <StatusPill v={(r as any).status} /> },
  ], []);

  const contractCols: Col<ContractMonth>[] = useMemo(() => [
    { key:"site",   title:"Site",      render:(r) => <div style={{minWidth:160}}><div style={{fontWeight:600,fontSize:13}}>{(r as any).site_id||"—"}</div><div style={{fontSize:11,color:"#94a3b8",maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{(r as any).site_name||""}</div></div> },
    { key:"contract",title:"Contrat",  render:(r) => <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12}}>{r.numero_compte_contrat}</span> },
    { key:"ym",     title:"Mois",      render:(r) => <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:600}}>{`${r.year}-${String(r.month).padStart(2,"0")}`}</span> },
    { key:"count",  title:"# Factures",render:(r) => <span style={{fontWeight:700,color:"#1e3a8a"}}>{(r as any).invoices_count}</span> },
    { key:"conso",  title:"Conso",     render:(r) => <span style={{whiteSpace:"nowrap",fontSize:12}}>{num((r as any).conso)}</span> },
    { key:"ht",     title:"HT",        render:(r) => <span style={{whiteSpace:"nowrap",fontSize:13,fontWeight:600}}>{money((r as any).montant_hors_tva)}</span> },
    { key:"ttc",    title:"TTC",       render:(r) => <span style={{whiteSpace:"nowrap",fontSize:13,fontWeight:700,color:"#1e3a8a"}}>{money((r as any).montant_ttc)}</span> },
    { key:"abo",    title:"Abo.",       render:(r) => <span style={{whiteSpace:"nowrap",fontSize:12}}>{money((r as any).abonnement_calcule)}</span> },
    { key:"pen",    title:"PenPrime",  render:(r) => <span style={{whiteSpace:"nowrap",fontSize:12}}>{money((r as any).penalite_abonnement_calculee)}</span> },
    { key:"nrj",    title:"NRJ",       render:(r) => <span style={{whiteSpace:"nowrap",fontSize:12}}>{money((r as any).energie_calculee)}</span> },
  ], []);

  const active = tab === "INVOICES" ? invoicesQ : tab === "MONTHLY" ? monthlyQ : tab === "CONTRACT" ? contractQ : null;
  const rows = ((active?.data as any)?.results ?? []) as any[];
  const total = (active?.data as any)?.count ?? 0;

  const kpi = useMemo(() => {
    const s = (k: string) => rows.reduce((a, r) => a + (Number(r?.[k] ?? 0) || 0), 0);
    return { ttc: s("montant_ttc"), ht: s("montant_hors_tva"), nrj: s("energie_calculee"), abo: s("abonnement_calcule"), pen: s("penalite_abonnement_calculee") };
  }, [rows]);

  function go(t: Tab) { setTab(t); setPage(1); }

  // ── Import
  const [file, setFile]               = useState<File | null>(null);
  const [echeance, setEcheance]       = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [severity, setSeverity]       = useState("");

  const batchesQ = useQuery({
    enabled: tab === "IMPORT" && isAdmin,
    queryKey: ["sb-batches", { kind: "SENELEC_INVOICE" }],
    queryFn:  () => listBatches({ kind: "SENELEC_INVOICE", page: 1, page_size: 20 }),
    placeholderData: keepPreviousData,
  });
  const issuesQ = useQuery({
    enabled: tab === "IMPORT" && !!selectedBatchId && isAdmin,
    queryKey: ["sb-batch-issues", selectedBatchId, severity],
    queryFn:  () => getBatchIssues(selectedBatchId!, severity ? { severity } : undefined),
    placeholderData: keepPreviousData,
  });
  const importMut = useMutation({
    mutationFn: ({ file, echeance }: { file: File; echeance: string }) => importInvoices(file, echeance),
    onSuccess: (res) => {
      toast.success(`Import OK — +${res.rows_created} créées / ${res.rows_updated} mises à jour`);
      setSelectedBatchId(res.batch.id);
      qc.invalidateQueries({ queryKey: ["sb-batches"] });
      qc.invalidateQueries({ queryKey: ["sb-invoices"] });
      qc.invalidateQueries({ queryKey: ["sb-monthly"] });
      qc.invalidateQueries({ queryKey: ["sb-contract-months"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Import échoué"),
  });

  const issueCols: Col<ImportIssue>[] = useMemo(() => [
    { key:"sev",  title:"Niveau",  render:(r) => <SeverityPill v={r.severity} /> },
    { key:"row",  title:"Ligne",   render:(r) => <span style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{r.row_number ?? "—"}</span> },
    { key:"field",title:"Champ",   render:(r) => <span style={{fontSize:12,whiteSpace:"nowrap"}}>{r.field||"—"}</span> },
    { key:"msg",  title:"Message", render:(r) => <div style={{minWidth:380,fontSize:12}}>{r.message}</div> },
  ], []);

  const lastBatches = (batchesQ.data as any)?.results ?? [];
  const issues = (issuesQ.data as any) ?? [];
  const showFilters = tab !== "IMPORT" && tab !== "STATS" && tab !== "PENALITES";
  const showKpi     = tab !== "IMPORT" && tab !== "STATS" && tab !== "PENALITES";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

        .sbp * { font-family:'DM Sans',sans-serif; box-sizing:border-box; }
        .sbp .display { font-family:'Outfit',sans-serif; }
        .sbp .mono    { font-family:'JetBrains Mono',monospace; }

        .sbp table { width:100%; border-collapse:collapse; }
        .sbp thead tr {
          background: #f0f4ff;
          border-bottom: 2px solid rgba(30,58,138,.08);
        }
        .sbp thead th {
          padding: 10px 14px;
          font-size: 10.5px; font-weight:700;
          color: #64748b;
          text-transform: uppercase; letter-spacing:.08em;
          text-align: left; white-space:nowrap;
        }
        .sbp tbody tr {
          border-bottom: 1px solid rgba(30,58,138,.05);
          transition: background .12s;
        }
        .sbp tbody tr:hover { background: #f8faff; }
        .sbp tbody tr:last-child { border-bottom: none; }
        .sbp tbody td { padding: 10px 14px; font-size:13px; }

        @keyframes sbp-in {
          from { opacity:0; transform:translateY(8px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .sbp-card { animation: sbp-in .4s cubic-bezier(.22,1,.36,1) both; }
        .sbp-card:nth-child(1) { animation-delay:.04s; }
        .sbp-card:nth-child(2) { animation-delay:.08s; }
        .sbp-card:nth-child(3) { animation-delay:.12s; }
        .sbp-card:nth-child(4) { animation-delay:.16s; }
        .sbp-card:nth-child(5) { animation-delay:.20s; }

        .sbp input:focus, .sbp select:focus {
          outline:none;
          border-color: #1e3a8a !important;
          box-shadow: 0 0 0 3px rgba(30,58,138,.09) !important;
        }

        .import-dropzone {
          border: 2px dashed rgba(30,58,138,.2);
          border-radius: 12px;
          padding: 20px;
          text-align: center;
          transition: border-color .2s, background .2s;
          cursor: pointer;
        }
        .import-dropzone:hover {
          border-color: rgba(30,58,138,.45);
          background: #f0f4ff;
        }
      `}</style>

      <div className="sbp" style={{ display:"flex", flexDirection:"column", gap:16 }}>

        {/* ══ Page header card */}
        <div className="sbp-card" style={{
          background:"white", borderRadius:20,
          border:"1px solid rgba(30,58,138,.08)",
          boxShadow:"0 1px 3px rgba(30,58,138,.04), 0 8px 32px rgba(30,58,138,.06)",
          overflow:"hidden",
          position:"relative",
        }}>
          <div style={{
            height:3, background:"linear-gradient(90deg,#E8401C,#ff7350,transparent)",
            position:"absolute", top:0, left:0, right:0,
          }}/>

          <div style={{ padding:"22px 24px 0" }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, flexWrap:"wrap" }}>
              <div>
                <div style={{
                  display:"inline-flex", alignItems:"center", gap:6,
                  background:"rgba(232,64,28,.08)", border:"1px solid rgba(232,64,28,.18)",
                  borderRadius:100, padding:"3px 10px",
                  marginBottom:8,
                }}>
                  <div style={{width:5,height:5,borderRadius:"50%",background:"#E8401C"}}/>
                  <span style={{fontSize:10,fontWeight:700,letterSpacing:".12em",color:"#E8401C",textTransform:"uppercase"}}>
                    Facturation Sénélec
                  </span>
                </div>
                <h1 className="display" style={{
                  fontSize:22, fontWeight:800,
                  color:"#0f172a", letterSpacing:"-.025em",
                  margin:0, lineHeight:1.2,
                }}>
                  Billing Sonatel
                </h1>
                <p style={{ fontSize:13, color:"#64748b", marginTop:4 }}>
                  Factures · Synthèse mensuelle · Contrat × Mois · Données cibles
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:18, paddingBottom:18 }}>
              {tabs.map(t => (
                <TabBtn key={t.key} active={tab === t.key} onClick={() => go(t.key)}>
                  {t.icon} {t.label}
                </TabBtn>
              ))}
            </div>
          </div>
        </div>

        {/* ══ Filters (not shown for PENALITES / STATS / IMPORT) */}
        {showFilters && (
          <div className="sbp-card" style={{
            background:"white", borderRadius:16,
            border:"1px solid rgba(30,58,138,.08)",
            boxShadow:"0 1px 3px rgba(30,58,138,.04)",
            padding:"16px 20px",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12 }}>
              <Filter size={13} style={{color:"#94a3b8"}}/>
              <span style={{fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:".08em",textTransform:"uppercase"}}>Filtres</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:10 }}>
              <div style={{ position:"relative" }}>
                <Search size={13} style={{ position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#94a3b8",pointerEvents:"none" }}/>
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  placeholder={tab==="INVOICES" ? "Facture / contrat…" : "Contrat…"}
                  style={{ ...inputStyle, paddingLeft:30 }}
                />
              </div>
              <input
                value={site}
                onChange={e => { setSite(e.target.value); setPage(1); }}
                placeholder="Site (ex: S001)"
                style={inputStyle}
              />
              <select
                value={status}
                onChange={e => { setStatus(e.target.value); setPage(1); }}
                style={inputStyle}
              >
                <option value="">Tous statuts</option>
                <option value="CREATED">Créée</option>
                <option value="VALIDATED">Validée</option>
                <option value="CONTESTED">Contestée</option>
              </select>
              <div style={{ position:"relative" }}>
                <Calendar size={13} style={{ position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#94a3b8",pointerEvents:"none" }}/>
                <input type="date" value={dateStart} onChange={e => { setDateStart(e.target.value); setPage(1); }} style={{ ...inputStyle, paddingLeft:30 }} />
              </div>
              <div style={{ position:"relative" }}>
                <Calendar size={13} style={{ position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#94a3b8",pointerEvents:"none" }}/>
                <input type="date" value={dateEnd} onChange={e => { setDateEnd(e.target.value); setPage(1); }} style={{ ...inputStyle, paddingLeft:30 }} />
              </div>
            </div>
          </div>
        )}

        {/* Filtres date pour PENALITES (sans les autres filtres) */}
        {tab === "PENALITES" && (
          <div className="sbp-card" style={{
            background:"white", borderRadius:16,
            border:"1px solid rgba(30,58,138,.08)",
            boxShadow:"0 1px 3px rgba(30,58,138,.04)",
            padding:"14px 20px",
            display:"flex", alignItems:"center", gap:10, flexWrap:"wrap",
          }}>
            <Calendar size={13} style={{color:"#94a3b8"}}/>
            <span style={{fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:".08em",textTransform:"uppercase"}}>Période</span>
            <div style={{ position:"relative" }}>
              <Calendar size={13} style={{ position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#94a3b8",pointerEvents:"none" }}/>
              <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} style={{ ...inputStyle, paddingLeft:30, width:160 }} />
            </div>
            <span style={{color:"#94a3b8", fontSize:13}}>→</span>
            <div style={{ position:"relative" }}>
              <Calendar size={13} style={{ position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#94a3b8",pointerEvents:"none" }}/>
              <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} style={{ ...inputStyle, paddingLeft:30, width:160 }} />
            </div>
          </div>
        )}

        {/* ══ KPI cards */}
        {showKpi && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))", gap:10 }}>
            {[
              { label:"TTC (page)",    value:money(String(kpi.ttc)), icon:<DollarSign size={14}/>,   accent:"#1e3a8a" },
              { label:"HT (page)",     value:money(String(kpi.ht)),  icon:<DollarSign size={14}/>,   accent:"#475569" },
              { label:"NRJ (page)",    value:money(String(kpi.nrj)), icon:<Zap size={14}/>,          accent:"#E8401C" },
              { label:"Abonnement",    value:money(String(kpi.abo)), icon:<TrendingUp size={14}/>,   accent:"#10b981" },
              { label:"PenPrime",      value:money(String(kpi.pen)), icon:<AlertTriangle size={14}/>,accent:"#f59e0b" },
            ].map((k, i) => (
              <div key={i} className="sbp-card">
                <KpiCard {...k} />
              </div>
            ))}
          </div>
        )}

        {/* ══ Content */}
        <div className="sbp-card" style={{
          background:"white", borderRadius:16,
          border:"1px solid rgba(30,58,138,.08)",
          boxShadow:"0 1px 3px rgba(30,58,138,.04), 0 8px 24px rgba(30,58,138,.04)",
          overflow:"hidden",
        }}>

          {/* STATS */}
          {tab === "STATS" && (
            <div style={{ padding:"20px" }}>
              <SonatelBillingStatsTab start={dateStart} end={dateEnd} />
            </div>
          )}

          {/* PENALITES */}
          {tab === "PENALITES" && (
            <div style={{ padding:"20px" }}>
              <div style={{ marginBottom:16 }}>
                <h2 style={{ fontFamily:"'Outfit',sans-serif", fontSize:17, fontWeight:800, color:"#0f172a", margin:0 }}>
                  Suivi Pénalités & Cos φ
                </h2>
                <p style={{ fontSize:13, color:"#64748b", marginTop:4, margin:"4px 0 0" }}>
                  Sites impactés par le cos phi et/ou les dépassements de puissance souscrite, mois par mois.
                </p>
              </div>
              <PenalitesTab start={dateStart} end={dateEnd} />
            </div>
          )}

          {/* DATA TABLES */}
          {(tab === "INVOICES" || tab === "MONTHLY" || tab === "CONTRACT") && (
            <>
              <div style={{ overflowX:"auto" }}>
                <DataTable
                  cols={tab === "INVOICES" ? invoiceCols : tab === "MONTHLY" ? monthlyCols : contractCols}
                  rows={rows}
                  loading={active?.isLoading}
                />
              </div>
              <div style={{ padding:"0 16px 16px" }}>
                <Pagination page={page} total={total} pageSize={pageSize} onPage={setPage} />
              </div>
            </>
          )}

          {/* IMPORT */}
          {tab === "IMPORT" && (
            <div style={{ padding:"20px" }}>
              {!isAdmin ? (
                <div style={{ padding:"40px 24px", textAlign:"center", color:"#64748b", fontSize:14 }}>
                  <AlertTriangle size={32} style={{color:"#E8401C",margin:"0 auto 12px",display:"block"}}/>
                  Accès réservé aux administrateurs.
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                  <div style={{ background:"#f8faff", borderRadius:14, border:"1px solid rgba(30,58,138,.1)", padding:"20px" }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                      <div>
                        <h2 className="display" style={{ fontSize:16, fontWeight:800, color:"#0f172a", margin:0 }}>Import Factures</h2>
                        <p style={{ fontSize:12, color:"#64748b", marginTop:2 }}>Upload Excel Sénélec → upsert factures + synthèse + Contrat×Mois</p>
                      </div>
                      <button onClick={() => batchesQ.refetch()} style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 12px", borderRadius:9, border:"1px solid rgba(30,58,138,.12)", background:"white", cursor:"pointer", fontSize:12, fontWeight:600, color:"#475569" }}>
                        <RefreshCw size={13}/> Rafraîchir
                      </button>
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", gap:12, alignItems:"end" }}>
                      <Field label="Fichier Excel">
                        <label className="import-dropzone" style={{ display:"block", cursor:"pointer" }}>
                          <FileSpreadsheet size={22} style={{color:"#1e3a8a",margin:"0 auto 6px",display:"block"}}/>
                          <div style={{fontSize:12,color:"#64748b",fontWeight:500}}>{file ? file.name : "Cliquer ou déposer .xlsx / .xls"}</div>
                          <input type="file" accept=".xlsx,.xls" onChange={e => setFile(e.target.files?.[0]||null)} style={{display:"none"}}/>
                        </label>
                      </Field>
                      <Field label="Échéance *">
                        <div style={{ position:"relative" }}>
                          <Calendar size={13} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#94a3b8",pointerEvents:"none"}}/>
                          <input type="date" value={echeance} onChange={e => setEcheance(e.target.value)} style={{ ...inputStyle, paddingLeft:30 }}/>
                        </div>
                      </Field>
                      <Field label="Batch précédent">
                        <select value={selectedBatchId ?? ""} onChange={e => setSelectedBatchId(e.target.value ? Number(e.target.value) : null)} style={inputStyle}>
                          <option value="">— sélectionner —</option>
                          {lastBatches.map((b: any) => (
                            <option key={b.id} value={b.id}>#{b.id} · {new Date(b.imported_at).toLocaleString("fr-FR")} · {b.source_filename}</option>
                          ))}
                        </select>
                      </Field>
                      <button
                        disabled={!file || !echeance || importMut.isPending}
                        onClick={() => file && echeance && importMut.mutate({ file, echeance })}
                        style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:7, padding:"11px 20px", borderRadius:10, background: (!file || !echeance || importMut.isPending) ? "#94a3b8" : "#1e3a8a", color:"white", border:"none", fontSize:13, fontWeight:700, cursor: (!file || !echeance || importMut.isPending) ? "not-allowed" : "pointer", transition:"background .18s", boxShadow: (!file||!echeance||importMut.isPending) ? "none" : "0 4px 14px rgba(30,58,138,.25)", height:42, whiteSpace:"nowrap" }}
                      >
                        <UploadCloud size={15}/> {importMut.isPending ? "Import..." : "Importer"}
                      </button>
                    </div>
                  </div>

                  {importMut.data && (
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))", gap:10 }}>
                      {[["Créées",importMut.data.rows_created],["Mises à jour",importMut.data.rows_updated],["Monthly créées",importMut.data.monthly_rows_created],["Issues",importMut.data.issues_logged],["Sans site",importMut.data.invoices_missing_site_count],["Contrat×Mois",importMut.data.contract_months_upserted]].map(([l,v]) => <StatMini key={l} label={String(l)} value={v as number}/>)}
                    </div>
                  )}

                  {importMut.data?.invoices_missing_site_count ? (
                    <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:12, padding:"14px 16px", display:"flex", gap:10, alignItems:"flex-start" }}>
                      <AlertTriangle size={16} style={{color:"#f59e0b",flexShrink:0,marginTop:1}}/>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:"#92400e"}}>{importMut.data.invoices_missing_site_count} contrat(s) sans mapping Site</div>
                        <div style={{fontSize:11,color:"#b45309",marginTop:3}}>Exemples : {importMut.data.invoices_missing_site_sample?.join(", ")||"—"}</div>
                      </div>
                    </div>
                  ) : null}

                  <div style={{ background:"white", borderRadius:12, border:"1px solid rgba(30,58,138,.08)", overflow:"hidden" }}>
                    <div style={{ padding:"14px 18px", borderBottom:"1px solid rgba(30,58,138,.07)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <h3 className="display" style={{ fontSize:14, fontWeight:800, color:"#0f172a", margin:0 }}>Issues du batch</h3>
                      <select value={severity} onChange={e => setSeverity(e.target.value)} style={{ ...inputStyle, width:"auto", padding:"6px 12px" }}>
                        <option value="">Tous</option>
                        <option value="ERROR">ERROR</option>
                        <option value="WARN">WARN</option>
                        <option value="INFO">INFO</option>
                      </select>
                    </div>
                    <div style={{ overflowX:"auto" }}>
                      <DataTable cols={issueCols} rows={issues} loading={issuesQ.isLoading} emptyText={selectedBatchId ? "Aucune issue" : "Sélectionne un batch pour voir les issues"}/>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}