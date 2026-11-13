// Vue BI — Suivi Stock : état actuel des cuves, autonomie, fraîcheur des relevés, répartition, classements.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { downloadBiExport, getBiConso, getBiStock, getStockEvolution, type StockEvolutionMonth } from "@/services/fuelTracking";
import { monthLabel } from "../helpers";
import { FT } from "../theme";
import {
  BI, BiKpi, ChartCard, DetailSection, FilterBar, Grid, KpiRow, SectionTitle, SiteCell, TopTable,
  axisProps, fDays, fDec1, fL, fNum, fPct, fShort, labelStyle, tooltipStyle,
} from "./kit";

const LEVEL_COLOR = { critique: BI.bad, alerte: BI.warn, moyen: BI.light, bon: BI.primary, inconnu: BI.unknown } as const;
// Tranches d'autonomie : mêmes couleurs que la maquette (< 3 j, 3–7, 7–15, 15–30, > 30 j).
const AUTONOMY_COLOR = ["#D03B3B", "#EC835A", "#FAB219", "#1baf7a", "#2a78d6"];
// Origine du stock final : couleurs catégorielles de la maquette, gris pour « Aucun relevé ».
const SOURCE_COLOR = ["#2a78d6", "#1baf7a", "#eda100", "#e87ba4", "#eb6834", "#008300"];
const AGE_COLOR = [BI.primary, BI.secondary, BI.light, BI.warn, BI.bad, BI.unknown];

export function StockBi({ toMonth, zone }: { toMonth: string | null; zone: string }) {
  const params = { zone, month: toMonth ?? undefined };
  const q = useQuery({
    queryKey: ["fuel-bi-stock", zone, toMonth],
    queryFn: () => getBiStock(params),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
  const ev = useQuery({
    queryKey: ["fuel-bi-stock-evolution", zone],
    queryFn: () => getStockEvolution({ zone, mois: "12" }),
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });
  // Livré du mois : même calcul que Suivi Conso (ENOC, mois de fin de période, même zone).
  const liv = useQuery({
    queryKey: ["fuel-bi-stock-livre", zone, toMonth],
    queryFn: () => getBiConso({ from_month: toMonth!, to_month: toMonth!, month: toMonth!, zone }),
    enabled: !!toMonth,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
  const [evMode, setEvMode] = useState<"litres" | "pct">("litres");
  const evKey = evMode === "litres" ? "stock_l" : "remplissage_pct";
  const d = q.data;
  const k = d?.kpis;
  const x = d?.explain;
  const loading = q.isLoading;
  const fillColor = (pct: number | null) => (pct == null ? BI.unknown : pct < 15 ? BI.bad : pct < 40 ? BI.warn : BI.secondary);
  const today = new Date().toISOString().slice(0, 10);
  const auto = d?.distribution_autonomie ?? [];
  const sous7 = d ? (auto[0]?.nb_sites ?? 0) + (auto[1]?.nb_sites ?? 0) : undefined;
  const lk = liv.data?.kpis;
  const sources = (d?.distribution_source ?? []).filter((b) => b.nb_sites > 0);
  const srcColor = (label: string, i: number) => (label === "Aucun relevé" ? "#A9B1BE" : SOURCE_COLOR[i % SOURCE_COLOR.length]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <FilterBar title="Suivi Stock"
        note={k ? `stock au dernier relevé · autonomie = stock ÷ conso moyenne par jour · dernier relevé ${k.derniere_mesure ? new Date(k.derniere_mesure).toLocaleDateString("fr-FR") : "—"} · autonomie calculée sur ${monthLabel(k.mois_reference_autonomie)}` : undefined}
        onExport={() => downloadBiExport("stock", params, `suivi_stock_${today}.xlsx`)}
      >
      </FilterBar>

      {q.isError && <div role="alert" style={{ color: FT.red, fontSize: 12.5 }}>Chargement impossible. Les onglets détaillés plus bas restent consultables.</div>}

      <KpiRow>
        <BiKpi label="Stock sur sites" detail={"Plus gros stocks"} value={fNum(k?.stock_total_l)} unit="L" explain={x?.stock_total_l}
          sub={k ? `au dernier relevé connu par site · ${fNum(k.nb_stock_connu)} / ${fNum(k.nb_sites)} sites` : undefined} />
        <BiKpi label="Autonomie < 7 jours" detail={"Autonomie des sites"} detailLabel="Voir la répartition" value={fNum(sous7)} unit="sites"
          alert={sous7 ? "bad" : null} sub={k ? `dont ${fNum(k.nb_autonomie_moins_3j)} sous 3 jours` : undefined} />
        <BiKpi label={`Livré en ${toMonth ? monthLabel(toMonth).split(" ")[0].toLowerCase() : "—"}`} value={liv.isError ? "—" : fNum(lk?.enoc_ajoutee_l)} unit="L"
          sub={liv.isError ? "non disponible (erreur de chargement)" : lk ? `${fNum(lk.nb_ravitaillements)} livraisons ENOC` : undefined} />
        <BiKpi label="Ponctions du mois" value="—" sub="non disponible : aucune source de ponctions en production" />
      </KpiRow>

      <ChartCard title="Évolution du stock" info="Stock de fin de mois : dernier relevé valide daté dans le mois (capteur, relevé terrain / gardiennage / ENOC, Synthèse). Un site sans relevé dans le mois n'est pas compté. Le remplissage reste comparable quand le nombre de sites relevés change."
        loading={ev.isLoading} error={ev.isError} empty={!ev.data?.months.some((m) => m.stock_l != null)} height={240}
        action={
          <div role="group" aria-label="Unité du graphique" style={{ display: "flex", gap: 4 }}>
            {([["litres", "Litres"], ["pct", "Remplissage %"]] as const).map(([v, l]) => (
              <button key={v} type="button" aria-pressed={evMode === v} onClick={() => setEvMode(v)}
                style={{ fontSize: 11.5, padding: "3px 9px", borderRadius: 4, cursor: "pointer", border: `1px solid ${evMode === v ? "#123C8C" : "#CBD3DF"}`, background: evMode === v ? "#EEF3FB" : "#fff", color: evMode === v ? "#123C8C" : FT.textSub }}>{l}</button>
            ))}
          </div>
        }>
        <ResponsiveContainer>
          <BarChart data={ev.data?.months ?? []} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={BI.grid} vertical={false} />
            <XAxis dataKey="month" {...axisProps} interval={0} tickFormatter={(m: string) => monthLabel(m).replace(/ (\d{2})(\d{2})$/, " $2")} />
            <YAxis {...axisProps} width={46} tickFormatter={(v: number) => (evMode === "pct" ? `${v} %` : fShort(v))} domain={evMode === "pct" ? [0, 100] : undefined} />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={(m) => monthLabel(m as string)}
              formatter={(_v, _n, item) => {
                const m = item.payload as StockEvolutionMonth;
                const src = Object.entries(m.sources).map(([s, n]) => `${s} ${n}`).join(", ");
                return [`${fL(m.stock_l)} · remplissage ${fPct(m.remplissage_pct)} · ${fNum(m.nb_sites_releves)} / ${fNum(m.nb_sites_ge)} sites relevés${m.nb_estimes ? ` (${m.nb_estimes} estimés)` : ""}${src ? ` · ${src}` : ""}${m.en_cours ? " · mois en cours" : ""}`, "Fin de mois"];
              }} />
            <Bar dataKey={evKey} maxBarSize={38}>
              {(ev.data?.months ?? []).map((m) => <Cell key={m.month} fill={m.en_cours ? BI.light : BI.primary} />)}
              <LabelList dataKey={evKey} position="top" style={labelStyle} formatter={(v: unknown) => (v == null ? "" : evMode === "pct" ? `${fDec1(v as number)} %` : fShort(v as number))} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <Grid min={480}>
        <ChartCard title="Autonomie des sites" info="Stock actuel ÷ conso mesurée moyenne par jour. Sites sans conso mesurée exclus."
          loading={loading} error={q.isError} empty={!d?.distribution_autonomie?.some((b) => b.nb_sites > 0)}>
          <ResponsiveContainer>
            <BarChart data={d?.distribution_autonomie ?? []} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={BI.grid} vertical={false} />
              <XAxis dataKey="label" {...axisProps} interval={0} />
              <YAxis {...axisProps} allowDecimals={false} width={40} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${fNum(v as number)} sites`} />
              <Bar dataKey="nb_sites" maxBarSize={44}>
                {(d?.distribution_autonomie ?? []).map((_, i) => <Cell key={i} fill={AUTONOMY_COLOR[i]} />)}
                <LabelList dataKey="nb_sites" position="top" style={labelStyle} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Origine du stock final" info="Source du stock retenu par site (relevé le plus récent, toutes sources). « Estimation » : stock estimé faute de relevé."
          legend={sources.map((b, i) => ({ label: `${b.label} · ${fNum(b.nb_sites)}`, color: srcColor(b.label, i) }))}
          loading={loading} error={q.isError} empty={!sources.length}>
          <ResponsiveContainer>
            <PieChart>
              <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [`${fNum(v as number)} sites`, n as string]} />
              <Pie data={sources} dataKey="nb_sites" nameKey="label" innerRadius="58%" outerRadius="88%" stroke="#fff" strokeWidth={2} isAnimationActive={false}>
                {sources.map((b, i) => <Cell key={b.label} fill={srcColor(b.label, i)} />)}
              </Pie>
              <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 22, fontWeight: 700, fill: "#0B1220" }}>{fNum(d?.kpis.nb_sites)}</text>
              <text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 11, fill: "#7D889B" }}>sites</text>
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </Grid>

      <DetailSection title="Autres analyses du stock (remplissage, ancienneté des relevés, zones, classements)">
      <Grid min={320}>
        <ChartCard title="Remplissage des cuves" info="Nombre de sites GE par tranche de remplissage. « Inconnu » : aucun relevé exploitable."
          loading={loading} error={q.isError} empty={!d?.distribution_remplissage?.some((b) => b.nb_sites > 0)}>
          <ResponsiveContainer>
            <BarChart data={d?.distribution_remplissage ?? []} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={BI.grid} vertical={false} />
              <XAxis dataKey="label" {...axisProps} interval={0} />
              <YAxis {...axisProps} allowDecimals={false} width={40} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${fNum(v as number)} sites`} />
              <Bar dataKey="nb_sites" maxBarSize={44}>
                {(d?.distribution_remplissage ?? []).map((b, i) => <Cell key={i} fill={LEVEL_COLOR[b.niveau]} />)}
                <LabelList dataKey="nb_sites" position="top" style={labelStyle} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Ancienneté du dernier relevé" info="Jours écoulés depuis le dernier relevé capteur. Au-delà de 7 jours, le stock affiché peut ne plus être réel."
          loading={loading} error={q.isError} empty={!d?.distribution_age_releve?.some((b) => b.nb_sites > 0)}>
          <ResponsiveContainer>
            <BarChart data={d?.distribution_age_releve ?? []} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={BI.grid} vertical={false} />
              <XAxis dataKey="label" {...axisProps} interval={0} />
              <YAxis {...axisProps} allowDecimals={false} width={40} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${fNum(v as number)} sites`} />
              <Bar dataKey="nb_sites" maxBarSize={44}>
                {(d?.distribution_age_releve ?? []).map((_, i) => <Cell key={i} fill={AGE_COLOR[i] ?? BI.unknown} />)}
                <LabelList dataKey="nb_sites" position="top" style={labelStyle} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </Grid>
      <ChartCard title="Situation par zone" info="Stock capteur et nombre de sites en alerte (cuve sous 15 % ou autonomie sous 3 jours), par zone."
        legend={[{ label: "Cuves sous 15 %", color: BI.bad }, { label: "Autonomie < 3 j", color: BI.warn }]}
        loading={loading} error={q.isError} empty={!d?.by_zone?.length}>
        <ResponsiveContainer>
          <BarChart data={d?.by_zone ?? []} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={BI.grid} vertical={false} />
            <XAxis dataKey="label" {...axisProps} interval={0} />
            <YAxis {...axisProps} allowDecimals={false} width={36} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${fNum(v as number)} sites`} />
            <Bar dataKey="nb_critique" name="Cuves sous 15 %" fill={BI.bad} maxBarSize={22}>
              <LabelList dataKey="nb_critique" position="top" style={labelStyle} />
            </Bar>
            <Bar dataKey="nb_autonomie_moins_3j" name="Autonomie < 3 j" fill={BI.warn} maxBarSize={22}>
              <LabelList dataKey="nb_autonomie_moins_3j" position="top" style={labelStyle} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <SectionTitle sub="État actuel · liste intégrale dans l'export Excel">Classements par site</SectionTitle>
      <Grid min={340}>
        <TopTable title="Cuves les plus basses" rows={d?.top_critique} loading={loading} error={q.isError}
          barValue={(r) => r.remplissage_pct} barMax={100} barColor={(r) => fillColor(r.remplissage_pct)}
          columns={[
            { label: "Site", render: (r) => <SiteCell id={r.site_id} name={r.site_name} /> },
            { label: "Remplissage", align: "right", render: (r) => <span style={{ fontWeight: 600, color: fillColor(r.remplissage_pct) }}>{fPct(r.remplissage_pct)}</span> },
            { label: "Stock", align: "right", render: (r) => fL(r.stock_l) },
          ]} />
        <TopTable title="Autonomie la plus courte" info="Ravitaillements à planifier en premier." rows={d?.top_autonomie_faible} loading={loading} error={q.isError}
          barValue={(r) => r.autonomie_j} barMax={30} barColor={(r) => ((r.autonomie_j ?? 99) < 3 ? BI.bad : BI.warn)}
          columns={[
            { label: "Site", render: (r) => <SiteCell id={r.site_id} name={r.site_name} /> },
            { label: "Autonomie", align: "right", render: (r) => <span style={{ fontWeight: 600, color: (r.autonomie_j ?? 99) < 3 ? FT.red : FT.text }}>{fDays(r.autonomie_j)}</span> },
            { label: "Conso / j", align: "right", render: (r) => fL(r.conso_jour_l) },
          ]} />
        <TopTable title="Plus gros stocks" rows={d?.top_stock} loading={loading} error={q.isError} barValue={(r) => r.stock_l}
          columns={[
            { label: "Site", render: (r) => <SiteCell id={r.site_id} name={r.site_name} /> },
            { label: "Stock", align: "right", render: (r) => fL(r.stock_l) },
            { label: "Capacité", align: "right", render: (r) => fL(r.capacite_l) },
          ]} />
      </Grid>
      </DetailSection>
    </div>
  );
}
