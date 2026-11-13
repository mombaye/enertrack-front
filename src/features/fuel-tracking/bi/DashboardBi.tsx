// Dashboard (vue d'ensemble d'un mois) : mise en page de la maquette validée (suivi-carburant-v5).
// Chaque chiffre vient d'un endpoint existant ; un bloc sans source en production est affiché « non disponible », jamais inventé.
import { useContext, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import { getBiClosingSynthese, getBiConso, getBiConsoSources, getBiStock, type BiConsoSite } from "@/services/fuelTracking";
import { DEBUT_SUIVI, monthLabel } from "../helpers";
import { FT } from "../theme";
import { ConsoSources } from "./ConsoBi";
import { AlerteRow, useAlertes } from "./AlertesBi";
import { BI, BiKpi, ChartCard, FilterBar, KpiRow, OpenSiteContext, Pill, StateBox, axisProps, fL, fNum, fPct, fShort, tooltipStyle, CARD } from "./kit";
import { Card } from "../ui";

// Couleurs catégorielles de la maquette, attribuées à la région dans l'ordre alphabétique (stables quand un filtre s'applique).
const PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#7b61c9", "#0e9bb0"];
const NONE = "#A9B1BE";
type TopKey = "conso" | "depassement" | "jour";
const TOP_LABEL: Record<TopKey, string> = { conso: "Plus gros consommateurs", depassement: "Dépassement target", jour: "L / jour" };

const prevMonthOf = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const sumOf = <T,>(rows: T[], f: (r: T) => number | null | undefined) => rows.reduce((a, r) => a + (f(r) ?? 0), 0);

export function DashboardBi({ toMonth, zone, onTab }: { toMonth: string | null; zone: string; onTab?: (t: "ALERTES") => void }) {
  const openSite = useContext(OpenSiteContext);
  const [topKey, setTopKey] = useState<TopKey>("conso");
  const month = toMonth ?? undefined;
  const prev = toMonth ? prevMonthOf(toMonth) : null;
  const prevOk = !!prev && prev >= DEBUT_SUIVI;   // pas de comparaison avant le début du suivi

  const conso = useQuery({
    queryKey: ["fuel-dash-conso", toMonth, zone],
    queryFn: () => getBiConso({ from_month: month, to_month: month, month, zone }),
    enabled: !!toMonth, staleTime: 60_000, placeholderData: (p) => p,
  });
  const consoPrev = useQuery({
    queryKey: ["fuel-dash-conso", prev, zone],
    queryFn: () => getBiConso({ from_month: prev!, to_month: prev!, month: prev!, zone }),
    enabled: prevOk, staleTime: 5 * 60_000, placeholderData: (p) => p,
  });
  // Même clé que le bloc des 4 mesures : une seule requête pour les deux.
  const src = useQuery({
    queryKey: ["fuel-bi-conso-sources", month, month, undefined, zone, undefined, undefined],
    queryFn: () => getBiConsoSources({ from_month: month, to_month: month, zone }),
    enabled: !!toMonth, staleTime: 5 * 60_000, retry: false,
  });
  const srcPrev = useQuery({
    queryKey: ["fuel-bi-conso-sources", prev, prev, undefined, zone, undefined, undefined],
    queryFn: () => getBiConsoSources({ from_month: prev!, to_month: prev!, zone }),
    enabled: prevOk, staleTime: 5 * 60_000, retry: false,
  });
  const stock = useQuery({
    queryKey: ["fuel-bi-stock", zone, toMonth],
    queryFn: () => getBiStock({ zone, month }),
    staleTime: 60_000, placeholderData: (p) => p,
  });
  const alertes = useAlertes(toMonth, zone);
  // Fichier Closing du mois : target, vols, statuts, variation de stock — chiffres du fichier, avec le motif précis quand il manque.
  const syn = useQuery({ queryKey: ["fuel-closing-synthese", toMonth], queryFn: () => getBiClosingSynthese(toMonth!), enabled: !!toMonth, staleTime: 5 * 60_000, retry: false });
  const sy = syn.data?.disponible ? syn.data : null;
  const noClosing = syn.data && !syn.data.disponible ? syn.data : null;
  const manque = (what: string) => syn.isError ? `${what} : chargement impossible (réessayez)` : noClosing ? `${what} : ${noClosing.motif ?? "aucun Closing importé pour ce mois"}` : "…";

  const c = conso.data;
  const k = c?.kpis;
  const sites: BiConsoSite[] = c?.sites ?? [];
  const zones = [...(c?.filters.zones ?? [])].sort();
  const zoneColor = (z: string | null | undefined) => { const i = z ? zones.indexOf(z) : -1; return i >= 0 ? PALETTE[i % PALETTE.length] : NONE; };

  // Consommation du mois : Closing (comme la maquette), comparée au mois précédent seulement dans la période de suivi.
  const closing = src.data?.disponible ? src.data.kpis.closing?.total_l ?? null : null;
  const closingPrev = prevOk && srcPrev.data?.disponible ? srcPrev.data.kpis.closing?.total_l ?? null : null;
  const deltaPct = closing != null && closingPrev ? (closing - closingPrev) / closingPrev * 100 : null;

  // Réalisé sur target : Σ conso mesurée ÷ Σ target, sur les sites ayant les deux.
  const withTarget = sites.filter((s) => s.conso_mesuree_l != null && s.target_l != null);
  const tm = sumOf(withTarget, (s) => s.conso_mesuree_l), tt = sumOf(withTarget, (s) => s.target_l);
  const pTarget = tt ? tm / tt * 100 : null;
  const gaugeTone = pTarget == null ? "mute" : pTarget <= 100 ? "good" : pTarget <= 110 ? "warn" : "crit";
  const gaugeColor = { good: "#0CA30C", warn: "#FAB219", crit: "#D03B3B", mute: NONE }[gaugeTone];

  const sk = stock.data?.kpis;
  const srcDist = stock.data?.distribution_source;
  const nbEstime = srcDist?.find((b) => b.label === "Estimation")?.nb_sites ?? 0;
  const nbSans = srcDist?.find((b) => b.label === "Aucun relevé")?.nb_sites ?? 0;
  const pctMesure = srcDist && sk?.nb_sites ? (sk.nb_sites - nbEstime - nbSans) / sk.nb_sites * 100 : null;

  const regions = (c?.by_zone ?? []).filter((z) => (z.conso_mesuree_l ?? 0) > 0);
  const totalRegions = sumOf(regions, (z) => z.conso_mesuree_l);

  const pts = withTarget.map((s) => ({ x: s.target_l!, y: s.conso_mesuree_l!, id: s.site_id, nom: s.site_name, zone: s.zone }));
  const mx0 = Math.max(100, ...pts.map((p) => Math.max(p.x, p.y))) * 1.05;
  const step = 10 ** Math.floor(Math.log10(mx0)) / 2;
  const mx = Math.ceil(mx0 / step) * step;
  const ptsZones = zones.filter((z) => pts.some((p) => p.zone === z));

  const topVal = (s: BiConsoSite) => topKey === "conso" ? s.conso_mesuree_l : topKey === "jour" ? s.l_site_jour
    : s.conso_mesuree_l != null && s.target_l != null ? s.conso_mesuree_l - s.target_l : null;
  const top = sites.map((s) => ({ s, v: topVal(s) })).filter((x) => x.v != null && (topKey !== "depassement" || x.v > 0))
    .sort((a, b) => b.v! - a.v!).slice(0, 10).map(({ s, v }) => ({ id: s.site_id, nom: s.site_name, zone: s.zone, v: v! }));

  const prevSites = consoPrev.data?.sites ?? [];
  const byRegion = zones.filter((z) => sites.some((s) => s.zone === z)).map((z) => ({
    zone: z,
    prev: prevOk && consoPrev.data ? sumOf(prevSites.filter((s) => s.zone === z), (s) => s.conso_mesuree_l) : null,
    cur: sumOf(sites.filter((s) => s.zone === z), (s) => s.conso_mesuree_l),
    target: sumOf(sites.filter((s) => s.zone === z && s.target_l != null), (s) => s.target_l) || null,
  }));

  const crit = (alertes.data?.alertes ?? []).filter((a) => a.sev === "crit");
  const alLabels = alertes.data?.labels;
  const mois = toMonth ? monthLabel(toMonth) : "—";
  const moisCourt = toMonth ? mois.split(" ")[0] : "—";
  const moisPrev = prev ? monthLabel(prev).split(" ")[0] : "";
  const loading = conso.isLoading;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <FilterBar title={`Vue d'ensemble · ${mois}`} note={k ? `${fNum(k.nb_sites)} sites avec groupe électrogène${zone ? ` · ${zone}` : ""}` : undefined} />

      {conso.isError && <div role="alert" style={{ color: FT.red, fontSize: 12.5 }}>Chargement de la consommation impossible. Réessayez avec le bouton Rafraîchir.</div>}

      <ConsoSources compact enabled={!!toMonth} params={{ from_month: month, to_month: month, zone }} />

            {(noClosing || (sy?.controle && !sy.controle.ok) || (sy?.lignes && sy.lignes.id_non_reconnus > 0)) && (
        <div role={noClosing || (sy?.controle && !sy.controle.ok) ? "alert" : "note"} style={{ padding: "10px 14px", borderRadius: 8, background: "#FFF6E5", border: "1px solid #F3D9A4", fontSize: 12.5, color: "#5b4300", display: "grid", gap: 4 }}>
          {noClosing && <span><strong>Fichier Closing absent.</strong> {noClosing.motif} <Link to="/modules/suivi-carburant/stock" style={{ color: "#1D5FE0", fontWeight: 700 }}>{noClosing.action?.libelle ?? "Importer le Closing"} →</Link></span>}
          {sy?.controle && !sy.controle.ok && <span><strong>Contrôle d'import :</strong> {sy.controle.avertissement} ({sy.controle.totaux.filter((t) => !t.ok).map((t) => `${t.libelle} : fichier ${fNum(t.lu_fichier_l)} L, importé ${fNum(t.importe_l)} L`).join(" ; ")})</span>}
          {sy?.lignes && sy.lignes.id_non_reconnus > 0 && <span>{fNum(sy.lignes.id_non_reconnus)} ligne(s) du fichier sur {fNum(sy.lignes.lues)} ont un identifiant absent de Gestion des sites : elles sont comptées dans la consommation Closing (comme dans le fichier) mais sans fiche site. {fNum(sy.lignes.id_en_double)} identifiant(s) en double et {fNum(sy.lignes.sans_region)} ligne(s) sans région conservés tels quels.</span>}
        </div>
      )}

      <KpiRow>
        <BiKpi label="Consommation du mois" value={src.isLoading ? "…" : fNum(closing)} unit="L"
          explain={src.data?.disponible && src.data.explain.closing ? { ...src.data.explain.closing, titre: "Consommation du mois (Closing)" } : null}
          sub={!prevOk ? "Closing · début du suivi, pas de comparaison"
            : closingPrev == null ? "Closing · mois précédent non disponible"
            : `${fNum(closingPrev)} L en ${moisPrev}${deltaPct != null ? ` · ${deltaPct > 0 ? "+" : ""}${fPct(deltaPct)}` : ""}`} />
        <BiKpi label="Réalisé sur target" value={sy?.target?.atteinte_pct == null ? "—" : fPct(sy.target.atteinte_pct).replace(" %", "")} unit="%"
          alert={sy?.target?.atteinte_pct != null && sy.target.atteinte_pct > 110 ? "bad" : null}
          sub={sy?.target?.sites_comparables ? `${fNum(sy.target.conso_comparable_l)} L sur ${fNum(sy.target.target_comparable_l)} L prévus · ${fNum(sy.target.sites_comparables)} sites · fichier Closing`
            : sy ? "aucun site avec conso et target dans le fichier" : manque("Target")} />
        <BiKpi label="Couverture stock" value={sk?.couverture_j == null ? "—" : fNum(sk.couverture_j)} unit="jours" explain={stock.data?.explain?.couverture_j}
          sub={sk ? `${fNum(sk.stock_total_l)} L en cuve aujourd'hui` : undefined} />
        <BiKpi label="Sites en surconsommation" value={sy?.target ? `${fNum(sy.target.sites_au_dessus)}` : "—"} unit={sy?.target ? `/ ${fNum(sy.target.sites_comparables)}` : undefined}
          alert={sy?.target?.sites_au_dessus ? "warn" : null} explain={c?.explain?.ecart_target_pct}
          sub={sy?.target ? `plus de ${fNum(sy.target.tolerance_pct)} % au-dessus du target (fichier Closing)` : manque("Target")} />
        <BiKpi label="Vols déclarés" value={sy?.vols ? fNum(sy.vols.total_l) : "—"} unit={sy?.vols ? "L" : undefined} alert={sy?.vols?.total_l ? "warn" : null}
          sub={sy?.vols ? `${fNum(sy.vols.sites_concernes)} site(s) · « Qté volée » du fichier · fuite / vidange / écart : ${fNum(sy.vidange_fuite_ecart?.total_l)} L` : manque("Vols")} />
        <BiKpi label="Stocks mesurés" value={pctMesure == null ? "—" : fNum(pctMesure)} unit="%"
          sub={srcDist ? `${fNum(nbEstime)} estimés · ${fNum(nbSans)} sans relevé` : undefined} />
      </KpiRow>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(330px, 100%), 1fr))" }}>
        <ChartCard title="Atteinte du target" sub="Σ conso ÷ Σ target" height={190} loading={loading} error={conso.isError} empty={pTarget == null}>
          <div style={{ position: "relative", height: "100%" }}>
            <ResponsiveContainer height={150}>
              <PieChart>
                <Pie data={[{ v: Math.min(pTarget ?? 0, 150) }, { v: Math.max(0, 150 - (pTarget ?? 0)) }]} dataKey="v" startAngle={180} endAngle={0}
                  cx="50%" cy="95%" innerRadius="130%" outerRadius="175%" stroke="none" isAnimationActive={false}>
                  <Cell fill={gaugeColor} /><Cell fill="#F0F2F6" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: "absolute", top: 92, left: 0, right: 0, textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#0B1220" }}>{fPct(pTarget)}</div>
              <div style={{ fontSize: 11, color: "#7D889B" }}>du target</div>
            </div>
            <div style={{ textAlign: "center", marginTop: 6, display: "flex", gap: 8, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
              <Pill tone={gaugeTone}>{gaugeTone === "good" ? "Dans le target" : gaugeTone === "warn" ? "Léger dépassement" : "Dépassement"}</Pill>
              <span style={{ fontSize: 12, color: "#7D889B" }}>{fNum(tm)} L / {fNum(tt)} L</span>
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Consommation par région" sub="litres · conso Snowflake" height={190} loading={loading} error={conso.isError} empty={!regions.length}
          legend={regions.map((z) => ({ label: z.label, color: zoneColor(z.label) }))}>
          <ResponsiveContainer>
            <PieChart>
              <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [fL(v as number), n as string]} />
              <Pie data={regions} dataKey="conso_mesuree_l" nameKey="label" innerRadius="58%" outerRadius="90%" stroke="#fff" strokeWidth={2} isAnimationActive={false}>
                {regions.map((z) => <Cell key={z.label} fill={zoneColor(z.label)} />)}
              </Pie>
              <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 20, fontWeight: 700, fill: "#0B1220" }}>{fShort(totalRegions)}</text>
              <text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 11, fill: "#7D889B" }}>litres</text>
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Statut des bilans" sub="Analysis #1 à #9 du fichier · sites à vérifier" height={190}>
          {sy?.statuts ? (
            <div style={{ display: "grid", gap: 4, fontSize: 11.5, overflow: "auto", maxHeight: 190 }} role="list" aria-label="Analyses du fichier Closing">
              {sy.statuts.map((a) => (
                <div key={a.code} role="listitem" title={a.valeurs.map((v) => `${v.valeur} : ${v.nb}`).join(" · ")} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ color: "#3b4658" }}>#{a.code} {a.libelle}</span>
                  <strong style={{ color: a.a_verifier ? "#B26A00" : "#0CA30C", whiteSpace: "nowrap" }}>{a.a_verifier ? `${fNum(a.a_verifier)} à vérifier` : "RAS"}</strong>
                </div>
              ))}
            </div>
          ) : <StateBox height={190} text={manque("Statuts des bilans")} />}
        </ChartCard>
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(420px, 100%), 1fr))" }}>
        <ChartCard title="Conso vs target par site" sub="au-dessus de la diagonale = surconsommation" height={320}
          legend={ptsZones.map((z) => ({ label: z, color: zoneColor(z) }))} loading={loading} error={conso.isError} empty={!pts.length}>
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 8, right: 16, left: 4, bottom: 16 }}>
              <CartesianGrid stroke={BI.grid} />
              <XAxis type="number" dataKey="x" name="Target" domain={[0, mx]} {...axisProps} tickFormatter={(v: number) => fNum(Math.round(v))}
                label={{ value: `Target ${moisCourt.toLowerCase()} (L)`, position: "insideBottom", offset: -8, fontSize: 11, fill: "#7D889B" }} />
              <YAxis type="number" dataKey="y" name="Conso" domain={[0, mx]} {...axisProps} width={56} tickFormatter={(v: number) => fNum(Math.round(v))}
                label={{ value: `Conso ${moisCourt.toLowerCase()} (L)`, angle: -90, position: "insideLeft", fontSize: 11, fill: "#7D889B" }} />
              <ZAxis range={[40, 40]} />
              <ReferenceLine segment={[{ x: 0, y: 0 }, { x: mx, y: mx }]} stroke="#9AA4B2" strokeDasharray="5 4" />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ payload }) => {
                const p = payload?.[0]?.payload as (typeof pts)[number] | undefined;
                return p ? <div style={{ ...tooltipStyle, background: "#fff", padding: "6px 9px" }}>{p.id} {p.nom ?? ""} · conso {fL(p.y)} · target {fL(p.x)} ({p.y - p.x > 0 ? "+" : ""}{fNum(p.y - p.x)} L)</div> : null;
              }} />
              {ptsZones.map((z) => (
                <Scatter key={z} name={z} data={pts.filter((p) => p.zone === z)} fill={zoneColor(z)} stroke="#fff" strokeWidth={1.5} isAnimationActive={false}
                  cursor={openSite ? "pointer" : undefined} onClick={(p) => { const id = (p as unknown as { id?: string })?.id; if (id) openSite?.(id); }} />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </ChartCard>

        <Card style={{ ...CARD, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0B1220" }}>Alertes critiques</div>
            {onTab && <button type="button" onClick={() => onTab("ALERTES")} style={{ all: "unset", marginLeft: "auto", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#1A56C4" }}>tout voir →</button>}
          </div>
          <div style={{ marginTop: 10, overflowY: "auto", maxHeight: 340, display: "grid", gap: 8 }}>
            {alertes.isLoading ? <StateBox height={120} text="Chargement…" />
              : alertes.isError ? <StateBox height={120} tone="red" text="Alertes indisponibles (erreur de chargement)." />
              : !crit.length ? <span style={{ fontSize: 12, color: "#7D889B" }}>Aucune alerte critique.</span>
              : crit.slice(0, 6).map((a) => <AlerteRow key={`${a.type}-${a.row.site_id}`} a={a} label={alLabels?.[a.type] ?? a.type} compact />)}
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(480px, 100%), 1fr))" }}>
        <ChartCard title="Top 10" height={320} loading={loading} error={conso.isError} empty={!top.length}
          action={
            <div role="group" aria-label="Classement" style={{ display: "inline-flex", border: "1px solid #E6EAF0", borderRadius: 8, overflow: "hidden" }}>
              {(Object.keys(TOP_LABEL) as TopKey[]).map((t) => (
                <button key={t} type="button" aria-pressed={topKey === t} onClick={() => setTopKey(t)}
                  style={{ border: "none", padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", background: topKey === t ? "#EAF1FD" : "#fff", color: topKey === t ? "#1A56C4" : "#0B1220" }}>
                  {TOP_LABEL[t]}
                </button>
              ))}
            </div>
          }>
          <ResponsiveContainer>
            <BarChart data={top} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={BI.grid} horizontal={false} />
              <XAxis type="number" {...axisProps} tickFormatter={(v: number) => fNum(v)} />
              <YAxis type="category" dataKey="id" {...axisProps} width={86} tick={{ fill: "#0B1220", fontSize: 11, fontWeight: 600 }} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(id) => { const t = top.find((x) => x.id === id); return t ? `${t.id} · ${t.nom ?? ""} (${t.zone ?? "—"})` : String(id); }}
                formatter={(v) => [topKey === "jour" ? `${fNum(v as number)} L/j` : `${topKey === "depassement" ? "+" : ""}${fNum(v as number)} L`, TOP_LABEL[topKey]]} />
              <Bar dataKey="v" radius={[0, 4, 4, 0]} maxBarSize={18} cursor={openSite ? "pointer" : undefined} onClick={(d: { id?: string }) => d?.id && openSite?.(d.id)}>
                {top.map((t) => <Cell key={t.id} fill={zoneColor(t.zone)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={`${moisCourt} comparé, par région`} sub={prevOk ? "litres · conso Snowflake" : "litres · début du suivi, pas de mois précédent"} height={320}
          legend={[...(prevOk ? [{ label: moisPrev, color: "#C9CFD9" }] : []), { label: moisCourt, color: "#0B1F4D" }, { label: "Target (trait)", color: "#0B1220" }]}
          loading={loading} error={conso.isError} empty={!byRegion.length}>
          <ResponsiveContainer>
            <ComposedChart data={byRegion} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={BI.grid} vertical={false} />
              <XAxis dataKey="zone" {...axisProps} interval={0} />
              <YAxis {...axisProps} width={56} tickFormatter={(v: number) => fNum(v)} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [fL(v as number | null), n as string]} />
              {prevOk && <Bar dataKey="prev" name={moisPrev} fill="#C9CFD9" radius={[4, 4, 0, 0]} maxBarSize={26} />}
              <Bar dataKey="cur" name={moisCourt} fill="#0B1F4D" radius={[4, 4, 0, 0]} maxBarSize={26} />
              <Scatter dataKey="target" name="Target" fill="#0B1220" isAnimationActive={false}
                shape={(p: { cx?: number; cy?: number; payload?: { target: number | null } }) => p.payload?.target == null || p.cx == null || p.cy == null ? <g />
                  : <line x1={p.cx - 22} x2={p.cx + 22} y1={p.cy} y2={p.cy} stroke="#0B1220" strokeWidth={3} />} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
