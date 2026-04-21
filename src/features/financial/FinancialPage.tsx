import { useState, useEffect, useRef, useCallback } from "react";
import { financialLock, isFinancialUnlocked, financialUnlock } from "./FinancialAccessGate";
import FinancialAccessGate from "./FinancialAccessGate";
import {
  importFeeRules,
  importMonthlyLoads,
  runEvaluation,
  fetchEvaluations,
  fetchEvaluationStats,
  exportEvaluationsCSV,
  fetchFacturesVsRedevances,
  fetchMargeParSite,
  fetchSitesRecurrents,
  fetchAnalyticsFullReport,
  fetchEvaluationDetail,
  type FinancialEvaluation,
  type EvaluationStats,
  type FacturesRedevancesPeriod,
  type SiteMargeRow,
  type SiteRecurrentRow,
  type EvaluateResult,
  type AnalyticsFullReport,
  type EvaluationDetail,
} from "./api";



import {
  TrendingUp,
  TrendingDown,
  Upload,
  RefreshCw,
  AlertCircle,
  Clock,
  BarChart3,
  ArrowUpRight,
  Layers,
  ChevronRight,
  Lock,
  CheckCircle2,
  XCircle,
  X,
  FileUp,
  Loader2,
  ArrowDown,
  ArrowUp,
  Minus,
  Search,
  Download,
  ChevronLeft,
  Eye,
  Sparkles,
  PanelRightClose,
  CalendarRange,
} from "lucide-react";
import FinancialDataPage from "./FinancialDataPage";
import FinancialSiteDetailModal from "./FinancialSiteDetailModal"; // ✅ NOUVEAU

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function fmt(v: string | null | undefined, suffix = " FCFA"): string {
  if (!v || v === "0.000") return "—";
  const n = parseFloat(v);
  if (isNaN(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".", ",") + " M" + suffix;
  if (Math.abs(n) >= 1_000) return Math.round(n).toLocaleString("fr-FR") + suffix;
  return n.toFixed(0) + suffix;
}

function fmtPlain(v: string | null | undefined): string {
  if (!v || v === "0.000") return "—";
  const n = parseFloat(v);
  if (isNaN(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".", ",") + " M";
  if (Math.abs(n) >= 1_000) return Math.round(n).toLocaleString("fr-FR");
  return n.toFixed(0);
}

function margeColor(v: string | null) {
  if (!v) return "#94a3b8";
  return parseFloat(v) >= 0 ? "#059669" : "#dc2626";
}

function severityStyle(severity: string) {
  if (severity === "CRITICAL") {
    return {
      background: "rgba(220,38,38,.10)",
      color: "#dc2626",
      border: "1px solid rgba(220,38,38,.18)",
    };
  }
  if (severity === "HIGH") {
    return {
      background: "rgba(245,158,11,.10)",
      color: "#b45309",
      border: "1px solid rgba(245,158,11,.18)",
    };
  }
  if (severity === "MEDIUM") {
    return {
      background: "rgba(59,130,246,.10)",
      color: "#1d4ed8",
      border: "1px solid rgba(59,130,246,.18)",
    };
  }
  return {
    background: "rgba(100,116,139,.10)",
    color: "#475569",
    border: "1px solid rgba(100,116,139,.18)",
  };
}

function statusPill(status: string | null | undefined) {
  if (!status) {
    return {
      bg: "rgba(148,163,184,.10)",
      color: "#64748b",
      label: "—",
    };
  }
  if (status === "OK" || status === "CERTIFIED_FMS" || status === "CERTIFIED_SENELEC") {
    return {
      bg: "rgba(5,150,105,.10)",
      color: "#059669",
      label: status,
    };
  }
  if (status === "NOK" || status === "NEEDS_REVIEW" || status === "FMS_UNAVAILABLE") {
    return {
      bg: "rgba(220,38,38,.10)",
      color: "#dc2626",
      label: status,
    };
  }
  return {
    bg: "rgba(245,158,11,.10)",
    color: "#b45309",
    label: status,
  };
}

// ─── Upload modal ─────────────────────────────────────────────────────────────
interface UploadModalProps {
  title: string;
  description: string;
  accept?: string;
  onClose: () => void;
  onUpload: (file: File) => Promise<{ created: number; updated: number; skipped: number; errors_sample?: any[] }>;
}

function UploadModal({ title, description, accept = ".xlsx,.xls,.csv", onClose, onUpload }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; errors_sample?: any[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const handleSubmit = async () => {
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
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        background: "rgba(15,23,42,.6)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && !loading && onClose()}
    >
      <div
        style={{
          background: "white",
          borderRadius: 24,
          padding: 32,
          maxWidth: 460,
          width: "100%",
          boxShadow: "0 32px 80px rgba(0,0,0,.22)",
          animation: "slideUp .22s cubic-bezier(.34,1.4,.64,1)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: "0 0 4px" }}>{title}</h3>
            <p style={{ fontSize: 12.5, color: "#64748b", margin: 0 }}>{description}</p>
          </div>
          {!loading && (
            <button
              onClick={onClose}
              style={{
                background: "rgba(0,0,0,.06)",
                border: "none",
                borderRadius: 9,
                padding: 6,
                cursor: "pointer",
                color: "#64748b",
                display: "grid",
                placeItems: "center",
              }}
            >
              <X size={15} />
            </button>
          )}
        </div>

        {!result ? (
          <>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              style={{
                border: `2px dashed ${dragging ? "#1e3a8a" : file ? "rgba(5,150,105,.4)" : "rgba(30,58,138,.2)"}`,
                borderRadius: 16,
                padding: "28px 20px",
                textAlign: "center",
                cursor: "pointer",
                background: dragging ? "rgba(30,58,138,.04)" : file ? "rgba(5,150,105,.03)" : "rgba(248,250,252,1)",
                transition: "all .18s",
                marginBottom: 16,
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept={accept}
                style={{ display: "none" }}
                onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
              />
              <FileUp size={28} color={file ? "#059669" : "#94a3b8"} style={{ marginBottom: 10 }} />
              {file ? (
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#059669", margin: "0 0 2px" }}>{file.name}</p>
                  <p style={{ fontSize: 11.5, color: "#94a3b8", margin: 0 }}>{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 2px" }}>
                    Glisser-déposer ou cliquer pour sélectionner
                  </p>
                  <p style={{ fontSize: 11.5, color: "#94a3b8", margin: 0 }}>{accept}</p>
                </div>
              )}
            </div>

            {error && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  background: "rgba(220,38,38,.07)",
                  border: "1px solid rgba(220,38,38,.15)",
                  marginBottom: 14,
                  fontSize: 12.5,
                  color: "#dc2626",
                  fontWeight: 500,
                }}
              >
                ⚠ {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  borderRadius: 12,
                  border: "1.5px solid rgba(0,0,0,.1)",
                  background: "white",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#374151",
                  cursor: "pointer",
                }}
              >
                Annuler
              </button>
              <button
                disabled={!file || loading}
                onClick={handleSubmit}
                style={{
                  flex: 2,
                  padding: "9px 0",
                  borderRadius: 12,
                  border: "none",
                  background: file && !loading ? "linear-gradient(135deg,#1e3a8a,#2d52b8)" : "rgba(30,58,138,.25)",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "white",
                  cursor: file && !loading ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                }}
              >
                {loading && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
                {loading ? "Import en cours…" : "Importer"}
              </button>
            </div>
          </>
        ) : (
          <div>
            <div style={{ textAlign: "center", padding: "8px 0 20px" }}>
              <CheckCircle2 size={40} color="#059669" style={{ marginBottom: 10 }} />
              <h4 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: "0 0 14px" }}>Import terminé</h4>
              <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
                {[
                  { label: "Créés", value: result.created, color: "#059669" },
                  { label: "Maj", value: result.updated, color: "#0891b2" },
                  { label: "Ignorés", value: result.skipped, color: "#f59e0b" },
                ].map((s) => (
                  <div
                    key={s.label}
                    style={{
                      padding: "10px 16px",
                      borderRadius: 12,
                      background: "rgba(0,0,0,.03)",
                      border: "1px solid rgba(0,0,0,.06)",
                    }}
                  >
                    <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: "'Outfit',sans-serif" }}>
                      {s.value}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8" }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {result.errors_sample && result.errors_sample.length > 0 && (
                <div
                  style={{
                    marginTop: 14,
                    padding: "10px 14px",
                    borderRadius: 12,
                    background: "rgba(245,158,11,.07)",
                    border: "1px solid rgba(245,158,11,.15)",
                    textAlign: "left",
                  }}
                >
                  <p style={{ fontSize: 11.5, fontWeight: 600, color: "#92400e", margin: "0 0 4px" }}>
                    {result.errors_sample.length} erreur(s) :
                  </p>
                  {result.errors_sample.slice(0, 3).map((e: any, i: number) => (
                    <p key={i} style={{ fontSize: 11, color: "#b45309", margin: "2px 0 0" }}>
                      Ligne {e.row || i + 1} : {e.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                width: "100%",
                padding: "10px 0",
                borderRadius: 12,
                border: "none",
                background: "linear-gradient(135deg,#1e3a8a,#2d52b8)",
                fontSize: 13,
                fontWeight: 600,
                color: "white",
                cursor: "pointer",
              }}
            >
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Table évaluations ────────────────────────────────────────────────────────
function EvaluationTable({
  items,
  onOpenDetail,
}: {
  items: FinancialEvaluation[];
  onOpenDetail: (siteId: string, siteName?: string) => void;  // ✅ + siteName
}) {
  if (!items.length) return null;

  return (
    <div style={{ overflowX: "auto", borderRadius: 18, border: "1.5px solid rgba(0,0,0,.06)", background: "white" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: "linear-gradient(180deg,rgba(30,58,138,.05),rgba(30,58,138,.02))", borderBottom: "1.5px solid rgba(0,0,0,.06)" }}>
            {["Site", "Période", "Typologie", "Config", "Load (W)", "Redevance", "Montant HT", "Marge", "Statut", "Récurrence", "Analyse"].map((h) => (
              <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "#374151", whiteSpace: "nowrap", fontSize: 11 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((ev, i) => {
            const marge = ev.marge ? parseFloat(ev.marge) : null;
            return (
              <tr key={ev.id} style={{ borderBottom: "1px solid rgba(0,0,0,.05)", background: i % 2 === 0 ? "white" : "rgba(248,250,252,.65)" }}>
                
                <td style={{ padding: "10px 12px" }}>
                  <button
                    onClick={() => onOpenDetail(ev.site_id, ev.site_name)}
                    title={`Ouvrir l'analyse de ${ev.site_id}`}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget.querySelector(".site-id") as HTMLElement).style.color = "#1e3a8a";
                      (e.currentTarget.querySelector(".site-id") as HTMLElement).style.textDecoration = "underline";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget.querySelector(".site-id") as HTMLElement).style.color = "#0f172a";
                      (e.currentTarget.querySelector(".site-id") as HTMLElement).style.textDecoration = "none";
                    }}
                  >
                    <div
                      className="site-id"
                      style={{
                        fontWeight: 700,
                        color: "#0f172a",
                        transition: "color 0.15s ease",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      {ev.site_id}
                      <Eye size={11} style={{ opacity: 0.35, flexShrink: 0 }} />
                    </div>
                    <div style={{
                      fontSize: 11,
                      color: "#94a3b8",
                      maxWidth: 140,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {ev.site_name}
                    </div>
                  </button>
                </td>

                <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: "#475569", fontWeight: 600 }}>
                  {MONTHS[(ev.month || 1) - 1]} {ev.year}
                </td>

                <td style={{ padding: "10px 12px", maxWidth: 170 }}>
                  {ev.typology ? (
                    <span
                      title={ev.typology}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#374151",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        display: "block",
                        maxWidth: 160,
                      }}
                    >
                      {ev.typology}
                    </span>
                  ) : (
                    <span style={{ color: "#d1d5db" }}>—</span>
                  )}
                </td>

                <td style={{ padding: "10px 12px", color: "#374151" }}>{ev.configuration || "—"}</td>

                <td style={{ padding: "10px 12px", color: "#374151", whiteSpace: "nowrap" }}>
                  {ev.load_w ? ev.load_w.toLocaleString("fr-FR") : "—"}
                  {ev.hors_catalogue && (
                    <span
                      title="Hors catalogue — fallback load supérieur"
                      style={{
                        marginLeft: 6,
                        fontSize: 9,
                        padding: "2px 6px",
                        borderRadius: 100,
                        background: "rgba(245,158,11,.10)",
                        color: "#b45309",
                        fontWeight: 700,
                      }}
                    >
                      HC
                    </span>
                  )}
                </td>

                <td style={{ padding: "10px 12px", color: "#374151", whiteSpace: "nowrap" }}>{fmt(ev.redevance)}</td>
                <td style={{ padding: "10px 12px", color: "#374151", whiteSpace: "nowrap" }}>{fmt(ev.montant_htva)}</td>

                <td style={{ padding: "10px 12px", fontWeight: 700, whiteSpace: "nowrap", color: marge !== null ? margeColor(ev.marge) : "#94a3b8" }}>
                  {marge !== null ? (
                    <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      {marge > 0 ? <ArrowUp size={11} /> : marge < 0 ? <ArrowDown size={11} /> : <Minus size={11} />}
                      {fmt(ev.marge)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>

                <td style={{ padding: "10px 12px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {ev.marge_statut ? (
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: 100,
                          fontSize: 10.5,
                          fontWeight: 700,
                          background: ev.marge_statut === "OK" ? "rgba(5,150,105,.10)" : "rgba(220,38,38,.10)",
                          color: ev.marge_statut === "OK" ? "#059669" : "#dc2626",
                          display: "inline-block",
                          width: "fit-content",
                        }}
                      >
                        {ev.marge_statut}
                      </span>
                    ) : (
                      "—"
                    )}

                    {ev.periode_courte && (
                      <span
                        title={`Période courte : ${ev.nb_jours_factures} jours`}
                        style={{
                          padding: "2px 7px",
                          borderRadius: 100,
                          fontSize: 9.5,
                          fontWeight: 700,
                          background: "rgba(99,102,241,.10)",
                          color: "#4f46e5",
                          width: "fit-content",
                        }}
                      >
                        ⏱ {ev.nb_jours_factures}j
                      </span>
                    )}
                  </div>
                </td>

                <td style={{ padding: "10px 12px" }}>
                  {ev.recurrence_type ? (
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: 100,
                        fontSize: 10,
                        fontWeight: 700,
                        background: ev.recurrence_type === "critique" ? "rgba(220,38,38,.10)" : "rgba(245,158,11,.10)",
                        color: ev.recurrence_type === "critique" ? "#dc2626" : "#b45309",
                      }}
                    >
                      {ev.recurrence_type === "critique" ? "⚠ Critique" : "Light"}
                      {ev.recurrence_mois_nok > 0 && ` (${ev.recurrence_mois_nok}m)`}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>

                <td style={{ padding: "10px 12px" }}>
                  <button
                    onClick={() => onOpenDetail(ev.site_id)}
                    title="Voir l'analyse détaillée"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      border: "1.5px solid rgba(30,58,138,.12)",
                      background: "rgba(30,58,138,.05)",
                      color: "#1e3a8a",
                      cursor: "pointer",
                      boxShadow: "0 1px 4px rgba(0,0,0,.04)",
                    }}
                  >
                    <Eye size={15} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Dashboard chart ──────────────────────────────────────────────────────────
function MiniBarChart({ data }: { data: FacturesRedevancesPeriod[] }) {
  if (!data.length) return null;
  const maxVal = Math.max(...data.flatMap((d) => [parseFloat(d.total_redevance || "0"), parseFloat(d.total_facture || "0")]));

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 80 }}>
      {data.slice(-8).map((d, i) => {
        const rev = parseFloat(d.total_redevance || "0");
        const fac = parseFloat(d.total_facture || "0");
        const hRev = maxVal ? (rev / maxVal) * 80 : 0;
        const hFac = maxVal ? (fac / maxVal) * 80 : 0;

        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 70 }}>
              <div
                title={`Redevance: ${fmt(d.total_redevance)}`}
                style={{
                  width: 10,
                  height: Math.max(hRev, 2),
                  borderRadius: "3px 3px 0 0",
                  background: "linear-gradient(180deg,#1e3a8a,#2d52b8)",
                  transition: "height .3s",
                }}
              />
              <div
                title={`Facture: ${fmt(d.total_facture)}`}
                style={{
                  width: 10,
                  height: Math.max(hFac, 2),
                  borderRadius: "3px 3px 0 0",
                  background: "linear-gradient(180deg,#E8401C,#ff6340)",
                  transition: "height .3s",
                }}
              />
            </div>
            <span
              style={{
                fontSize: 9,
                color: "#94a3b8",
                textAlign: "center",
                transform: "rotate(-45deg)",
                transformOrigin: "center",
                whiteSpace: "nowrap",
              }}
            >
              {d.period.slice(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function GraphCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: 18,
        border: "1px solid rgba(0,0,0,.06)",
        padding: 18,
      }}
    >
      <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
        {title}
      </h4>
      {children}
    </div>
  );
}

function DetailMargeBarsChart({ detail }: { detail: EvaluationDetail }) {
  const rows = detail.history || [];
  if (!rows.length) {
    return <div style={{ fontSize: 12.5, color: "#94a3b8" }}>Aucune donnée</div>;
  }

  const values = rows.map((r) => Math.abs(parseFloat(r.marge || "0")));
  const maxVal = Math.max(...values, 1);

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 220 }}>
      {rows.map((row) => {
        const marge = parseFloat(row.marge || "0");
        const barH = Math.max((Math.abs(marge) / maxVal) * 160, 6);

        return (
          <div
            key={row.period}
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 8,
            }}
          >
            <div
              title={`${row.period} : ${fmt(row.marge)}`}
              style={{
                width: "100%",
                maxWidth: 42,
                height: barH,
                borderRadius: "10px 10px 0 0",
                background:
                  marge >= 0
                    ? "linear-gradient(180deg,#10b981,#059669)"
                    : "linear-gradient(180deg,#f87171,#dc2626)",
                boxShadow: "0 6px 18px rgba(0,0,0,.08)",
              }}
            />
            <div style={{ fontSize: 10.5, color: "#64748b", fontWeight: 700, textAlign: "center" }}>
              {row.period.slice(5)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DetailRedevanceFactureChart({ detail }: { detail: EvaluationDetail }) {
  const rows = detail.history || [];
  if (!rows.length) {
    return <div style={{ fontSize: 12.5, color: "#94a3b8" }}>Aucune donnée</div>;
  }

  const values = rows.flatMap((r) => [
    parseFloat(r.redevance || "0"),
    parseFloat(r.montant_htva || "0"),
  ]);
  const maxVal = Math.max(...values, 1);

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 220 }}>
      {rows.map((row) => {
        const rev = parseFloat(row.redevance || "0");
        const fac = parseFloat(row.montant_htva || "0");
        const hRev = Math.max((rev / maxVal) * 150, 4);
        const hFac = Math.max((fac / maxVal) * 150, 4);

        return (
          <div
            key={row.period}
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 170 }}>
              <div
                title={`Redevance ${row.period}: ${fmt(row.redevance)}`}
                style={{
                  width: 14,
                  height: hRev,
                  borderRadius: "8px 8px 0 0",
                  background: "linear-gradient(180deg,#3b82f6,#1e3a8a)",
                }}
              />
              <div
                title={`Facture ${row.period}: ${fmt(row.montant_htva)}`}
                style={{
                  width: 14,
                  height: hFac,
                  borderRadius: "8px 8px 0 0",
                  background: "linear-gradient(180deg,#fb923c,#E8401C)",
                }}
              />
            </div>
            <div style={{ fontSize: 10.5, color: "#64748b", fontWeight: 700 }}>{row.period.slice(5)}</div>
          </div>
        );
      })}
    </div>
  );
}

function DetailBillingPenaltyChart({ detail }: { detail: EvaluationDetail }) {
  const rows = detail.billing?.rows || [];
  if (!rows.length) {
    return <div style={{ fontSize: 12.5, color: "#94a3b8" }}>Aucune donnée billing</div>;
  }

  const values = rows.flatMap((r) => [
    parseFloat(r.montant_cosinus_phi || "0"),
    parseFloat(r.penalite_abonnement || "0"),
  ]);
  const maxVal = Math.max(...values, 1);

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 220 }}>
      {rows.map((row) => {
        const cosphi = parseFloat(row.montant_cosinus_phi || "0");
        const pen = parseFloat(row.penalite_abonnement || "0");
        const h1 = Math.max((cosphi / maxVal) * 150, cosphi > 0 ? 4 : 0);
        const h2 = Math.max((pen / maxVal) * 150, pen > 0 ? 4 : 0);

        return (
          <div
            key={row.period}
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 170 }}>
              <div
                title={`Cos φ ${row.period}: ${fmt(row.montant_cosinus_phi)}`}
                style={{
                  width: 14,
                  height: h1,
                  borderRadius: "8px 8px 0 0",
                  background: "linear-gradient(180deg,#f59e0b,#b45309)",
                }}
              />
              <div
                title={`Pénalité PS ${row.period}: ${fmt(row.penalite_abonnement)}`}
                style={{
                  width: 14,
                  height: h2,
                  borderRadius: "8px 8px 0 0",
                  background: "linear-gradient(180deg,#ef4444,#b91c1c)",
                }}
              />
            </div>
            <div style={{ fontSize: 10.5, color: "#64748b", fontWeight: 700 }}>{row.period.slice(5)}</div>
          </div>
        );
      })}
    </div>
  );
}


// ─── Drawer analyse détaillée ─────────────────────────────────────────────────
function AnalysisDrawer({
  open,
  loading,
  detail,
  onClose,
}: {
  open: boolean;
  loading: boolean;
  detail: EvaluationDetail | null;
  onClose: () => void;
}) {
  const [viewMode, setViewMode] = useState<"resume" | "graph">("resume");

  useEffect(() => {
    if (open) setViewMode("resume");
  }, [open, detail?.site?.site_id, detail?.period?.year, detail?.period?.month_start, detail?.period?.month_end]);

  if (!open) return null;

  const currentStatus = detail?.current?.marge_statut ? statusPill(detail.current.marge_statut) : null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 400,
        background: "rgba(15,23,42,.52)",
        backdropFilter: "blur(5px)",
        display: "flex",
        justifyContent: "flex-end",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: "min(860px, 100vw)",
          height: "100vh",
          background: "linear-gradient(180deg,#ffffff,#f8fafc)",
          boxShadow: "-18px 0 60px rgba(15,23,42,.22)",
          overflowY: "auto",
          padding: "22px 22px 30px",
          animation: "slideUp .2s ease",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  display: "grid",
                  placeItems: "center",
                  background: "linear-gradient(135deg,#1e3a8a,#2d52b8)",
                  color: "white",
                }}
              >
                <Sparkles size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0f172a", fontFamily: "'Outfit',sans-serif" }}>
                  Analyse détaillée
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#64748b" }}>
                  {detail ? `${detail.site.site_id} · ${detail.site.name || "Site"}` : "Chargement…"}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,.08)",
              background: "white",
              color: "#64748b",
              cursor: "pointer",
            }}
          >
            <PanelRightClose size={16} />
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 18,
            background: "rgba(0,0,0,.04)",
            padding: 4,
            borderRadius: 14,
            width: "fit-content",
          }}
        >
          {[
            { key: "resume", label: "Synthèse" },
            { key: "graph", label: "Graphique" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setViewMode(tab.key as "resume" | "graph")}
              style={{
                padding: "7px 16px",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                fontSize: 12.5,
                fontWeight: 700,
                background: viewMode === tab.key ? "white" : "transparent",
                color: viewMode === tab.key ? "#1e3a8a" : "#64748b",
                boxShadow: viewMode === tab.key ? "0 1px 6px rgba(0,0,0,.08)" : "none",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading || !detail ? (
          <div style={{ padding: "70px 0", textAlign: "center", color: "#94a3b8" }}>
            <Loader2 size={28} style={{ animation: "spin 1s linear infinite", marginBottom: 8 }} />
            <div style={{ fontSize: 13 }}>Chargement de l'analyse…</div>
          </div>
        ) : (
          <>
            <div
              style={{
                background: "white",
                borderRadius: 18,
                border: "1px solid rgba(0,0,0,.06)",
                padding: "16px 18px",
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", fontFamily: "'Outfit',sans-serif" }}>
                    {detail.site.site_id}
                  </div>
                  <div style={{ fontSize: 12.5, color: "#64748b" }}>
                    {detail.site.name || "—"} · {detail.site.zone || "Zone N/A"} · {detail.period.year}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {currentStatus && (
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: 100,
                        fontSize: 10.5,
                        fontWeight: 800,
                        background: currentStatus.bg,
                        color: currentStatus.color,
                      }}
                    >
                      {currentStatus.label}
                    </span>
                  )}
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: 100,
                      fontSize: 10.5,
                      fontWeight: 800,
                      background: "rgba(30,58,138,.08)",
                      color: "#1e3a8a",
                    }}
                  >
                    {MONTHS[detail.period.month_start - 1]} → {MONTHS[detail.period.month_end - 1]}
                  </span>
                </div>
              </div>
            </div>

            {viewMode === "resume" ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 18 }}>
                  {[
                    {
                      label: "Marge cumulée",
                      value: fmt(detail.summary.total_marge),
                      color: parseFloat(detail.summary.total_marge || "0") >= 0 ? "#059669" : "#dc2626",
                      bg: parseFloat(detail.summary.total_marge || "0") >= 0 ? "rgba(5,150,105,.08)" : "rgba(220,38,38,.08)",
                    },
                    {
                      label: "Mois OK",
                      value: String(detail.summary.count_ok),
                      color: "#059669",
                      bg: "rgba(5,150,105,.08)",
                    },
                    {
                      label: "Mois NOK",
                      value: String(detail.summary.count_nok),
                      color: "#dc2626",
                      bg: "rgba(220,38,38,.08)",
                    },
                    {
                      label: "HT facturé",
                      value: fmt(detail.summary.billing_total_ht),
                      color: "#1e3a8a",
                      bg: "rgba(30,58,138,.08)",
                    },
                  ].map((card) => (
                    <div key={card.label} style={{ background: "white", borderRadius: 16, border: "1px solid rgba(0,0,0,.06)", padding: "14px 15px" }}>
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          background: card.bg,
                          color: card.color,
                          display: "grid",
                          placeItems: "center",
                          marginBottom: 10,
                        }}
                      >
                        <BarChart3 size={16} />
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: card.color, fontFamily: "'Outfit',sans-serif" }}>{card.value}</div>
                      <div style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 600 }}>{card.label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,.06)", padding: "18px", marginBottom: 16 }}>
                  <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Diagnostic automatique</h4>
                  {detail.diagnostics.length ? (
                    <div style={{ display: "grid", gap: 10 }}>
                      {detail.diagnostics.map((d, idx) => (
                        <div key={idx} style={{ ...severityStyle(d.severity), borderRadius: 14, padding: "12px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                            <strong style={{ fontSize: 12.5 }}>{d.message}</strong>
                            <span style={{ fontSize: 10.5, fontWeight: 800 }}>{d.severity}</span>
                          </div>
                          <div style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>{d.detail}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12.5, color: "#64748b" }}>Aucun diagnostic critique sur la période.</div>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,.06)", padding: "18px" }}>
                    <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Historique des marges</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {detail.history.length ? (
                        detail.history.map((row) => (
                          <div
                            key={row.period}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 10,
                              padding: "8px 10px",
                              borderRadius: 12,
                              background: "rgba(248,250,252,1)",
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a" }}>{row.period}</div>
                              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                                {row.load_w ? `${row.load_w.toLocaleString("fr-FR")} W` : "Load N/A"}
                                {row.hors_catalogue ? " · HC" : ""}
                              </div>
                            </div>
                            <div style={{ fontSize: 12.5, fontWeight: 800, color: parseFloat(row.marge || "0") >= 0 ? "#059669" : "#dc2626" }}>
                              {fmt(row.marge)}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: 12.5, color: "#94a3b8" }}>Aucune donnée</div>
                      )}
                    </div>
                  </div>

                  <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,.06)", padding: "18px" }}>
                    <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Certification</h4>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                      {Object.entries(detail.certification.summary).map(([k, v]) => (
                        <span
                          key={k}
                          style={{
                            padding: "4px 8px",
                            borderRadius: 100,
                            fontSize: 10.5,
                            fontWeight: 700,
                            background: "rgba(30,58,138,.06)",
                            color: "#1e3a8a",
                          }}
                        >
                          {k} · {String(v)}
                        </span>
                      ))}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {detail.certification.rows.length ? (
                        detail.certification.rows.map((row, idx) => {
                          const pill = statusPill(row.status);
                          return (
                            <div key={idx} style={{ padding: "9px 10px", borderRadius: 12, background: "rgba(248,250,252,1)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a" }}>{row.period}</div>
                                <div style={{ fontSize: 10.5, fontWeight: 800, color: pill.color }}>{pill.label}</div>
                              </div>
                              <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 3 }}>
                                Ratio FMS : {row.ratio_fms || "—"} · Variation montant : {row.variation_montant || "—"}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ fontSize: 12.5, color: "#94a3b8" }}>Aucune certification sur la période</div>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,.06)", padding: "18px" }}>
                  <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Détail billing</h4>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(0,0,0,.06)" }}>
                          {["Période", "HT", "Énergie", "Abonnement", "Cos φ", "Pénalité PS", "Nb jours"].map((h) => (
                            <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontSize: 11, color: "#64748b" }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {detail.billing.rows.length ? (
                          detail.billing.rows.map((row) => (
                            <tr key={row.period} style={{ borderBottom: "1px solid rgba(0,0,0,.04)" }}>
                              <td style={{ padding: "9px 10px", fontWeight: 700, color: "#0f172a" }}>{row.period}</td>
                              <td style={{ padding: "9px 10px" }}>{fmt(row.montant_hors_tva)}</td>
                              <td style={{ padding: "9px 10px" }}>{fmtPlain(row.energie)}</td>
                              <td style={{ padding: "9px 10px" }}>{fmt(row.abonnement)}</td>
                              <td style={{ padding: "9px 10px" }}>{fmt(row.montant_cosinus_phi)}</td>
                              <td style={{ padding: "9px 10px" }}>{fmt(row.penalite_abonnement)}</td>
                              <td style={{ padding: "9px 10px" }}>{row.nb_jours ?? "—"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} style={{ padding: "18px 10px", color: "#94a3b8", textAlign: "center" }}>
                              Aucun billing sur la période
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                <GraphCard title="Évolution des marges">
                  <DetailMargeBarsChart detail={detail} />
                </GraphCard>

                <GraphCard title="Redevance vs Facture HT">
                  <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: "#1e3a8a" }} />
                      <span style={{ fontSize: 11.5, color: "#64748b" }}>Redevance</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: "#E8401C" }} />
                      <span style={{ fontSize: 11.5, color: "#64748b" }}>Facture HT</span>
                    </div>
                  </div>
                  <DetailRedevanceFactureChart detail={detail} />
                </GraphCard>

                <GraphCard title="Impact pénalités Billing">
                  <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: "#b45309" }} />
                      <span style={{ fontSize: 11.5, color: "#64748b" }}>Cos φ</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: "#b91c1c" }} />
                      <span style={{ fontSize: 11.5, color: "#64748b" }}>Pénalité puissance</span>
                    </div>
                  </div>
                  <DetailBillingPenaltyChart detail={detail} />
                </GraphCard>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Onglet analyse ───────────────────────────────────────────────────────────
function AnalysisOverview({
  loading,
  analytics,
}: {
  loading: boolean;
  analytics: AnalyticsFullReport | null;
}) {
  if (loading) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center", color: "#94a3b8" }}>
        <Loader2 size={24} style={{ animation: "spin 1s linear infinite", marginBottom: 8 }} />
        <div style={{ fontSize: 13 }}>Chargement de l’analyse…</div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div
        style={{
          background: "white",
          borderRadius: 18,
          border: "1.5px dashed rgba(30,58,138,.15)",
          padding: "40px 24px",
          textAlign: "center",
        }}
      >
        <Sparkles size={28} color="#cbd5e1" style={{ marginBottom: 10 }} />
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: "0 0 6px", fontFamily: "'Outfit',sans-serif" }}>
          Aucune analyse disponible
        </h3>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
          Lance une évaluation et charge les données de la période sélectionnée.
        </p>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 18 }}>
        {[
          {
            label: "Marge totale",
            value: fmt(analytics.summary.total_marge),
            color: parseFloat(analytics.summary.total_marge || "0") >= 0 ? "#059669" : "#dc2626",
          },
          {
            label: "Taux NOK",
            value: `${analytics.summary.taux_nok_pct}%`,
            color: "#dc2626",
          },
          {
            label: "Sites critique",
            value: String(analytics.summary.count_critique),
            color: "#dc2626",
          },
          {
            label: "Hors catalogue",
            value: String(analytics.summary.count_hc),
            color: "#b45309",
          },
        ].map((card) => (
          <div key={card.label} style={{ background: "white", borderRadius: 16, padding: "16px 18px", border: "1.5px solid rgba(0,0,0,.06)" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: card.color, fontFamily: "'Outfit',sans-serif" }}>{card.value}</div>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "#94a3b8" }}>{card.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 18, marginBottom: 18 }}>
        <div style={{ background: "white", borderRadius: 18, padding: 20, border: "1.5px solid rgba(0,0,0,.06)" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: "0 0 14px" }}>Décomposition des causes</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.entries(analytics.decomposition.causes).map(([key, c]) => (
              <div
                key={key}
                style={{
                  padding: "9px 12px",
                  borderRadius: 12,
                  background: "rgba(248,250,252,1)",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a", textTransform: "capitalize" }}>
                    {key.replaceAll("_", " ")}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    {c.sites_count} site(s) · {c.pct_ecart}% de contribution
                  </div>
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: "#dc2626" }}>{fmt(c.montant_facteur)}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "white", borderRadius: 18, padding: 20, border: "1.5px solid rgba(0,0,0,.06)" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: "0 0 14px" }}>Top sites NOK</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {analytics.top_sites.slice(0, 8).map((s) => (
              <div key={s.site_id} style={{ padding: "9px 12px", borderRadius: 12, background: "rgba(248,250,252,1)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a" }}>{s.site_id}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>
                      {s.nb_mois_nok} mois NOK · {s.zone || "—"}
                    </div>
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: "#dc2626" }}>{fmt(s.marge_totale)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: "white", borderRadius: 18, padding: 20, border: "1.5px solid rgba(0,0,0,.06)" }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: "0 0 14px" }}>Recommandations</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {analytics.recommandations.map((r, i) => (
            <div
              key={i}
              style={{
                borderRadius: 14,
                padding: "12px 14px",
                ...severityStyle(
                  r.priorite === "CRITIQUE"
                    ? "CRITICAL"
                    : r.priorite === "HAUTE"
                      ? "HIGH"
                      : r.priorite === "MOYENNE"
                        ? "MEDIUM"
                        : "LOW"
                ),
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <strong style={{ fontSize: 12.5 }}>{r.titre}</strong>
                <span style={{ fontSize: 10.5, fontWeight: 800 }}>{r.priorite}</span>
              </div>
              <div style={{ fontSize: 12, marginTop: 5, lineHeight: 1.5 }}>{r.description}</div>
              <div style={{ fontSize: 12, marginTop: 5, fontWeight: 700 }}>Action : {r.action}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}


const MONTHS_COURT = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
const periodKey = (y: number, m: number) => y * 100 + m;
const keyToYM   = (k: number) => ({ year: Math.floor(k / 100), month: k % 100 });
const fmtPer    = (y: number, m: number) => `${MONTHS_COURT[m - 1]} ${y}`;
 
const PRESETS_FIN = [
  { label:"Année 2026",       range:[periodKey(2026,1),  periodKey(2026,12)] },
  { label:"Année 2025",       range:[periodKey(2025,1),  periodKey(2025,12)] },
  { label:"Année 2024",       range:[periodKey(2024,1),  periodKey(2024,12)] },
  { label:"Juil 24 → Jun 25", range:[periodKey(2024,7),  periodKey(2025,6)]  },
  { label:"Oct 24 → Mar 25",  range:[periodKey(2024,10), periodKey(2025,3)]  },
  { label:"Jan 25 → Jun 25",  range:[periodKey(2025,1),  periodKey(2025,6)]  },
];
 
function PeriodRangePicker({
  startKey, endKey, onChange,
}: {
  startKey: number; endKey: number;
  onChange: (s: number, e: number) => void;
}) {
  const [open, setOpen]       = useState(false);
  const [sel,  setSel]        = useState<number | null>(null);
  const [hov,  setHov]        = useState<number | null>(null);
  const [ly,   setLy]         = useState(() => keyToYM(startKey).year);
  const [ry,   setRy]         = useState(() => {
    const ey = keyToYM(endKey).year;
    return ey > keyToYM(startKey).year ? ey : keyToYM(startKey).year + 1;
  });
  const ref = useRef<HTMLDivElement>(null);
 
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setSel(null);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
 
  function getCls(k: number) {
    const lo = Math.min(startKey, endKey), hi = Math.max(startKey, endKey);
    if (sel !== null) {
      const hk = hov ?? k;
      const sl = Math.min(sel, hk), sh = Math.max(sel, hk);
      if (k === sel) return "start";
      if (k === hk)  return "end";
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
    if (!sel) { setSel(k); onChange(k, k); }
    else {
      onChange(Math.min(sel, k), Math.max(sel, k));
      setSel(null); setOpen(false);
    }
  }
 
  const navBtn: React.CSSProperties = {
    width: 22, height: 22, borderRadius: 4,
    border: "1.5px solid rgba(0,0,0,.1)", background: "white",
    cursor: "pointer", fontSize: 12, color: "#374151",
    display: "flex", alignItems: "center", justifyContent: "center",
  };
 
  function renderCal(year: number, setYear: (fn: (y: number) => number) => void) {
    return (
      <div style={{ flex: 1 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
          <button style={navBtn} onClick={() => setYear(y => y - 1)} disabled={year <= 2023}>‹</button>
          <span style={{ fontSize:12, fontWeight:700, color:"#0f172a" }}>{year}</span>
          <button style={navBtn} onClick={() => setYear(y => y + 1)} disabled={year >= 2030}>›</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:3 }}>
          {MONTHS_COURT.map((mn, mi) => {
            const k   = periodKey(year, mi + 1);
            const cls = getCls(k);
            return (
              <div key={mi}
                onClick={() => pick(year, mi)}
                onMouseEnter={() => setHov(k)}
                onMouseLeave={() => setHov(null)}
                style={{
                  padding:"5px 3px", borderRadius:6, fontSize:11.5,
                  textAlign:"center", cursor:"pointer", transition:"background .1s",
                  background: cls === "start" || cls === "end" ? "#1e3a8a"
                            : cls === "inrange" ? "rgba(30,58,138,.1)" : "#fff",
                  color: cls === "start" || cls === "end" ? "#fff"
                       : cls === "inrange" ? "#1e3a8a" : "#374151",
                  fontWeight: cls === "start" || cls === "end" ? 700 : 400,
                  border: `1px solid ${cls ? "transparent" : "rgba(0,0,0,.08)"}`,
                }}>
                {mn}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
 
  const lo = Math.min(startKey, endKey), hi = Math.max(startKey, endKey);
  const { year: sy, month: sm } = keyToYM(lo);
  const { year: ey, month: em } = keyToYM(hi);
  const label = lo === hi ? fmtPer(sy, sm) : `${fmtPer(sy, sm)} → ${fmtPer(ey, em)}`;
 
  return (
    <div ref={ref} style={{ position:"relative" }}>
      {/* Trigger */}
      <div
        onClick={() => { setOpen(v => !v); setSel(null); }}
        style={{
          display:"flex", alignItems:"center", gap:7, padding:"7px 12px",
          borderRadius:12, background:"white",
          border: `1.5px solid ${open ? "#1e3a8a" : "rgba(0,0,0,.1)"}`,
          boxShadow:"0 1px 4px rgba(0,0,0,.04)",
          cursor:"pointer", whiteSpace:"nowrap", fontSize:12.5,
        }}
      >
        <CalendarRange size={13} color={open ? "#1e3a8a" : "#94a3b8"} />
        <span style={{ fontWeight:700, color:"#0f172a" }}>{label}</span>
        <span style={{ fontSize:9, color:"#94a3b8" }}>{open ? "▲" : "▼"}</span>
      </div>
 
      {/* Popup */}
      {open && (
        <div style={{
          position:"absolute", top:"calc(100% + 6px)", left:0, zIndex:500,
          background:"#fff", border:"1.5px solid rgba(0,0,0,.1)",
          borderRadius:16, boxShadow:"0 16px 48px rgba(0,0,0,.14)",
          padding:"16px 16px 60px", width:480, display:"flex", gap:14,
        }}>
          {renderCal(ly, setLy)}
          <div style={{ width:1, background:"rgba(0,0,0,.08)" }} />
          {renderCal(ry, setRy)}
 
          {/* Footer presets */}
          <div style={{
            position:"absolute", bottom:0, left:0, right:0,
            borderTop:"1px solid rgba(0,0,0,.07)", padding:"8px 14px",
            background:"#fff", borderRadius:"0 0 16px 16px",
            display:"flex", flexWrap:"wrap", gap:4, alignItems:"center",
          }}>
            {PRESETS_FIN.map((p, i) => (
              <button key={i}
                onClick={() => {
                  onChange(p.range[0] as number, p.range[1] as number);
                  setSel(null); setOpen(false);
                }}
                style={{
                  padding:"3px 9px", borderRadius:5,
                  border:"1.5px solid rgba(0,0,0,.08)",
                  background:"white", fontSize:10.5, color:"#374151",
                  cursor:"pointer", fontWeight:500,
                }}>
                {p.label}
              </button>
            ))}
            {sel !== null && (
              <span style={{ fontSize:11, color:"#1e3a8a", marginLeft:"auto", fontWeight:600 }}>
                Cliquer la date de fin…
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main module content ──────────────────────────────────────────────────────
function FinancialModuleContent({ onLock }: { onLock: () => void }) {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const [startKey, setStartKey] = useState(
    periodKey(currentYear, Math.max(1, currentMonth - 2))
  );
  const [endKey, setEndKey] = useState(
    periodKey(currentYear, currentMonth)
  );
  const [runMonth, setRunMonth] = useState(currentMonth);
  const [runYear,  setRunYear]  = useState(currentYear);   // ← NOUVEAU
 
  // Bornes dérivées (utilisées dans tous les appels API)
  const lo = Math.min(startKey, endKey);
  const hi = Math.max(startKey, endKey);
  const { year: yearStart, month: selectedMonthStart } = keyToYM(lo);
  const { year: yearEnd,   month: selectedMonthEnd   } = keyToYM(hi);
  // Rétrocompat : certains appels legacy utilisent encore `year`
  const year = yearStart;

  const [evaluations, setEvaluations] = useState<FinancialEvaluation[]>([]);
  const [evalStats, setEvalStats] = useState<EvaluationStats | null>(null);
  const [chartData, setChartData] = useState<FacturesRedevancesPeriod[]>([]);
  const [margeData, setMargeData] = useState<SiteMargeRow[]>([]);
  const [recData, setRecData] = useState<SiteRecurrentRow[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsFullReport | null>(null);

  const [loadingEval, setLoadingEval] = useState(false);
  const [loadingChart, setLoadingChart] = useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [runningCalc, setRunningCalc] = useState(false);
  const [evalResult, setEvalResult] = useState<EvaluateResult | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);

  const [filterStatut, setFilterStatut] = useState<"" | "OK" | "NOK">("");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterTypo, setFilterTypo] = useState("");
  const [evalPage, setEvalPage] = useState(1);
  const [evalTotal, setEvalTotal] = useState(0);
  const [evalPages, setEvalPages] = useState(1);
  const [exporting, setExporting] = useState(false);

  const [activeTab, setActiveTab] = useState<"evaluations" | "dashboard" | "recurrents" | "analyse" | "donnees">("evaluations");

  const [showUploadFee, setShowUploadFee] = useState(false);
  const [showUploadLoad, setShowUploadLoad] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<EvaluationDetail | null>(null);


  const [modalSite, setModalSite] = useState<{
    siteId:     string;
    siteName:   string;
    year:       number;
    monthStart: number;
    monthEnd:   number;
  } | null>(null);

  useEffect(() => {
    setEvalPage(1);
  }, [year, selectedMonthStart, selectedMonthEnd, filterStatut, filterSearch, filterTypo]);

  const loadStats = useCallback(async () => {
    try {
      const s = await fetchEvaluationStats({
        year_start:   yearStart,
        month_start:  selectedMonthStart,
        year_end:     yearEnd,
        month_end:    selectedMonthEnd,
      } as any);
      setEvalStats(s);
    } catch {
      // silent
    }
  }, [year, selectedMonthStart, selectedMonthEnd]);

  const loadEvaluations = useCallback(async () => {
    setLoadingEval(true);
    try {
      const params: any = {
        year_start:   yearStart,
        month_start:  selectedMonthStart,
        year_end:     yearEnd,
        month_end:    selectedMonthEnd,
        page:       evalPage,
        page_size:  100,
      };
      if (filterStatut) params.statut = filterStatut;
      if (filterSearch) params.search = filterSearch;
      if (filterTypo) params.typology = filterTypo;

      const res = await fetchEvaluations(params as any);
      setEvaluations(res.results);
      setEvalTotal(res.count);
      setEvalPages(res.pages);
    } catch {
      // silent
    } finally {
      setLoadingEval(false);
    }
  }, [year, selectedMonthStart, selectedMonthEnd, filterStatut, filterSearch, filterTypo, evalPage]);

  const loadChart = useCallback(async () => {
    setLoadingChart(true);
    try {
      const [chart, marge, rec] = await Promise.all([
        fetchFacturesVsRedevances({ year_start:yearStart, month_start:selectedMonthStart, year_end:yearEnd, month_end:selectedMonthEnd } as any),
        fetchMargeParSite({         year_start:yearStart, month_start:selectedMonthStart, year_end:yearEnd, month_end:selectedMonthEnd } as any),
        fetchSitesRecurrents({      year_start:yearStart, month_start:selectedMonthStart, year_end:yearEnd, month_end:selectedMonthEnd } as any),
      ]);
      setChartData(chart);
      setMargeData(marge);
      setRecData(rec);
    } catch {
      // silent
    } finally {
      setLoadingChart(false);
    }
  }, [year, selectedMonthStart, selectedMonthEnd]);

  const loadAnalytics = useCallback(async () => {
    if (activeTab !== "analyse") return;
    setLoadingAnalytics(true);
    try {
       const data = await fetchAnalyticsFullReport({
        year_start:   yearStart,
        month_start:  selectedMonthStart,
        year_end:     yearEnd,
        month_end:    selectedMonthEnd,
      });
      
      setAnalytics(data);
    } catch {
      setAnalytics(null);
    } finally {
      setLoadingAnalytics(false);
    }
  }, [activeTab, year, selectedMonthStart, selectedMonthEnd]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadEvaluations();
  }, [loadEvaluations]);

  useEffect(() => {
    if (activeTab === "dashboard" || activeTab === "recurrents") {
      loadChart();
    }
  }, [activeTab, loadChart]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const openDetail = (siteId: string, siteName?: string) => {
    setModalSite({
        siteId,
        siteName:   siteName || siteId,
        year:       yearStart,   // année de début pour la modal site (mono-année)
        monthStart: selectedMonthStart,
        monthEnd:   selectedMonthEnd,
    });
  };

  const handleEvaluate = async () => {
    setRunningCalc(true);
    setEvalResult(null);
    setEvalError(null);
    try {
      const res = await runEvaluation({ year: runYear, month: runMonth });
      setEvalResult(res);
      await Promise.all([loadStats(), loadEvaluations()]);
      if (activeTab === "dashboard" || activeTab === "recurrents") await loadChart();
      if (activeTab === "analyse") await loadAnalytics();
    } catch (e: any) {
      setEvalError(e?.response?.data?.detail || "Erreur lors du calcul.");
    } finally {
      setRunningCalc(false);
    }
  };

  const margeVal = evalStats ? parseFloat(evalStats.total_marge) : 0;
  const STAT_CARDS = [
    {
      label: "Redevance totale",
      value: evalStats ? fmt(evalStats.total_redevance) : "—",
      icon: <TrendingUp size={17} />,
      color: "#1e3a8a",
      bg: "rgba(30,58,138,.07)",
    },
    {
      label: "Montant facturé HT",
      value: evalStats ? fmt(evalStats.total_facture) : "—",
      icon: <BarChart3 size={17} />,
      color: "#0891b2",
      bg: "rgba(8,145,178,.07)",
    },
    {
      label: "Marge globale",
      value: evalStats ? fmt(evalStats.total_marge) : "—",
      icon: <TrendingDown size={17} />,
      color: !evalStats ? "#94a3b8" : margeVal >= 0 ? "#059669" : "#dc2626",
      bg: !evalStats ? "rgba(0,0,0,.04)" : margeVal >= 0 ? "rgba(5,150,105,.07)" : "rgba(220,38,38,.07)",
    },
    {
      label: "Sites NOK",
      value: evalStats ? String(evalStats.count_nok) : "—",
      icon: <AlertCircle size={17} />,
      color: "#dc2626",
      bg: "rgba(220,38,38,.07)",
    },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <style>{`
        @keyframes fadeIn { from {opacity:0;transform:translateY(8px)} to {opacity:1;transform:translateY(0)} }
        @keyframes spin    { to { transform:rotate(360deg) } }
        @keyframes slideUp { from {opacity:0;transform:translateY(18px)} to {opacity:1;transform:translateY(0)} }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:.5} }
      `}</style>

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 24,
          animation: "fadeIn .3s ease",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg,#1e3a8a,#2d52b8)",
                display: "grid",
                placeItems: "center",
                boxShadow: "0 4px 14px rgba(30,58,138,.25)",
              }}
            >
              <TrendingUp size={18} color="white" />
            </div>
            <h1
              style={{
                fontSize: 21,
                fontWeight: 800,
                color: "#0f172a",
                letterSpacing: "-.03em",
                margin: 0,
                fontFamily: "'Outfit',sans-serif",
              }}
            >
              Évaluation Financière
            </h1>
            <span
              style={{
                padding: "3px 9px",
                borderRadius: 100,
                fontSize: 10,
                fontWeight: 700,
                background: "rgba(5,150,105,.1)",
                border: "1px solid rgba(5,150,105,.15)",
                color: "#059669",
                letterSpacing: ".06em",
              }}
            >
              ACTIF
            </span>
          </div>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
            Marge Redevance Aktivco vs Factures Sénélec — {MONTHS[selectedMonthStart - 1]} à {MONTHS[selectedMonthEnd - 1]} {year}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <PeriodRangePicker
            startKey={startKey}
            endKey={endKey}
            onChange={(s, e) => {
              setStartKey(s);
              setEndKey(e);
              setEvalPage(1);
            }}
          />

          <div style={{
            display:"flex", alignItems:"center", gap:6, padding:"7px 12px",
            borderRadius:12, background:"white",
            border:"1.5px solid rgba(0,0,0,.08)",
            boxShadow:"0 1px 4px rgba(0,0,0,.04)",
          }}>
            <Clock size={13} color="#94a3b8" />
            <span style={{ fontSize:11.5, color:"#64748b", fontWeight:600 }}>Calculer</span>
            <select
              value={runMonth}
              onChange={e => setRunMonth(Number(e.target.value))}
              style={{ border:"none", background:"none", outline:"none",
                fontSize:12.5, fontWeight:700, color:"#0f172a", cursor:"pointer" }}
            >
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select
              value={runYear}
              onChange={e => setRunYear(Number(e.target.value))}
              style={{ border:"none", background:"none", outline:"none",
                fontSize:12.5, fontWeight:700, color:"#1e3a8a", cursor:"pointer" }}
            >
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <button
            onClick={handleEvaluate}
            disabled={runningCalc}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 12,
              border: "none",
              background: runningCalc ? "rgba(30,58,138,.3)" : "linear-gradient(135deg,#1e3a8a,#2d52b8)",
              color: "white",
              cursor: runningCalc ? "not-allowed" : "pointer",
              fontSize: 12.5,
              fontWeight: 600,
              boxShadow: "0 3px 12px rgba(30,58,138,.22)",
            }}
          >
            {runningCalc ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={14} />}
            {runningCalc ? "Calcul…" : "Calculer"}
          </button>

          <button
            onClick={() => setShowUploadFee(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 12px",
              borderRadius: 12,
              background: "white",
              border: "1.5px solid rgba(0,0,0,.08)",
              color: "#374151",
              cursor: "pointer",
              fontSize: 12.5,
              fontWeight: 600,
              boxShadow: "0 1px 4px rgba(0,0,0,.04)",
            }}
          >
            <Upload size={13} /> Redevances
          </button>

          <button
            onClick={() => setShowUploadLoad(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 12px",
              borderRadius: 12,
              background: "white",
              border: "1.5px solid rgba(0,0,0,.08)",
              color: "#374151",
              cursor: "pointer",
              fontSize: 12.5,
              fontWeight: 600,
              boxShadow: "0 1px 4px rgba(0,0,0,.04)",
            }}
          >
            <Layers size={13} /> Loads
          </button>

          <button
            onClick={onLock}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 12px",
              borderRadius: 12,
              background: "white",
              border: "1.5px solid rgba(0,0,0,.08)",
              color: "#64748b",
              cursor: "pointer",
              fontSize: 12.5,
              fontWeight: 600,
              boxShadow: "0 1px 4px rgba(0,0,0,.04)",
              transition: "all .18s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(220,38,38,.3)";
              e.currentTarget.style.color = "#dc2626";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(0,0,0,.08)";
              e.currentTarget.style.color = "#64748b";
            }}
          >
            <Lock size={13} /> Verrouiller
          </button>
        </div>
      </div>

      {(evalResult || evalError) && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            borderRadius: 14,
            animation: "fadeIn .25s ease",
            background: evalError ? "rgba(220,38,38,.07)" : "rgba(5,150,105,.07)",
            border: `1px solid ${evalError ? "rgba(220,38,38,.15)" : "rgba(5,150,105,.15)"}`,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {evalError ? <XCircle size={16} color="#dc2626" /> : <CheckCircle2 size={16} color="#059669" />}
          <span style={{ fontSize: 12.5, fontWeight: 600, color: evalError ? "#dc2626" : "#059669", flex: 1 }}>
            {evalError ||
              (evalResult &&
                `Calcul terminé — ${evalResult.processed} sites traités · ${evalResult.ok} OK · ${evalResult.nok} NOK · ${evalResult.hors_catalogue} hors catalogue${(evalResult as any).periode_courte ? ` · ${(evalResult as any).periode_courte} période<15j` : ""}`)}
          </span>
          <button
            onClick={() => {
              setEvalResult(null);
              setEvalError(null);
            }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "grid", placeItems: "center" }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 22 }}>
        {STAT_CARDS.map((s, i) => (
          <div
            key={i}
            style={{
              background: "white",
              borderRadius: 16,
              padding: "16px 18px",
              border: "1.5px solid rgba(0,0,0,.06)",
              boxShadow: "0 1px 4px rgba(0,0,0,.04)",
              animation: `fadeIn .3s ease ${i * 0.06}s both`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: s.bg, display: "grid", placeItems: "center", color: s.color }}>
                {s.icon}
              </div>
              <ArrowUpRight size={13} color="#e2e8f0" />
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: s.color,
                letterSpacing: "-.02em",
                margin: "10px 0 2px",
                fontFamily: "'Outfit',sans-serif",
              }}
            >
              {loadingEval ? <span style={{ animation: "pulse 1s infinite", color: "#d1d5db" }}>—</span> : s.value}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8" }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 18,
          background: "rgba(0,0,0,.04)",
          padding: 4,
          borderRadius: 14,
          width: "fit-content",
        }}
      >
        {(["evaluations", "dashboard", "recurrents", "analyse", "donnees"] as const).map((tab) => {
          const labels = {
            evaluations: "Résultats",
            dashboard: "Dashboard",
            recurrents: "Sites récurrents",
            analyse: "Analyse",
            donnees: "Données & Imports",
          };
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "7px 16px",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                fontSize: 12.5,
                fontWeight: 600,
                transition: "all .18s",
                background: activeTab === tab ? "white" : "transparent",
                color: activeTab === tab ? "#1e3a8a" : "#64748b",
                boxShadow: activeTab === tab ? "0 1px 6px rgba(0,0,0,.08)" : "none",
              }}
            >
              {labels[tab]}
              {tab === "recurrents" && recData.length > 0 && (
                <span
                  style={{
                    marginLeft: 5,
                    padding: "1px 6px",
                    borderRadius: 100,
                    background: "rgba(220,38,38,.1)",
                    color: "#dc2626",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {recData.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === "evaluations" && (
        <div style={{ animation: "fadeIn .25s ease" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative", minWidth: 180 }}>
              <Search size={13} color="#94a3b8" style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)" }} />
              <input
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder="Site ID ou nom…"
                style={{
                  padding: "6px 10px 6px 28px",
                  borderRadius: 9,
                  border: "1.5px solid rgba(0,0,0,.09)",
                  outline: "none",
                  fontSize: 12.5,
                  color: "#0f172a",
                  background: "white",
                  width: 180,
                }}
              />
            </div>

            <div style={{ position: "relative" }}>
              <Search size={13} color="#94a3b8" style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)" }} />
              <input
                value={filterTypo}
                onChange={(e) => setFilterTypo(e.target.value)}
                placeholder="Typologie…"
                style={{
                  padding: "6px 10px 6px 28px",
                  borderRadius: 9,
                  border: "1.5px solid rgba(0,0,0,.09)",
                  outline: "none",
                  fontSize: 12.5,
                  color: "#0f172a",
                  background: "white",
                  width: 140,
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 4 }}>
              {(["", "OK", "NOK"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatut(s)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 100,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 11.5,
                    fontWeight: 600,
                    transition: "all .15s",
                    background:
                      filterStatut === s
                        ? s === "NOK"
                          ? "#dc2626"
                          : s === "OK"
                            ? "#059669"
                            : "#1e3a8a"
                        : "rgba(0,0,0,.06)",
                    color: filterStatut === s ? "white" : "#64748b",
                  }}
                >
                  {s || "Tous"}
                </button>
              ))}
            </div>

            {loadingEval && <Loader2 size={14} color="#94a3b8" style={{ animation: "spin 1s linear infinite" }} />}

            <span style={{ fontSize: 11.5, color: "#94a3b8", marginLeft: "auto" }}>
              {evalTotal.toLocaleString("fr-FR")} résultat{evalTotal > 1 ? "s" : ""}
            </span>

            <button
              disabled={exporting}
              onClick={async () => {
                setExporting(true);
                try {
                  await exportEvaluationsCSV({
                    year,
                    month_start: selectedMonthStart,
                    month_end: selectedMonthEnd,
                    statut: filterStatut || undefined,
                    search: filterSearch || undefined,
                    typology: filterTypo || undefined,
                  } as any);
                } finally {
                  setExporting(false);
                }
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 12px",
                borderRadius: 9,
                border: "1.5px solid rgba(0,0,0,.09)",
                background: "white",
                cursor: exporting ? "not-allowed" : "pointer",
                fontSize: 12,
                fontWeight: 600,
                color: exporting ? "#94a3b8" : "#374151",
              }}
            >
              {exporting ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={13} />}
              Export CSV
            </button>
          </div>

          {loadingEval && !evaluations.length ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
              <Loader2 size={24} style={{ animation: "spin 1s linear infinite", marginBottom: 8 }} />
              <div>Chargement…</div>
            </div>
          ) : evaluations.length ? (
            <>
              <EvaluationTable items={evaluations} onOpenDetail={openDetail} />

              {evalPages > 1 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, flexWrap: "wrap", gap: 10 }}>
                  <span style={{ fontSize: 12, color: "#64748b" }}>
                    Page {evalPage}/{evalPages} — {evalTotal.toLocaleString("fr-FR")} résultats
                  </span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      disabled={evalPage <= 1}
                      onClick={() => setEvalPage((p) => p - 1)}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 8,
                        border: "1.5px solid rgba(0,0,0,.1)",
                        background: "white",
                        cursor: evalPage <= 1 ? "not-allowed" : "pointer",
                        color: evalPage <= 1 ? "#d1d5db" : "#374151",
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                        fontSize: 12,
                      }}
                    >
                      <ChevronLeft size={13} /> Préc.
                    </button>

                    {Array.from({ length: Math.min(7, evalPages) }, (_, i) => {
                      const p = evalPage <= 4 ? i + 1 : evalPage - 3 + i;
                      if (p < 1 || p > evalPages) return null;
                      return (
                        <button
                          key={p}
                          onClick={() => setEvalPage(p)}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 7,
                            border: "1.5px solid",
                            borderColor: p === evalPage ? "#1e3a8a" : "rgba(0,0,0,.1)",
                            background: p === evalPage ? "#1e3a8a" : "white",
                            cursor: "pointer",
                            color: p === evalPage ? "white" : "#374151",
                            fontSize: 11.5,
                            fontWeight: p === evalPage ? 700 : 500,
                          }}
                        >
                          {p}
                        </button>
                      );
                    })}

                    <button
                      disabled={evalPage >= evalPages}
                      onClick={() => setEvalPage((p) => p + 1)}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 8,
                        border: "1.5px solid rgba(0,0,0,.1)",
                        background: "white",
                        cursor: evalPage >= evalPages ? "not-allowed" : "pointer",
                        color: evalPage >= evalPages ? "#d1d5db" : "#374151",
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                        fontSize: 12,
                      }}
                    >
                      Suiv. <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div
              style={{
                background: "white",
                borderRadius: 18,
                border: "1.5px dashed rgba(30,58,138,.15)",
                padding: "40px 24px",
                textAlign: "center",
              }}
            >
              <BarChart3 size={28} color="#cbd5e1" style={{ marginBottom: 10 }} />
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#0f172a",
                  margin: "0 0 6px",
                  fontFamily: "'Outfit',sans-serif",
                }}
              >
                Aucune évaluation pour la période sélectionnée
              </h3>
              <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px" }}>
                Clique sur <strong>Calculer</strong> pour lancer l'évaluation financière.
              </p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                <button
                  onClick={() => setShowUploadFee(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 14px",
                    borderRadius: 11,
                    background: "rgba(30,58,138,.07)",
                    border: "none",
                    color: "#1e3a8a",
                    cursor: "pointer",
                    fontSize: 12.5,
                    fontWeight: 600,
                  }}
                >
                  <Upload size={13} /> Importer redevances
                </button>
                <button
                  onClick={handleEvaluate}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 14px",
                    borderRadius: 11,
                    background: "linear-gradient(135deg,#1e3a8a,#2d52b8)",
                    border: "none",
                    color: "white",
                    cursor: "pointer",
                    fontSize: 12.5,
                    fontWeight: 600,
                  }}
                >
                  <RefreshCw size={13} /> Calculer
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "dashboard" && (
        <div style={{ animation: "fadeIn .25s ease" }}>
          {loadingChart ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "#94a3b8" }}>
              <Loader2 size={24} style={{ animation: "spin 1s linear infinite", marginBottom: 8 }} />
              <div style={{ fontSize: 13 }}>Chargement du dashboard…</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              <div style={{ background: "white", borderRadius: 18, padding: 22, border: "1.5px solid rgba(0,0,0,.06)", gridColumn: "1 / -1" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                    Factures vs Redevances — {MONTHS[selectedMonthStart - 1]} à {MONTHS[selectedMonthEnd - 1]} {year}
                  </h3>
                  <div style={{ display: "flex", gap: 12 }}>
                    {[{ color: "#1e3a8a", label: "Redevance" }, { color: "#E8401C", label: "Facture" }].map((l) => (
                      <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
                        <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {chartData.length ? (
                  <MiniBarChart data={chartData} />
                ) : (
                  <div style={{ textAlign: "center", padding: "20px 0", color: "#94a3b8", fontSize: 12.5 }}>
                    Aucune donnée — lance une évaluation d'abord
                  </div>
                )}
              </div>

              <div style={{ background: "white", borderRadius: 18, padding: 22, border: "1.5px solid rgba(0,0,0,.06)" }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: "0 0 14px" }}>Top sites — marge la plus faible</h3>
                {margeData.length ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {margeData.slice(0, 6).map((row, i) => {
                      const m = parseFloat(row.marge_moyenne);
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 12, background: i === 0 ? "rgba(220,38,38,.04)" : "rgba(248,250,252,1)" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", width: 16 }}>{i + 1}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 12.5,
                                fontWeight: 600,
                                color: "#0f172a",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {row.site_id}
                            </div>
                            <div style={{ fontSize: 11, color: "#94a3b8" }}>
                              {row.nb_nok}/{row.nb_mois} mois NOK
                            </div>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: m < 0 ? "#dc2626" : "#059669", whiteSpace: "nowrap" }}>
                            {fmt(row.marge_moyenne)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ fontSize: 12.5, color: "#94a3b8", textAlign: "center", padding: "12px 0" }}>Aucune donnée</p>
                )}
              </div>

              <div style={{ background: "white", borderRadius: 18, padding: 22, border: "1.5px solid rgba(0,0,0,.06)" }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: "0 0 14px" }}>Résumé mensuel</h3>
                {chartData.length ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {chartData.slice(-6).reverse().map((d, i) => {
                      const marge = parseFloat(d.total_marge);
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 10, background: "rgba(248,250,252,1)" }}>
                          <span style={{ fontSize: 11.5, fontWeight: 600, color: "#374151", flex: 1 }}>{d.period}</span>
                          <span style={{ fontSize: 10.5, color: "#64748b" }}>
                            {d.sites_ok} OK · {d.sites_nok} NOK
                          </span>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: marge >= 0 ? "#059669" : "#dc2626", whiteSpace: "nowrap" }}>
                            {fmt(d.total_marge)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ fontSize: 12.5, color: "#94a3b8", textAlign: "center", padding: "12px 0" }}>Aucune donnée</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "recurrents" && (
        <div style={{ animation: "fadeIn .25s ease" }}>
          {loadingChart ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "#94a3b8" }}>
              <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : recData.length ? (
            <div>
              <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                {[
                  { type: "critique", count: recData.filter((r) => r.recurrence_type === "critique").length, color: "#dc2626", bg: "rgba(220,38,38,.08)" },
                  { type: "light", count: recData.filter((r) => r.recurrence_type === "light").length, color: "#b45309", bg: "rgba(245,158,11,.08)" },
                ].map((s) => (
                  <div key={s.type} style={{ padding: "8px 16px", borderRadius: 12, background: s.bg, border: `1px solid ${s.color}22` }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: s.color, fontFamily: "'Outfit',sans-serif" }}>{s.count}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: s.color, marginLeft: 6 }}>{s.type}</span>
                  </div>
                ))}
              </div>
              <div style={{ overflowX: "auto", borderRadius: 16, border: "1.5px solid rgba(0,0,0,.06)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "rgba(30,58,138,.04)", borderBottom: "1.5px solid rgba(0,0,0,.06)" }}>
                      {["Site", "Type récurrence", "Mois NOK", "Marge moyenne"].map((h) => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#374151", fontSize: 11 }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recData.map((r, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid rgba(0,0,0,.05)", background: i % 2 === 0 ? "white" : "rgba(248,250,252,.6)" }}>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ fontWeight: 600, color: "#0f172a" }}>{r.site_id}</div>
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>{r.site_name}</div>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <span
                            style={{
                              padding: "3px 9px",
                              borderRadius: 100,
                              fontSize: 10.5,
                              fontWeight: 700,
                              background: r.recurrence_type === "critique" ? "rgba(220,38,38,.1)" : "rgba(245,158,11,.1)",
                              color: r.recurrence_type === "critique" ? "#dc2626" : "#b45309",
                            }}
                          >
                            {r.recurrence_type === "critique" ? "⚠ Critique" : "Light"}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px", fontWeight: 600, color: "#374151" }}>{r.mois_nok}</td>
                        <td style={{ padding: "10px 14px", fontWeight: 700, color: parseFloat(r.marge_moyenne) < 0 ? "#dc2626" : "#059669" }}>
                          {fmt(r.marge_moyenne)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div
              style={{
                background: "white",
                borderRadius: 18,
                border: "1.5px dashed rgba(5,150,105,.2)",
                padding: "40px 24px",
                textAlign: "center",
              }}
            >
              <CheckCircle2 size={28} color="#059669" style={{ marginBottom: 10 }} />
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: "0 0 6px", fontFamily: "'Outfit',sans-serif" }}>
                Aucun site récurrent NOK
              </h3>
              <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
                Excellent — aucun site ne présente de marge négative récurrente.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === "analyse" && (
        <div style={{ animation: "fadeIn .25s ease" }}>
          <AnalysisOverview loading={loadingAnalytics} analytics={analytics} />
        </div>
      )}

      {activeTab === "donnees" && (
        <div style={{ animation: "fadeIn .25s ease" }}>
          <FinancialDataPage />
        </div>
      )}

      <AnalysisDrawer
          open={detailOpen}
          loading={detailLoading}
          detail={detailData}
          onClose={() => setDetailOpen(false)}
        />
        
        {/* ✅ NOUVEAU — Modal détail site avec comparaison conso multi-sources */}
        {modalSite && (
          <FinancialSiteDetailModal
            siteId={modalSite.siteId}
            siteName={modalSite.siteName}
            year={modalSite.year}
            monthStart={modalSite.monthStart}
            monthEnd={modalSite.monthEnd}
            onClose={() => setModalSite(null)}
          />
        )}

      {showUploadFee && (
        <UploadModal
          title="Catalogue Redevances"
          description="Fichier Redevance_et_Cible_Akt.xlsx — Typologie | Load | Config | Redevance | Cible"
          accept=".xlsx,.xls"
          onClose={() => setShowUploadFee(false)}
          onUpload={async (file) => {
            const res = await importFeeRules(file);
            return { created: res.created, updated: res.updated, skipped: res.skipped, errors_sample: res.errors_sample };
          }}
        />
      )}

      {showUploadLoad && (
        <UploadModal
          title="Loads Mensuels"
          description="CSV : Site_ID | Site_Name | Année | Mois | Load"
          accept=".csv,.xlsx,.xls"
          onClose={() => setShowUploadLoad(false)}
          onUpload={async (file) => {
            const res = await importMonthlyLoads(file);
            return { created: res.created, updated: res.updated, skipped: (res as any).skipped || (res as any).skipped_sites_inconnus || 0, errors_sample: res.errors_sample };
          }}
        />
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
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
