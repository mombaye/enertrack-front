// src/features/prediction/PredictionPage.tsx — light v4
// Fond blanc · design moderne · stats globales par défaut · export tous sites · fix zone DBL→DIOURBEL
import { useState, useMemo, useRef, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ComposedChart, Bar, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { BrainCircuit, Search, X, Building2, Globe, Download, RefreshCw,
  CloudRain, Thermometer, Info, CheckCircle2, Calendar, Activity,
  Cpu, FileSpreadsheet, Layers, Zap, PackageX, TrendingDown, TrendingUp } from "lucide-react";
import { api } from "@/services/api";
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────
type Factor    = { feature: string; impact: number };
type EvInfo    = { name: string; date: string };
type Meteo     = { temp_max_mean?: number; precip_total?: number };
type PredMonth = {
  period: string; year: number; month: number;
  conso_pred: number; ht_pred: number; marge_pred: number; marge_ok: boolean;
  ic_lo: number; ic_hi: number; confidence: number; fnp_score: number;
  top_factors: Factor[]; events: EvInfo[]; meteo: Meteo;
};
type PredResp  = {
  site_id: string; zone: string; horizon: number;
  generated_at: string; model_version: string;
  historic: { period: string; conso: number; ht: number }[];
  predictions: PredMonth[];
};
type Site      = { id: number; site_id: string; numero_compte_contrat: string };
type GlobalStats = {
  evolution: { period: string; invoices: number; montant_ht: string }[];
  distribution_ht: { total_ht: string };
  payment_statuses?: { summary: { total: number; paid: number; paid_pct: number } };
};

// ─── Design system ────────────────────────────────────────────────────────────
const T = {
  // Neutrals
  bg:     "#F8FAFC",
  card:   "#FFFFFF",
  border: "rgba(15,23,42,0.07)",
  borderM:"rgba(15,23,42,0.13)",
  // Text
  t1: "#0F172A", t2: "#475569", t3: "#94A3B8",
  // Brand
  blue:   "#1D4ED8", blueL: "#EFF6FF", blueMid:"#3B82F6",
  indigo: "#4F46E5", indigoL:"#EEF2FF",
  // Semantic
  green:  "#059669", greenL: "#ECFDF5",
  red:    "#DC2626", redL:   "#FFF5F5",
  amber:  "#D97706", amberL: "#FFFBEB",
  cyan:   "#0891B2", cyanL:  "#ECFEFF",
  violet: "#7C3AED", violetL:"#F5F3FF",
  // Mono
  mono: "'Fira Code','Cascadia Code',ui-monospace,monospace",
};

// ─── Zone normalization ───────────────────────────────────────────────────────
const ZMAP: Record<string,string> = {
  DBL:"DIOURBEL",DIB:"DIOURBEL",DIO:"DIOURBEL",DKR:"DKR",DAK:"DKR",
  THI:"THIES",TH:"THIES",LOU:"LOUGA",LG:"LOUGA",KAO:"KAOLACK",KAL:"KAOLACK",
  ZIG:"ZIGUINCHOR",ZI:"ZIGUINCHOR",SLO:"SAINT-LOUIS",SL:"SAINT-LOUIS",SLOU:"SAINT-LOUIS",
  TAM:"TAMBACOUNDA",TB:"TAMBACOUNDA",KOL:"KOLDA",FAT:"FATICK",FT:"FATICK",
  MAT:"MATAM",KAF:"KAFFRINE",SED:"SEDHIOU",KED:"KEDOUGOU",
};
const nz = (z: string) => ZMAP[z?.toUpperCase()] ?? z?.toUpperCase() ?? "DKR";

// ─── Feature labels ───────────────────────────────────────────────────────────
const FL: Record<string,string> = {
  conso_lag_1m:"Conso M−1", rolling_3m_conso:"Moyenne 3 mois", conso_lag_3m:"Conso M−3",
  is_hivernage_meteo:"Hivernage (pluie)", event_magal_pressure:"Magal · zone",
  event_gamou_pressure:"Gamou · zone", event_tabaski_pressure:"Tabaski",
  event_korite_pressure:"Korité", total_event_pressure:"Pression événements",
  load_w:"Load site (W)", precip_total:"Précipitations", temp_max_mean:"Température max",
  recurrence_score:"Récurrence NOK",
};

const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
const fmtP = (p: string) => { const [y,m] = p.split("-"); return `${MONTHS[+m-1]} ${y}`; };
const fmtN = (v: number|string, u?: string) => {
  const val = Number(v); if (isNaN(val)) return "—";
  const abs = Math.abs(val), sign = val < 0 ? "−" : "";
  const s = abs >= 1e6 ? `${sign}${(abs/1e6).toFixed(1)} M` : abs >= 1e3 ? `${sign}${Math.round(abs/1e3).toLocaleString("fr-FR")} k` : `${sign}${Math.round(val).toLocaleString("fr-FR")}`;
  return u ? `${s} ${u}` : s;
};
const fmtK = (v: number) => v >= 1000 ? `${(v/1000).toFixed(1)} MWh` : `${Math.round(v).toLocaleString("fr-FR")} kWh`;

// ─── API ──────────────────────────────────────────────────────────────────────
const fetchPred   = (s: string, h: number): Promise<PredResp> => api.get("/prediction/forecast/", { params: { site: s, horizon: h } }).then(r => r.data);
const fetchGlobal = (start: string, end: string): Promise<GlobalStats> => api.get("/sonatel-billing/stats/", { params: { start, end } }).then(r => r.data);
const fetchSites  = (): Promise<Site[]> => api.get("/sonatel-billing/contract-site-links/", { params: { limit: 500 } }).then(r => Array.isArray(r.data) ? r.data : (r.data.results ?? []));
const searchSites = (q: string): Promise<Site[]> => api.get("/sonatel-billing/contract-site-links/", { params: { search: q, limit: 20 } }).then(r => {
  const list = Array.isArray(r.data) ? r.data : (r.data.results ?? []);
  const seen = new Set<string>();
  return list.filter((s: Site) => !seen.has(s.site_id) && seen.add(s.site_id));
});
const year0 = () => {
  const n = new Date(), f = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  return { start: f(new Date(n.getFullYear(),0,1)), end: f(n) };
};

// ─── Export ───────────────────────────────────────────────────────────────────
async function exportAll(sites: Site[], h: number, onP: (n: number, t: number) => void) {
  const wb = XLSX.utils.book_new(), summary: any[] = [];
  for (let i = 0; i < sites.length; i++) {
    onP(i+1, sites.length);
    try {
      const d = await fetchPred(sites[i].site_id, h);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d.predictions.map(p => ({
        "Site": sites[i].site_id, "Période": p.period, "Conso kWh": Math.round(p.conso_pred),
        "HT FCFA": Math.round(p.ht_pred), "Marge": Math.round(p.marge_pred),
        "Statut": p.marge_ok ? "OK" : "NOK", "FNP %": Math.round(p.fnp_score*100),
        "Confiance %": Math.round(p.confidence*100), "Événements": p.events.map(e => e.name).join(", ")||"—",
      }))), sites[i].site_id.slice(0,31));
      summary.push({ "Site": sites[i].site_id, "Zone": d.zone,
        "Conso moy kWh": Math.round(d.predictions.reduce((s,p) => s+p.conso_pred, 0)/d.predictions.length),
        "Total HT FCFA": Math.round(d.predictions.reduce((s,p) => s+p.ht_pred, 0)),
        "FNP max %": Math.round(Math.max(...d.predictions.map(p => p.fnp_score))*100), "Modèle": d.model_version });
    } catch {}
  }
  if (summary.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Résumé global");
  XLSX.writeFile(wb, `predictions_h${h}_${new Date().toISOString().slice(0,10)}.xlsx`);
}
function exportOne(d: PredResp) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d.predictions.map(p => ({
    "Période": p.period, "Conso kWh": Math.round(p.conso_pred), "IC bas": Math.round(p.ic_lo), "IC haut": Math.round(p.ic_hi),
    "HT FCFA": Math.round(p.ht_pred), "Marge": Math.round(p.marge_pred), "Statut": p.marge_ok ? "OK" : "NOK",
    "FNP %": Math.round(p.fnp_score*100), "Confiance %": Math.round(p.confidence*100), "Précip mm": Math.round(p.meteo?.precip_total??0),
  }))), "Prédictions");
  XLSX.writeFile(wb, `pred_${d.site_id}_${d.generated_at}.xlsx`);
}

// ─── UI Components ────────────────────────────────────────────────────────────

const Card = ({ children, style = {} }: { children: ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background: T.card, borderRadius: 14, border: `1px solid ${T.border}`, boxShadow: "0 1px 4px rgba(15,23,42,.05), 0 0 0 0.5px rgba(15,23,42,.04)", ...style }}>{children}</div>
);

const Lbl = ({ children }: { children: ReactNode }) => (
  <div style={{ fontSize: 9, fontWeight: 700, color: T.t3, letterSpacing: ".12em", textTransform: "uppercase" as const, marginBottom: 5 }}>{children}</div>
);

// KPI card — colored gradient top bar
function KpiCard({ label, value, sub, color, colorL, icon, trend }:
  { label: string; value: string; sub?: string; color: string; colorL: string; icon: ReactNode; trend?: "up"|"down"|"neutral" }) {
  return (
    <Card>
      <div style={{ height: 3, background: color, borderRadius: "14px 14px 0 0", margin: "-1px -1px 0" }}/>
      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: colorL, display: "grid", placeItems: "center", color }}>{icon}</div>
          {trend && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
              background: trend==="up" ? T.redL : trend==="down" ? T.greenL : "#F1F5F9",
              color: trend==="up" ? T.red : trend==="down" ? T.green : T.t3 }}>
              {trend==="up" ? <TrendingUp size={9}/> : trend==="down" ? <TrendingDown size={9}/> : null}
            </span>
          )}
        </div>
        <Lbl>{label}</Lbl>
        <div style={{ fontSize: 22, fontWeight: 800, color: T.t1, lineHeight: 1, letterSpacing: "-.02em" }}>{value}</div>
        {sub && <div style={{ fontSize: 10, color: T.t3, marginTop: 4 }}>{sub}</div>}
      </div>
    </Card>
  );
}

// SHAP bar
function ShapRow({ feature, impact }: Factor) {
  const pos = impact >= 0, col = pos ? T.blue : T.amber, pct = Math.min(Math.abs(impact)*120, 100);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: T.t2 }}>{FL[feature] || feature.replace(/_/g," ")}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: col }}>{pos?"+":"−"}{Math.abs(impact*100).toFixed(1)}%</span>
      </div>
      <div style={{ height: 4, background: "#F1F5F9", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: col, borderRadius: 99, opacity: 0.75 }}/>
      </div>
    </div>
  );
}

// Event colors
const EV_C: Record<string,{ color: string; bg: string }> = {
  magal:{ color:"#991B1B", bg:"#FEF2F2" }, gamou:{ color:"#1E40AF", bg:"#EFF6FF" },
  tabaski:{ color:"#065F46", bg:"#ECFDF5" }, korite:{ color:"#5B21B6", bg:"#F5F3FF" },
  tamkharit:{ color:"#374151", bg:"#F9FAFB" }, layene:{ color:"#92400E", bg:"#FFFBEB" },
  magal_darou:{ color:"#991B1B", bg:"#FEF2F2" },
};
const EvPill = ({ name }: { name: string }) => {
  const key = name.toLowerCase().replace(/\s+/g,"_");
  const cfg = EV_C[key] ?? { color: T.t2, bg: "#F8FAFC" };
  return <span style={{ display:"inline-block", padding:"2px 8px", borderRadius:999, fontSize:9, fontWeight:700, background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.color}22`, marginRight:4, marginBottom:2 }}>{name}</span>;
};

// Tooltip
function LightTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 14px", boxShadow: "0 8px 24px rgba(15,23,42,.12)", fontSize: 11 }}>
      <div style={{ fontWeight: 700, color: T.t1, marginBottom: 6 }}>{label}</div>
      {payload.map((p: any, i: number) => p.value != null && (
        <div key={i} style={{ display: "flex", gap: 10, marginBottom: 2, alignItems: "center" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color || p.stroke, flexShrink: 0, display: "inline-block" }}/>
          <span style={{ color: T.t2, minWidth: 80 }}>{p.name}</span>
          <span style={{ fontWeight: 700, color: T.t1 }}>{p.value > 10000 ? fmtN(p.value) : fmtK(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// Site search
function SiteSearch({ sel, onSel, onClr }: { sel: Site|null; onSel(s: Site): void; onClr(): void }) {
  const [q, setQ] = useState(""), [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: res = [], isFetching } = useQuery({ queryKey: ["psearch", q], queryFn: () => searchSites(q), enabled: q.length >= 1, staleTime: 30_000 });
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);

  if (sel) return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, background: T.blueL, border: `1.5px solid ${T.blue}33`, borderRadius: 9, padding: "6px 12px" }}>
      <Building2 size={12} color={T.blue}/>
      <span style={{ fontFamily: T.mono, fontSize: 12, color: T.blue, fontWeight: 700 }}>{sel.site_id}</span>
      <span style={{ fontSize: 11, color: T.t3 }}>{sel.numero_compte_contrat}</span>
      <button onClick={onClr} style={{ marginLeft: 4, background: "none", border: "none", cursor: "pointer", color: T.t3, display: "grid", placeItems: "center" }}><X size={11}/></button>
    </div>
  );

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, background: T.card, border: `1.5px solid ${open ? T.blue+"88" : T.border}`, borderRadius: 9, padding: "6px 12px", minWidth: 220, boxShadow: open ? `0 0 0 3px ${T.blueL}` : "none", transition: "all .15s" }}>
        <Search size={12} color={T.t3}/>
        <input value={q} onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Chercher un site…" style={{ background: "none", border: "none", outline: "none", fontSize: 12, color: T.t1, flex: 1 }}/>
        {isFetching && <div style={{ width: 12, height: 12, borderRadius: "50%", border: `2px solid ${T.blueL}`, borderTopColor: T.blue, animation: "spin .7s linear infinite" }}/>}
      </div>
      {open && q.length >= 1 && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, zIndex: 200, overflow: "hidden", boxShadow: "0 12px 40px rgba(15,23,42,.12)" }}>
          {!isFetching && res.length === 0 && <div style={{ padding: "10px 14px", fontSize: 11, color: T.t3 }}>Aucun site trouvé</div>}
          {res.map((s, i) => (
            <button key={s.id} onMouseDown={() => { onSel(s); setQ(""); }}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", borderBottom: i < res.length-1 ? `1px solid ${T.border}` : "none" }}
              onMouseEnter={e => (e.currentTarget.style.background = T.blueL)} onMouseLeave={e => (e.currentTarget.style.background = "none")}>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: T.blueL, display: "grid", placeItems: "center" }}><Building2 size={12} color={T.blue}/></div>
              <div><div style={{ fontSize: 12, fontWeight: 700, color: T.t1 }}>{s.site_id}</div><div style={{ fontSize: 10, color: T.t3 }}>{s.numero_compte_contrat}</div></div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Export modal
function ExportModal({ onClose, horizon, pred }: { onClose(): void; horizon: number; pred: PredResp|null }) {
  const [mode, setMode] = useState<"all"|"one">("all");
  const [prog, setProg] = useState(0), [tot, setTot] = useState(0), [running, setRunning] = useState(false);
  const sitesQ = useQuery({ queryKey: ["allsites"], queryFn: fetchSites, staleTime: 5*60_000 });
  async function go() {
    if (mode === "one" && pred) { exportOne(pred); onClose(); return; }
    const sites = sitesQ.data ?? []; setTot(sites.length); setProg(0); setRunning(true);
    await exportAll(sites, horizon, n => setProg(n));
    setRunning(false); onClose();
  }
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(15,23,42,.45)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={e => e.target === e.currentTarget && onClose()}>
      <Card style={{ width: 440, boxShadow: "0 24px 80px rgba(15,23,42,.18), 0 0 0 1px rgba(15,23,42,.06)" }}>
        <div style={{ padding: "22px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div><div style={{ fontSize: 16, fontWeight: 800, color: T.t1, letterSpacing: "-.02em" }}>Export Excel</div><div style={{ fontSize: 11, color: T.t3, marginTop: 2 }}>Horizon {horizon} mois</div></div>
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, cursor: "pointer", display: "grid", placeItems: "center", color: T.t2 }}><X size={12}/></button>
          </div>
          {[
            { id:"all", icon:<Layers size={15}/>, label:"Tous les sites", sub:`${sitesQ.data?.length??"…"} sites · 1 feuille/site + résumé global` },
            { id:"one", icon:<Building2 size={15}/>, label:"Site actuel uniquement", sub: pred ? pred.site_id : "Sélectionner un site", disabled: !pred },
          ].map(opt => (
            <div key={opt.id} onClick={() => !opt.disabled && setMode(opt.id as "all"|"one")}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 11, marginBottom: 8, cursor: opt.disabled ? "not-allowed" : "pointer",
                background: mode===opt.id ? T.blueL : T.bg, border: `1.5px solid ${mode===opt.id ? T.blue+"55" : T.border}`, opacity: opt.disabled ? 0.45 : 1, transition: "all .15s" }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: mode===opt.id ? T.blue : "#E2E8F0", display: "grid", placeItems: "center", color: mode===opt.id ? "white" : T.t2 }}>{opt.icon}</div>
              <div><div style={{ fontSize: 12, fontWeight: 700, color: T.t1 }}>{opt.label}</div><div style={{ fontSize: 10, color: T.t3, marginTop: 2 }}>{opt.sub}</div></div>
              <div style={{ marginLeft: "auto", width: 17, height: 17, borderRadius: "50%", border: `2px solid ${mode===opt.id ? T.blue : T.t3}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {mode===opt.id && <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.blue }}/>}
              </div>
            </div>
          ))}
          {running && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: T.t3, marginBottom: 5 }}>
                <span>Traitement des sites…</span><span style={{ fontFamily: T.mono }}>{prog}/{tot}</span>
              </div>
              <div style={{ height: 4, background: "#E2E8F0", borderRadius: 99 }}>
                <div style={{ height: "100%", borderRadius: 99, width: `${tot ? (prog/tot)*100 : 0}%`, background: `linear-gradient(90deg,${T.blue},${T.cyan})`, transition: "width .3s" }}/>
              </div>
            </div>
          )}
          <button onClick={go} disabled={running} style={{ width: "100%", padding: "11px", borderRadius: 10, background: running ? "#E2E8F0" : T.blue, border: "none", cursor: running ? "not-allowed" : "pointer", color: "white", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, boxShadow: running ? "none" : "0 4px 14px rgba(29,78,216,.3)", transition: "all .15s" }}>
            <FileSpreadsheet size={14}/>{running ? `Export… (${prog}/${tot})` : "Lancer l'export"}
          </button>
        </div>
      </Card>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PredictionPage() {
  const [site, setSite] = useState<Site|null>(null);
  const [horizon, setH] = useState(6);
  const [showExp, setExp] = useState(false);
  const { start, end } = year0();
  const siteId = site?.site_id;

  const gQ = useQuery({ queryKey: ["pglobal", start, end], queryFn: () => fetchGlobal(start, end), staleTime: 10*60_000 });
  const pQ = useQuery({ queryKey: ["ppred", siteId, horizon], queryFn: () => fetchPred(siteId!, horizon), enabled: !!siteId, staleTime: 5*60_000 });
  const pred = pQ.data, global = gQ.data, loading = pQ.isLoading;

  const chartData = useMemo(() => {
    if (!pred) return [];
    return [
      ...pred.historic.map(h => ({ label: fmtP(h.period), histo: Math.round(h.conso), pred: null as number|null, ic_lo: null as number|null, ic_hi: null as number|null })),
      ...pred.predictions.map(p => ({ label: fmtP(p.period), histo: null as number|null, pred: Math.round(p.conso_pred), ic_lo: Math.round(p.ic_lo), ic_hi: Math.round(p.ic_hi) })),
    ];
  }, [pred]);

  const globalChart = useMemo(() => global?.evolution?.slice(-12).map(r => ({ label: fmtP(r.period), ht: Number(r.montant_ht) })) || [], [global]);

  const kpis = useMemo(() => {
    if (!pred?.predictions.length) return null;
    const p = pred.predictions;
    return { conso: p.reduce((s,r) => s+r.conso_pred, 0)/p.length, ht: p.reduce((s,r) => s+r.ht_pred, 0), marge: p.reduce((s,r) => s+r.marge_pred, 0)/p.length, fnp: Math.max(...p.map(r => r.fnp_score)) };
  }, [pred]);

  const gkpis = useMemo(() => {
    if (!global) return null;
    return { ht: Number(global.distribution_ht?.total_ht ?? 0), paid: global.payment_statuses?.summary.paid ?? 0, total: global.payment_statuses?.summary.total ?? 0, pct: global.payment_statuses?.summary.paid_pct ?? 0 };
  }, [global]);

  const topF = useMemo(() => {
    if (!pred?.predictions.length) return [];
    const a: Record<string,number> = {};
    pred.predictions.forEach(p => p.top_factors.forEach(f => { a[f.feature] = (a[f.feature]||0) + Math.abs(f.impact); }));
    return Object.entries(a).map(([feature, sum]) => ({ feature, impact: sum/pred.predictions.length })).sort((a,b) => b.impact-a.impact).slice(0,8);
  }, [pred]);

  const events = useMemo(() => {
    if (!pred) return [];
    const seen = new Set<string>(), evs: {name:string;date:string;period:string}[] = [];
    pred.predictions.forEach(p => p.events.forEach(ev => { const k = `${ev.name}-${ev.date}`; if (!seen.has(k)) { seen.add(k); evs.push({ ...ev, period: p.period }); } }));
    return evs.sort((a,b) => a.date.localeCompare(b.date));
  }, [pred]);

  const meteo = useMemo(() => pred?.predictions.map(p => ({ label: fmtP(p.period), temp: Math.round(p.meteo?.temp_max_mean??32), precip: Math.round(p.meteo?.precip_total??0), isHiv: (p.meteo?.precip_total??0)>20, events: p.events })) || [], [pred]);

  const sk = (h: number) => (
    <div style={{ height: h, borderRadius: 8, background: "linear-gradient(90deg,#F1F5F9 25%,#E8EFF6 50%,#F1F5F9 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }}/>
  );
  const cc = (c: number) => c >= 0.85 ? T.green : c >= 0.70 ? T.amber : T.red;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;700&family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
        .pf{animation:fadeIn .3s ease both}
      `}</style>

      <div style={{ fontFamily:"'DM Sans',sans-serif", display:"flex", flexDirection:"column", gap:14 }}>

        {/* ── HEADER ── */}
        <Card style={{ overflow:"hidden" }}>
          {/* Top gradient accent */}
          <div style={{ height:3, background:`linear-gradient(90deg,${T.blue},${T.violet},${T.cyan})` }}/>
          <div style={{ padding:"18px 22px" }}>

            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:14, flexWrap:"wrap", marginBottom:16 }}>
              {/* Brand */}
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:42, height:42, borderRadius:11, background:`linear-gradient(135deg,${T.blue},${T.violet})`, display:"grid", placeItems:"center", boxShadow:`0 4px 12px ${T.blue}44` }}>
                  <BrainCircuit size={20} color="white"/>
                </div>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <h1 style={{ fontSize:18, fontWeight:800, color:T.t1, margin:0, letterSpacing:"-.025em" }}>Prédiction IA</h1>
                    <span style={{ fontSize:9, fontWeight:700, padding:"3px 8px", borderRadius:999, background:pred?.model_version==="lgbm_v1"?T.greenL:T.amberL, color:pred?.model_version==="lgbm_v1"?T.green:T.amber, border:`1px solid ${pred?.model_version==="lgbm_v1"?T.green:T.amber}33`, letterSpacing:".08em", textTransform:"uppercase" as const }}>
                      {pred?.model_version==="lgbm_v1"?"LightGBM":"Rule-based"}
                    </span>
                  </div>
                  <p style={{ fontSize:12, color:T.t3, margin:"3px 0 0" }}>Conso · HT · marge · FNP · météo · événements hégirien</p>
                </div>
              </div>

              {/* Controls */}
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ display:"flex", background:T.bg, borderRadius:9, border:`1px solid ${T.border}`, overflow:"hidden" }}>
                  {[3,6,12].map(h => (
                    <button key={h} onClick={() => setH(h)} style={{ padding:"7px 14px", fontSize:12, fontWeight:600, cursor:"pointer", border:"none", background:horizon===h?T.blue:"transparent", color:horizon===h?"white":T.t2, transition:"all .15s" }}>{h} mois</button>
                  ))}
                </div>
                <button onClick={() => setExp(true)} style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:9, background:T.blue, border:"none", color:"white", fontSize:12, fontWeight:600, cursor:"pointer", boxShadow:`0 2px 8px ${T.blue}44` }}>
                  <Download size={13}/> Export
                </button>
                <button onClick={() => { gQ.refetch(); pQ.refetch(); }} style={{ width:36, height:36, borderRadius:9, border:`1px solid ${T.border}`, background:T.bg, display:"grid", placeItems:"center", cursor:"pointer", color:T.t3 }}>
                  <RefreshCw size={13} style={{ animation:loading?"spin 1s linear infinite":"none" }}/>
                </button>
              </div>
            </div>

            {/* Site bar */}
            <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderRadius:11, background:site?T.blueL:T.bg, border:`1.5px solid ${site?T.blue+"33":T.border}`, transition:"all .2s" }}>
              <div style={{ width:30, height:30, borderRadius:8, background:site?"rgba(29,78,216,.12)":"#E2E8F0", display:"grid", placeItems:"center" }}>
                {site ? <Building2 size={13} color={T.blue}/> : <Globe size={13} color={T.t3}/>}
              </div>
              <div>
                <div style={{ fontSize:9, fontWeight:700, color:T.t3, textTransform:"uppercase" as const, letterSpacing:".1em" }}>Site analysé</div>
                <div style={{ fontSize:12, fontWeight:700, color:site?T.blue:T.t2, marginTop:1 }}>
                  {site ? `${site.site_id} · ${site.numero_compte_contrat}` : "Vue globale — sélectionner un site pour la prédiction IA"}
                </div>
              </div>
              <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
                {pred && (
                  <div style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 10px", borderRadius:7, background:pred.model_version==="lgbm_v1"?T.greenL:T.amberL, border:`1px solid ${pred.model_version==="lgbm_v1"?T.green:T.amber}33` }}>
                    <div style={{ width:6, height:6, borderRadius:"50%", background:pred.model_version==="lgbm_v1"?T.green:T.amber }}/>
                    <span style={{ fontSize:10, fontWeight:600, color:pred.model_version==="lgbm_v1"?T.green:T.amber }}>
                      {pred.model_version==="lgbm_v1"?"LightGBM actif":"Mode règles"} · {pred.generated_at}
                    </span>
                  </div>
                )}
                <SiteSearch sel={site} onSel={setSite} onClr={() => setSite(null)}/>
                {site && <button onClick={() => setSite(null)} style={{ fontSize:10, color:T.t3, background:"none", border:`1px solid ${T.border}`, borderRadius:7, padding:"5px 10px", cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}><Globe size={10}/> Vue globale</button>}
              </div>
            </div>
          </div>
        </Card>

        {/* ── GLOBAL KPIs ── */}
        {gQ.isLoading
          ? <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>{[1,2,3,4].map(i => <div key={i}>{sk(90)}</div>)}</div>
          : gkpis && (
            <div className="pf" style={{ display:"grid", gridTemplateColumns:"repeat(4,minmax(0,1fr))", gap:12 }}>
              <KpiCard label="Total HT — parc" value={fmtN(gkpis.ht,"FCFA")} sub={`${start.slice(0,4)} → maintenant`} color={T.blue} colorL={T.blueL} icon={<TrendingUp size={16}/>}/>
              <KpiCard label="Factures payées" value={gkpis.paid.toLocaleString("fr-FR")} sub={`${gkpis.pct.toFixed(1)}% · sur ${gkpis.total.toLocaleString("fr-FR")}`} color={T.green} colorL={T.greenL} icon={<CheckCircle2 size={16}/>}/>
              <KpiCard label="Horizon actif" value={`${horizon} mois`} sub={site?`Site · ${site.site_id}`:"Sélectionner un site"} color={T.violet} colorL={T.violetL} icon={<Activity size={16}/>}/>
              <KpiCard label="Zone normalisée" value={pred?nz(pred.zone):"—"} sub={pred?`Code brut : ${pred.zone}`:"Après sélection"} color={T.cyan} colorL={T.cyanL} icon={<Globe size={16}/>}/>
            </div>
          )
        }

        {/* ── GLOBAL CHART (pas de site) ── */}
        {!site && (
          <Card>
            <div style={{ padding:"18px 20px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <div>
                  <Lbl>Évolution mensuelle HT — parc complet</Lbl>
                  <div style={{ fontSize:12, color:T.t3 }}>Sélectionner un site ci-dessus pour lancer la prédiction IA</div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 10px", background:T.blueL, border:`1px solid ${T.blue}33`, borderRadius:7 }}>
                  <div style={{ width:7, height:7, borderRadius:"50%", background:T.green }}/>
                  <span style={{ fontSize:10, fontWeight:600, color:T.blue }}>Live</span>
                </div>
              </div>
              {gQ.isLoading ? sk(180) : (
                <ResponsiveContainer width="100%" height={180}>
                  <ComposedChart data={globalChart} margin={{ top:4, right:8, left:8, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
                    <XAxis dataKey="label" tick={{ fontSize:10, fill:T.t3 }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fontSize:10, fill:T.t3 }} axisLine={false} tickLine={false} width={52} tickFormatter={v => fmtN(v)}/>
                    <Tooltip content={<LightTip/>}/>
                    <defs>
                      <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={T.blue} stopOpacity={0.15}/>
                        <stop offset="95%" stopColor={T.blue} stopOpacity={0.01}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="ht" name="HT (FCFA)" stroke={T.blue} strokeWidth={2} fill="url(#blueGrad)" dot={false}/>
                  </ComposedChart>
                </ResponsiveContainer>
              )}
              <div style={{ marginTop:14, padding:"11px 14px", borderRadius:10, background:T.blueL, border:`1px solid ${T.blue}22`, display:"flex", alignItems:"center", gap:8 }}>
                <BrainCircuit size={14} color={T.blue}/>
                <span style={{ fontSize:11, color:T.blue }}>
                  Prédiction disponible par site : conso, HT, marge, score FNP, facteurs SHAP, météo et événements sénégalais.
                </span>
              </div>
            </div>
          </Card>
        )}

        {/* ── SITE KPIs ── */}
        {site && (loading
          ? <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>{[1,2,3,4].map(i => <div key={i}>{sk(92)}</div>)}</div>
          : kpis && (
            <div className="pf" style={{ display:"grid", gridTemplateColumns:"repeat(4,minmax(0,1fr))", gap:12 }}>
              <KpiCard label="Conso moy. prédite" value={fmtK(Math.round(kpis.conso))} sub={`par mois · ${horizon}m`} color={T.blue} colorL={T.blueL} icon={<Zap size={16}/>}/>
              <KpiCard label="Total HT préd." value={fmtN(Math.round(kpis.ht),"FCFA")} sub="IC ±9%" color={T.cyan} colorL={T.cyanL} icon={<TrendingUp size={16}/>}/>
              <KpiCard label="Marge moy." value={`${kpis.marge>=0?"+":""}${fmtN(Math.round(kpis.marge),"FCFA")}`} sub={kpis.marge>=0?"Redevance couverte":"Dépassement prévu"} color={kpis.marge>=0?T.green:T.red} colorL={kpis.marge>=0?T.greenL:T.redL} icon={kpis.marge>=0?<CheckCircle2 size={16}/>:<TrendingDown size={16}/>} trend={kpis.marge>=0?"down":"up"}/>
              <KpiCard label="Score FNP max" value={`${Math.round(kpis.fnp*100)} %`} sub={kpis.fnp>0.5?"Risque élevé · relancer":kpis.fnp>0.25?"Risque modéré":"Risque faible"} color={kpis.fnp>0.5?T.red:kpis.fnp>0.25?T.amber:T.green} colorL={kpis.fnp>0.5?T.redL:kpis.fnp>0.25?T.amberL:T.greenL} icon={<PackageX size={16}/>} trend={kpis.fnp>0.5?"up":"neutral"}/>
            </div>
          )
        )}

        {/* ── CHART + SHAP ── */}
        {site && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 280px", gap:14 }}>
            <Card>
              <div style={{ padding:"18px 20px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                  <div>
                    <Lbl>Prévision conso facturée (kWh)</Lbl>
                    <div style={{ display:"flex", gap:14, marginTop:4 }}>
                      {[{c:T.red,l:"Historique",dash:true},{c:T.blue,l:"Prédit"},{c:"rgba(59,130,246,.12)",l:"IC 80%",solid:true}].map(x => (
                        <div key={x.l} style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, color:T.t3 }}>
                          <div style={{ width:14, height:x.solid?7:2, background:x.c, borderRadius:2, opacity:x.dash?.5:1 }}/>{x.l}
                        </div>
                      ))}
                    </div>
                  </div>
                  {pred && <span style={{ fontSize:10, color:T.t3 }}>{pred.model_version==="lgbm_v1"?"● LightGBM":"● Mode règles"}</span>}
                </div>
                {loading ? sk(240) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart data={chartData} margin={{ top:4, right:8, left:8, bottom:0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
                      <XAxis dataKey="label" tick={{ fontSize:10, fill:T.t3 }} axisLine={false} tickLine={false}/>
                      <YAxis tick={{ fontSize:10, fill:T.t3 }} axisLine={false} tickLine={false} width={52} tickFormatter={fmtK}/>
                      <Tooltip content={<LightTip/>}/>
                      <defs>
                        <linearGradient id="icGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={T.blue} stopOpacity={0.08}/>
                          <stop offset="95%" stopColor={T.blue} stopOpacity={0.01}/>
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="ic_hi" stroke="none" fill="url(#icGrad)" activeDot={false} name="IC haut"/>
                      <Area type="monotone" dataKey="ic_lo" stroke="none" fill="white" activeDot={false} name="IC bas"/>
                      <Bar dataKey="histo" name="Historique" fill={T.red+"18"} stroke={T.red} strokeWidth={1.5} radius={[3,3,0,0]} barSize={18}/>
                      <Bar dataKey="pred" name="Prédit" fill={T.blue+"18"} stroke={T.blue} strokeWidth={1.5} radius={[3,3,0,0]} barSize={18}/>
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card>
              <div style={{ padding:"18px 20px" }}>
                <Lbl>Facteurs d'influence (SHAP)</Lbl>
                <div style={{ fontSize:11, color:T.t3, marginBottom:14 }}>Importance moy. sur {horizon} mois prédits</div>
                {loading ? sk(200) : topF.length === 0
                  ? <div style={{ fontSize:11, color:T.t3, textAlign:"center", padding:"20px 0" }}>Mode rule-based<br/>SHAP indisponible</div>
                  : topF.map(f => <ShapRow key={f.feature} {...f}/>)
                }
              </div>
            </Card>
          </div>
        )}

        {/* ── EVENTS + METEO ── */}
        {site && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            <Card>
              <div style={{ padding:"18px 20px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                  <Lbl>Événements · zone {pred ? nz(pred.zone) : "—"}</Lbl>
                  <span style={{ fontSize:10, color:T.t3 }}>hijri-converter</span>
                </div>
                {loading ? sk(140) : events.length === 0 ? (
                  <div style={{ padding:"24px 0", textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
                    <div style={{ width:40, height:40, borderRadius:"50%", background:T.greenL, display:"grid", placeItems:"center" }}>
                      <CheckCircle2 size={18} color={T.green}/>
                    </div>
                    <div style={{ fontSize:12, color:T.t2 }}>Aucun événement dans la fenêtre de prédiction</div>
                    {pred && pred.zone !== nz(pred.zone) && (
                      <div style={{ fontSize:10, color:T.t3, padding:"4px 10px", background:T.bg, borderRadius:6, border:`1px solid ${T.border}` }}>
                        Zone normalisée : {pred.zone} → {nz(pred.zone)}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {events.map((ev, i) => {
                      const key = ev.name.toLowerCase().replace(/\s+/g,"_");
                      const cfg = EV_C[key] ?? { color: T.t2, bg: T.bg };
                      const daysTo = Math.round((new Date(ev.date).getTime() - Date.now()) / 86400000);
                      const urgent = daysTo < 21;
                      return (
                        <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:10, background:T.bg, borderLeft:`3px solid ${cfg.color}`, border:`1px solid ${T.border}`, borderLeftWidth:3, borderLeftColor:cfg.color }}>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:12, fontWeight:700, color:T.t1 }}>{ev.name}</div>
                            <div style={{ fontSize:10, color:T.t3, marginTop:2 }}>{ev.date} · prédiction {fmtP(ev.period)}</div>
                          </div>
                          <div style={{ padding:"3px 9px", borderRadius:6, fontSize:10, fontWeight:700, background:urgent?T.redL:T.amberL, color:urgent?T.red:T.amber }}>
                            {daysTo > 0 ? `J−${daysTo}` : "En cours"}
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ padding:"9px 12px", borderRadius:9, background:T.blueL, border:`1px solid ${T.blue}22`, display:"flex", gap:7, alignItems:"flex-start" }}>
                      <Info size={12} color={T.blue} style={{ flexShrink:0, marginTop:1 }}/>
                      <span style={{ fontSize:10, color:T.blue }}>Pression = jours_fenêtre × poids_zone. Zone {pred?.zone} normalisée → {pred ? nz(pred.zone) : "—"}.</span>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <div style={{ padding:"18px 20px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                  <Lbl>Météo mensuelle · open-meteo</Lbl>
                  <span style={{ fontSize:10, color:T.t3 }}>archive + prévisions</span>
                </div>
                {loading ? sk(190) : (
                  <div style={{ display:"flex", flexDirection:"column" }}>
                    {meteo.map((r, i) => (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 0", borderBottom:i<meteo.length-1?`1px solid ${T.border}`:"none" }}>
                        <div style={{ width:52, fontSize:11, fontWeight:600, color:T.t1, flexShrink:0 }}>{r.label}</div>
                        <div style={{ display:"flex", gap:5, alignItems:"center", flex:1 }}>
                          <span style={{ display:"inline-flex", alignItems:"center", gap:3, padding:"2px 7px", borderRadius:5, fontSize:10, fontWeight:600, background:r.temp>35?T.redL:T.amberL, color:r.temp>35?T.red:T.amber }}>
                            <Thermometer size={10}/>{r.temp}°C
                          </span>
                          <span style={{ display:"inline-flex", alignItems:"center", gap:3, padding:"2px 7px", borderRadius:5, fontSize:10, fontWeight:600, background:r.isHiv?T.blueL:"#F8FAFC", color:r.isHiv?T.blue:T.t3 }}>
                            <CloudRain size={10}/>{r.precip} mm
                          </span>
                          {r.isHiv && <span style={{ padding:"2px 6px", borderRadius:4, fontSize:9, fontWeight:700, background:T.greenL, color:T.green }}>Hivernage</span>}
                        </div>
                        <div style={{ flexShrink:0 }}>{r.events.map((ev,j) => <EvPill key={j} name={ev.name}/>)}</div>
                      </div>
                    ))}
                    <div style={{ marginTop:10, padding:"8px 10px", background:T.bg, borderRadius:8, fontSize:10, color:T.t3, display:"flex", alignItems:"center", gap:5 }}>
                      <Globe size={11}/> Source : open-meteo.com · données historiques & prévisions
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* ── TABLE ── */}
        {site && (
          <Card style={{ overflow:"hidden" }}>
            <div style={{ padding:"14px 20px", display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:`1px solid ${T.border}`, background:T.bg }}>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:T.t1 }}>Détail mois par mois</div>
                {pred && <div style={{ fontSize:11, color:T.t3, marginTop:2 }}>{pred.predictions.length} mois prédits · généré le {pred.generated_at}</div>}
              </div>
              {pred && (
                <button onClick={() => exportOne(pred)} style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 14px", borderRadius:8, border:`1px solid ${T.border}`, background:T.card, color:T.t2, fontSize:11, fontWeight:600, cursor:"pointer" }}>
                  <Download size={12}/> Excel
                </button>
              )}
            </div>
            {loading ? <div style={{ padding:20 }}>{sk(180)}</div> : pred ? (
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                  <thead>
                    <tr style={{ background:T.bg }}>
                      {["Mois","Conso préd.","IC 80%","HT préd.","Marge","Statut","FNP","Confiance","Facteurs clés","Événements"].map(h => (
                        <th key={h} style={{ padding:"9px 12px", textAlign:"left", fontSize:9, fontWeight:700, color:T.t3, textTransform:"uppercase" as const, letterSpacing:".08em", borderBottom:`1px solid ${T.border}`, whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pred.predictions.map((p, i) => (
                      <tr key={i} style={{ borderBottom:`1px solid ${T.border}`, background:i%2===0?T.card:"#FAFBFC" }}>
                        <td style={{ padding:"10px 12px", fontWeight:700, fontFamily:T.mono, fontSize:11, color:T.blue }}>{fmtP(p.period)}</td>
                        <td style={{ padding:"10px 12px", fontFamily:T.mono, fontSize:11, color:T.t1 }}>{fmtK(Math.round(p.conso_pred))}</td>
                        <td style={{ padding:"10px 12px", fontSize:10, color:T.t3 }}>{fmtK(Math.round(p.ic_lo))} – {fmtK(Math.round(p.ic_hi))}</td>
                        <td style={{ padding:"10px 12px", fontFamily:T.mono, fontSize:11, color:T.t1 }}>{fmtN(Math.round(p.ht_pred))} FCFA</td>
                        <td style={{ padding:"10px 12px", fontFamily:T.mono, fontSize:11, fontWeight:700, color:p.marge_ok?T.green:T.red }}>{p.marge_pred>=0?"+":""}{fmtN(Math.round(p.marge_pred))}</td>
                        <td style={{ padding:"10px 12px" }}>
                          <span style={{ padding:"2px 8px", borderRadius:5, fontSize:10, fontWeight:700, background:p.marge_ok?T.greenL:T.redL, color:p.marge_ok?T.green:T.red }}>{p.marge_ok?"OK":"NOK"}</span>
                        </td>
                        <td style={{ padding:"10px 12px" }}>
                          <span style={{ padding:"2px 8px", borderRadius:5, fontSize:10, fontWeight:700, background:p.fnp_score>0.5?T.redL:p.fnp_score>0.25?T.amberL:T.greenL, color:p.fnp_score>0.5?T.red:p.fnp_score>0.25?T.amber:T.green }}>{Math.round(p.fnp_score*100)}%</span>
                        </td>
                        <td style={{ padding:"10px 12px" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                            <div style={{ height:4, width:40, background:"#F1F5F9", borderRadius:99, overflow:"hidden" }}>
                              <div style={{ height:"100%", width:`${Math.round(p.confidence*100)}%`, background:cc(p.confidence), borderRadius:99 }}/>
                            </div>
                            <span style={{ fontSize:10, color:cc(p.confidence), fontWeight:600 }}>{p.confidence>=0.85?"Haute":p.confidence>=0.70?"Moy.":"Faible"}</span>
                          </div>
                        </td>
                        <td style={{ padding:"10px 12px", maxWidth:200 }}>
                          <div style={{ display:"flex", flexWrap:"wrap", gap:3 }}>
                            {p.top_factors.slice(0,3).map((f,j) => (
                              <span key={j} style={{ display:"inline-block", padding:"1px 6px", borderRadius:4, fontSize:9, fontWeight:600, background:f.impact>=0?T.blueL:T.amberL, color:f.impact>=0?T.blue:T.amber }}>
                                {(FL[f.feature]||f.feature).split(" ")[0]} {f.impact>=0?"+":"−"}{Math.abs(f.impact*100).toFixed(0)}%
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding:"10px 12px" }}>
                          {p.events.length>0 ? p.events.map((ev,j) => <EvPill key={j} name={ev.name}/>) : <span style={{ fontSize:10, color:T.t3 }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </Card>
        )}

        {/* ── FOOTER ── */}
        {site && pred && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
            {[
              { icon:<Cpu size={13}/>, color:T.blue, colorL:T.blueL, title:"Modèle", lines:[`LightGBM · ${pred.model_version}`,"Walk-forward validation","MAE cible < 8%"] },
              { icon:<Calendar size={13}/>, color:T.violet, colorL:T.violetL, title:"Événements", lines:["hijri-converter · calendrier islamique","Gamou · Magal · Tabaski · Korité",`Zone: ${pred.zone} → ${nz(pred.zone)}`] },
              { icon:<CloudRain size={13}/>, color:T.cyan, colorL:T.cyanL, title:"Météo", lines:["open-meteo.com · gratuit","Temp · précipitations · humidité","Hivernage juin–octobre"] },
            ].map((b, i) => (
              <Card key={i}>
                <div style={{ padding:"13px 16px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:8 }}>
                    <div style={{ width:28, height:28, borderRadius:7, background:b.colorL, display:"grid", placeItems:"center", color:b.color }}>{b.icon}</div>
                    <span style={{ fontSize:12, fontWeight:700, color:T.t1 }}>{b.title}</span>
                  </div>
                  {b.lines.map((l, j) => <div key={j} style={{ fontSize:10, color:T.t3, marginBottom:3 }}>· {l}</div>)}
                </div>
              </Card>
            ))}
          </div>
        )}

        {showExp && <ExportModal onClose={() => setExp(false)} horizon={horizon} pred={pred??null}/>}
      </div>
    </>
  );
}