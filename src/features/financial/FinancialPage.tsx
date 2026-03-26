// src/features/financial/FinancialPage.tsx
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
  type FinancialEvaluation,
  type EvaluationStats,
  type FacturesRedevancesPeriod,
  type SiteMargeRow,
  type SiteRecurrentRow,
  type EvaluateResult,
} from "./api";
import {
  TrendingUp, TrendingDown, Upload, RefreshCw, AlertCircle,
  Clock, BarChart3, ArrowUpRight, Layers, ChevronRight, Lock,
  CheckCircle2, XCircle, X, FileUp,
  Loader2, ArrowDown, ArrowUp, Minus, Search, Download,
  ChevronLeft,
} from "lucide-react";
import FinancialDataPage from "./FinancialDataPage";
// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];

function fmt(v: string | null | undefined, suffix = " FCFA"): string {
  if (!v || v === "0.000") return "—";
  const n = parseFloat(v);
  if (isNaN(n)) return "—";
  if (Math.abs(n) >= 1_000_000)
    return (n / 1_000_000).toFixed(1).replace(".", ",") + " M" + suffix;
  if (Math.abs(n) >= 1_000)
    return Math.round(n).toLocaleString("fr-FR") + suffix;
  return n.toFixed(0) + suffix;
}

function margeColor(v: string | null) {
  if (!v) return "#94a3b8";
  return parseFloat(v) >= 0 ? "#059669" : "#dc2626";
}

// ─── Upload modal ──────────────────────────────────────────────────────────────
interface UploadModalProps {
  title: string;
  description: string;
  accept?: string;
  onClose: () => void;
  onUpload: (file: File) => Promise<{ created: number; updated: number; skipped: number; errors_sample?: any[] }>;
}

function UploadModal({ title, description, accept = ".xlsx,.xls,.csv", onClose, onUpload }: UploadModalProps) {
  const [file, setFile]         = useState<File | null>(null);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<{ created: number; updated: number; skipped: number; errors_sample?: any[] } | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true); setError(null);
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
      style={{ position:"fixed", inset:0, zIndex:300, background:"rgba(15,23,42,.6)", backdropFilter:"blur(8px)",
        display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}
      onClick={e => e.target === e.currentTarget && !loading && onClose()}
    >
      <div style={{
        background:"white", borderRadius:24, padding:32, maxWidth:460, width:"100%",
        boxShadow:"0 32px 80px rgba(0,0,0,.22)",
        animation:"slideUp .22s cubic-bezier(.34,1.4,.64,1)",
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
          <div>
            <h3 style={{ fontSize:16, fontWeight:700, color:"#0f172a", margin:"0 0 4px" }}>{title}</h3>
            <p style={{ fontSize:12.5, color:"#64748b", margin:0 }}>{description}</p>
          </div>
          {!loading && (
            <button onClick={onClose} style={{ background:"rgba(0,0,0,.06)", border:"none", borderRadius:9,
              padding:6, cursor:"pointer", color:"#64748b", display:"grid", placeItems:"center" }}>
              <X size={15} />
            </button>
          )}
        </div>

        {!result ? (
          <>
            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              style={{
                border: `2px dashed ${dragging ? "#1e3a8a" : file ? "rgba(5,150,105,.4)" : "rgba(30,58,138,.2)"}`,
                borderRadius:16, padding:"28px 20px", textAlign:"center", cursor:"pointer",
                background: dragging ? "rgba(30,58,138,.04)" : file ? "rgba(5,150,105,.03)" : "rgba(248,250,252,1)",
                transition:"all .18s", marginBottom:16,
              }}
            >
              <input ref={inputRef} type="file" accept={accept} style={{ display:"none" }}
                onChange={e => e.target.files?.[0] && setFile(e.target.files[0])} />
              <FileUp size={28} color={file ? "#059669" : "#94a3b8"} style={{ marginBottom:10 }} />
              {file ? (
                <div>
                  <p style={{ fontSize:13, fontWeight:600, color:"#059669", margin:"0 0 2px" }}>{file.name}</p>
                  <p style={{ fontSize:11.5, color:"#94a3b8", margin:0 }}>{(file.size/1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize:13, fontWeight:600, color:"#374151", margin:"0 0 2px" }}>
                    Glisser-déposer ou cliquer pour sélectionner
                  </p>
                  <p style={{ fontSize:11.5, color:"#94a3b8", margin:0 }}>{accept}</p>
                </div>
              )}
            </div>

            {error && (
              <div style={{ padding:"10px 14px", borderRadius:12, background:"rgba(220,38,38,.07)",
                border:"1px solid rgba(220,38,38,.15)", marginBottom:14,
                fontSize:12.5, color:"#dc2626", fontWeight:500 }}>
                ⚠ {error}
              </div>
            )}

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={onClose} style={{ flex:1, padding:"9px 0", borderRadius:12,
                border:"1.5px solid rgba(0,0,0,.1)", background:"white",
                fontSize:13, fontWeight:600, color:"#374151", cursor:"pointer" }}>
                Annuler
              </button>
              <button
                disabled={!file || loading}
                onClick={handleSubmit}
                style={{ flex:2, padding:"9px 0", borderRadius:12, border:"none",
                  background: file && !loading ? "linear-gradient(135deg,#1e3a8a,#2d52b8)" : "rgba(30,58,138,.25)",
                  fontSize:13, fontWeight:600, color:"white",
                  cursor: file && !loading ? "pointer" : "not-allowed",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}
              >
                {loading && <Loader2 size={14} style={{ animation:"spin 1s linear infinite" }} />}
                {loading ? "Import en cours…" : "Importer"}
              </button>
            </div>
          </>
        ) : (
          /* Result state */
          <div>
            <div style={{ textAlign:"center", padding:"8px 0 20px" }}>
              <CheckCircle2 size={40} color="#059669" style={{ marginBottom:10 }} />
              <h4 style={{ fontSize:15, fontWeight:700, color:"#0f172a", margin:"0 0 14px" }}>
                Import terminé
              </h4>
              <div style={{ display:"flex", justifyContent:"center", gap:12 }}>
                {[
                  { label:"Créés", value:result.created, color:"#059669" },
                  { label:"Maj", value:result.updated, color:"#0891b2" },
                  { label:"Ignorés", value:result.skipped, color:"#f59e0b" },
                ].map(s => (
                  <div key={s.label} style={{ padding:"10px 16px", borderRadius:12,
                    background:`rgba(0,0,0,.03)`, border:"1px solid rgba(0,0,0,.06)" }}>
                    <div style={{ fontSize:20, fontWeight:800, color:s.color, fontFamily:"'Outfit',sans-serif" }}>
                      {s.value}
                    </div>
                    <div style={{ fontSize:11, fontWeight:600, color:"#94a3b8" }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {result.errors_sample && result.errors_sample.length > 0 && (
                <div style={{ marginTop:14, padding:"10px 14px", borderRadius:12,
                  background:"rgba(245,158,11,.07)", border:"1px solid rgba(245,158,11,.15)",
                  textAlign:"left" }}>
                  <p style={{ fontSize:11.5, fontWeight:600, color:"#92400e", margin:"0 0 4px" }}>
                    {result.errors_sample.length} erreur(s) :
                  </p>
                  {result.errors_sample.slice(0, 3).map((e: any, i: number) => (
                    <p key={i} style={{ fontSize:11, color:"#b45309", margin:"2px 0 0" }}>
                      Ligne {e.row || i+1} : {e.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
            <button onClick={onClose} style={{ width:"100%", padding:"10px 0", borderRadius:12, border:"none",
              background:"linear-gradient(135deg,#1e3a8a,#2d52b8)",
              fontSize:13, fontWeight:600, color:"white", cursor:"pointer" }}>
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Evaluation results table ──────────────────────────────────────────────────
function EvaluationTable({ items }: { items: FinancialEvaluation[] }) {
  if (!items.length) return null;
  return (
    <div style={{ overflowX:"auto", borderRadius:16, border:"1.5px solid rgba(0,0,0,.06)" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12.5 }}>
        <thead>
          <tr style={{ background:"rgba(30,58,138,.04)", borderBottom:"1.5px solid rgba(0,0,0,.06)" }}>
            {["Site","Typologie","Config","Load (W)","Redevance","Montant HT","Marge","Statut","Récurrence"].map(h => (
              <th key={h} style={{ padding:"10px 12px", textAlign:"left", fontWeight:700,
                color:"#374151", whiteSpace:"nowrap", fontSize:11 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((ev, i) => {
            const marge = ev.marge ? parseFloat(ev.marge) : null;
            return (
              <tr key={ev.id} style={{ borderBottom:"1px solid rgba(0,0,0,.05)",
                background: i % 2 === 0 ? "white" : "rgba(248,250,252,.6)" }}>
                <td style={{ padding:"10px 12px" }}>
                  <div style={{ fontWeight:600, color:"#0f172a" }}>{ev.site_id}</div>
                  <div style={{ fontSize:11, color:"#94a3b8", maxWidth:120, overflow:"hidden",
                    textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ev.site_name}</div>
                </td>
                <td style={{ padding:"10px 12px", maxWidth:160 }}>
                  {ev.typology ? (
                    <span title={ev.typology} style={{
                      fontSize:11, fontWeight:600, color:"#374151",
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                      display:"block", maxWidth:150,
                    }}>{ev.typology}</span>
                  ) : <span style={{color:"#d1d5db"}}>—</span>}
                </td>
                <td style={{ padding:"10px 12px", color:"#374151" }}>{ev.configuration || "—"}</td>
                <td style={{ padding:"10px 12px", color:"#374151" }}>
                  {ev.load_w ? ev.load_w.toLocaleString("fr-FR") : "—"}
                  {ev.hors_catalogue && (
                    <span title="Hors catalogue — load interpolé" style={{ marginLeft:4, fontSize:9,
                      padding:"1px 5px", borderRadius:100,
                      background:"rgba(245,158,11,.1)", color:"#b45309", fontWeight:700 }}>HC</span>
                  )}
                </td>
                <td style={{ padding:"10px 12px", color:"#374151", whiteSpace:"nowrap" }}>
                  {fmt(ev.redevance)}
                </td>
                <td style={{ padding:"10px 12px", color:"#374151", whiteSpace:"nowrap" }}>
                  {fmt(ev.montant_htva)}
                </td>
                <td style={{ padding:"10px 12px", fontWeight:700, whiteSpace:"nowrap",
                  color: marge !== null ? margeColor(ev.marge) : "#94a3b8" }}>
                  {marge !== null ? (
                    <span style={{ display:"flex", alignItems:"center", gap:3 }}>
                      {marge > 0 ? <ArrowUp size={11} /> : marge < 0 ? <ArrowDown size={11} /> : <Minus size={11} />}
                      {fmt(ev.marge)}
                    </span>
                  ) : "—"}
                </td>
                <td style={{ padding:"10px 12px" }}>
                  <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                    {ev.marge_statut ? (
                      <span style={{
                        padding:"3px 10px", borderRadius:100, fontSize:10.5, fontWeight:700,
                        background: ev.marge_statut === "OK" ? "rgba(5,150,105,.1)" : "rgba(220,38,38,.1)",
                        color: ev.marge_statut === "OK" ? "#059669" : "#dc2626",
                        display:"inline-block", width:"fit-content",
                      }}>
                        {ev.marge_statut}
                      </span>
                    ) : "—"}
                    {ev.periode_courte && (
                      <span title={`Période courte : ${ev.nb_jours_factures}j < 15j — marge forcée à 0`}
                        style={{ padding:"2px 7px", borderRadius:100, fontSize:9.5, fontWeight:700,
                          background:"rgba(99,102,241,.1)", color:"#4f46e5",
                          display:"inline-block", width:"fit-content", cursor:"help" }}>
                        ⏱ {ev.nb_jours_factures}j
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ padding:"10px 12px" }}>
                  {ev.recurrence_type ? (
                    <span style={{
                      padding:"3px 8px", borderRadius:100, fontSize:10, fontWeight:700,
                      background: ev.recurrence_type === "critique" ? "rgba(220,38,38,.1)" : "rgba(245,158,11,.1)",
                      color: ev.recurrence_type === "critique" ? "#dc2626" : "#b45309",
                    }}>
                      {ev.recurrence_type === "critique" ? "⚠ Critique" : "Light"}
                      {ev.recurrence_mois_nok > 0 && ` (${ev.recurrence_mois_nok}m)`}
                    </span>
                  ) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Dashboard chart (simple bars) ────────────────────────────────────────────
function MiniBarChart({ data }: { data: FacturesRedevancesPeriod[] }) {
  if (!data.length) return null;
  const maxVal = Math.max(...data.flatMap(d => [parseFloat(d.total_redevance||"0"), parseFloat(d.total_facture||"0")]));
  return (
    <div style={{ display:"flex", gap:8, alignItems:"flex-end", height:80 }}>
      {data.slice(-8).map((d, i) => {
        const rev = parseFloat(d.total_redevance || "0");
        const fac = parseFloat(d.total_facture || "0");
        const hRev = maxVal ? (rev / maxVal) * 80 : 0;
        const hFac = maxVal ? (fac / maxVal) * 80 : 0;
        return (
          <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
            <div style={{ display:"flex", gap:2, alignItems:"flex-end", height:70 }}>
              <div title={`Redevance: ${fmt(d.total_redevance)}`} style={{
                width:10, height:Math.max(hRev, 2), borderRadius:"3px 3px 0 0",
                background:"linear-gradient(180deg,#1e3a8a,#2d52b8)", transition:"height .3s",
              }}/>
              <div title={`Facture: ${fmt(d.total_facture)}`} style={{
                width:10, height:Math.max(hFac, 2), borderRadius:"3px 3px 0 0",
                background:"linear-gradient(180deg,#E8401C,#ff6340)", transition:"height .3s",
              }}/>
            </div>
            <span style={{ fontSize:9, color:"#94a3b8", textAlign:"center",
              transform:"rotate(-45deg)", transformOrigin:"center",
              whiteSpace:"nowrap" }}>
              {d.period.slice(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main module content ───────────────────────────────────────────────────────
function FinancialModuleContent({ onLock }: { onLock: () => void }) {
  const [year, setYear]   = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  // Data states
  const [evaluations,  setEvaluations]  = useState<FinancialEvaluation[]>([]);
  const [evalStats,    setEvalStats]    = useState<EvaluationStats | null>(null);
  const [chartData,    setChartData]    = useState<FacturesRedevancesPeriod[]>([]);
  const [margeData,    setMargeData]    = useState<SiteMargeRow[]>([]);
  const [recData,      setRecData]      = useState<SiteRecurrentRow[]>([]);

  // Loading states
  const [loadingEval,    setLoadingEval]    = useState(false);
  const [loadingChart,   setLoadingChart]   = useState(false);
  const [runningCalc,    setRunningCalc]    = useState(false);
  const [evalResult,     setEvalResult]     = useState<EvaluateResult | null>(null);
  const [evalError,      setEvalError]      = useState<string | null>(null);

  // Filter state
  const [filterStatut,  setFilterStatut]  = useState<"" | "OK" | "NOK">("");
  const [filterSearch,  setFilterSearch]  = useState("");
  const [filterTypo,    setFilterTypo]    = useState("");
  const [evalPage,      setEvalPage]      = useState(1);
  const [evalTotal,     setEvalTotal]     = useState(0);
  const [evalPages,     setEvalPages]     = useState(1);
  const [exporting,     setExporting]     = useState(false);
  const [activeTab, setActiveTab]         = useState<"evaluations" | "dashboard" | "recurrents" | "donnees">("evaluations");

  // Upload modals
  const [showUploadFee,  setShowUploadFee]  = useState(false);
  const [showUploadLoad, setShowUploadLoad] = useState(false);

  // ── Stats viennent de l'endpoint /stats/ (agrégat complet, pas la page) ────

  // Reset page when filters change
  useEffect(() => { setEvalPage(1); }, [year, month, filterStatut, filterSearch, filterTypo]);

  // ── Load stats (cards) — indépendant des filtres de liste ─────────────────
  const loadStats = useCallback(async () => {
    try {
      const s = await fetchEvaluationStats({ year, month });
      setEvalStats(s);
    } catch { /* silent */ }
  }, [year, month]);

  // ── Load evaluations (table paginée) ──────────────────────────────────────
  const loadEvaluations = useCallback(async () => {
    setLoadingEval(true);
    try {
      const params: any = { year, month, page: evalPage, page_size: 100 };
      if (filterStatut)  params.statut   = filterStatut;
      if (filterSearch)  params.search   = filterSearch;
      if (filterTypo)    params.typology = filterTypo;
      const res = await fetchEvaluations(params);
      setEvaluations(res.results);
      setEvalTotal(res.count);
      setEvalPages(res.pages);
    } catch { /* silent */ }
    finally { setLoadingEval(false); }
  }, [year, month, filterStatut, filterSearch, filterTypo, evalPage]);

  // ── Load dashboard chart data ─────────────────────────────────────────────────
  const loadChart = useCallback(async () => {
    setLoadingChart(true);
    try {
      const [chart, marge, rec] = await Promise.all([
        fetchFacturesVsRedevances(year),
        fetchMargeParSite({ year, month }),
        fetchSitesRecurrents(),
      ]);
      setChartData(chart);
      setMargeData(marge);
      setRecData(rec);
    } catch { /* silent */ }
    finally { setLoadingChart(false); }
  }, [year, month]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadEvaluations(); }, [loadEvaluations]);
  useEffect(() => { if (activeTab === "dashboard" || activeTab === "recurrents") loadChart(); }, [activeTab, loadChart]);

  // ── Run evaluation ────────────────────────────────────────────────────────────
  const handleEvaluate = async () => {
    setRunningCalc(true); setEvalResult(null); setEvalError(null);
    try {
      const res = await runEvaluation({ year, month });
      setEvalResult(res);
      await Promise.all([loadStats(), loadEvaluations()]);
      if (activeTab === "dashboard") await loadChart();
    } catch (e: any) {
      setEvalError(e?.response?.data?.detail || "Erreur lors du calcul.");
    } finally {
      setRunningCalc(false);
    }
  };

  const margeVal = evalStats ? parseFloat(evalStats.total_marge) : 0;
  const STAT_CARDS = [
    { label:"Redevance totale",   value: evalStats ? fmt(evalStats.total_redevance) : "—",
      icon:<TrendingUp size={17}/>, color:"#1e3a8a", bg:"rgba(30,58,138,.07)" },
    { label:"Montant facturé HT", value: evalStats ? fmt(evalStats.total_facture) : "—",
      icon:<BarChart3 size={17}/>, color:"#0891b2", bg:"rgba(8,145,178,.07)" },
    { label:"Marge globale",      value: evalStats ? fmt(evalStats.total_marge) : "—",
      icon:<TrendingDown size={17}/>,
      color: !evalStats ? "#94a3b8" : margeVal >= 0 ? "#059669" : "#dc2626",
      bg:    !evalStats ? "rgba(0,0,0,.04)" : margeVal >= 0 ? "rgba(5,150,105,.07)" : "rgba(220,38,38,.07)" },
    { label:"Sites NOK",          value: evalStats ? String(evalStats.count_nok) : "—",
      icon:<AlertCircle size={17}/>, color:"#dc2626", bg:"rgba(220,38,38,.07)" },
  ];

  return (
    <div style={{ maxWidth:1200, margin:"0 auto" }}>
      <style>{`
        @keyframes fadeIn { from {opacity:0;transform:translateY(8px)} to {opacity:1;transform:translateY(0)} }
        @keyframes spin    { to { transform:rotate(360deg) } }
        @keyframes slideUp { from {opacity:0;transform:translateY(18px)} to {opacity:1;transform:translateY(0)} }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:.5} }
      `}</style>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between",
        flexWrap:"wrap", gap:16, marginBottom:24, animation:"fadeIn .3s ease" }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:5 }}>
            <div style={{ width:36, height:36, borderRadius:10,
              background:"linear-gradient(135deg,#1e3a8a,#2d52b8)",
              display:"grid", placeItems:"center", boxShadow:"0 4px 14px rgba(30,58,138,.25)" }}>
              <TrendingUp size={18} color="white"/>
            </div>
            <h1 style={{ fontSize:21, fontWeight:800, color:"#0f172a",
              letterSpacing:"-.03em", margin:0, fontFamily:"'Outfit',sans-serif" }}>
              Évaluation Financière
            </h1>
            <span style={{ padding:"3px 9px", borderRadius:100, fontSize:10, fontWeight:700,
              background:"rgba(5,150,105,.1)", border:"1px solid rgba(5,150,105,.15)", color:"#059669", letterSpacing:".06em" }}>
              ACTIF
            </span>
          </div>
          <p style={{ fontSize:13, color:"#64748b", margin:0 }}>
            Marge Redevance Aktivco vs Factures Sénélec — {MONTHS[month-1]} {year}
          </p>
        </div>

        {/* Controls */}
        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
          {/* Month/Year */}
          <div style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 12px",
            borderRadius:12, background:"white", border:"1.5px solid rgba(0,0,0,.08)",
            boxShadow:"0 1px 4px rgba(0,0,0,.04)" }}>
            <Clock size={13} color="#94a3b8"/>
            <select value={month} onChange={e => setMonth(Number(e.target.value))}
              style={{ border:"none", background:"none", outline:"none",
                fontSize:12.5, fontWeight:600, color:"#0f172a", cursor:"pointer" }}>
              {MONTHS.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              style={{ border:"none", background:"none", outline:"none",
                fontSize:12.5, fontWeight:600, color:"#0f172a", cursor:"pointer" }}>
              {[2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Run evaluation */}
          <button onClick={handleEvaluate} disabled={runningCalc}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px",
              borderRadius:12, border:"none",
              background: runningCalc ? "rgba(30,58,138,.3)" : "linear-gradient(135deg,#1e3a8a,#2d52b8)",
              color:"white", cursor: runningCalc ? "not-allowed" : "pointer",
              fontSize:12.5, fontWeight:600, boxShadow:"0 3px 12px rgba(30,58,138,.22)" }}>
            {runningCalc
              ? <Loader2 size={14} style={{ animation:"spin 1s linear infinite" }}/>
              : <RefreshCw size={14}/>}
            {runningCalc ? "Calcul…" : "Calculer"}
          </button>

          {/* Import fee rules */}
          <button onClick={() => setShowUploadFee(true)}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 12px",
              borderRadius:12, background:"white", border:"1.5px solid rgba(0,0,0,.08)",
              color:"#374151", cursor:"pointer", fontSize:12.5, fontWeight:600,
              boxShadow:"0 1px 4px rgba(0,0,0,.04)" }}>
            <Upload size={13}/> Redevances
          </button>

          {/* Import loads */}
          <button onClick={() => setShowUploadLoad(true)}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 12px",
              borderRadius:12, background:"white", border:"1.5px solid rgba(0,0,0,.08)",
              color:"#374151", cursor:"pointer", fontSize:12.5, fontWeight:600,
              boxShadow:"0 1px 4px rgba(0,0,0,.04)" }}>
            <Layers size={13}/> Loads
          </button>

          {/* Lock */}
          <button onClick={onLock}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 12px",
              borderRadius:12, background:"white", border:"1.5px solid rgba(0,0,0,.08)",
              color:"#64748b", cursor:"pointer", fontSize:12.5, fontWeight:600,
              boxShadow:"0 1px 4px rgba(0,0,0,.04)", transition:"all .18s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor="rgba(220,38,38,.3)"; e.currentTarget.style.color="#dc2626"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor="rgba(0,0,0,.08)"; e.currentTarget.style.color="#64748b"; }}>
            <Lock size={13}/> Verrouiller
          </button>
        </div>
      </div>

      {/* ── Eval result toast ────────────────────────────────────────────────── */}
      {(evalResult || evalError) && (
        <div style={{ marginBottom:16, padding:"12px 16px", borderRadius:14, animation:"fadeIn .25s ease",
          background: evalError ? "rgba(220,38,38,.07)" : "rgba(5,150,105,.07)",
          border: `1px solid ${evalError ? "rgba(220,38,38,.15)" : "rgba(5,150,105,.15)"}`,
          display:"flex", alignItems:"center", gap:10 }}>
          {evalError
            ? <XCircle size={16} color="#dc2626"/>
            : <CheckCircle2 size={16} color="#059669"/>}
          <span style={{ fontSize:12.5, fontWeight:600, color: evalError ? "#dc2626" : "#059669", flex:1 }}>
            {evalError || (evalResult && `Calcul terminé — ${evalResult.processed} sites traités · ${evalResult.ok} OK · ${evalResult.nok} NOK · ${evalResult.hors_catalogue} hors catalogue${evalResult.periode_courte ? ` · ${evalResult.periode_courte} période<15j` : ""}`)}
          </span>
          <button onClick={() => { setEvalResult(null); setEvalError(null); }}
            style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8", display:"grid", placeItems:"center" }}>
            <X size={14}/>
          </button>
        </div>
      )}

      {/* ── Stats row ────────────────────────────────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",
        gap:12, marginBottom:22 }}>
        {STAT_CARDS.map((s,i) => (
          <div key={i} style={{ background:"white", borderRadius:16, padding:"16px 18px",
            border:"1.5px solid rgba(0,0,0,.06)", boxShadow:"0 1px 4px rgba(0,0,0,.04)",
            animation:`fadeIn .3s ease ${i*0.06}s both` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div style={{ width:34, height:34, borderRadius:10, background:s.bg,
                display:"grid", placeItems:"center", color:s.color }}>
                {s.icon}
              </div>
              <ArrowUpRight size={13} color="#e2e8f0"/>
            </div>
            <div style={{ fontSize:20, fontWeight:800, color:s.color || "#0f172a",
              letterSpacing:"-.02em", margin:"10px 0 2px", fontFamily:"'Outfit',sans-serif" }}>
              {loadingEval ? <span style={{ animation:"pulse 1s infinite", color:"#d1d5db" }}>—</span> : s.value}
            </div>
            <div style={{ fontSize:11, fontWeight:600, color:"#94a3b8" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <div style={{ display:"flex", gap:4, marginBottom:18,
        background:"rgba(0,0,0,.04)", padding:4, borderRadius:14,
        width:"fit-content" }}>
        {(["evaluations","dashboard","recurrents","donnees"] as const).map(tab => {
          const labels = {
            evaluations: "Résultats",
            dashboard:   "Dashboard",
            recurrents:  "Sites récurrents",
            donnees:     "Données & Imports",
          };
          return (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ padding:"7px 16px", borderRadius:10, border:"none", cursor:"pointer",
                fontSize:12.5, fontWeight:600, transition:"all .18s",
                background: activeTab === tab ? "white" : "transparent",
                color: activeTab === tab ? "#1e3a8a" : "#64748b",
                boxShadow: activeTab === tab ? "0 1px 6px rgba(0,0,0,.08)" : "none" }}>
              {labels[tab]}
              {tab === "recurrents" && recData.length > 0 && (
                <span style={{ marginLeft:5, padding:"1px 6px", borderRadius:100,
                  background:"rgba(220,38,38,.1)", color:"#dc2626", fontSize:10, fontWeight:700 }}>
                  {recData.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab: Evaluations ─────────────────────────────────────────────────── */}
      {activeTab === "evaluations" && (
        <div style={{ animation:"fadeIn .25s ease" }}>
          {/* Filter bar */}
          <div style={{ display:"flex", gap:8, marginBottom:14, alignItems:"center", flexWrap:"wrap" }}>
            {/* Search */}
            <div style={{ position:"relative", minWidth:180 }}>
              <Search size={13} color="#94a3b8" style={{ position:"absolute", left:9, top:"50%", transform:"translateY(-50%)" }}/>
              <input value={filterSearch} onChange={e=>setFilterSearch(e.target.value)}
                placeholder="Site ID ou nom…"
                style={{ padding:"6px 10px 6px 28px", borderRadius:9, border:"1.5px solid rgba(0,0,0,.09)",
                  outline:"none", fontSize:12.5, color:"#0f172a", background:"white", width:180 }}/>
            </div>
            {/* Typo filter */}
            <div style={{ position:"relative" }}>
              <Search size={13} color="#94a3b8" style={{ position:"absolute", left:9, top:"50%", transform:"translateY(-50%)" }}/>
              <input value={filterTypo} onChange={e=>setFilterTypo(e.target.value)}
                placeholder="Typologie…"
                style={{ padding:"6px 10px 6px 28px", borderRadius:9, border:"1.5px solid rgba(0,0,0,.09)",
                  outline:"none", fontSize:12.5, color:"#0f172a", background:"white", width:140 }}/>
            </div>
            {/* Statut */}
            <div style={{ display:"flex", gap:4 }}>
              {(["","OK","NOK"] as const).map(s => (
                <button key={s} onClick={() => setFilterStatut(s)}
                  style={{ padding:"5px 12px", borderRadius:100, border:"none", cursor:"pointer",
                    fontSize:11.5, fontWeight:600, transition:"all .15s",
                    background: filterStatut === s
                      ? s === "NOK" ? "#dc2626" : s === "OK" ? "#059669" : "#1e3a8a"
                      : "rgba(0,0,0,.06)",
                    color: filterStatut === s ? "white" : "#64748b" }}>
                  {s || "Tous"}
                </button>
              ))}
            </div>
            {loadingEval && <Loader2 size={14} color="#94a3b8" style={{ animation:"spin 1s linear infinite" }}/>}
            <span style={{ fontSize:11.5, color:"#94a3b8", marginLeft:"auto" }}>
              {evalTotal.toLocaleString("fr-FR")} résultat{evalTotal > 1 ? "s" : ""}
            </span>
            {/* Export CSV */}
            <button
              disabled={exporting}
              onClick={async () => {
                setExporting(true);
                try {
                  await exportEvaluationsCSV({
                    year, month,
                    statut:   filterStatut || undefined,
                    search:   filterSearch || undefined,
                    typology: filterTypo   || undefined,
                  });
                } finally { setExporting(false); }
              }}
              style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 12px",
                borderRadius:9, border:"1.5px solid rgba(0,0,0,.09)",
                background:"white", cursor: exporting ? "not-allowed" : "pointer",
                fontSize:12, fontWeight:600, color: exporting ? "#94a3b8" : "#374151" }}>
              {exporting
                ? <Loader2 size={13} style={{ animation:"spin 1s linear infinite" }}/>
                : <Download size={13}/>}
              Export CSV
            </button>
          </div>

          {loadingEval && !evaluations.length ? (
            <div style={{ padding:"40px 0", textAlign:"center", color:"#94a3b8", fontSize:13 }}>
              <Loader2 size={24} style={{ animation:"spin 1s linear infinite", marginBottom:8 }}/>
              <div>Chargement…</div>
            </div>
          ) : evaluations.length ? (
            <>
              <EvaluationTable items={evaluations} />
              {/* Pagination */}
              {evalPages > 1 && (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                  marginTop:14, flexWrap:"wrap", gap:10 }}>
                  <span style={{ fontSize:12, color:"#64748b" }}>
                    Page {evalPage}/{evalPages} — {evalTotal.toLocaleString("fr-FR")} résultats
                  </span>
                  <div style={{ display:"flex", gap:6 }}>
                    <button disabled={evalPage<=1} onClick={()=>setEvalPage(p=>p-1)}
                      style={{ padding:"5px 10px", borderRadius:8, border:"1.5px solid rgba(0,0,0,.1)",
                        background:"white", cursor:evalPage<=1?"not-allowed":"pointer",
                        color:evalPage<=1?"#d1d5db":"#374151", display:"flex", alignItems:"center", gap:3, fontSize:12 }}>
                      <ChevronLeft size={13}/> Préc.
                    </button>
                    {Array.from({length:Math.min(7,evalPages)},(_,i)=>{
                      const p = evalPage<=4?i+1:evalPage-3+i;
                      if(p<1||p>evalPages) return null;
                      return (
                        <button key={p} onClick={()=>setEvalPage(p)}
                          style={{ width:28, height:28, borderRadius:7, border:"1.5px solid",
                            borderColor:p===evalPage?"#1e3a8a":"rgba(0,0,0,.1)",
                            background:p===evalPage?"#1e3a8a":"white", cursor:"pointer",
                            color:p===evalPage?"white":"#374151", fontSize:11.5, fontWeight:p===evalPage?700:500 }}>
                          {p}
                        </button>
                      );
                    })}
                    <button disabled={evalPage>=evalPages} onClick={()=>setEvalPage(p=>p+1)}
                      style={{ padding:"5px 10px", borderRadius:8, border:"1.5px solid rgba(0,0,0,.1)",
                        background:"white", cursor:evalPage>=evalPages?"not-allowed":"pointer",
                        color:evalPage>=evalPages?"#d1d5db":"#374151", display:"flex", alignItems:"center", gap:3, fontSize:12 }}>
                      Suiv. <ChevronRight size={13}/>
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ background:"white", borderRadius:18, border:"1.5px dashed rgba(30,58,138,.15)",
              padding:"40px 24px", textAlign:"center" }}>
              <BarChart3 size={28} color="#cbd5e1" style={{ marginBottom:10 }}/>
              <h3 style={{ fontSize:15, fontWeight:700, color:"#0f172a", margin:"0 0 6px",
                fontFamily:"'Outfit',sans-serif" }}>
                Aucune évaluation pour {MONTHS[month-1]} {year}
              </h3>
              <p style={{ fontSize:13, color:"#64748b", margin:"0 0 16px" }}>
                Cliquez sur <strong>Calculer</strong> pour lancer l'évaluation financière.
              </p>
              <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap" }}>
                <button onClick={() => setShowUploadFee(true)}
                  style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px",
                    borderRadius:11, background:"rgba(30,58,138,.07)", border:"none",
                    color:"#1e3a8a", cursor:"pointer", fontSize:12.5, fontWeight:600 }}>
                  <Upload size={13}/> Importer redevances
                </button>
                <button onClick={handleEvaluate}
                  style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px",
                    borderRadius:11, background:"linear-gradient(135deg,#1e3a8a,#2d52b8)", border:"none",
                    color:"white", cursor:"pointer", fontSize:12.5, fontWeight:600 }}>
                  <RefreshCw size={13}/> Calculer
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Dashboard ───────────────────────────────────────────────────── */}
      {activeTab === "dashboard" && (
        <div style={{ animation:"fadeIn .25s ease" }}>
          {loadingChart ? (
            <div style={{ padding:"40px 0", textAlign:"center", color:"#94a3b8" }}>
              <Loader2 size={24} style={{ animation:"spin 1s linear infinite", marginBottom:8 }}/>
              <div style={{ fontSize:13 }}>Chargement du dashboard…</div>
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:18 }}>

              {/* Chart: Factures vs Redevances */}
              <div style={{ background:"white", borderRadius:18, padding:22,
                border:"1.5px solid rgba(0,0,0,.06)", gridColumn:"1 / -1" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                  <h3 style={{ fontSize:14, fontWeight:700, color:"#0f172a", margin:0 }}>
                    Factures vs Redevances — {year}
                  </h3>
                  <div style={{ display:"flex", gap:12 }}>
                    {[{color:"#1e3a8a",label:"Redevance"},{color:"#E8401C",label:"Facture"}].map(l => (
                      <div key={l.label} style={{ display:"flex", alignItems:"center", gap:5 }}>
                        <div style={{ width:8, height:8, borderRadius:2, background:l.color }}/>
                        <span style={{ fontSize:11, color:"#64748b", fontWeight:500 }}>{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {chartData.length ? <MiniBarChart data={chartData}/> : (
                  <div style={{ textAlign:"center", padding:"20px 0", color:"#94a3b8", fontSize:12.5 }}>
                    Aucune donnée — lancez une évaluation d'abord
                  </div>
                )}
              </div>

              {/* Top sites marge négative */}
              <div style={{ background:"white", borderRadius:18, padding:22,
                border:"1.5px solid rgba(0,0,0,.06)" }}>
                <h3 style={{ fontSize:14, fontWeight:700, color:"#0f172a", margin:"0 0 14px" }}>
                  Top sites — marge la plus faible
                </h3>
                {margeData.length ? (
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {margeData.slice(0,6).map((row, i) => {
                      const m = parseFloat(row.marge_moyenne);
                      return (
                        <div key={i} style={{ display:"flex", alignItems:"center", gap:10,
                          padding:"8px 12px", borderRadius:12,
                          background: i === 0 ? "rgba(220,38,38,.04)" : "rgba(248,250,252,1)" }}>
                          <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", width:16 }}>{i+1}</div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:12.5, fontWeight:600, color:"#0f172a",
                              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              {row.site_id}
                            </div>
                            <div style={{ fontSize:11, color:"#94a3b8" }}>{row.nb_nok}/{row.nb_mois} mois NOK</div>
                          </div>
                          <span style={{ fontSize:12, fontWeight:700, color: m < 0 ? "#dc2626" : "#059669",
                            whiteSpace:"nowrap" }}>
                            {fmt(row.marge_moyenne)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : <p style={{ fontSize:12.5, color:"#94a3b8", textAlign:"center", padding:"12px 0" }}>
                  Aucune donnée
                </p>}
              </div>

              {/* Summary by period */}
              <div style={{ background:"white", borderRadius:18, padding:22,
                border:"1.5px solid rgba(0,0,0,.06)" }}>
                <h3 style={{ fontSize:14, fontWeight:700, color:"#0f172a", margin:"0 0 14px" }}>
                  Résumé mensuel
                </h3>
                {chartData.length ? (
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {chartData.slice(-6).reverse().map((d, i) => {
                      const marge = parseFloat(d.total_marge);
                      return (
                        <div key={i} style={{ display:"flex", alignItems:"center", gap:10,
                          padding:"7px 10px", borderRadius:10, background:"rgba(248,250,252,1)" }}>
                          <span style={{ fontSize:11.5, fontWeight:600, color:"#374151", flex:1 }}>{d.period}</span>
                          <span style={{ fontSize:10.5, color:"#64748b" }}>
                            {d.sites_ok} OK · {d.sites_nok} NOK
                          </span>
                          <span style={{ fontSize:11.5, fontWeight:700,
                            color: marge >= 0 ? "#059669" : "#dc2626", whiteSpace:"nowrap" }}>
                            {fmt(d.total_marge)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : <p style={{ fontSize:12.5, color:"#94a3b8", textAlign:"center", padding:"12px 0" }}>
                  Aucune donnée
                </p>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Sites récurrents ─────────────────────────────────────────────── */}
      {activeTab === "recurrents" && (
        <div style={{ animation:"fadeIn .25s ease" }}>
          {loadingChart ? (
            <div style={{ padding:"40px 0", textAlign:"center", color:"#94a3b8" }}>
              <Loader2 size={24} style={{ animation:"spin 1s linear infinite" }}/>
            </div>
          ) : recData.length ? (
            <div>
              <div style={{ display:"flex", gap:10, marginBottom:14 }}>
                {[
                  { type:"critique", count:recData.filter(r=>r.recurrence_type==="critique").length, color:"#dc2626", bg:"rgba(220,38,38,.08)" },
                  { type:"light",    count:recData.filter(r=>r.recurrence_type==="light").length,    color:"#b45309", bg:"rgba(245,158,11,.08)" },
                ].map(s => (
                  <div key={s.type} style={{ padding:"8px 16px", borderRadius:12,
                    background:s.bg, border:`1px solid ${s.color}22` }}>
                    <span style={{ fontSize:18, fontWeight:800, color:s.color,
                      fontFamily:"'Outfit',sans-serif" }}>{s.count}</span>
                    <span style={{ fontSize:11.5, fontWeight:600, color:s.color, marginLeft:6 }}>
                      {s.type}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ overflowX:"auto", borderRadius:16, border:"1.5px solid rgba(0,0,0,.06)" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12.5 }}>
                  <thead>
                    <tr style={{ background:"rgba(30,58,138,.04)", borderBottom:"1.5px solid rgba(0,0,0,.06)" }}>
                      {["Site","Type récurrence","Mois NOK","Marge moyenne"].map(h => (
                        <th key={h} style={{ padding:"10px 14px", textAlign:"left",
                          fontWeight:700, color:"#374151", fontSize:11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recData.map((r, i) => (
                      <tr key={i} style={{ borderBottom:"1px solid rgba(0,0,0,.05)",
                        background: i%2===0 ? "white" : "rgba(248,250,252,.6)" }}>
                        <td style={{ padding:"10px 14px" }}>
                          <div style={{ fontWeight:600, color:"#0f172a" }}>{r.site_id}</div>
                          <div style={{ fontSize:11, color:"#94a3b8" }}>{r.site_name}</div>
                        </td>
                        <td style={{ padding:"10px 14px" }}>
                          <span style={{ padding:"3px 9px", borderRadius:100, fontSize:10.5, fontWeight:700,
                            background: r.recurrence_type==="critique" ? "rgba(220,38,38,.1)" : "rgba(245,158,11,.1)",
                            color: r.recurrence_type==="critique" ? "#dc2626" : "#b45309" }}>
                            {r.recurrence_type==="critique" ? "⚠ Critique" : "Light"}
                          </span>
                        </td>
                        <td style={{ padding:"10px 14px", fontWeight:600, color:"#374151" }}>{r.mois_nok}</td>
                        <td style={{ padding:"10px 14px", fontWeight:700,
                          color: parseFloat(r.marge_moyenne)<0 ? "#dc2626" : "#059669" }}>
                          {fmt(r.marge_moyenne)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ background:"white", borderRadius:18, border:"1.5px dashed rgba(5,150,105,.2)",
              padding:"40px 24px", textAlign:"center" }}>
              <CheckCircle2 size={28} color="#059669" style={{ marginBottom:10 }}/>
              <h3 style={{ fontSize:15, fontWeight:700, color:"#0f172a", margin:"0 0 6px",
                fontFamily:"'Outfit',sans-serif" }}>Aucun site récurrent NOK</h3>
              <p style={{ fontSize:13, color:"#64748b", margin:0 }}>
                Excellent — aucun site ne présente de marge négative récurrente.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Données & Imports ──────────────────────────────────────────── */}
      {activeTab === "donnees" && (
        <div style={{ animation:"fadeIn .25s ease" }}>
          <FinancialDataPage />
        </div>
      )}

      {/* ── Upload modals ────────────────────────────────────────────────────── */}
      {showUploadFee && (
        <UploadModal
          title="Catalogue Redevances"
          description="Fichier Redevance_et_Cible_Akt.xlsx — Typologie | Load | Config | Redevance | Cible"
          accept=".xlsx,.xls"
          onClose={() => setShowUploadFee(false)}
          onUpload={async (file) => {
            const res = await importFeeRules(file);
            return { created:res.created, updated:res.updated, skipped:res.skipped, errors_sample:res.errors_sample };
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
            return { created:res.created, updated:res.updated, skipped:res.skipped, errors_sample:res.errors_sample };
          }}
        />
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function FinancialPage() {
  const [unlocked, setUnlocked] = useState(isFinancialUnlocked);

  const handleUnlock = () => { financialUnlock(); setUnlocked(true); };
  const handleLock   = () => { financialLock();   setUnlocked(false); };

  if (!unlocked) return <FinancialAccessGate onUnlock={handleUnlock} />;
  return <FinancialModuleContent onLock={handleLock} />;
}