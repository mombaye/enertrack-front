// src/features/financial/FinancialSiteDetailModal.tsx

import { useState, useEffect } from "react";
import {
  X, BarChart3, TableProperties, TrendingUp, TrendingDown,
  Zap, Sun, Activity, AlertTriangle, CheckCircle2, XCircle,
  Info,
} from "lucide-react";
import { api } from "@/services/api";

// ═══════════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════════

const C = {
  navy:    { 900:"#0a1628", 800:"#0f2140", 700:"#163058", 600:"#1e4175", 500:"#2563a8", 400:"#4a90d9", 100:"#e6f1fc", 50:"#f3f8fe" },
  accent:  { 500:"#e85d04", 400:"#f97316", 100:"#ffedd5" },
  success: { main:"#059669", light:"#d1fae5", dark:"#065f46" },
  danger:  { main:"#dc2626", light:"#fee2e2", dark:"#991b1b" },
  warning: { main:"#d97706", light:"#fef3c7", dark:"#92400e" },
  info:    { main:"#7c3aed", light:"#ede9fe" },
  solar:   { main:"#ca8a04", light:"#fef9c3", dark:"#713f12" },
  slate:   { 900:"#0f172a", 800:"#1e293b", 700:"#334155", 600:"#475569", 500:"#64748b", 400:"#94a3b8", 300:"#cbd5e1", 200:"#e2e8f0", 100:"#f1f5f9", 50:"#f8fafc" },
};

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

type ConsoRow = {
  period:         string;
  month:          number;
  conso_facturee: string | null;
  conso_fms:      string | null;
  conso_acm:      string | null;
  conso_target:   string | null;
  solar_kwh:      number | null;
  unavail_hours:  number | null;
  fms_available:  boolean;
  acm_available:  boolean;
  ratio_fms:      string | null;
  nb_jours:       number | null;
  cible_kwh_j:    string | null;
};

type MargeRow = {
  period:           string;
  month:            number;
  redevance:        string | null;
  montant_htva:     string | null;
  marge:            string | null;
  marge_statut:     "OK" | "NOK" | null;
  load_w:           number | null;
  hors_catalogue:   boolean;
  recurrence_type:  string | null;
};

type SiteDetail = {
  site: { site_id:string; name:string; zone:string; typology:string; configuration:string };
  period: { year:number; month_start:number; month_end:number };
  summary: {
    total_marge:string; count_ok:number; count_nok:number;
    count_hors_catalogue:number; billing_total_ht:string;
    billing_total_cosphi:string; billing_total_penalite:string;
  };
  current: { marge_statut:string; recurrence_type:string|null; redevance:string|null; montant_htva:string|null; load_w:number|null } | null;
  history: MargeRow[];
  conso_comparison: { rows: ConsoRow[] };
  diagnostics: Array<{ type:string; severity:string; message:string; detail:string }>;
};

export type FinancialSiteDetailModalProps = {
  siteId:     string;
  siteName?:  string;
  year:       number;
  monthStart: number;
  monthEnd:   number;
  onClose:    () => void;
};

// ═══════════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════════

const MONTHS_FR = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

function fmt(v: string | number | null | undefined, decimals = 0): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "—";
  return n.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtKwh(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "—";
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 1 })} kWh`;
}

function fmtMoney(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "—";
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} F`;
}

function deltaColor(delta: number | null): string {
  if (delta === null) return C.slate[400];
  if (Math.abs(delta) < 10) return C.success.main;
  if (Math.abs(delta) < 20) return C.warning.main;
  return C.danger.main;
}

function deltaLabel(delta: number | null): string {
  if (delta === null) return "—";
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`;
}

function calcDelta(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const fa = parseFloat(a), fb = parseFloat(b);
  if (isNaN(fa) || isNaN(fb) || fb === 0) return null;
  return ((fa - fb) / fb) * 100;
}

// ── Agrégats conso ──────────────────────────────────────────────────
function sumKwh(rows: ConsoRow[], key: keyof ConsoRow): number | null {
  let total = 0, hasAny = false;
  for (const r of rows) {
    const v = r[key];
    if (v !== null && v !== undefined) {
      const n = typeof v === "string" ? parseFloat(v as string) : Number(v);
      if (!isNaN(n)) { total += n; hasAny = true; }
    }
  }
  return hasAny ? total : null;
}

function avgRatio(rows: ConsoRow[]): number | null {
  const vals = rows
    .map(r => r.ratio_fms ? parseFloat(r.ratio_fms) : null)
    .filter((v): v is number => v !== null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

// ═══════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════

function KpiCard({ label, value, sub, color, icon }: {
  label:string; value:string; sub?:string; color:string; icon:React.ReactNode;
}) {
  return (
    <div style={{
      background:"#fff",
      borderRadius:10,
      padding:"11px 13px",
      border:`1px solid ${C.slate[200]}`,
      position:"relative",
      overflow:"hidden",
      minWidth:0,
    }}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:color }} />
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
        <span style={{ fontSize:9, fontWeight:700, color:C.slate[500], textTransform:"uppercase", letterSpacing:"0.07em", lineHeight:1.3 }}>{label}</span>
        <span style={{ color, opacity:0.65, flexShrink:0 }}>{icon}</span>
      </div>
      <div style={{ fontSize:15, fontWeight:700, color:C.navy[800], fontFamily:"'JetBrains Mono',monospace", wordBreak:"break-all" }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:C.slate[500], marginTop:2 }}>{sub}</div>}
    </div>
  );
}

// ── Section label ────────────────────────────────────────────────────────────
function CardSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize:9, fontWeight:800, color:C.slate[400],
      textTransform:"uppercase", letterSpacing:"0.12em",
      marginBottom:4, paddingLeft:2,
    }}>
      {children}
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return <span style={{ color:C.slate[300], fontSize:11 }}>—</span>;
  const col = deltaColor(delta);
  const bg  = Math.abs(delta) < 10 ? C.success.light : Math.abs(delta) < 20 ? C.warning.light : C.danger.light;
  return (
    <span style={{
      display:"inline-block", padding:"3px 8px", borderRadius:6,
      background:bg, color:col, fontSize:11, fontWeight:700,
      fontFamily:"'JetBrains Mono',monospace", whiteSpace:"nowrap",
    }}>
      {deltaLabel(delta)}
    </span>
  );
}

function StatutBadge({ statut }: { statut: string | null }) {
  if (!statut) return <span style={{ color:C.slate[300] }}>—</span>;
  const ok = statut === "OK";
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:4,
      padding:"4px 10px", borderRadius:6,
      background: ok ? C.success.light : C.danger.light,
      color: ok ? C.success.dark : C.danger.dark,
      fontSize:11, fontWeight:700,
    }}>
      {ok ? <CheckCircle2 style={{width:11,height:11}}/> : <XCircle style={{width:11,height:11}}/>}
      {statut}
    </span>
  );
}

function RecurrBadge({ type }: { type: string | null }) {
  if (!type) return null;
  const crit = type === "critique";
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:4,
      padding:"3px 8px", borderRadius:6,
      background: crit ? C.danger.light : C.warning.light,
      color: crit ? C.danger.dark : C.warning.dark,
      fontSize:10, fontWeight:700, textTransform:"uppercase",
    }}>
      <AlertTriangle style={{width:9,height:9}}/>
      {crit ? "Critique" : "Light"}
    </span>
  );
}

function MiniBar({ value, maxVal, color, width = 60 }: { value:number|null; maxVal:number; color:string; width?:number }) {
  const pct = value && maxVal > 0 ? Math.min((value / maxVal) * 100, 100) : 0;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
      <div style={{ width, height:6, background:C.slate[100], borderRadius:99, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:99, transition:"width 0.4s ease" }} />
      </div>
    </div>
  );
}

// ── Bar chart SVG ────────────────────────────────────────────────────────────
function ConsoBarChart({ rows }: { rows: ConsoRow[] }) {
  if (!rows.length) return null;

  const CHART_W = 720, CHART_H = 260;
  const PADDING = { top:24, right:16, bottom:48, left:60 };
  const inner_w = CHART_W - PADDING.left - PADDING.right;
  const inner_h = CHART_H - PADDING.top  - PADDING.bottom;

  const parsed = rows.map(r => ({
    label:   MONTHS_FR[(r.month || 1) - 1],
    facture: r.conso_facturee ? parseFloat(r.conso_facturee) : null,
    fms:     r.conso_fms ? parseFloat(r.conso_fms) : (r.conso_acm ? parseFloat(r.conso_acm) : null),
    target:  r.conso_target  ? parseFloat(r.conso_target)  : null,
    solar:   r.solar_kwh ?? null,
  }));

  const allVals = parsed.flatMap(d => [d.facture, d.fms, d.target]).filter((v): v is number => v !== null);
  const maxVal  = allVals.length ? Math.max(...allVals) * 1.1 : 1;
  const BAR_GROUPS = 4;
  const groupW = inner_w / parsed.length;
  const barW   = Math.min(groupW / (BAR_GROUPS + 1), 18);
  const barGap = (groupW - barW * BAR_GROUPS) / (BAR_GROUPS + 1);
  const toY = (v: number | null) => v === null ? null : PADDING.top + inner_h - (v / maxVal) * inner_h;
  const ticks = 5;

  const SERIES = [
    { key:"facture", label:"Facturée", color:C.navy[500] },
    { key:"fms",     label:"FMS/ACM",  color:C.info.main },
    { key:"target",  label:"Target",   color:C.success.main },
    { key:"solar",   label:"Solaire",  color:C.solar.main },
  ] as const;

  return (
    <div style={{ overflowX:"auto" }}>
      <svg width={CHART_W} height={CHART_H} style={{ fontFamily:"inherit", display:"block" }}>
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const y = PADDING.top + (i / ticks) * inner_h;
          const val = maxVal - (i / ticks) * maxVal;
          return (
            <g key={i}>
              <line x1={PADDING.left} y1={y} x2={CHART_W - PADDING.right} y2={y}
                stroke={C.slate[200]} strokeWidth={1} strokeDasharray={i === ticks ? "none" : "4,3"} />
              <text x={PADDING.left - 6} y={y + 4} textAnchor="end" fontSize={9} fill={C.slate[400]}>
                {val >= 1000 ? `${(val/1000).toFixed(0)}k` : val.toFixed(0)}
              </text>
            </g>
          );
        })}

        {parsed.map((d, gi) => {
          const groupX = PADDING.left + gi * groupW;
          return (
            <g key={gi}>
              {SERIES.map((s, si) => {
                const val  = (d as Record<string, number | null>)[s.key];
                const y    = toY(val);
                const x    = groupX + barGap + si * (barW + barGap / 2);
                const barH = val !== null && y !== null ? inner_h - (y - PADDING.top) : 0;
                return y !== null ? (
                  <g key={s.key}>
                    <rect x={x} y={y} width={barW} height={barH} rx={3} fill={s.color} opacity={0.85} />
                    {barH > 16 && (
                      <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize={8} fill={s.color} fontWeight={600}>
                        {val! >= 1000 ? `${(val!/1000).toFixed(1)}k` : val!.toFixed(0)}
                      </text>
                    )}
                  </g>
                ) : null;
              })}
              <text x={groupX + groupW / 2} y={CHART_H - PADDING.bottom + 14}
                textAnchor="middle" fontSize={10} fill={C.slate[600]} fontWeight={600}>
                {d.label}
              </text>
            </g>
          );
        })}

        <text transform={`translate(12, ${PADDING.top + inner_h / 2}) rotate(-90)`}
          textAnchor="middle" fontSize={9} fill={C.slate[400]}>kWh</text>
      </svg>

      <div style={{ display:"flex", gap:16, justifyContent:"center", marginTop:8 }}>
        {SERIES.map(s => (
          <div key={s.key} style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:C.slate[600] }}>
            <div style={{ width:12, height:12, borderRadius:3, background:s.color }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Table conso ──────────────────────────────────────────────────────────────
function ConsoTable({ consoRows, margeRows }: { consoRows:ConsoRow[]; margeRows:MargeRow[] }) {
  const mergeByMonth = (month: number) => margeRows.find(r => r.month === month);
  if (!consoRows.length) return (
    <div style={{ padding:"48px 24px", textAlign:"center", color:C.slate[400] }}>
      Aucune donnée de consommation disponible pour cette période.
    </div>
  );

  const allFacture = consoRows.map(r => r.conso_facturee ? parseFloat(r.conso_facturee) : null).filter(Boolean) as number[];
  const maxFacture = allFacture.length ? Math.max(...allFacture) : 1;

  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
        <thead>
          <tr style={{ background:C.slate[50] }}>
            {["Mois","Jours","Conso Facturée","Conso FMS/ACM","Δ FMS/Fact","Conso Target","Δ Fact/Target","Solar kWh","Indispo (h)","Marge","Statut"].map(h => (
              <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:9, fontWeight:700, color:C.slate[500], textTransform:"uppercase", letterSpacing:"0.1em", borderBottom:`1px solid ${C.slate[200]}`, whiteSpace:"nowrap" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {consoRows.map((r, i) => {
            const marge    = mergeByMonth(r.month);
            const fmsVal   = r.conso_fms || r.conso_acm;
            const deltaFms = calcDelta(fmsVal, r.conso_facturee);
            const deltaTgt = calcDelta(r.conso_facturee, r.conso_target);
            const factN    = r.conso_facturee ? parseFloat(r.conso_facturee) : null;
            const isNOK    = marge?.marge_statut === "NOK";

            return (
              <tr key={r.period} style={{ borderBottom:`1px solid ${C.slate[100]}`, background: isNOK ? `${C.danger.light}60` : i % 2 === 0 ? "#fff" : C.slate[50] }}>
                <td style={{ padding:"12px 14px", fontWeight:700, color:C.navy[800], whiteSpace:"nowrap" }}>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace" }}>{r.period}</div>
                  {marge?.recurrence_type && <div style={{ marginTop:3 }}><RecurrBadge type={marge.recurrence_type} /></div>}
                </td>
                <td style={{ padding:"12px 14px", color:C.slate[500], textAlign:"center" }}>{r.nb_jours ?? "—"}</td>
                <td style={{ padding:"12px 14px" }}>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:600, color:C.navy[700] }}>{fmtKwh(r.conso_facturee)}</div>
                  {factN !== null && <MiniBar value={factN} maxVal={maxFacture} color={C.navy[400]} />}
                </td>
                <td style={{ padding:"12px 14px" }}>
                  {fmsVal ? (
                    <div>
                      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:600, color:C.info.main }}>{fmtKwh(fmsVal)}</div>
                      <div style={{ fontSize:10, color:C.slate[400], marginTop:2 }}>
                        {r.conso_fms ? "FMS/Grid" : "ACM"}
                        {!r.fms_available && !r.acm_available && <span style={{ color:C.warning.main }}> · indispo</span>}
                      </div>
                    </div>
                  ) : <span style={{ color:C.slate[300], fontSize:11 }}>indisponible</span>}
                </td>
                <td style={{ padding:"12px 14px" }}><DeltaBadge delta={deltaFms} /></td>
                <td style={{ padding:"12px 14px" }}>
                  {r.conso_target ? (
                    <div>
                      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:600, color:C.success.main }}>{fmtKwh(r.conso_target)}</div>
                      {r.cible_kwh_j && <div style={{ fontSize:10, color:C.slate[400], marginTop:2 }}>{fmt(r.cible_kwh_j, 3)} kWh/j × {r.nb_jours}j</div>}
                    </div>
                  ) : <span style={{ color:C.slate[300], fontSize:11 }}>—</span>}
                </td>
                <td style={{ padding:"12px 14px" }}><DeltaBadge delta={deltaTgt} /></td>
                <td style={{ padding:"12px 14px" }}>
                  {r.solar_kwh !== null && r.solar_kwh !== undefined ? (
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <Sun style={{ width:12, height:12, color:C.solar.main }} />
                      <span style={{ fontFamily:"'JetBrains Mono',monospace", color:C.solar.dark, fontWeight:600 }}>{fmtKwh(r.solar_kwh)}</span>
                    </div>
                  ) : <span style={{ color:C.slate[300], fontSize:11 }}>—</span>}
                </td>
                <td style={{ padding:"12px 14px", color:C.slate[500], fontFamily:"'JetBrains Mono',monospace" }}>
                  {r.unavail_hours !== null && r.unavail_hours !== undefined ? `${fmt(r.unavail_hours, 1)} h` : "—"}
                </td>
                <td style={{ padding:"12px 14px" }}>
                  {marge?.marge ? (
                    <span style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:700, color: parseFloat(marge.marge) >= 0 ? C.success.main : C.danger.main }}>
                      {fmtMoney(marge.marge)}
                    </span>
                  ) : <span style={{ color:C.slate[300] }}>—</span>}
                </td>
                <td style={{ padding:"12px 14px" }}><StatutBadge statut={marge?.marge_statut ?? null} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Diagnostics ──────────────────────────────────────────────────────────────
const SEV_CONFIG = {
  CRITICAL: { color:C.danger.main,  bg:C.danger.light,  label:"Critique" },
  HIGH:     { color:"#c2410c",      bg:"#ffedd5",        label:"Élevé"    },
  MEDIUM:   { color:C.warning.main, bg:C.warning.light, label:"Moyen"    },
  LOW:      { color:C.success.main, bg:C.success.light, label:"Faible"   },
};

function DiagnosticsPanel({ items }: { items: SiteDetail["diagnostics"] }) {
  if (!items.length) return (
    <div style={{ padding:"16px 20px", background:C.success.light, borderRadius:10, color:C.success.dark, fontSize:13, display:"flex", alignItems:"center", gap:8 }}>
      <CheckCircle2 style={{width:15,height:15}}/> Aucun diagnostic — site en bonne santé financière.
    </div>
  );
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {items.map((d, i) => {
        const cfg = SEV_CONFIG[d.severity as keyof typeof SEV_CONFIG] || SEV_CONFIG.MEDIUM;
        return (
          <div key={i} style={{ padding:"12px 16px", borderRadius:10, background:cfg.bg, borderLeft:`3px solid ${cfg.color}` }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
              <span style={{ fontSize:9, fontWeight:700, textTransform:"uppercase", background:cfg.color, color:"#fff", padding:"2px 6px", borderRadius:4 }}>{cfg.label}</span>
              <span style={{ fontSize:12, fontWeight:600, color:cfg.color }}>{d.message}</span>
            </div>
            <p style={{ fontSize:11, color:C.slate[600], margin:0 }}>{d.detail}</p>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN MODAL
// ═══════════════════════════════════════════════════════════════════

export default function FinancialSiteDetailModal({
  siteId, siteName, year, monthStart, monthEnd, onClose,
}: FinancialSiteDetailModalProps) {
  const [data,    setData]    = useState<SiteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [view,    setView]    = useState<"table" | "chart">("table");
  const [section, setSection] = useState<"conso" | "marge" | "diag">("conso");

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get(`/financial/evaluations/${siteId}/detail/`, {
        params: { year, month_start: monthStart, month_end: monthEnd },
      })
      .then(r => { setData(r.data); setLoading(false); })
      .catch(e => { setError(e?.response?.data?.detail || "Erreur de chargement"); setLoading(false); });
  }, [siteId, year, monthStart, monthEnd]);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onClose]);

  const consoRows    = data?.conso_comparison?.rows ?? [];
  const margeRows    = data?.history ?? [];
  const totalMarge   = data?.summary.total_marge ?? null;
  const margePositif = totalMarge !== null && parseFloat(totalMarge) >= 0;

  // ── Agrégats conso ──────────────────────────────────────────────
  const totalFacturee    = sumKwh(consoRows, "conso_facturee");
  const totalFms         = sumKwh(consoRows, "conso_fms") ?? sumKwh(consoRows, "conso_acm");
  const totalTarget      = sumKwh(consoRows, "conso_target");
  const totalSolar       = sumKwh(consoRows, "solar_kwh");
  const ratioMoyFms      = avgRatio(consoRows);
  const ratioFactTarget  = totalFacturee !== null && totalTarget !== null && totalTarget > 0
    ? (totalFacturee / totalTarget) * 100 : null;

  return (
    <div
      style={{ position:"fixed", inset:0, zIndex:1000, background:"rgba(10,22,40,0.65)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:24, animation:"fadeIn 0.15s ease" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background:"#fff", borderRadius:20, width:"100%", maxWidth:1140, maxHeight:"92vh", overflow:"hidden", display:"flex", flexDirection:"column", boxShadow:"0 25px 60px rgba(10,22,40,0.35)", animation:"slideUp 0.2s ease" }}>

        {/* ── Header ── */}
        <div style={{ background:`linear-gradient(135deg, ${C.navy[800]} 0%, ${C.navy[900]} 100%)`, padding:"18px 24px", display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, flexShrink:0 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:5 }}>
              <div style={{ background:`${C.accent[400]}22`, border:`1px solid ${C.accent[400]}44`, borderRadius:8, padding:"3px 9px", fontSize:11, fontWeight:700, fontFamily:"'JetBrains Mono',monospace", color:C.accent[400] }}>
                {siteId}
              </div>
              {data?.current?.recurrence_type && <RecurrBadge type={data.current.recurrence_type} />}
            </div>
            <h2 style={{ margin:0, fontSize:17, fontWeight:700, color:"#fff" }}>{siteName || data?.site?.name || siteId}</h2>
            <div style={{ fontSize:11.5, color:C.slate[300], marginTop:3 }}>
              {data?.site?.typology && <span>{data.site.typology} · {data.site.configuration} · Load {data.current?.load_w ? `${(data.current.load_w / 1000).toFixed(1)} kW` : "—"}</span>}
              <span style={{ marginLeft:8, color:C.slate[500] }}>{year} · Mois {monthStart}–{monthEnd}</span>
            </div>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {section === "conso" && (
              <div style={{ display:"flex", background:`${C.navy[700]}80`, borderRadius:8, padding:3 }}>
                {([["table","Table",TableProperties],["chart","Graphe",BarChart3]] as const).map(([k, l, Icon]) => (
                  <button key={k} onClick={() => setView(k as "table" | "chart")} style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 12px", borderRadius:6, border:"none", cursor:"pointer", background: view === k ? "#ffffff22" : "transparent", color: view === k ? "#fff" : C.slate[400], fontSize:12, fontWeight:view === k ? 600 : 400 }}>
                    <Icon style={{width:13,height:13}}/>{l}
                  </button>
                ))}
              </div>
            )}
            <button onClick={onClose} style={{ width:32, height:32, borderRadius:"50%", background:`${C.navy[700]}80`, border:"none", cursor:"pointer", display:"grid", placeItems:"center", color:C.slate[300] }}>
              <X style={{width:16,height:16}}/>
            </button>
          </div>
        </div>

        {/* ── KPI Bar — 2 lignes ── */}
        {data && (
          <div style={{ padding:"14px 24px 12px", background:C.slate[50], borderBottom:`1px solid ${C.slate[200]}`, flexShrink:0, display:"flex", flexDirection:"column", gap:10 }}>

            {/* Ligne 1 : Marges & pénalités */}
            <div>
              <CardSectionLabel>Marges & Pénalités</CardSectionLabel>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:8 }}>
                <KpiCard label="Marge totale" value={fmtMoney(data.summary.total_marge)} color={margePositif ? C.success.main : C.danger.main} icon={margePositif ? <TrendingUp style={{width:13,height:13}}/> : <TrendingDown style={{width:13,height:13}}/>} />
                <KpiCard label="Mois OK / NOK" value={`${data.summary.count_ok} / ${data.summary.count_nok}`} color={data.summary.count_nok > 0 ? C.danger.main : C.success.main} icon={<Activity style={{width:13,height:13}}/>} />
                <KpiCard label="Redevance (dernier)" value={fmtMoney(data.current?.redevance)} color={C.accent[500]} icon={<TrendingUp style={{width:13,height:13}}/>} />
                <KpiCard label="Total HT Sénélec" value={fmtMoney(data.summary.billing_total_ht)} color={C.navy[600]} icon={<Zap style={{width:13,height:13}}/>} />
                <KpiCard label="Pénalité Cos φ" value={fmtMoney(data.summary.billing_total_cosphi)} color={C.info.main} icon={<AlertTriangle style={{width:13,height:13}}/>} />
                <KpiCard label="Pénalité Puiss." value={fmtMoney(data.summary.billing_total_penalite)} color={C.warning.main} icon={<AlertTriangle style={{width:13,height:13}}/>} />
              </div>
            </div>

            {/* Ligne 2 : Consommations */}
            {consoRows.length > 0 && (
              <div>
                <CardSectionLabel>Consommations</CardSectionLabel>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:8 }}>
                  <KpiCard
                    label="Conso Facturée (cumul)"
                    value={totalFacturee !== null ? fmtKwh(totalFacturee) : "—"}
                    color={C.navy[500]}
                    icon={<Zap style={{width:13,height:13}}/>}
                  />
                  <KpiCard
                    label="Conso FMS / ACM (cumul)"
                    value={totalFms !== null ? fmtKwh(totalFms) : "—"}
                    color={C.info.main}
                    icon={<Activity style={{width:13,height:13}}/>}
                  />
                  <KpiCard
                    label="Ratio FMS / Fact. moy."
                    value={ratioMoyFms !== null ? `${(ratioMoyFms * 100).toFixed(1)} %` : "—"}
                    sub={ratioMoyFms !== null
                      ? Math.abs(ratioMoyFms * 100 - 100) < 10 ? "✓ cohérent" : "⚠ écart important"
                      : undefined}
                    color={ratioMoyFms !== null && Math.abs(ratioMoyFms * 100 - 100) < 10 ? C.success.main : C.danger.main}
                    icon={<Info style={{width:13,height:13}}/>}
                  />
                  <KpiCard
                    label="Conso Target (cumul)"
                    value={totalTarget !== null ? fmtKwh(totalTarget) : "—"}
                    color={C.success.main}
                    icon={<TrendingUp style={{width:13,height:13}}/>}
                  />
                  <KpiCard
                    label="Fact. / Target moy."
                    value={ratioFactTarget !== null ? `${ratioFactTarget.toFixed(1)} %` : "—"}
                    sub={ratioFactTarget !== null
                      ? ratioFactTarget > 90 && ratioFactTarget < 110 ? "✓ dans la cible"
                        : ratioFactTarget > 110 ? "▲ sur-consommation" : "▼ sous-consommation"
                      : undefined}
                    color={ratioFactTarget !== null && ratioFactTarget > 90 && ratioFactTarget < 110 ? C.success.main : C.warning.main}
                    icon={<BarChart3 style={{width:13,height:13}}/>}
                  />
                  <KpiCard
                    label="Prod. solaire (cumul)"
                    value={totalSolar !== null ? fmtKwh(totalSolar) : "—"}
                    color={C.solar.main}
                    icon={<Sun style={{width:13,height:13}}/>}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Section tabs ── */}
        <div style={{ display:"flex", gap:4, padding:"12px 24px 0", borderBottom:`1px solid ${C.slate[200]}`, flexShrink:0 }}>
          {([
            ["conso", "Consommation",    BarChart3],
            ["marge", "Historique marge", TrendingUp],
            ["diag",  "Diagnostics",      AlertTriangle],
          ] as const).map(([k, l, Icon]) => (
            <button key={k} onClick={() => setSection(k as "conso" | "marge" | "diag")} style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:"8px 8px 0 0", border:"none", cursor:"pointer", background: section === k ? "#fff" : "transparent", borderBottom: section === k ? `2px solid ${C.navy[600]}` : "2px solid transparent", color: section === k ? C.navy[700] : C.slate[500], fontSize:12, fontWeight: section === k ? 700 : 500 }}>
              <Icon style={{width:13,height:13}}/>{l}
              {k === "diag" && data?.diagnostics.length ? (
                <span style={{ background: data.diagnostics.some(d => d.severity === "CRITICAL") ? C.danger.main : C.warning.main, color:"#fff", fontSize:9, fontWeight:700, padding:"1px 5px", borderRadius:4 }}>
                  {data.diagnostics.length}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>
          {loading && (
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:60, gap:12, color:C.slate[500] }}>
              <div style={{ width:20, height:20, border:`2px solid ${C.navy[200]}`, borderTopColor:C.navy[600], borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
              Chargement des données…
            </div>
          )}

          {error && (
            <div style={{ padding:"16px 20px", borderRadius:10, background:C.danger.light, color:C.danger.dark, fontSize:13, display:"flex", alignItems:"center", gap:8 }}>
              <XCircle style={{width:16,height:16}}/> {error}
            </div>
          )}

          {!loading && !error && data && (
            <>
              {section === "conso" && (
                <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                  {consoRows.length === 0 && (
                    <div style={{ padding:"48px 24px", textAlign:"center", color:C.slate[400], fontSize:13 }}>
                      Aucune donnée de consommation pour cette période.
                    </div>
                  )}
                  {consoRows.length > 0 && view === "table" && <ConsoTable consoRows={consoRows} margeRows={margeRows} />}
                  {consoRows.length > 0 && view === "chart" && (
                    <div style={{ padding:"8px 0" }}>
                      <div style={{ marginBottom:12, fontSize:12, color:C.slate[500] }}>Comparaison des consommations (kWh) · {year}</div>
                      <ConsoBarChart rows={consoRows} />
                    </div>
                  )}
                  <div style={{ padding:"12px 16px", background:C.slate[50], borderRadius:10, border:`1px solid ${C.slate[200]}`, fontSize:11, color:C.slate[500], display:"flex", gap:20, flexWrap:"wrap" }}>
                    <span><strong style={{color:C.navy[600]}}>Facturée</strong> — kWh Sénélec certifiés</span>
                    <span><strong style={{color:C.info.main}}>FMS/ACM</strong> — Grid Report ou AC Meter (eFMS)</span>
                    <span><strong style={{color:C.success.main}}>Target</strong> — Cible catalogue (cible_kwh_j × jours)</span>
                    <span><strong style={{color:C.solar.main}}>Solaire</strong> — Production PV fact_solar_mth</span>
                    <span><strong>Δ</strong> : vert &lt;10% · ambre 10–20% · rouge &gt;20%</span>
                  </div>
                </div>
              )}

              {section === "marge" && (
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                    <thead>
                      <tr style={{ background:C.slate[50] }}>
                        {["Mois","Load (W)","Redevance","Montant HT","Marge","Statut","Récurrence","Hors cat."].map(h => (
                          <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:9, fontWeight:700, color:C.slate[500], textTransform:"uppercase", letterSpacing:"0.1em", borderBottom:`1px solid ${C.slate[200]}`, whiteSpace:"nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {margeRows.map((r, i) => {
                        const isNOK = r.marge_statut === "NOK";
                        const margeN = r.marge ? parseFloat(r.marge) : null;
                        return (
                          <tr key={r.period} style={{ borderBottom:`1px solid ${C.slate[100]}`, background: isNOK ? `${C.danger.light}50` : i % 2 === 0 ? "#fff" : C.slate[50] }}>
                            <td style={{ padding:"11px 14px", fontWeight:600, color:C.navy[800], fontFamily:"'JetBrains Mono',monospace" }}>{r.period}</td>
                            <td style={{ padding:"11px 14px", color:C.slate[600], fontFamily:"'JetBrains Mono',monospace" }}>{r.load_w ? r.load_w.toLocaleString("fr-FR") : "—"}</td>
                            <td style={{ padding:"11px 14px", fontFamily:"'JetBrains Mono',monospace", color:C.navy[700] }}>{fmtMoney(r.redevance)}</td>
                            <td style={{ padding:"11px 14px", fontFamily:"'JetBrains Mono',monospace", color:C.slate[700] }}>{fmtMoney(r.montant_htva)}</td>
                            <td style={{ padding:"11px 14px", fontFamily:"'JetBrains Mono',monospace", fontWeight:700, color: margeN !== null ? (margeN >= 0 ? C.success.main : C.danger.main) : C.slate[400] }}>{fmtMoney(r.marge)}</td>
                            <td style={{ padding:"11px 14px" }}><StatutBadge statut={r.marge_statut} /></td>
                            <td style={{ padding:"11px 14px" }}><RecurrBadge type={r.recurrence_type} /></td>
                            <td style={{ padding:"11px 14px", textAlign:"center" }}>
                              {r.hors_catalogue
                                ? <span style={{ fontSize:10, fontWeight:700, color:C.warning.main, background:C.warning.light, padding:"2px 7px", borderRadius:4 }}>HC</span>
                                : <span style={{ color:C.slate[300] }}>—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {section === "diag" && <DiagnosticsPanel items={data.diagnostics} />}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding:"12px 24px", borderTop:`1px solid ${C.slate[200]}`, display:"flex", alignItems:"center", justifyContent:"space-between", background:C.slate[50], flexShrink:0 }}>
          <div style={{ fontSize:11, color:C.slate[400] }}>
            Évaluation financière · PAID + UNPAID uniquement · {year}-{String(monthStart).padStart(2,"0")} → {year}-{String(monthEnd).padStart(2,"0")}
          </div>
          <button onClick={onClose} style={{ padding:"8px 18px", borderRadius:8, background:`linear-gradient(135deg, ${C.navy[700]}, ${C.navy[800]})`, color:"#fff", border:"none", fontSize:12, fontWeight:600, cursor:"pointer" }}>
            Fermer
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes slideUp { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
        @keyframes spin    { to { transform:rotate(360deg) } }
      `}</style>
    </div>
  );
}