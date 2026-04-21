// src/features/financial/SuiviConsoPage.tsx  v4
// Fixes : thead lisible · filtres fond blanc · graphique 3 séries vs target · conso_target affiché

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Search, Download, RefreshCw, ChevronLeft, ChevronRight,
  Sun, Zap, Activity, BarChart3, TrendingUp, Calendar,
  CheckCircle2, XCircle, Filter,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { api } from "@/services/api";

// ─── Tokens ───────────────────────────────────────────────────────────────────
const C = {
  blue: { 950:"#010E2A", 900:"#021A40", 800:"#032566", 700:"#0A3D96",
          600:"#1A56C4", 500:"#3272E0", 400:"#5B91F0", 200:"#C0D8FB",
          100:"#E4EFFE", 50:"#F2F6FE" },
  slate:{ 700:"#334155", 600:"#475569", 500:"#64748B", 400:"#94A3B8",
          300:"#CBD5E1", 200:"#E2E8F0", 100:"#F1F5F9", 50:"#F8FAFC" },
  ok:   { main:"#059669", light:"#D1FAE5", dark:"#065F46" },
  nok:  { main:"#DC2626", light:"#FEE2E2", dark:"#991B1B" },
  warn: { main:"#D97706", light:"#FEF3C7", dark:"#92400E" },
  teal: { main:"#0891B2", dark:"#0E7490" },
  solar:{ main:"#D97706", dark:"#B45309" },
};
const HDR = `linear-gradient(135deg, #010E2A 0%, #032566 55%, #0A3D96 100%)`;
const MONTHS_FR = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
const LINE_COLORS = ["#3272E0","#0891B2","#D97706","#7C3AED","#059669","#DC2626"];

// ─── Period helpers ───────────────────────────────────────────────────────────
const periodKey = (y:number, m:number) => y*100+m;
const keyToYM   = (k:number) => ({ year:Math.floor(k/100), month:k%100 });
const fmtPeriod = (y:number, m:number) => `${MONTHS_FR[m-1]} ${y}`;

// ─── Types ────────────────────────────────────────────────────────────────────
type ConsoRow = {
  site_id:string; site_name:string; zone:string; year:number; month:number;
  nb_jours:number|null; conso_kwh:string|null; cout_nrj:string|null;
  conso_target:string|null; solar_target:string|null;
  typology:string|null; load_w:number|null;
  marge:string|null; marge_statut:"OK"|"NOK"|null;
  recurrence_type:string|null; hors_catalogue:boolean;
  fms_grid_kwh:string|null; fms_grid_src:string|null;
  fms_acm_kwh:string|null;  fms_acm_src:string|null;
  solar_kwh:string|null;    unavail_hours:number|null;
};

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtKwh = (v:string|number|null|undefined): string => {
  if (!v) return "—";
  const n = parseFloat(v as string);
  if (isNaN(n)) return "—";
  return n >= 1000
    ? `${(n/1000).toLocaleString("fr-FR",{minimumFractionDigits:1,maximumFractionDigits:1})} MWh`
    : `${n.toLocaleString("fr-FR",{minimumFractionDigits:0,maximumFractionDigits:0})} kWh`;
};

const delta = (a:string|null, b:string|null): number|null => {
  if (!a||!b) return null;
  const fa=parseFloat(a), fb=parseFloat(b);
  if (isNaN(fa)||isNaN(fb)||fb===0) return null;
  return (fa/fb-1)*100;
};

// ─── Small components ─────────────────────────────────────────────────────────
function DeltaBadge({v}:{v:number|null}) {
  if (v===null) return <span style={{color:C.slate[400],fontSize:11}}>—</span>;
  const abs=Math.abs(v);
  const color=abs<10?C.ok.main:abs<20?C.warn.main:C.nok.main;
  const bg=abs<10?C.ok.light:abs<20?C.warn.light:C.nok.light;
  return <span style={{display:"inline-block",padding:"2px 7px",borderRadius:5,background:bg,color,fontSize:10,fontWeight:700,fontFamily:"monospace"}}>{v>0?"+":""}{v.toFixed(1)}%</span>;
}

function SrcDot({src}:{src:string|null}) {
  return <span style={{display:"inline-block",width:5,height:5,borderRadius:"50%",background:src&&src!=="none"?C.ok.main:C.slate[300],marginRight:3,verticalAlign:"middle"}}/>;
}

function TypoBadge({typo}:{typo:string|null}) {
  if (!typo) return <span style={{color:C.slate[300],fontSize:10}}>—</span>;
  const short = typo.replace(/^[A-Z]\d?_/,"").replace(/\s+(INDOOR|OUTDOOR)$/i,"");
  return <span style={{display:"inline-block",padding:"1px 6px",borderRadius:4,fontSize:9,fontWeight:700,fontFamily:"monospace",background:C.blue[100],color:C.blue[700],border:`1px solid ${C.blue[200]}`,whiteSpace:"nowrap",maxWidth:90,overflow:"hidden",textOverflow:"ellipsis"}} title={typo}>{short}</span>;
}

function MetricCard({label,value,sub,accent,icon}:{label:string;value:string;sub?:string;accent:string;icon:React.ReactNode}) {
  return(
    <div style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,padding:"11px 14px",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${accent},transparent)`}}/>
      <div style={{position:"absolute",right:10,top:10,opacity:.14}}>{icon}</div>
      <div style={{fontSize:9.5,fontWeight:700,color:"rgba(255,255,255,0.42)",textTransform:"uppercase",letterSpacing:"0.08em"}}>{label}</div>
      <div style={{fontSize:17,fontWeight:700,color:"#fff",fontFamily:"monospace",marginTop:3}}>{value}</div>
      {sub&&<div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:2}}>{sub}</div>}
    </div>
  );
}

// ─── DateRangePicker ─────────────────────────────────────────────────────────
const PRESETS=[
  {label:"Année 2026",range:[periodKey(2026,1),periodKey(2026,12)]},
  {label:"Année 2025",range:[periodKey(2025,1),periodKey(2025,12)]},
  {label:"Année 2024",range:[periodKey(2024,1),periodKey(2024,12)]},
  {label:"Juil 24 → Jun 25",range:[periodKey(2024,7),periodKey(2025,6)]},
  {label:"Oct 24 → Mar 25",range:[periodKey(2024,10),periodKey(2025,3)]},
];

function DateRangePicker({startKey,endKey,onChange}:{startKey:number;endKey:number;onChange:(s:number,e:number)=>void}) {
  const [open,setOpen]=useState(false);
  const [sel,setSel]=useState<number|null>(null);
  const [hov,setHov]=useState<number|null>(null);
  const [ly,setLy]=useState(()=>keyToYM(startKey).year);
  const [ry,setRy]=useState(()=>{const ey=keyToYM(endKey).year;return ey>keyToYM(startKey).year?ey:keyToYM(startKey).year+1;});
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{const h=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node)){setOpen(false);setSel(null);}};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  function getCls(k:number){const lo=Math.min(startKey,endKey),hi=Math.max(startKey,endKey);if(sel!==null){const hk=hov??k,sl=Math.min(sel,hk),sh=Math.max(sel,hk);if(k===sel)return"start";if(k===hk)return"end";if(k>sl&&k<sh)return"inrange";return"";}if(k===lo)return"start";if(k===hi)return"end";if(k>lo&&k<hi)return"inrange";return"";}
  function pick(y:number,mi:number){const k=periodKey(y,mi+1);if(!sel){setSel(k);onChange(k,k);}else{onChange(Math.min(sel,k),Math.max(sel,k));setSel(null);setOpen(false);}}
  const nb:React.CSSProperties={width:22,height:22,borderRadius:4,border:`1px solid ${C.slate[200]}`,background:"#fff",cursor:"pointer",fontSize:12,color:C.slate[600],display:"flex",alignItems:"center",justifyContent:"center"};
  function cal(year:number,setY:(fn:(y:number)=>number)=>void){return(
    <div style={{flex:1}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <button style={nb} onClick={()=>setY(y=>y-1)} disabled={year<=2023}>‹</button>
        <span style={{fontSize:12,fontWeight:600,color:C.blue[900]}}>{year}</span>
        <button style={nb} onClick={()=>setY(y=>y+1)} disabled={year>=2030}>›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:3}}>
        {MONTHS_FR.map((mn,mi)=>{const k=periodKey(year,mi+1);const c=getCls(k);return(
          <div key={mi} onClick={()=>pick(year,mi)} onMouseEnter={()=>setHov(k)} onMouseLeave={()=>setHov(null)}
            style={{padding:"5px 3px",borderRadius:5,fontSize:11,textAlign:"center",cursor:"pointer",
              background:c==="start"||c==="end"?C.blue[700]:c==="inrange"?C.blue[100]:"#fff",
              color:c==="start"||c==="end"?"#fff":c==="inrange"?C.blue[800]:"#0F172A",
              fontWeight:c==="start"||c==="end"?700:400,
              border:`1px solid ${c?"transparent":C.slate[200]}`}}>{mn}</div>
        );})}
      </div>
    </div>
  );}
  const lo=Math.min(startKey,endKey),hi=Math.max(startKey,endKey);
  const{year:sy,month:sm}=keyToYM(lo);const{year:ey,month:em}=keyToYM(hi);
  const label=lo===hi?fmtPeriod(sy,sm):`${fmtPeriod(sy,sm)} → ${fmtPeriod(ey,em)}`;
  return(
    <div ref={ref} style={{position:"relative"}}>
      <div onClick={()=>{setOpen(v=>!v);setSel(null);}}
        style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",border:`1px solid ${open?"rgba(255,255,255,0.4)":"rgba(255,255,255,0.2)"}`,borderRadius:7,background:"rgba(255,255,255,0.1)",cursor:"pointer",whiteSpace:"nowrap"}}>
        <Calendar size={11} style={{color:"rgba(255,255,255,0.55)"}}/>
        <span style={{fontFamily:"monospace",fontWeight:700,color:"#fff",fontSize:11.5}}>{label}</span>
        <span style={{fontSize:9,color:"rgba(255,255,255,0.4)"}}>{open?"▲":"▼"}</span>
      </div>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,zIndex:300,background:"#fff",border:`1px solid ${C.slate[200]}`,borderRadius:12,boxShadow:"0 12px 40px rgba(0,0,0,.18)",padding:"14px 14px 58px",width:460,display:"flex",gap:14}}>
          {cal(ly,setLy)}<div style={{width:1,background:C.slate[200]}}/>{cal(ry,setRy)}
          <div style={{position:"absolute",bottom:0,left:0,right:0,borderTop:`1px solid ${C.slate[200]}`,padding:"7px 12px",background:"#fff",borderRadius:"0 0 12px 12px",display:"flex",flexWrap:"wrap",gap:4}}>
            {PRESETS.map((p,i)=><button key={i} onClick={()=>{onChange(p.range[0] as number,p.range[1] as number);setSel(null);setOpen(false);}} style={{padding:"3px 8px",borderRadius:4,border:`1px solid ${C.slate[200]}`,background:"#fff",fontSize:10.5,color:C.slate[600],cursor:"pointer"}}>{p.label}</button>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Table helpers ─────────────────────────────────────────────────────────────
// thead : fond bleu 700 (lisible) avec texte blanc
function TH({children,center,right,accent}:{children:React.ReactNode;center?:boolean;right?:boolean;accent?:boolean}) {
  return(
    <th style={{
      padding:"9px 10px",
      textAlign:center?"center":right?"right":"left",
      fontSize:10, fontWeight:700,
      color: accent ? "#fff" : "rgba(255,255,255,0.75)",
      textTransform:"uppercase", letterSpacing:"0.08em",
      borderRight:"1px solid rgba(255,255,255,0.1)",
      whiteSpace:"nowrap",
      // ✅ thead lisible : bleu 700 au lieu de 900
      background: accent ? "rgba(90,145,240,0.35)" : C.blue[700],
      borderLeft: accent ? `3px solid ${C.blue[300]}` : undefined,
    }}>{children}</th>
  );
}
function TD({children,center,right}:{children:React.ReactNode;center?:boolean;right?:boolean}) {
  return <td style={{padding:"8px 10px",textAlign:center?"center":right?"right":"left",verticalAlign:"middle"}}>{children}</td>;
}

// ─── Chart customisation ──────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return(
    <div style={{background:"#fff",border:`1px solid ${C.slate[200]}`,borderRadius:8,padding:"8px 12px",fontSize:11,boxShadow:"0 4px 16px rgba(0,0,0,.1)"}}>
      <div style={{fontWeight:700,color:C.blue[800],marginBottom:4}}>{label}</div>
      {payload.map((p:any) => (
        <div key={p.name} style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:p.color}}/>
          <span style={{color:C.slate[600]}}>{p.name} :</span>
          <span style={{fontFamily:"monospace",fontWeight:700,color:C.slate[800]}}>
            {p.value>=1000?`${(p.value/1000).toFixed(1)} MWh`:`${Math.round(p.value).toLocaleString("fr-FR")} kWh`}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SuiviConsoPage() {
  const curYear = new Date().getFullYear();
  const [startKey,setStartKey]=useState(periodKey(curYear,1));
  const [endKey,setEndKey]=useState(periodKey(curYear,12));
  const [search,setSearch]=useState("");
  const [zone,setZone]=useState("");
  const [statut,setStatut]=useState("");
  const [typoFilter,setTypoFilter]=useState("");
  const [rows,setRows]=useState<ConsoRow[]>([]);
  const [total,setTotal]=useState(0);
  const [page,setPage]=useState(1);
  const [pages,setPages]=useState(1);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [activeTab,setActiveTab]=useState<"table"|"chart">("table");
  const [chartType,setChartType]=useState<"line"|"bar">("line");
  const [selectedSites,setSelectedSites]=useState<string[]>([]);
  const [exporting,setExporting]=useState(false);
  const [availTypos,setAvailTypos]=useState<string[]>([]);
  const PAGE_SIZE=100;
  const searchTimer=useRef<ReturnType<typeof setTimeout>>();
  const lo=Math.min(startKey,endKey),hi=Math.max(startKey,endKey);
  const {year:yearStart,month:monthStart}=keyToYM(lo);
  const {year:yearEnd,month:monthEnd}=keyToYM(hi);

  const fetchData=useCallback(async(p=1)=>{
    setLoading(true);setError(null);
    try{
      const params:Record<string,string|number>={year_start:yearStart,month_start:monthStart,year_end:yearEnd,month_end:monthEnd,page:p,page_size:PAGE_SIZE};
      if(search)params.search=search;if(zone)params.zone=zone;if(statut)params.statut=statut;if(typoFilter)params.typology=typoFilter;
      const res=await api.get("/financial/suivi-conso/",{params});
      setRows(res.data.results);setTotal(res.data.count);setPages(res.data.pages);setPage(p);
      const typos=[...new Set<string>(res.data.results.map((r:ConsoRow)=>r.typology).filter(Boolean))].sort() as string[];
      setAvailTypos(prev=>[...new Set([...prev,...typos])]);
    }catch(e:any){setError(e?.response?.data?.detail||"Erreur");}
    finally{setLoading(false);}
  },[yearStart,monthStart,yearEnd,monthEnd,search,zone,statut,typoFilter]);

  useEffect(()=>{fetchData(1);},[yearStart,monthStart,yearEnd,monthEnd,zone,statut,typoFilter]);
  const handleSearch=(v:string)=>{setSearch(v);clearTimeout(searchTimer.current);searchTimer.current=setTimeout(()=>fetchData(1),400);};

  const stats=useMemo(()=>({
    totConso:  rows.reduce((s,r)=>s+(r.conso_kwh?parseFloat(r.conso_kwh):0),0),
    totGrid:   rows.reduce((s,r)=>s+(r.fms_grid_kwh?parseFloat(r.fms_grid_kwh):0),0),
    totAcm:    rows.reduce((s,r)=>s+(r.fms_acm_kwh?parseFloat(r.fms_acm_kwh):0),0),
    totSolar:  rows.reduce((s,r)=>s+(r.solar_kwh?parseFloat(r.solar_kwh):0),0),
    nok:rows.filter(r=>r.marge_statut==="NOK").length,
    ok:rows.filter(r=>r.marge_statut==="OK").length,
  }),[rows]);

  // ── Chart data : 3 séries + target ─────────────────────────────────────────
  const chartData=useMemo(()=>{
    const bk:Record<number,any>={};
    for(let k=lo;k<=hi;){const{year:y,month:m}=keyToYM(k);bk[k]={key:k,label:`${MONTHS_FR[m-1]} ${y}`};k=m===12?(y+1)*100+1:y*100+m+1;}
    const show=selectedSites.length>0?selectedSites:null;
    rows.forEach(r=>{
      const k=periodKey(r.year,r.month);
      if(!bk[k])return;
      // FMS = grid en priorité, sinon ACM
      const fmsVal=r.fms_grid_kwh??r.fms_acm_kwh;
      if(show){
        if(!show.includes(r.site_id))return;
        bk[k][`facturee_${r.site_id}`]=(bk[k][`facturee_${r.site_id}`]||0)+parseFloat(r.conso_kwh||"0");
      }else{
        bk[k].facturee=(bk[k].facturee||0)+parseFloat(r.conso_kwh||"0");
        if(fmsVal) bk[k].fms=(bk[k].fms||0)+parseFloat(fmsVal);
        if(r.solar_kwh) bk[k].solar=(bk[k].solar||0)+parseFloat(r.solar_kwh);
        if(r.conso_target) bk[k].target=(bk[k].target||0)+parseFloat(r.conso_target);
      }
    });
    return Object.values(bk).sort((a,b)=>a.key-b.key);
  },[rows,selectedSites,lo,hi]);

  const sitesInRows=[...new Set(rows.map(r=>r.site_id))];
  const toggleSite=(sid:string)=>setSelectedSites(p=>p.includes(sid)?p.filter(s=>s!==sid):[...p,sid]);

  const handleExport=async()=>{
    setExporting(true);
    try{
      const p=new URLSearchParams({year_start:String(yearStart),month_start:String(monthStart),year_end:String(yearEnd),month_end:String(monthEnd),export:"csv",...(search&&{search}),...(zone&&{zone}),...(statut&&{statut}),...(typoFilter&&{typology:typoFilter})});
      const res=await api.get(`/financial/suivi-conso/?${p}`,{responseType:"blob"});
      const url=URL.createObjectURL(res.data);Object.assign(document.createElement("a"),{href:url,download:`suivi_conso_${yearStart}${monthStart}-${yearEnd}${monthEnd}.csv`}).click();URL.revokeObjectURL(url);
    }catch{/**/}setExporting(false);
  };

  // ── Filter select style : fond BLANC texte sombre ─────────────────────────
  const fSel:React.CSSProperties={
    padding:"5px 9px", borderRadius:6,
    border:`1px solid ${C.slate[300]}`,
    fontSize:12, background:"#fff",
    color:C.slate[700], outline:"none",
  };

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:C.slate[100],fontFamily:"system-ui,sans-serif",overflow:"hidden"}}>

      {/* ── Header ── */}
      <div style={{background:HDR,padding:"0 20px",display:"flex",alignItems:"center",justifyContent:"space-between",height:54,flexShrink:0,borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:30,height:30,background:"rgba(255,255,255,0.1)",borderRadius:7,border:"1px solid rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center"}}><Activity size={14} color="#fff"/></div>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:"#fff",letterSpacing:".02em"}}>Suivi Consommations</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:1}}>Sénélec · eFMS Grid & ACM · Solaire · Ratios</div>
          </div>
        </div>
        <div style={{display:"flex",gap:7,alignItems:"center"}}>
          <DateRangePicker startKey={startKey} endKey={endKey} onChange={(s,e)=>{setStartKey(s);setEndKey(e);setPage(1);}}/>
          <div style={{width:1,height:20,background:"rgba(255,255,255,0.15)"}}/>
          <button onClick={handleExport} disabled={exporting} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,background:"rgba(255,255,255,0.09)",border:"1px solid rgba(255,255,255,0.14)",color:"rgba(255,255,255,.82)",fontSize:11.5,fontWeight:500,cursor:"pointer"}}>
            <Download size={12}/>{exporting?"Export…":"Export CSV"}
          </button>
          <button onClick={()=>fetchData(page)} style={{width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:7,background:"rgba(255,255,255,0.09)",border:"1px solid rgba(255,255,255,0.14)",color:"rgba(255,255,255,.65)",cursor:"pointer"}}>
            <RefreshCw size={12} className={loading?"spin":""}/>
          </button>
        </div>
      </div>

      {/* ── Filters — fond BLANC, texte sombre ── */}
      <div style={{
        background:"#fff",
        borderBottom:`1px solid ${C.slate[200]}`,
        padding:"8px 20px",
        display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",
        flexShrink:0,zIndex:50,position:"relative",
      }}>
        {/* Search */}
        <div style={{position:"relative",flex:1,minWidth:130,maxWidth:220}}>
          <Search size={12} style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",color:C.slate[400]}}/>
          <input value={search} onChange={e=>handleSearch(e.target.value)} placeholder="Rechercher un site…"
            style={{width:"100%",paddingLeft:26,paddingRight:8,paddingTop:5,paddingBottom:5,borderRadius:6,border:`1px solid ${C.slate[300]}`,fontSize:12,color:C.slate[700],background:"#fff",outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
        </div>
        <select value={zone} onChange={e=>{setZone(e.target.value);setPage(1);}} style={fSel}>
          <option value="">Toutes zones</option>
          {["DKR","THIES","DIOURBEL","LOUGA","KAOLACK","ZIGUINCHOR","SAINT-LOUIS","TAMBACOUNDA","KOLDA","FATICK","MATAM","KAFFRINE","SEDHIOU","KEDOUGOU"].map(z=><option key={z} value={z}>{z}</option>)}
        </select>
        <select value={typoFilter} onChange={e=>{setTypoFilter(e.target.value);setPage(1);}} style={fSel}>
          <option value="">Toutes typologies</option>
          {availTypos.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        <select value={statut} onChange={e=>{setStatut(e.target.value);setPage(1);}} style={fSel}>
          <option value="">Tous statuts</option>
          <option value="ok">OK</option>
          <option value="nok">NOK</option>
        </select>
        {(zone||typoFilter||statut||search)&&(
          <button onClick={()=>{setZone("");setTypoFilter("");setStatut("");setSearch("");}}
            style={{display:"flex",alignItems:"center",gap:4,padding:"5px 10px",borderRadius:6,border:`1px solid ${C.warn.main}`,background:C.warn.light,color:C.warn.dark,fontSize:11.5,fontWeight:600,cursor:"pointer"}}>
            <Filter size={10}/>Effacer les filtres
          </button>
        )}
        <span style={{fontSize:11,color:C.slate[400],marginLeft:"auto"}}>
          {total.toLocaleString("fr-FR")} lignes
        </span>
      </div>

      {/* ── Metric Cards ── */}
      <div style={{padding:"10px 20px",background:HDR,borderBottom:"1px solid rgba(255,255,255,0.07)",flexShrink:0,display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
        <MetricCard label="Conso Facturée" accent={C.blue[400]}
          value={stats.totConso>=1000?`${(stats.totConso/1000).toFixed(1)} MWh`:`${Math.round(stats.totConso).toLocaleString("fr-FR")} kWh`}
          sub={`${total.toLocaleString("fr-FR")} lignes`} icon={<Zap size={22} color={C.blue[400]}/>}/>
        <MetricCard label="eFMS Grid" accent="#0891B2"
          value={stats.totGrid>=1000?`${(stats.totGrid/1000).toFixed(1)} MWh`:`${Math.round(stats.totGrid).toLocaleString("fr-FR")} kWh`}
          sub="Grid Report" icon={<Activity size={22} color="#0891B2"/>}/>
        <MetricCard label="eFMS ACM" accent="#6366F1"
          value={stats.totAcm>=1000?`${(stats.totAcm/1000).toFixed(1)} MWh`:`${Math.round(stats.totAcm).toLocaleString("fr-FR")} kWh`}
          sub="AC Meter" icon={<TrendingUp size={22} color="#6366F1"/>}/>
        <MetricCard label="Solaire" accent={C.solar.main}
          value={stats.totSolar>=1000?`${(stats.totSolar/1000).toFixed(1)} MWh`:`${Math.round(stats.totSolar).toLocaleString("fr-FR")} kWh`}
          sub="SQL2-ProdDB" icon={<Sun size={22} color={C.solar.main}/>}/>
        <MetricCard label="Sites NOK" accent={stats.nok>0?C.nok.main:C.ok.main}
          value={`${stats.nok} / ${stats.nok+stats.ok}`}
          sub={stats.nok+stats.ok>0?`${((stats.nok/(stats.nok+stats.ok))*100).toFixed(0)}% NOK`:undefined}
          icon={stats.nok>0?<XCircle size={22} color={C.nok.main}/>:<CheckCircle2 size={22} color={C.ok.main}/>}/>
      </div>

      {/* ── Tabs ── */}
      <div style={{background:"#fff",borderBottom:`1px solid ${C.slate[200]}`,display:"flex",padding:"0 20px",flexShrink:0}}>
        {(["table","chart"] as const).map(t=>(
          <div key={t} onClick={()=>setActiveTab(t)} style={{padding:"10px 16px",fontSize:12.5,fontWeight:activeTab===t?700:500,color:activeTab===t?C.blue[700]:C.slate[500],cursor:"pointer",borderBottom:activeTab===t?`2px solid ${C.blue[700]}`:"2px solid transparent",marginBottom:-1,display:"flex",alignItems:"center",gap:5}}>
            {t==="table"?<><BarChart3 size={13}/>Tableau</>:<><TrendingUp size={13}/>Graphiques</>}
          </div>
        ))}
      </div>

      {/* ── Body ── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {error&&<div style={{margin:16,padding:"12px 16px",background:C.nok.light,borderRadius:8,color:C.nok.dark,fontSize:13,display:"flex",alignItems:"center",gap:8}}><XCircle size={14}/>{error}</div>}
        {loading&&<div style={{display:"flex",justifyContent:"center",alignItems:"center",padding:60,gap:12,color:C.slate[500]}}><div style={{width:16,height:16,border:`2px solid ${C.blue[200]}`,borderTopColor:C.blue[600],borderRadius:"50%",animation:"spin .8s linear infinite"}}/>Chargement…</div>}

        {/* TABLE */}
        {!loading&&!error&&activeTab==="table"&&(
          <>
            <div style={{flex:1,overflow:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11.5}}>
                <thead style={{position:"sticky",top:0,zIndex:10}}>
                  {/* Group row — bleu 800 (sombre mais pas 950) */}
                  <tr style={{background:C.blue[800]}}>
                    <th colSpan={5} style={{padding:"3px 10px",fontSize:8,color:"rgba(255,255,255,.25)",textAlign:"center"}}/>
                    <th colSpan={3} style={{padding:"3px 10px",fontSize:8.5,fontWeight:700,color:"rgba(160,210,255,.95)",textAlign:"center",borderLeft:`2px solid ${C.blue[300]}`,textTransform:"uppercase",letterSpacing:".08em"}}>eFMS / ACM</th>
                    <th colSpan={3} style={{padding:"3px 10px",fontSize:8.5,fontWeight:700,color:"rgba(255,200,60,.95)",textAlign:"center",borderLeft:`2px solid ${C.solar.main}`,textTransform:"uppercase",letterSpacing:".08em"}}>Solaire</th>
                    <th colSpan={2} style={{padding:"3px 10px"}}/>
                  </tr>
                  {/* Column headers — bleu 700 (lisible) */}
                  <tr style={{background:C.blue[700]}}>
                    <TH>Site</TH><TH>Période</TH><TH>Typo</TH><TH center>Jours</TH><TH right>Conso Facturée</TH>
                    <TH right accent>FMS Grid</TH><TH right>FMS ACM</TH><TH center>Δ FMS/Fact</TH>
                    <TH right>Solar kWh</TH><TH right>Solar Target</TH><TH center>Δ Sol/Cible</TH>
                    <TH center>Statut</TH><TH right>Conso Target</TH>
                  </tr>
                </thead>
                <tbody>
                  {rows.length===0&&<tr><td colSpan={13} style={{padding:"48px 24px",textAlign:"center",color:C.slate[400]}}>Aucune donnée.</td></tr>}
                  {rows.map((r,i)=>{
                    const fmsVal=r.fms_grid_kwh??r.fms_acm_kwh;
                    const dFms=delta(r.conso_kwh,fmsVal);
                    const dSol=delta(r.solar_kwh,r.solar_target);
                    const isNok=r.marge_statut==="NOK";
                    const rowBg=isNok?"#FFF5F5":i%2===0?"#fff":C.slate[50];
                    return(
                      <tr key={`${r.site_id}-${r.year}-${r.month}`} style={{borderBottom:`1px solid ${C.slate[200]}`,background:rowBg}}>
                        <TD>
                          <div style={{fontFamily:"monospace",fontSize:10.5,fontWeight:700,color:C.blue[700]}}>{r.site_id}</div>
                          <div style={{fontSize:10,color:C.slate[500],marginTop:1,maxWidth:110,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.site_name}</div>
                          {r.zone&&<span style={{fontSize:8.5,fontWeight:700,color:C.blue[700],background:C.blue[100],padding:"1px 4px",borderRadius:3,marginTop:2,display:"inline-block",fontFamily:"monospace"}}>{r.zone}</span>}
                        </TD>
                        <TD>
                          <span style={{fontFamily:"monospace",fontSize:11,fontWeight:700,color:C.blue[700]}}>{r.year}-{String(r.month).padStart(2,"0")}</span>
                          <span style={{fontSize:10,color:C.slate[400],marginLeft:4}}>{MONTHS_FR[(r.month||1)-1]}</span>
                        </TD>
                        <TD><TypoBadge typo={r.typology}/></TD>
                        <TD center><span style={{fontFamily:"monospace",fontSize:11,color:C.slate[600]}}>{r.nb_jours??"—"}</span></TD>
                        <TD right>
                          <div style={{fontFamily:"monospace",fontWeight:700,color:C.blue[800]}}>{fmtKwh(r.conso_kwh)}</div>
                          <div style={{fontSize:9,color:C.slate[400]}}>Sénélec</div>
                        </TD>
                        <TD right>{r.fms_grid_kwh?<div><div style={{fontFamily:"monospace",fontWeight:700,color:"#0369A1"}}>{fmtKwh(r.fms_grid_kwh)}</div><div style={{fontSize:9,color:C.slate[400]}}><SrcDot src={r.fms_grid_src}/>Grid</div></div>:<span style={{color:C.slate[300]}}>—</span>}</TD>
                        <TD right>{r.fms_acm_kwh?<div><div style={{fontFamily:"monospace",fontWeight:700,color:C.teal.dark}}>{fmtKwh(r.fms_acm_kwh)}</div><div style={{fontSize:9,color:C.slate[400]}}><SrcDot src={r.fms_acm_src}/>ACM</div></div>:<span style={{color:C.slate[300]}}>—</span>}</TD>
                        <TD center><DeltaBadge v={dFms}/></TD>
                        <TD right>{r.solar_kwh?<div style={{display:"flex",alignItems:"center",gap:3,justifyContent:"flex-end"}}><Sun size={10} style={{color:C.solar.main}}/><span style={{fontFamily:"monospace",fontWeight:700,color:C.solar.main}}>{fmtKwh(r.solar_kwh)}</span></div>:<span style={{color:C.slate[300]}}>—</span>}</TD>
                        <TD right>{r.solar_target?<span style={{fontFamily:"monospace",fontSize:11,color:C.solar.dark}}>{fmtKwh(r.solar_target)}</span>:<span style={{color:C.slate[300]}}>—</span>}</TD>
                        <TD center><DeltaBadge v={dSol}/></TD>
                        <TD center>{r.marge_statut?<span style={{display:"inline-flex",alignItems:"center",gap:2,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:700,background:r.marge_statut==="OK"?C.ok.light:C.nok.light,color:r.marge_statut==="OK"?C.ok.dark:C.nok.dark}}>{r.marge_statut==="OK"?<CheckCircle2 size={9}/>:<XCircle size={9}/>}{r.marge_statut}</span>:<span style={{color:C.slate[300]}}>—</span>}</TD>
                        <TD right>
                          {r.conso_target
                            ?<span style={{fontFamily:"monospace",fontSize:11,fontWeight:700,color:C.ok.main}}>{fmtKwh(r.conso_target)}</span>
                            :<span style={{color:C.slate[300],fontSize:10}}>—</span>}
                        </TD>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {pages>1&&(
              <div style={{padding:"8px 20px",borderTop:`1px solid ${C.slate[200]}`,background:"#fff",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
                <span style={{fontSize:11,color:C.slate[500]}}>{total.toLocaleString("fr-FR")} lignes · Page {page} / {pages}</span>
                <div style={{display:"flex",gap:4}}>
                  <button onClick={()=>fetchData(page-1)} disabled={page<=1||loading} style={{display:"flex",alignItems:"center",gap:3,padding:"4px 10px",borderRadius:6,border:`1px solid ${C.slate[200]}`,background:"#fff",cursor:page<=1?"default":"pointer",color:page<=1?C.slate[400]:"#0F172A",fontSize:11.5}}><ChevronLeft size={12}/>Préc.</button>
                  {Array.from({length:Math.min(pages,7)},(_,i)=>{const p=Math.max(1,page-3)+i;if(p>pages)return null;return<button key={p} onClick={()=>fetchData(p)} style={{width:28,height:28,borderRadius:6,cursor:"pointer",fontSize:11.5,border:`1px solid ${C.slate[200]}`,background:p===page?C.blue[700]:"#fff",color:p===page?"#fff":"#0F172A",fontWeight:p===page?700:400}}>{p}</button>;})}
                  <button onClick={()=>fetchData(page+1)} disabled={page>=pages||loading} style={{display:"flex",alignItems:"center",gap:3,padding:"4px 10px",borderRadius:6,border:`1px solid ${C.slate[200]}`,background:"#fff",cursor:page>=pages?"default":"pointer",color:page>=pages?C.slate[400]:"#0F172A",fontSize:11.5}}>Suiv.<ChevronRight size={12}/></button>
                </div>
              </div>
            )}
          </>
        )}

        {/* CHART */}
        {!loading&&!error&&activeTab==="chart"&&(
          <div style={{flex:1,overflow:"auto",padding:"16px 20px",background:C.slate[100]}}>
            <div style={{background:"#fff",border:`1px solid ${C.slate[200]}`,borderRadius:12,padding:16}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:C.blue[900]}}>Évolution des consommations</div>
                  <div style={{fontSize:11,color:C.slate[400],marginTop:2}}>
                    {selectedSites.length===0
                      ?"Facturée · FMS (Grid ou ACM) · Solaire vs Target"
                      :`${selectedSites.length} site(s) isolé(s)`}
                  </div>
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <div style={{display:"flex",border:`1px solid ${C.slate[200]}`,borderRadius:7,overflow:"hidden"}}>
                    {(["line","bar"] as const).map(t=><div key={t} onClick={()=>setChartType(t)} style={{padding:"5px 12px",fontSize:11.5,cursor:"pointer",fontWeight:500,background:chartType===t?C.blue[700]:"#fff",color:chartType===t?"#fff":C.slate[600]}}>{t==="line"?"Lignes":"Barres"}</div>)}
                  </div>
                </div>
              </div>

              {/* Site chips */}
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,color:C.slate[600],marginBottom:5}}>{selectedSites.length===0?"Isoler un site :":"Sites isolés :"}</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                  <div onClick={()=>setSelectedSites([])} style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:500,cursor:"pointer",background:C.blue[900],color:"#fff",border:`1px solid ${C.blue[900]}`}}>{selectedSites.length===0?"✓ Tous":"Tous"}</div>
                  {sitesInRows.map(sid=><div key={sid} onClick={()=>toggleSite(sid)} style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:500,cursor:"pointer",background:selectedSites.includes(sid)?C.blue[700]:"#fff",color:selectedSites.includes(sid)?"#fff":C.slate[600],border:`1px solid ${selectedSites.includes(sid)?C.blue[700]:C.slate[200]}`}}>{sid}</div>)}
                </div>
              </div>

              {/* Légende custom */}
              {selectedSites.length===0&&(
                <div style={{display:"flex",gap:16,marginBottom:10,flexWrap:"wrap"}}>
                  {[
                    {label:"Conso Facturée",color:C.blue[700],dash:false},
                    {label:"FMS (Grid/ACM)",color:"#0891B2",dash:true},
                    {label:"Solaire",color:C.solar.main,dash:false},
                    {label:"Target",color:C.slate[400],dash:true},
                  ].map(l=>(
                    <div key={l.label} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:C.slate[600]}}>
                      <div style={{width:20,height:0,borderTop:`2px ${l.dash?"dashed":"solid"} ${l.color}`}}/>
                      {l.label}
                    </div>
                  ))}
                </div>
              )}

              <div style={{height:300}}>
                <ResponsiveContainer width="100%" height="100%">
                  {selectedSites.length===0?(
                    chartType==="line"?(
                      <LineChart data={chartData} margin={{top:4,right:16,bottom:4,left:16}}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.slate[200]} vertical={false}/>
                        <XAxis dataKey="label" tick={{fontSize:10,fill:C.slate[500]}} interval="preserveStartEnd"/>
                        <YAxis tick={{fontSize:10,fill:C.slate[500]}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}MWh`}/>
                        <Tooltip content={<ChartTooltip/>}/>
                        {/* ✅ 3 séries + target */}
                        <Line type="monotone" dataKey="facturee" name="Conso Facturée" stroke={C.blue[700]} strokeWidth={2.5} dot={{r:3,fill:C.blue[700]}} activeDot={{r:5}}/>
                        <Line type="monotone" dataKey="fms"      name="FMS (Grid/ACM)" stroke="#0891B2"  strokeWidth={2} strokeDasharray="6 3" dot={false}/>
                        <Line type="monotone" dataKey="solar"    name="Solaire"        stroke={C.solar.main} strokeWidth={2} dot={{r:2,fill:C.solar.main}}/>
                        <Line type="monotone" dataKey="target"   name="Target"         stroke={C.slate[400]} strokeWidth={1.5} strokeDasharray="3 4" dot={false}/>
                      </LineChart>
                    ):(
                      <BarChart data={chartData} margin={{top:4,right:16,bottom:4,left:16}}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.slate[200]} vertical={false}/>
                        <XAxis dataKey="label" tick={{fontSize:10,fill:C.slate[500]}} interval="preserveStartEnd"/>
                        <YAxis tick={{fontSize:10,fill:C.slate[500]}} tickFormatter={v=>`${(v/1000).toFixed(0)}MWh`}/>
                        <Tooltip content={<ChartTooltip/>}/>
                        <Bar dataKey="facturee" name="Conso Facturée" fill={C.blue[700]}   radius={[3,3,0,0]}/>
                        <Bar dataKey="fms"      name="FMS (Grid/ACM)" fill="#0891B2"       radius={[3,3,0,0]}/>
                        <Bar dataKey="solar"    name="Solaire"        fill={C.solar.main}  radius={[3,3,0,0]}/>
                        <Bar dataKey="target"   name="Target"         fill={C.slate[300]}  radius={[3,3,0,0]}/>
                      </BarChart>
                    )
                  ):(
                    <LineChart data={chartData} margin={{top:4,right:16,bottom:4,left:16}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.slate[200]} vertical={false}/>
                      <XAxis dataKey="label" tick={{fontSize:10,fill:C.slate[500]}} interval="preserveStartEnd"/>
                      <YAxis tick={{fontSize:10,fill:C.slate[500]}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}MWh`}/>
                      <Tooltip content={<ChartTooltip/>}/>
                      {selectedSites.map((sid,i)=><Line key={sid} type="monotone" dataKey={`facturee_${sid}`} name={sid} stroke={LINE_COLORS[i%LINE_COLORS.length]} strokeWidth={2} dot={{r:2}}/>)}
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin .8s linear infinite}tbody tr:hover{filter:brightness(0.97)}`}</style>
    </div>
  );
}