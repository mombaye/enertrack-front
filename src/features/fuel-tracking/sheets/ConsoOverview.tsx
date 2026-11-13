// Blocs visuels de « Suivis Consommations » : cartes KPI (avec tendance), évolution par période, répartition des bilans.
// Aucune valeur inventée : une série ou une tendance absente est affichée comme telle (« — », « pas de période précédente »).
import type { CSSProperties, ReactNode } from "react";
import { Area, AreaChart, CartesianGrid, Cell, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, CheckCircle2, Fuel, Gauge, PieChart as PieIcon, Droplets } from "lucide-react";
import type { ConsoEvolution } from "@/services/fuelTracking";
import { HelpTip } from "./cphBadges";
import { FT } from "../theme";

const nf = (v: number | null | undefined, d = 0) => (v === null || v === undefined ? "—" : v.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }));
const card: CSSProperties = { border: "1px solid #E6ECF5", background: FT.card, borderRadius: 16, boxShadow: "0 6px 18px rgba(15,23,42,.06)" };

export type OverviewCard = { key: string; label: string; value: number | null; sub: string; help?: string; color: string; bg: string; icon: "sigma" | "closing" | "snow" | "cph"; series?: Array<number | null>; trend?: number | null; trendNote?: string };

const ICONS = { sigma: Fuel, closing: CheckCircle2, snow: Gauge, cph: Droplets };

function Spark({ data, color }: { data: Array<number | null>; color: string }) {
  const pts = data.map((v, i) => ({ i, v })).filter((p) => p.v !== null) as Array<{ i: number; v: number }>;
  if (pts.length < 2) return null;
  return (
    <div aria-hidden style={{ position: "absolute", right: 8, bottom: 6, width: 120, height: 46, opacity: 0.9 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={pts} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <Area type="monotone" dataKey="v" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={2} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function KpiCards({ cards }: { cards: OverviewCard[] }) {
  return (
    <div role="group" aria-label="Indicateurs de la période" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
      {cards.map((c) => {
        const Icon = ICONS[c.icon];
        return (
          <div key={c.key} style={{ ...card, position: "relative", overflow: "hidden", padding: "18px 18px", background: `linear-gradient(135deg, ${c.bg}, ${FT.card} 75%)`, display: "flex", gap: 14, minHeight: 118, alignItems: "flex-start" }}>
            <div aria-hidden style={{ width: 56, height: 56, borderRadius: 999, background: "#fff", boxShadow: `0 0 0 6px ${c.bg}`, display: "grid", placeItems: "center", flexShrink: 0, margin: 6 }}>
              <Icon size={26} color={c.color} />
            </div>
            <div style={{ minWidth: 0, display: "grid", alignContent: "start", gap: 2 }}>
              <div style={{ fontSize: 14.5, color: FT.text, fontWeight: 600 }}>{c.label}{c.help && <HelpTip text={c.help} label={c.label} />}</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: FT.text, fontVariantNumeric: "tabular-nums", lineHeight: 1.15 }}>{c.value === null ? "—" : `${nf(c.value)} L`}</div>
              <div style={{ fontSize: 11.5, color: FT.textMid }}>{c.sub}</div>
              {c.trend !== undefined && (
                <div style={{ fontSize: 11.5, fontWeight: 700, color: c.trend === null ? FT.textSub : c.trend >= 0 ? FT.green : FT.red }}>
                  {c.trend === null ? c.trendNote ?? "tendance indisponible" : `${c.trend >= 0 ? "↑ +" : "↓ "}${nf(c.trend, 1)} % vs période précédente`}
                </div>
              )}
            </div>
            {c.series && <Spark data={c.series} color={c.color} />}
          </div>
        );
      })}
    </div>
  );
}

const shortDay = (iso: string) => { const d = new Date(iso); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`; };

export function EvolutionChart({ evo, loading, error }: { evo: ConsoEvolution | undefined; loading: boolean; error: boolean }) {
  const data = (evo?.periodes ?? []).map((p) => ({ x: shortDay(p.fin), label: `${shortDay(p.debut)} → ${shortDay(p.fin)} (${p.jours} j)`, variation: p.variation_l, closing: p.closing_l }));
  const anyData = data.some((d) => d.variation !== null || d.closing !== null);
  return (
    <section aria-label="Évolution des consommations" style={{ ...card, padding: "14px 16px", minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 17, display: "flex", alignItems: "center", gap: 8 }}><BarChart3 size={19} color={FT.blue} aria-hidden /> Évolution des consommations</h3>
        <div aria-hidden style={{ display: "inline-flex", gap: 14, padding: "6px 14px", borderRadius: 999, border: "1px solid #E6ECF5", fontSize: 12.5 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i style={{ width: 9, height: 9, borderRadius: 999, background: "#2563EB" }} /> Variation de stock</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i style={{ width: 9, height: 9, borderRadius: 999, background: "#16A34A" }} /> Consommation Closing</span>
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: FT.textMid, margin: "2px 0 6px" }}>Somme des sites par période de bilan (instrumentée et CPH non historisées).</div>
      <div style={{ height: 250 }}>
        {loading ? <div aria-busy="true" style={{ color: FT.textMid, fontSize: 13 }}>Chargement…</div>
          : error ? <div role="alert" style={{ color: FT.red, fontSize: 13 }}>Évolution indisponible (erreur serveur).</div>
          : !anyData ? <div style={{ color: FT.textMid, fontSize: 13, padding: 20 }}>Aucune période avec valeur calculée à afficher.</div>
          : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={FT.border} />
                <XAxis dataKey="x" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <Tooltip formatter={(v) => (typeof v === "number" ? `${nf(v)} L` : "—")} labelFormatter={(_, p) => (p?.[0]?.payload as { label?: string } | undefined)?.label ?? ""} />
                <Area type="monotone" name="Variation de stock" dataKey="variation" stroke="#2563EB" fill="#2563EB" fillOpacity={0.08} strokeWidth={2.5} dot connectNulls={false} />
                <Line type="monotone" name="Consommation Closing" dataKey="closing" stroke="#16A34A" strokeWidth={2.5} dot connectNulls={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
      </div>
    </section>
  );
}

export function StatusDonut({ items, total }: { items: Array<{ label: string; n: number; color: string }>; total: number }) {
  const shown = items.filter((i) => i.n > 0);
  return (
    <section aria-label="Répartition des bilans" style={{ ...card, padding: "14px 16px", minWidth: 0 }}>
      <h3 style={{ margin: 0, fontSize: 17, display: "flex", alignItems: "center", gap: 8 }}><PieIcon size={19} color={FT.blue} aria-hidden /> Répartition</h3>
      <div style={{ fontSize: 11.5, color: FT.textMid, margin: "2px 0 6px" }}>Nombre de sites par statut de bilan (sites utilisés dans les totaux).</div>
      {total === 0 ? <div style={{ color: FT.textMid, fontSize: 13, padding: 20 }}>Aucun site.</div> : (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ width: 190, height: 190, position: "relative" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={shown} dataKey="n" nameKey="label" innerRadius={62} outerRadius={92} paddingAngle={shown.length > 1 ? 2 : 0} isAnimationActive={false}>
                  {shown.map((s) => <Cell key={s.label} fill={s.color} />)}
                </Pie>
                <Tooltip formatter={(v) => `${nf(typeof v === "number" ? v : null)} site(s)`} />
              </PieChart>
            </ResponsiveContainer>
            <div aria-hidden style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none", textAlign: "center" }}>
              <div><div style={{ fontSize: 24, fontWeight: 800 }}>{nf(total)} sites</div><div style={{ fontSize: 12, color: FT.textMid }}>Total</div></div>
            </div>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6, fontSize: 12.5 }}>
            {items.map((i) => (
              <li key={i.label} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span aria-hidden style={{ width: 10, height: 10, borderRadius: 999, background: i.color }} />
                <span>{i.label}</span><strong style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>{nf(i.n)} ({total ? nf((100 * i.n) / total, 1) : "0"} %)</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function SectionTitle({ title, subtitle, right }: { title: string; subtitle: string; right?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 22, color: FT.text }}>{title}</h2>
        <div style={{ fontSize: 13, color: FT.textMid }}>{subtitle}</div>
      </div>
      {right}
    </div>
  );
}
