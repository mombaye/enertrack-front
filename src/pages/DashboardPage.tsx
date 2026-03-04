// src/pages/DashboardPage.tsx
import { useMemo, useState, useEffect, useRef } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
} from "recharts";
import {
  Zap, TrendingUp, BarChart3, ShieldCheck, FileSpreadsheet,
  ArrowRight, CheckCircle2, AlertTriangle, Clock, Database,
  Activity, Calendar, RefreshCw, Wifi,
} from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { getDashboardSummary } from "@/services/dashboard";
import type { DashboardCertBatch } from "@/services/dashboard";

// ─── Tokens ──────────────────────────────────────────────────────────────────
const T = {
  blue:   "#1e3a8a",
  blueMd: "#1e40af",
  orange: "#E8401C",
  white:  "#ffffff",
  off:    "#f0f4ff",
  offDk:  "#f8faff",
  border: "rgba(30,58,138,.09)",
  shadow: "0 1px 3px rgba(30,58,138,.04), 0 8px 28px rgba(30,58,138,.06)",
  sm:     "0 1px 3px rgba(30,58,138,.04)",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function defaultRange() {
  const now = new Date();
  return { start: fmtDate(new Date(now.getFullYear(), 0, 1)), end: fmtDate(now) };
}
function money(v: string | number | null | undefined, short = false): string {
  if (v == null) return "—";
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/\s/g,"").replace(",","."));
  if (isNaN(n)) return "—";
  if (short) {
    if (Math.abs(n) >= 1e9) return `${(n/1e9).toFixed(1)} Md`;
    if (Math.abs(n) >= 1e6) return `${(n/1e6).toFixed(1)} M`;
    if (Math.abs(n) >= 1e3) return `${(n/1e3).toFixed(0)} k`;
  }
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + " F";
}
function numFmt(v: number): string {
  return new Intl.NumberFormat("fr-FR").format(v);
}
function fmtDateTime(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleString("fr-FR", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" });
}
function pct(n: number, t: number) { return t === 0 ? 0 : Math.round(n/t*100); }

// ─── Counter animation ────────────────────────────────────────────────────────
function AnimatedNum({ target, prefix = "", suffix = "", duration = 1000 }: {
  target: number; prefix?: string; suffix?: string; duration?: number;
}) {
  const [val, setVal] = useState(0);
  const raf = useRef<number | null>(null);
  const start = useRef<number | null>(null);

  useEffect(() => {
    if (!target) { setVal(0); return; }
    start.current = null;
    const step = (ts: number) => {
      if (!start.current) start.current = ts;
      const prog = Math.min((ts - start.current) / duration, 1);
      const ease = 1 - Math.pow(1 - prog, 3);
      setVal(Math.round(target * ease));
      if (prog < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration]);

  return <>{prefix}{numFmt(val)}{suffix}</>;
}

// ─── OrangeBar ────────────────────────────────────────────────────────────────
function OrangeBar() {
  return <div style={{ position:"absolute",top:0,left:0,right:0,height:3, background:`linear-gradient(90deg,${T.orange},#ff7350,transparent)` }}/>;
}

// ─── SectionTitle ─────────────────────────────────────────────────────────────
function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
      <div style={{ width:28, height:28, borderRadius:8, background:`${T.blue}10`, display:"grid", placeItems:"center", color:T.blue }}>
        {icon}
      </div>
      <span style={{ fontFamily:"'Outfit',sans-serif", fontSize:13, fontWeight:800, color:"#0f172a" }}>{children}</span>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon, accent, delay = 0 }: {
  label: string; value: React.ReactNode; sub?: string;
  icon: React.ReactNode; accent?: string; delay?: number;
}) {
  return (
    <div style={{
      background: T.white, borderRadius: 16,
      border: `1px solid ${T.border}`, padding: "18px 20px",
      boxShadow: T.shadow,
      display: "flex", flexDirection: "column", gap: 12,
      animation: `db-in .4s cubic-bezier(.22,1,.36,1) ${delay}s both`,
      transition: "box-shadow .2s, transform .2s",
    }}
    onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = "0 4px 20px rgba(30,58,138,.12)"; el.style.transform = "translateY(-2px)"; }}
    onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = T.shadow; el.style.transform = "translateY(0)"; }}
    >
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ fontSize:10.5, fontWeight:700, color:"#94a3b8", letterSpacing:".06em", textTransform:"uppercase" as const }}>{label}</span>
        <div style={{ width:32,height:32,borderRadius:9,
          background: accent ? `${accent}15` : `${T.blue}10`,
          display:"grid", placeItems:"center", color: accent || T.blue }}>
          {icon}
        </div>
      </div>
      <div style={{ fontFamily:"'Outfit',sans-serif", fontSize:22, fontWeight:800, color:"#0f172a", letterSpacing:"-.025em", lineHeight:1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize:11, color:"#94a3b8" }}>{sub}</div>}
    </div>
  );
}

// ─── Chart card wrapper ───────────────────────────────────────────────────────
function ChartCard({ title, icon, children, delay = 0, style }: {
  title: string; icon: React.ReactNode; children: React.ReactNode;
  delay?: number; style?: React.CSSProperties;
}) {
  return (
    <div style={{
      background: T.white, borderRadius: 16,
      border: `1px solid ${T.border}`, padding: "20px",
      boxShadow: T.shadow,
      animation: `db-in .4s cubic-bezier(.22,1,.36,1) ${delay}s both`,
      ...style,
    }}>
      <SectionTitle icon={icon}>{title}</SectionTitle>
      {children}
    </div>
  );
}

// ─── Cert ring ────────────────────────────────────────────────────────────────
function CertRing({ batch }: { batch: DashboardCertBatch }) {
  const t = batch.total || 1;
  const certPct = pct(batch.certified_fms + batch.certified_senelec, t);
  const C = 2 * Math.PI * 38;

  const bars = [
    { label:"Certifié FMS",     val:batch.certified_fms,    color:"#10b981", light:"#f0fdf4", text:"#059669" },
    { label:"Certifié Sénélec", val:batch.certified_senelec,color:T.blue,    light:"#eff6ff", text:T.blue    },
    { label:"À analyser",       val:batch.needs_review,     color:"#f59e0b", light:"#fffbeb", text:"#b45309" },
    { label:"Contrat inconnu",  val:batch.unknown_contract, color:"#ef4444", light:"#fef2f2", text:"#dc2626" },
    { label:"FMS indispo",      val:batch.fms_unavailable,  color:"#cbd5e1", light:"#f8fafc", text:"#64748b" },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      {/* Ring + label */}
      <div style={{ display:"flex", alignItems:"center", gap:20 }}>
        <div style={{ position:"relative", width:88, height:88, flexShrink:0 }}>
          <svg style={{ width:88,height:88,transform:"rotate(-90deg)" }} viewBox="0 0 88 88">
            <circle cx="44" cy="44" r="38" fill="none" stroke="#e2e8f0" strokeWidth="8"/>
            <circle cx="44" cy="44" r="38" fill="none"
              stroke={certPct >= 80 ? "#10b981" : certPct >= 50 ? T.blue : "#f59e0b"}
              strokeWidth="8"
              strokeDasharray={String(C)}
              strokeDashoffset={String(C * (1 - certPct/100))}
              strokeLinecap="round"
              style={{ transition:"stroke-dashoffset 1s cubic-bezier(.22,1,.36,1)" }}
            />
          </svg>
          <div style={{ position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center" }}>
            <span style={{ fontFamily:"'Outfit',sans-serif",fontSize:19,fontWeight:800,color:"#0f172a",lineHeight:1 }}>{certPct}%</span>
            <span style={{ fontSize:9,color:"#94a3b8",marginTop:1 }}>certifié</span>
          </div>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"'Outfit',sans-serif",fontSize:14,fontWeight:800,color:"#0f172a",marginBottom:2 }}>
            Échéance {batch.echeance}
          </div>
          <div style={{ fontSize:11,color:"#94a3b8",marginBottom:8 }}>
            {numFmt(batch.total)} factures · {fmtDateTime(batch.finished_at || batch.launched_at)}
          </div>
          {/* Stacked bar */}
          <div style={{ height:7,borderRadius:100,overflow:"hidden",background:"#e2e8f0",display:"flex" }}>
            {bars.map((b,i) => b.val > 0 && (
              <div key={i} style={{ background:b.color, width:`${pct(b.val,t)}%`, transition:"width .8s ease" }}/>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
        {bars.map((b,i) => (
          <div key={i} style={{
            display:"flex", alignItems:"center", justifyContent:"space-between",
            padding:"7px 10px", borderRadius:9,
            background:b.light, border:`1px solid ${b.color}25`,
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:7,height:7,borderRadius:"50%",background:b.color,flexShrink:0 }}/>
              <span style={{ fontSize:11,color:"#64748b" }}>{b.label}</span>
            </div>
            <span style={{ fontFamily:"'Outfit',sans-serif",fontSize:13,fontWeight:800,color:b.text }}>{b.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────
function ChartTip({ active, payload, label, mode = "money" }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background:T.white, border:`1px solid ${T.border}`,
      borderRadius:10, padding:"10px 14px",
      boxShadow:"0 4px 20px rgba(30,58,138,.1)",
      fontFamily:"'DM Sans',sans-serif", fontSize:12,
    }}>
      <div style={{ fontWeight:700, color:"#0f172a", marginBottom:6 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
          <div style={{ width:8,height:8,borderRadius:"50%",background:p.color,flexShrink:0 }}/>
          <span style={{ color:"#64748b" }}>{p.name}</span>
          <span style={{ fontWeight:700, color:"#0f172a", marginLeft:"auto" }}>
            {mode === "money" ? money(p.value, true) : numFmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label:string; color:string; bg:string; border:string }> = {
  VALIDATED: { label:"Validée",   color:"#059669", bg:"#f0fdf4", border:"#a7f3d0" },
  CREATED:   { label:"Créée",     color:"#1e40af", bg:"#eff6ff", border:"#bfdbfe" },
  CONTESTED: { label:"Contestée", color:"#d97706", bg:"#fffbeb", border:"#fde68a" },
  DONE:      { label:"Terminé",   color:"#059669", bg:"#f0fdf4", border:"#a7f3d0" },
  RUNNING:   { label:"En cours",  color:"#1e40af", bg:"#eff6ff", border:"#bfdbfe" },
  FAILED:    { label:"Échec",     color:"#dc2626", bg:"#fef2f2", border:"#fecaca" },
  PENDING:   { label:"En attente",color:"#64748b", bg:"#f8fafc", border:"#e2e8f0" },
};
function StatusPill({ status }: { status: string }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.PENDING;
  return (
    <span style={{
      fontSize:10, padding:"2px 9px", borderRadius:100, fontWeight:700,
      color:c.color, background:c.bg, border:`1px solid ${c.border}`,
      whiteSpace:"nowrap",
    }}>{c.label}</span>
  );
}

// ─── Date input ───────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  background:T.offDk, border:`1.5px solid ${T.border}`,
  borderRadius:8, padding:"6px 10px", fontSize:12,
  fontWeight:600, color:T.blue,
  fontFamily:"'DM Sans',sans-serif", outline:"none",
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  const def = useMemo(() => defaultRange(), []);
  const [start, setStart] = useState(def.start);
  const [end,   setEnd]   = useState(def.end);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["dashboard-summary", start, end],
    queryFn: () => getDashboardSummary({ start, end }),
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
  });

  const b = data?.billing;
  const c = data?.certification;

  // Pie data
  const pieData = useMemo(() => (b?.status_distribution ?? []).map(d => ({
    name: STATUS_CFG[d.status]?.label ?? d.status,
    value: d.count,
    pct: d.percent,
    color: d.status === "VALIDATED" ? "#10b981" : d.status === "CREATED" ? T.blue : "#f59e0b",
  })), [b]);

  // Cert global rate as bars
  const certBars = useMemo(() => c ? [
    { label:"Certifié FMS",     val:c.global_rate.certified_fms,     color:"#10b981" },
    { label:"Certifié Sénélec", val:c.global_rate.certified_senelec, color:T.blue    },
    { label:"À analyser",       val:c.global_rate.needs_review,      color:"#f59e0b" },
    { label:"Inconnu",          val:c.global_rate.unknown_contract,  color:"#ef4444" },
    { label:"FMS indispo",      val:c.global_rate.fms_unavailable,   color:"#cbd5e1" },
  ] : [], [c]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800;900&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        .db, .db * { font-family:'DM Sans',sans-serif; box-sizing:border-box; }
        .db .display { font-family:'Outfit',sans-serif; }

        @keyframes db-in {
          from { opacity:0; transform:translateY(10px); }
          to   { opacity:1; transform:translateY(0);    }
        }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes pulse-dot {
          0%,100% { opacity:1; box-shadow:0 0 0 0 rgba(16,185,129,.4); }
          50%     { opacity:.8; box-shadow:0 0 0 5px rgba(16,185,129,0); }
        }

        .db input[type=date]:focus { border-color:${T.blue} !important; box-shadow:0 0 0 3px rgba(30,58,138,.09) !important; }

        .db .recharts-cartesian-grid-horizontal line,
        .db .recharts-cartesian-grid-vertical line { stroke:rgba(30,58,138,.06); }

        .db .history-row {
          display:flex; align-items:center; justify-content:space-between;
          padding:9px 14px; border-radius:9px;
          border:1px solid rgba(30,58,138,.07);
          background:white; transition:background .12s;
        }
        .db .history-row:hover { background:${T.offDk}; }
      `}</style>

      <div className="db" style={{ display:"flex", flexDirection:"column", gap:16 }}>

        {/* ══ PAGE HEADER ══════════════════════════════════════════════════════ */}
        <div style={{
          background:T.white, borderRadius:20,
          border:`1px solid ${T.border}`, boxShadow:T.shadow,
          position:"relative", overflow:"hidden",
          animation:"db-in .35s cubic-bezier(.22,1,.36,1) both",
        }}>
          <OrangeBar/>
          <div style={{ padding:"22px 24px 20px" }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
              {/* Left: title */}
              <div>
                <div style={{
                  display:"inline-flex", alignItems:"center", gap:6,
                  background:"rgba(232,64,28,.08)", border:"1px solid rgba(232,64,28,.18)",
                  borderRadius:100, padding:"3px 10px", marginBottom:8,
                }}>
                  <div style={{ width:5,height:5,borderRadius:"50%",background:T.orange, animation:"pulse-dot 2s infinite" }}/>
                  <span style={{ fontSize:10,fontWeight:700,letterSpacing:".12em",color:T.orange,textTransform:"uppercase" }}>
                    EnerTrack Live
                  </span>
                </div>
                <h1 className="display" style={{ fontSize:22,fontWeight:900,color:"#0f172a",letterSpacing:"-.03em",margin:0,lineHeight:1.2 }}>
                  Tableau de bord
                </h1>
                <p style={{ fontSize:13, color:"#64748b", marginTop:4 }}>
                  Vue globale · Facturation Sénélec × Certification FMS
                </p>
              </div>

              {/* Right: date range + refresh */}
              <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                <div style={{ display:"flex", alignItems:"center", gap:6,
                  padding:"6px 12px", borderRadius:10,
                  background:T.offDk, border:`1px solid ${T.border}` }}>
                  <Calendar style={{width:13,height:13,color:"#94a3b8"}}/>
                  <input type="date" value={start}
                    onChange={e => setStart(e.target.value)}
                    style={inputStyle}
                  />
                  <span style={{ fontSize:11,color:"#94a3b8" }}>→</span>
                  <input type="date" value={end}
                    onChange={e => setEnd(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <button
                  onClick={() => refetch()}
                  disabled={isFetching}
                  style={{
                    width:36,height:36, borderRadius:9,
                    border:`1px solid ${T.border}`,
                    background:T.white, cursor:"pointer",
                    display:"grid", placeItems:"center",
                    color:"#94a3b8", transition:"all .15s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = T.blue; (e.currentTarget as HTMLButtonElement).style.background = T.offDk; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8"; (e.currentTarget as HTMLButtonElement).style.background = T.white; }}
                >
                  <RefreshCw style={{ width:14,height:14, animation: isFetching ? "spin .8s linear infinite" : "none" }}/>
                </button>
              </div>
            </div>

            {/* User greeting */}
            {user && (
              <div style={{
                marginTop:16, paddingTop:16,
                borderTop:`1px solid rgba(30,58,138,.07)`,
                display:"flex", alignItems:"center", gap:10,
              }}>
                <div style={{
                  width:34, height:34, borderRadius:10, flexShrink:0,
                  background:`linear-gradient(135deg,${T.orange},#ff7350)`,
                  display:"grid", placeItems:"center",
                  fontFamily:"'Outfit',sans-serif", fontSize:13, fontWeight:800, color:"white",
                }}>
                  {(user.username || "?")[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:"#0f172a" }}>
                    Bonjour {user.username} 👋
                  </div>
                  <div style={{ fontSize:11, color:"#94a3b8" }}>
                    {data?.range
                      ? `Période : ${data.range.start} → ${data.range.end}`
                      : "Chargement des données..."
                    }
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══ LOADING / ERROR ══════════════════════════════════════════════════ */}
        {isLoading && (
          <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:10,padding:"40px 0",color:"#94a3b8",fontSize:14 }}>
            <RefreshCw style={{width:18,height:18,animation:"spin .8s linear infinite"}}/>
            Chargement du tableau de bord...
          </div>
        )}
        {isError && (
          <div style={{
            display:"flex",gap:10,alignItems:"center",
            padding:"16px 20px",borderRadius:14,
            background:"#fef2f2", border:"1px solid #fecaca",
          }}>
            <AlertTriangle style={{width:16,height:16,color:"#dc2626",flexShrink:0}}/>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:"#991b1b"}}>Erreur de chargement</div>
              <div style={{fontSize:11,color:"#b91c1c",marginTop:2}}>Vérifie l'endpoint <code>/api/dashboard/summary/</code></div>
            </div>
          </div>
        )}

        {data && (
          <>
            {/* ══ KPI ROW ══════════════════════════════════════════════════════ */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:10 }}>
              <KpiCard
                delay={.05} label="Factures" icon={<FileSpreadsheet size={14}/>}
                value={<AnimatedNum target={b?.total_invoices ?? 0}/>}
                sub={`${b?.active_contracts ?? 0} contrats actifs`}
              />
              <KpiCard
                delay={.10} label="Montant TTC" icon={<TrendingUp size={14}/>} accent={T.blue}
                value={money(b?.total_ttc, true)}
                sub={`HT : ${money(b?.total_ht, true)}`}
              />
              <KpiCard
                delay={.15} label="NRJ (HT)" icon={<Zap size={14}/>} accent={T.orange}
                value={money(b?.total_nrj, true)}
                sub={`${b?.total_conso_kwh ? (parseFloat(b.total_conso_kwh)/1e6).toFixed(1)+" GWh" : "—"}`}
              />
              <KpiCard
                delay={.20} label="Sites actifs" icon={<Activity size={14}/>} accent="#10b981"
                value={<AnimatedNum target={b?.active_sites ?? 0}/>}
                sub={`${data.range.start} → ${data.range.end}`}
              />
              <KpiCard
                delay={.25} label="Taux certifié" icon={<ShieldCheck size={14}/>} accent={c?.global_rate.certified_fms ? "#10b981" : "#94a3b8"}
                value={`${((c?.global_rate.certified_fms ?? 0) + (c?.global_rate.certified_senelec ?? 0)).toFixed(1)}%`}
                sub={`${c?.total_batches_in_range ?? 0} campagne(s)`}
              />
            </div>

            {/* ══ ROW 2 : Évolution + Certification ════════════════════════════ */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>

              {/* Évolution mensuelle */}
              <ChartCard title="Évolution mensuelle" icon={<BarChart3 size={14}/>} delay={.18}>
                {(b?.evolution?.length ?? 0) === 0 ? (
                  <EmptyChart/>
                ) : (
                  <div style={{ height:240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={b!.evolution} margin={{ top:4, right:10, left:0, bottom:0 }}>
                        <CartesianGrid strokeDasharray="3 3"/>
                        <XAxis dataKey="period" tick={{ fontSize:10, fill:"#94a3b8" }} tickFormatter={v => v.slice(5)}/>
                        <YAxis tick={{ fontSize:10, fill:"#94a3b8" }} tickFormatter={v => money(v, true)}/>
                        <Tooltip content={<ChartTip mode="money"/>}/>
                        <Legend wrapperStyle={{ fontSize:11 }}/>
                        <Line type="monotone" dataKey="montant_ht"  name="HT"  stroke={T.blue}    strokeWidth={2} dot={false}/>
                        <Line type="monotone" dataKey="nrj"         name="NRJ" stroke={T.orange}  strokeWidth={2} dot={false}/>
                        <Line type="monotone" dataKey="abonnement"  name="Abo" stroke="#10b981"   strokeWidth={1.5} dot={false} strokeDasharray="4 3"/>
                        <Line type="monotone" dataKey="pen_prime"   name="Pen" stroke="#f59e0b"   strokeWidth={1.5} dot={false} strokeDasharray="4 3"/>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Mini KPI row sous le chart */}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginTop:14 }}>
                  {[
                    { label:"Abonnement", val:money(b?.total_abo, true) },
                    { label:"PenPrime",   val:money(b?.total_pen, true) },
                    { label:"CosPhi",     val:money(b?.total_cosphi, true) },
                  ].map(({ label, val }) => (
                    <div key={label} style={{
                      borderRadius:9, padding:"8px 10px",
                      background:T.offDk, border:`1px solid ${T.border}`,
                    }}>
                      <div style={{ fontSize:9.5,fontWeight:700,color:"#94a3b8",textTransform:"uppercase" as const,letterSpacing:".06em" }}>{label}</div>
                      <div style={{ fontFamily:"'Outfit',sans-serif",fontSize:14,fontWeight:800,color:T.blue,marginTop:2 }}>{val}</div>
                    </div>
                  ))}
                </div>
              </ChartCard>

              {/* Certification — dernière campagne */}
              <ChartCard title="Certification — dernière campagne" icon={<ShieldCheck size={14}/>} delay={.22}>
                {c?.last_batch ? (
                  <CertRing batch={c.last_batch} />
                ) : (
                  <EmptyChart label="Aucune campagne de certification"/>
                )}

                {/* Lien vers certification */}
                <Link to="/certification" style={{
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  marginTop:16, padding:"10px 14px", borderRadius:10,
                  background:T.offDk, border:`1px solid ${T.border}`,
                  textDecoration:"none",
                  transition:"background .15s",
                }}
                  onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background = "#e8efff"}
                  onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background = T.offDk}
                >
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <ShieldCheck style={{width:13,height:13,color:T.blue}}/>
                    <span style={{ fontSize:12, fontWeight:600, color:T.blue }}>Lancer une nouvelle certification</span>
                  </div>
                  <ArrowRight style={{width:13,height:13,color:T.blue}}/>
                </Link>
              </ChartCard>
            </div>

            {/* ══ ROW 3 : Statuts + Historique campagnes + Activité ════════════ */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>

              {/* Répartition statuts factures */}
              <ChartCard title="Statuts factures" icon={<PieChart size={14}/>} delay={.26}
                style={{ gridColumn: "1 / 2" }}>
                {pieData.length === 0 ? <EmptyChart/> : (
                  <>
                    <div style={{ height:160 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Tooltip
                            formatter={(v: any, n: any, p: any) => [`${numFmt(v)} (${p.payload.pct}%)`, n]}
                          />
                          <Pie data={pieData} dataKey="value" nameKey="name"
                            innerRadius={45} outerRadius={72} paddingAngle={3}>
                            {pieData.map((d, i) => <Cell key={i} fill={d.color}/>)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:10 }}>
                      {pieData.map((d, i) => (
                        <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <div style={{ width:8,height:8,borderRadius:"50%",background:d.color }}/>
                            <span style={{ fontSize:12, color:"#475569" }}>{d.name}</span>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <span style={{ fontFamily:"'Outfit',sans-serif",fontSize:13,fontWeight:800,color:"#0f172a" }}>{numFmt(d.value)}</span>
                            <span style={{ fontSize:10, color:"#94a3b8", width:36, textAlign:"right" }}>{d.pct}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* CTA billing */}
                <Link to="/billing/sonatel" style={{
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  marginTop:14, padding:"9px 12px", borderRadius:9,
                  background:T.offDk, border:`1px solid ${T.border}`,
                  textDecoration:"none", transition:"background .15s",
                }}
                  onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background = "#e8efff"}
                  onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background = T.offDk}
                >
                  <span style={{ fontSize:12, fontWeight:600, color:T.blue }}>Voir toutes les factures</span>
                  <ArrowRight style={{width:12,height:12,color:T.blue}}/>
                </Link>
              </ChartCard>

              {/* Taux certification global */}
              <ChartCard title="Taux global certification" icon={<ShieldCheck size={14}/>} delay={.30}>
                {certBars.every(b => b.val === 0) ? <EmptyChart label="Aucun batch certifié dans la période"/> : (
                  <>
                    <div style={{ height:160 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={certBars} layout="vertical" margin={{ left:0, right:20, top:0, bottom:0 }}>
                          <XAxis type="number" domain={[0,100]} tick={{ fontSize:10,fill:"#94a3b8" }} tickFormatter={v => `${v}%`}/>
                          <YAxis type="category" dataKey="label" width={0} tick={false}/>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                          <Tooltip formatter={(v: any) => [`${v}%`]}/>
                          <Bar dataKey="val" name="%" radius={[0,6,6,0]}>
                            {certBars.map((b,i) => <Cell key={i} fill={b.color}/>)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:8 }}>
                      {certBars.map((b,i) => (
                        <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <div style={{ width:8,height:8,borderRadius:"50%",background:b.color }}/>
                            <span style={{ fontSize:11, color:"#475569" }}>{b.label}</span>
                          </div>
                          <span style={{ fontFamily:"'Outfit',sans-serif",fontSize:13,fontWeight:800,color:"#0f172a" }}>{b.val}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </ChartCard>

              {/* Activité récente */}
              <ChartCard title="Activité récente" icon={<Clock size={14}/>} delay={.34}>
                {/* Dernier import */}
                {b?.last_import && (
                  <div style={{ marginBottom:14 }}>
                    <div style={{ fontSize:9.5,fontWeight:700,color:"#94a3b8",textTransform:"uppercase" as const,letterSpacing:".08em",marginBottom:8 }}>
                      Dernier import
                    </div>
                    <div style={{
                      display:"flex", alignItems:"center", gap:10,
                      padding:"10px 12px", borderRadius:10,
                      background:T.offDk, border:`1px solid ${T.border}`,
                    }}>
                      <div style={{ width:32,height:32,borderRadius:8,background:`${T.blue}10`,display:"grid",placeItems:"center",flexShrink:0,color:T.blue }}>
                        <FileSpreadsheet style={{width:15,height:15}}/>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12,fontWeight:600,color:"#0f172a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                          {b.last_import.source_filename}
                        </div>
                        <div style={{ fontSize:10,color:"#94a3b8",marginTop:1 }}>
                          {fmtDateTime(b.last_import.imported_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Historique campagnes */}
                <div>
                  <div style={{ fontSize:9.5,fontWeight:700,color:"#94a3b8",textTransform:"uppercase" as const,letterSpacing:".08em",marginBottom:8 }}>
                    Campagnes récentes
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                    {(c?.history ?? []).slice(0,5).map((h, i) => (
                      <div key={i} className="history-row">
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <Database style={{width:12,height:12,color:"#cbd5e1",flexShrink:0}}/>
                          <span style={{ fontSize:12, fontWeight:600, color:"#334155" }}>{h.echeance}</span>
                          <span style={{ fontSize:10, color:"#94a3b8" }}>{numFmt(h.total)} fact.</span>
                        </div>
                        <StatusPill status={h.status}/>
                      </div>
                    ))}
                    {(c?.history?.length ?? 0) === 0 && (
                      <div style={{ fontSize:12,color:"#94a3b8",textAlign:"center",padding:"16px 0" }}>
                        Aucune campagne dans la période
                      </div>
                    )}
                  </div>
                </div>
              </ChartCard>
            </div>

            {/* ══ ROW 4 : Volumes mensuels bar chart ════════════════════════════ */}
            <ChartCard
              title="Volume de factures par mois"
              icon={<BarChart3 size={14}/>}
              delay={.38}
              style={{ animation:"db-in .4s cubic-bezier(.22,1,.36,1) .38s both" }}
            >
              {(b?.evolution?.length ?? 0) === 0 ? <EmptyChart/> : (
                <div style={{ height:180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={b!.evolution} margin={{ top:4,right:10,left:0,bottom:0 }}>
                      <CartesianGrid strokeDasharray="3 3"/>
                      <XAxis dataKey="period" tick={{ fontSize:10,fill:"#94a3b8" }} tickFormatter={v => v.slice(5)}/>
                      <YAxis tick={{ fontSize:10,fill:"#94a3b8" }}/>
                      <Tooltip content={<ChartTip mode="count"/>}/>
                      <Bar dataKey="invoices" name="Factures" fill={T.blue} radius={[5,5,0,0]}
                        maxBarSize={40}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartCard>

          </>
        )}
      </div>
    </>
  );
}

// ─── Empty chart placeholder ──────────────────────────────────────────────────
function EmptyChart({ label = "Aucune donnée" }: { label?: string }) {
  return (
    <div style={{ height:160,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"#cbd5e1",gap:8 }}>
      <BarChart3 style={{width:28,height:28}}/>
      <span style={{ fontSize:12,color:"#94a3b8" }}>{label}</span>
    </div>
  );
}