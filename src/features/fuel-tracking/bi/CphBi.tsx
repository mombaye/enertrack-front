// Vue BI — Contrôle CPH : couverture du calcul, motifs de blocage, charge vs CPH, classements.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import { downloadBiExport, getBiCph } from "@/services/fuelTracking";
import { monthLabel } from "../helpers";
import { FT } from "../theme";
import {
  BI, BiKpi, ChartCard, DetailSection, FilterBar, FilterSelect, Grid, KpiRow, Pill, SectionTitle, SiteCell, TopTable,
  axisProps, fDec1, fL, fNum, fPct, fRatio, fShort, fSignedPct, labelStyle, tooltipStyle,
} from "./kit";

/** Seuil « gros écart » mesuré / CPH : même valeur que l'alerte « Écart CPH > 20 % » du tableau par site. */
const GROS_ECART_PCT = 20;
const TABLE_MAX = 100;
const STATUT_LABEL: Record<string, string> = { COMPLET: "Complet", PARTIEL: "Partiel", NON_CALCULE: "Non calculé" };
const MOTIF_LABEL: Record<string, string> = {
  GE_NON_CONFIRME_SNOWFLAKE: "GE non confirmé (Snowflake)", RUNTIME_INDISPONIBLE: "Heures de marche indisponibles",
  RUNTIME_NON_QUALIFIE: "Heures de marche non qualifiées", PUISSANCE_INDISPONIBLE: "Puissance indisponible",
  PUISSANCE_HORS_LIMITE: "Puissance hors limite", PUISSANCE_NOMINALE_ABSENTE: "Puissance nominale absente",
  RENDEMENT_REDRESSEUR_INVALIDE: "Rendement redresseur invalide", COURBE_CPH_MANQUANTE: "Courbe CPH manquante",
  MAPPING_GE_A_VALIDER: "Mapping GE à valider", MODELE_GE_AMBIGU: "Modèle GE ambigu", SITE_MULTI_GE: "Site multi-GE",
  TYPE_GE_ABSENT: "Type de GE absent", PERIODE_INCOMPLETE: "Période incomplète", AUTRE: "Autre",
};
export const motif = (code: string) => MOTIF_LABEL[code] ?? code.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

/** Période CPH dérivée des mois du header : 3 mois max (limite du calcul), jamais au-delà d'hier. */
export function cphPeriod(fromMonth: string | null, toMonth: string | null): { start: string; end: string; label: string } | null {
  if (!toMonth) return null;
  const [ty, tm] = toMonth.split("-").map(Number);
  const startIdx = Math.max(ty * 12 + tm - 1 - 2, fromMonth ? Number(fromMonth.slice(0, 4)) * 12 + Number(fromMonth.slice(5, 7)) - 1 : -Infinity);
  const sy = Math.floor(startIdx / 12), sm = (startIdx % 12) + 1;
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const lastDay = new Date(ty, tm, 0);
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const end = lastDay > yesterday ? yesterday : lastDay;
  const start = `${sy}-${String(sm).padStart(2, "0")}-01`;
  const startMonth = `${sy}-${String(sm).padStart(2, "0")}`;
  return { start, end: iso(end), label: startMonth === toMonth ? monthLabel(toMonth) : `${monthLabel(startMonth)} → ${monthLabel(toMonth)}` };
}

/** Mois de la période du header, du plus récent au plus ancien. */
function monthsBetween(fromMonth: string | null, toMonth: string | null): string[] {
  if (!fromMonth || !toMonth) return [];
  const idx = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
  const out: string[] = [];
  for (let i = idx(toMonth); i >= idx(fromMonth) && out.length < 36; i--) out.push(`${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`);
  return out;
}

export function CphBi({ fromMonth, toMonth, zone }: { fromMonth: string | null; toMonth: string | null; zone: string }) {
  const [month, setMonth] = useState("");
  const monthOptions = monthsBetween(fromMonth, toMonth);
  const effMonth = monthOptions.includes(month) ? month : "";
  const p = effMonth ? cphPeriod(effMonth, effMonth) : cphPeriod(fromMonth, toMonth);
  const q = useQuery({
    queryKey: ["fuel-bi-cph", p?.start, p?.end, zone],
    queryFn: () => getBiCph({ start: p!.start, end: p!.end, zone }),
    enabled: !!p,
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });
  const d = q.data;
  const k = d?.kpis;
  const loading = q.isLoading || !p;
  const x = d?.explain;
  const byCountry = (d?.by_zone ?? []).map((c) => ({ ...c, partiel: c.nb_sites - c.nb_cph_complet }));
  const statuts = ["COMPLET", "PARTIEL", "NON_CALCULE"].map((s) => ({ label: STATUT_LABEL[s], nb_sites: d?.statuts_cph?.find((x) => x.label === s)?.nb_sites ?? 0 }));
  const all = d?.sites ?? [];
  const theo = all.filter((s) => s.conso_theorique_l != null);
  const both = theo.filter((s) => s.conso_mesuree_l != null);
  const gros = (s: { ecart_pct: number | null }) => s.ecart_pct != null && Math.abs(s.ecart_pct) > GROS_ECART_PCT;
  const sansHeures = d?.sites ? all.filter((s) => s.runtime_h == null).length : undefined;
  const ecartComparable = k?.conso_mesuree_comparable_l != null && k.conso_theorique_comparable_l != null ? k.conso_mesuree_comparable_l - k.conso_theorique_comparable_l : null;
  const mx0 = Math.max(100, ...both.map((s) => Math.max(s.conso_mesuree_l!, s.conso_theorique_l!))) * 1.05;
  const step = 10 ** Math.floor(Math.log10(mx0)) / 2;
  const mx = Math.ceil(mx0 / step) * step;
  const pts = (g: boolean) => both.filter((s) => gros(s) === g).map((s) => ({ x: s.conso_theorique_l, y: s.conso_mesuree_l, id: s.site_id }));
  const cov = d ? [{ label: "CPH complet", nb: k?.nb_cph_complet ?? 0, color: "#2a78d6" }, { label: "CPH non complet", nb: (k?.nb_sites_ge ?? 0) - (k?.nb_cph_complet ?? 0), color: "#A9B1BE" }].filter((c) => c.nb > 0) : [];
  const table = [...theo].sort((a, b) => Math.abs(b.ecart_l ?? 0) - Math.abs(a.ecart_l ?? 0));
  const motifs = (d?.motifs_non_calcule ?? []).map((m) => ({ ...m, name: motif(m.label) }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <FilterBar title="Contrôle CPH"
        note={p ? `conso théorique = heures GE × litres par heure, comparée aux relevés · ${p.label}${effMonth ? "" : " (3 mois au plus)"}${d?.periode?.incomplete ? ` · données Snowflake jusqu'au ${d.periode.donnees_jusqu_au ?? "—"}` : ""}` : undefined}
        onExport={p ? () => downloadBiExport("cph", { start: p.start, end: p.end, zone }, `controle_cph_${p.start}_${p.end}.xlsx`) : undefined}
      >
        <FilterSelect label="Mois" value={effMonth} options={monthOptions} onChange={setMonth} allLabel="3 derniers mois" format={monthLabel} />
      </FilterBar>

      {q.isError && <div role="alert" style={{ color: FT.red, fontSize: 12.5 }}>Calcul CPH indisponible (calcul ou Snowflake en erreur). Le contrôle détaillé plus bas reste consultable.</div>}

      <KpiRow>
        <BiKpi label="Conso théorique" detail="Contrôle par site" detailLabel="Voir par site" value={fNum(k?.conso_theorique_l)} unit="L" explain={x?.conso_theorique_l}
          sub={k ? `${fNum(k.nb_cph_complet)} sites au CPH complet` : undefined} />
        <BiKpi label="Conso relevée (mêmes sites)" detail="Théorique vs relevée" detailLabel="Voir le graphique" value={fNum(k?.conso_mesuree_comparable_l)} unit="L" explain={x?.ecart_global_pct}
          sub={k ? (ecartComparable == null ? "aucun site ayant les deux" : `écart ${ecartComparable > 0 ? "+" : ""}${fNum(ecartComparable)} L · ${fNum(k.nb_sites_comparables)} sites`) : undefined} />
        <BiKpi label="Gros écarts" detail="Contrôle par site" detailLabel="Voir les sites" value={d?.sites ? fNum(both.filter(gros).length) : "—"} unit="sites"
          alert={both.some(gros) ? "warn" : null} sub={`écart relevée / théorique > ${GROS_ECART_PCT} % : heures ou type de GE à vérifier`} />
        <BiKpi label="Sans heures GE" value={fNum(sansHeures)} unit="sites" sub="pas de contrôle possible" />
      </KpiRow>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(420px, 100%), 1fr))" }}>
        <ChartCard title="Théorique vs relevée" sub="loin de la diagonale = à vérifier" height={320}
          legend={[{ label: "Écart normal", color: "#2a78d6" }, { label: `Gros écart (> ${GROS_ECART_PCT} %)`, color: "#D03B3B" }]}
          loading={loading} error={q.isError} empty={!both.length}>
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 8, right: 16, left: 4, bottom: 16 }}>
              <CartesianGrid stroke={BI.grid} />
              <XAxis type="number" dataKey="x" name="Théorique" domain={[0, mx]} {...axisProps} tickFormatter={(v: number) => fNum(Math.round(v))} label={{ value: "Théorique (L)", position: "insideBottom", offset: -8, fontSize: 11, fill: "#7D889B" }} />
              <YAxis type="number" dataKey="y" name="Relevée" domain={[0, mx]} {...axisProps} width={56} tickFormatter={(v: number) => fNum(Math.round(v))} label={{ value: "Relevée (L)", angle: -90, position: "insideLeft", fontSize: 11, fill: "#7D889B" }} />
              <ZAxis range={[40, 40]} />
              <ReferenceLine segment={[{ x: 0, y: 0 }, { x: mx, y: mx }]} stroke="#9AA4B2" strokeDasharray="5 4" ifOverflow="extendDomain" />
              <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: "3 3" }}
                content={({ payload }) => {
                  const pt = payload?.[0]?.payload as { x: number; y: number; id: string } | undefined;
                  return pt ? <div style={{ ...tooltipStyle, background: "#fff", padding: "6px 9px" }}>{pt.id} · théorique {fL(pt.x)} · relevée {fL(pt.y)}</div> : null;
                }} />
              <Scatter name="Écart normal" data={pts(false)} fill="#2a78d6" stroke="#fff" strokeWidth={1.5} isAnimationActive={false} />
              <Scatter name="Gros écart" data={pts(true)} fill="#D03B3B" stroke="#fff" strokeWidth={1.5} shape="triangle" isAnimationActive={false} />
            </ScatterChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Couverture CPH" height={200}
          legend={cov.map((c) => ({ label: `${c.label} · ${fNum(c.nb)}`, color: c.color }))}
          loading={loading} error={q.isError} empty={!cov.length}>
          <ResponsiveContainer>
            <PieChart>
              <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [`${fNum(v as number)} sites`, n as string]} />
              <Pie data={cov} dataKey="nb" nameKey="label" innerRadius="62%" outerRadius="90%" stroke="#fff" strokeWidth={2} isAnimationActive={false}>
                {cov.map((c) => <Cell key={c.label} fill={c.color} />)}
              </Pie>
              <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 20, fontWeight: 700, fill: "#0B1220" }}>{fPct(k?.couverture_cph_pct)}</text>
              <text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 11, fill: "#7D889B" }}>couverts</text>
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <TopTable title="Contrôle par site" rows={d?.sites ? table.slice(0, TABLE_MAX) : undefined} loading={loading} error={q.isError}
        sub={d?.sites ? `${fNum(table.length)} sites au CPH complet · triés par écart${table.length > TABLE_MAX ? ` · ${TABLE_MAX} premiers affichés, liste intégrale dans l'export Excel` : ""}` : undefined}
        columns={[
          { label: "Site", render: (r) => <SiteCell id={r.site_id} name={r.site_name} /> },
          { label: "kVA", align: "right", render: (r) => fDec1(r.ge_kva) },
          { label: "Heures GE", align: "right", render: (r) => fDec1(r.runtime_h) },
          { label: "L / heure", align: "right", render: (r) => fDec1(r.cph_l_h) },
          { label: "Théorique", align: "right", render: (r) => <b style={{ fontWeight: 700 }}>{fL(r.conso_theorique_l)}</b> },
          { label: "Relevée", align: "right", render: (r) => fL(r.conso_mesuree_l) },
          { label: "Écart", align: "right", render: (r) => r.ecart_l == null ? "—" : `${r.ecart_l > 0 ? "+" : ""}${fNum(r.ecart_l)}` },
          { label: "Contrôle", render: (r) => r.ecart_pct == null ? <Pill tone="mute">Pas de relevé</Pill> : gros(r) ? <Pill tone="crit">Gros écart</Pill> : <Pill tone="good">Cohérent</Pill> },
          { label: "Compteur terrain", align: "right", render: () => <span title="Pas encore de source en production : sera alimenté par les Remontées terrain." style={{ color: FT.textSub, fontStyle: "italic" }}>non disponible</span> },
        ]} />

      <DetailSection title="Autres analyses CPH (indicateurs, statuts, motifs, zones, charge, classements)">
      <KpiRow>
        <BiKpi label="Sites au CPH complet" detail={"Motifs de non-calcul"} detailLabel="Voir pourquoi certains sites ne sont pas calculés" value={fPct(k?.couverture_cph_pct)} explain={x?.couverture_cph_pct} sub={k ? `${fNum(k.nb_cph_complet)} / ${fNum(k.nb_sites_ge)} sites GE` : undefined} />
        <BiKpi label="Conso estimée CPH" detail={"Plus forte conso estimée"} value={fNum(k?.conso_theorique_l)} unit="L" explain={x?.conso_theorique_l} sub="CPH × heures de marche, sites complets" />
        <BiKpi label="Heures de marche GE" detail="Plus d'heures de marche" value={fNum(k?.runtime_total_h)} unit="h" explain={x?.runtime_total_h} />
        <BiKpi label="CPH moyen" detail={"Charge du GE et CPH par site"} detailLabel="Voir site par site" value={fRatio(k?.cph_moy_l_h)} unit="L/h" explain={x?.cph_moy_l_h} />
        <BiKpi label="Charge moyenne GE" detail={"Charge du GE et CPH par site"} detailLabel="Voir site par site" value={fDec1(k?.charge_moy_pct)} unit="%"
          alert={k?.charge_moy_pct != null && k.charge_moy_pct < 30 ? "warn" : null}
          sub="pondérée par les heures" explain={x?.charge_moy_pct} />
        <BiKpi label="Mesuré vs CPH" detail={"Écarts mesuré / CPH"} detailLabel="Voir les plus gros écarts" value={fSignedPct(k?.ecart_global_pct)} explain={x?.ecart_global_pct}
          alert={k?.ecart_global_pct == null ? null : Math.abs(k.ecart_global_pct) > 15 ? "bad" : null}
          sub={k ? `${fNum(k.nb_sites_comparables)} sites ayant les deux` : undefined} />
      </KpiRow>

      <Grid min={320}>
        <ChartCard title="Statut du calcul" loading={loading} error={q.isError} empty={!statuts.some((s) => s.nb_sites > 0)} height={200}>
          <ResponsiveContainer>
            <BarChart data={statuts} layout="vertical" margin={{ top: 0, right: 44, left: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="label" {...axisProps} width={86} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${fNum(v as number)} sites`} />
              <Bar dataKey="nb_sites" name="Sites" fill={BI.primary} maxBarSize={22}>
                <LabelList dataKey="nb_sites" position="right" style={labelStyle} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Motifs de non-calcul" info="Motif principal pour les sites dont le CPH n'est pas complet."
          loading={loading} error={q.isError} empty={!motifs.length} height={Math.max(200, motifs.length * 30 + 20)}>
          <ResponsiveContainer>
            <BarChart data={motifs} layout="vertical" margin={{ top: 0, right: 44, left: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" {...axisProps} width={170} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${fNum(v as number)} sites`} />
              <Bar dataKey="nb_sites" name="Sites" fill={BI.warn} maxBarSize={18}>
                <LabelList dataKey="nb_sites" position="right" style={labelStyle} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="CPH complet par zone" loading={loading} error={q.isError} empty={!byCountry.length}
          legend={[{ label: "CPH complet", color: BI.primary }, { label: "Autres sites GE", color: BI.light }]}
          height={Math.max(200, byCountry.length * 32 + 20)}>
          <ResponsiveContainer>
            <BarChart data={byCountry} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="label" {...axisProps} width={90} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${fNum(v as number)} sites`} />
              <Bar dataKey="nb_cph_complet" name="CPH complet" stackId="a" fill={BI.primary} maxBarSize={18} />
              <Bar dataKey="partiel" name="Autres sites GE" stackId="a" fill={BI.light} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </Grid>

      <ChartCard title="Charge du GE et CPH par site" info="Un point par site. Une charge faible avec un CPH élevé signale un GE surdimensionné ou une donnée à vérifier."
        loading={loading} error={q.isError} empty={!d?.charge_vs_cph?.length} height={280}>
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid stroke={BI.grid} />
            <XAxis type="number" dataKey="charge_pct" name="Charge" unit=" %" {...axisProps} domain={[0, "auto"]} />
            <YAxis type="number" dataKey="cph_l_h" name="CPH" unit=" L/h" {...axisProps} width={56} />
            <ZAxis range={[22, 22]} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: "3 3" }}
              formatter={(v, n) => (n === "Charge" ? `${fDec1(v as number)} %` : `${fRatio(v as number)} L/h`)} />
            <Scatter data={d?.charge_vs_cph ?? []} fill={BI.secondary} fillOpacity={0.55} />
          </ScatterChart>
        </ResponsiveContainer>
      </ChartCard>

      <SectionTitle sub="Période CPH · liste intégrale dans l'export Excel">Classements par site</SectionTitle>
      <Grid min={340}>
        <TopTable title="Plus forte conso estimée" rows={d?.top_conso_theorique} loading={loading} error={q.isError} barValue={(r) => r.conso_theorique_l}
          columns={[
            { label: "Site", render: (r) => <SiteCell id={r.site_id} name={r.site_name} /> },
            { label: "Conso CPH", align: "right", render: (r) => fL(r.conso_theorique_l) },
            { label: "L/h", align: "right", width: "56px", render: (r) => fRatio(r.cph_l_h) },
          ]} />
        <TopTable title="Écarts mesuré / CPH" info="Sites ayant à la fois une conso mesurée et une conso CPH complète." rows={d?.top_ecart_mesure} loading={loading} error={q.isError}
          barValue={(r) => r.ecart_pct} barColumn={3} barColor={(r) => ((r.ecart_l ?? 0) > 0 ? BI.bad : BI.warn)}
          columns={[
            { label: "Site", render: (r) => <SiteCell id={r.site_id} name={r.site_name} /> },
            { label: "CPH", align: "right", render: (r) => fL(r.conso_theorique_l) },
            { label: "Mesuré", align: "right", render: (r) => fL(r.conso_mesuree_l) },
            { label: "Écart", align: "right", render: (r) => <span style={{ fontWeight: 600, color: Math.abs(r.ecart_pct ?? 0) > 15 ? FT.red : FT.text }}>{fSignedPct(r.ecart_pct)}</span> },
          ]} />
        <TopTable title="Plus d'heures de marche" rows={d?.top_runtime} loading={loading} error={q.isError} barValue={(r) => r.runtime_h}
          columns={[
            { label: "Site", render: (r) => <SiteCell id={r.site_id} name={r.site_name} /> },
            { label: "Heures", align: "right", render: (r) => (r.runtime_h != null ? `${fShort(r.runtime_h)} h` : "—") },
            { label: "Charge", align: "right", width: "64px", render: (r) => fPct(r.charge_pct) },
          ]} />
      </Grid>
      </DetailSection>
    </div>
  );
}
