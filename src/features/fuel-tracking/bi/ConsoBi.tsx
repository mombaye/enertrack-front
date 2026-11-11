// Vue BI — Suivi Conso : tendance, répartition, Top 10, pilotée par la période du header.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart,
  ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Droplets, Fuel, Gauge, Radar } from "lucide-react";
import { getBiConso } from "@/services/fuelTracking";
import { monthLabel } from "../helpers";
import { FT } from "../theme";
import {
  BI, BiKpi, ChartCard, FilterBar, FilterSelect, Grid, KpiRow, SectionTitle, SiteCell, TopTable,
  axisProps, fL, fNum, fPct, fRatio, fShort, tooltipStyle,
} from "./kit";

const DONUT = [BI.primary, BI.secondary, BI.light, "#5B7FB8", "#C9D6EA", BI.unknown];

export function ConsoBi({ fromMonth, toMonth }: { fromMonth: string | null; toMonth: string | null }) {
  const [country, setCountry] = useState("");
  const [typology, setTypology] = useState("");
  const q = useQuery({
    queryKey: ["fuel-bi-conso", fromMonth, toMonth, country, typology],
    queryFn: () => getBiConso({ from_month: fromMonth ?? undefined, to_month: toMonth ?? undefined, country, typology }),
    enabled: !!fromMonth && !!toMonth,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
  const d = q.data;
  const k = d?.kpis;
  const loading = q.isLoading || !fromMonth;
  const monthly = (d?.monthly ?? []).map((m) => ({ ...m, label: monthLabel(m.month) }));
  const [refLo, refHi] = d?.reference_l_kwh ?? [0.25, 0.3];
  const prevLabel = d?.previous_months?.length ? `vs ${monthLabel(d.previous_months[0])} – ${monthLabel(d.previous_months[d.previous_months.length - 1])}` : "pas de période précédente";
  const typoData = (d?.by_typology ?? []).filter((t) => t.conso_mesuree_l != null).slice(0, 6);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <FilterBar note={d?.months?.length ? `${monthLabel(d.months[0])} → ${monthLabel(d.months[d.months.length - 1])} · ${prevLabel}` : undefined}>
        <FilterSelect label="Pays" value={country} options={d?.filters.countries ?? []} onChange={setCountry} />
        <FilterSelect label="Typologie" value={typology} options={d?.filters.typologies ?? []} onChange={setTypology} allLabel="Toutes" />
      </FilterBar>

      {q.isError && <div role="alert" style={{ color: FT.red, fontSize: 12.5, fontWeight: 600 }}>Vue BI indisponible : erreur de chargement. Les tableaux détaillés plus bas restent consultables.</div>}

      <KpiRow>
        <BiKpi label="Conso mesurée (capteur)" value={fL(k?.conso_mesuree_l)} delta={d?.deltas?.conso_mesuree_l} upIsGood={false} tone="blue" icon={<Droplets size={13} />}
          sub={k ? `${fNum(k.nb_sites_mesure)} sites mesurés` : undefined} />
        <BiKpi label="Ajouté ENOC (ravitaillements)" value={fL(k?.enoc_ajoutee_l)} delta={d?.deltas?.enoc_ajoutee_l} upIsGood={false} tone="orange" icon={<Fuel size={13} />}
          sub={k?.nb_ravitaillements != null ? `${fNum(k.nb_ravitaillements)} demandes` : undefined} />
        <BiKpi label="Conso spécifique" value={k?.l_kwh != null ? `${fRatio(k.l_kwh)} L/kWh` : "—"} delta={d?.deltas?.l_kwh} upIsGood={false}
          tone={k?.l_kwh == null ? "slate" : k.l_kwh > refHi ? "red" : k.l_kwh < refLo ? "orange" : "green"} icon={<Gauge size={13} />}
          sub={`réf. ${fRatio(refLo)}–${fRatio(refHi)}`} />
        <BiKpi label="Couverture capteur" value={fPct(k?.couverture_pct)} delta={d?.deltas?.couverture_pts} deltaUnit="pts" tone="cyan" icon={<Radar size={13} />}
          sub={k ? `${fNum(k.nb_sites_mesure)} / ${fNum(k.nb_sites)} sites GE` : undefined} />
      </KpiRow>

      <SectionTitle sub="Litres par mois — mesuré et ENOC ne sont jamais additionnés">Tendance</SectionTitle>
      <ChartCard
        title="Conso mesurée vs ravitaillements ENOC"
        subtitle="Un écart durable entre les deux courbes est à investiguer (fuite, vol, saisie ENOC)."
        legend={[{ label: "Conso mesurée (capteur)", color: BI.primary }, { label: "Ajouté ENOC", color: BI.enoc, dashed: true }]}
        loading={loading} error={q.isError} empty={!monthly.length} height={280}
      >
        <ResponsiveContainer>
          <ComposedChart data={monthly} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={BI.grid} vertical={false} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} tickFormatter={fShort} width={52} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => fL(v as number | null)} />
            <Bar dataKey="conso_mesuree_l" name="Conso mesurée" fill={BI.primary} radius={[4, 4, 0, 0]} maxBarSize={30} />
            <Line dataKey="enoc_ajoutee_l" name="Ajouté ENOC" stroke={BI.enoc} strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3, fill: BI.enoc }} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <Grid>
        <ChartCard title="Conso spécifique (L/kWh)" subtitle="Bande verte = plage normale d'un GE correctement chargé."
          legend={[{ label: "L/kWh du parc", color: BI.secondary }, { label: `Référence ${fRatio(refLo)}–${fRatio(refHi)}`, color: BI.band }]}
          loading={loading} error={q.isError} empty={!monthly.some((m) => m.l_kwh != null)}>
          <ResponsiveContainer>
            <ComposedChart data={monthly} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={BI.grid} vertical={false} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} domain={[0.15, "auto"]} tickFormatter={(v) => fRatio(v)} width={44} />
              <ReferenceArea y1={refLo} y2={refHi} fill={BI.band} fillOpacity={0.9} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${fRatio(v as number | null)} L/kWh`} />
              <Line dataKey="l_kwh" name="L/kWh" stroke={BI.secondary} strokeWidth={2.5} dot={{ r: 3.5, fill: BI.secondary }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Couverture capteur (% des sites GE)" subtitle="Part des sites GE avec une conso mesurée."
          loading={loading} error={q.isError} empty={!monthly.length}>
          <ResponsiveContainer>
            <AreaChart data={monthly} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={BI.grid} vertical={false} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} domain={[0, 100]} tickFormatter={(v) => `${v} %`} width={50} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fPct(v as number | null)} />
              <Area dataKey="couverture_pct" name="Couverture" stroke={BI.secondary} strokeWidth={2.5} fill={BI.secondary} fillOpacity={0.12} dot={{ r: 3, fill: BI.secondary }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </Grid>

      <SectionTitle sub="Sur toute la période choisie">Répartition</SectionTitle>
      <Grid min={320}>
        <ChartCard title="Conso mesurée par pays" loading={loading} error={q.isError} empty={!d?.by_country?.length}
          height={Math.max(260, (d?.by_country?.length ?? 0) * 34 + 30)}>
          <ResponsiveContainer>
            <BarChart data={d?.by_country ?? []} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={BI.grid} horizontal={false} />
              <XAxis type="number" {...axisProps} tickFormatter={fShort} />
              <YAxis type="category" dataKey="label" {...axisProps} width={92} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fL(v as number | null)} />
              <Bar dataKey="conso_mesuree_l" name="Conso mesurée" fill={BI.secondary} radius={[0, 4, 4, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Conso mesurée par typologie" loading={loading} error={q.isError} empty={!typoData.length}
          legend={typoData.map((t, i) => ({ label: `${t.label} · ${fShort(t.conso_mesuree_l ?? 0)} L`, color: DONUT[i % DONUT.length] }))}>
          <ResponsiveContainer>
            <PieChart>
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fL(v as number | null)} />
              <Pie data={typoData} dataKey="conso_mesuree_l" nameKey="label" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="#fff">
                {typoData.map((_, i) => <Cell key={i} fill={DONUT[i % DONUT.length]} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Sites par conso spécifique (L/kWh)" subtitle={`Sites avec ≥ 100 kWh produits. En vert : plage de référence.`}
          loading={loading} error={q.isError} empty={!d?.distribution_l_kwh?.some((b) => b.nb_sites > 0)}>
          <ResponsiveContainer>
            <BarChart data={d?.distribution_l_kwh ?? []} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={BI.grid} vertical={false} />
              <XAxis dataKey="label" {...axisProps} interval={0} />
              <YAxis {...axisProps} allowDecimals={false} width={36} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${fNum(v as number)} sites`} />
              <Bar dataKey="nb_sites" radius={[4, 4, 0, 0]} maxBarSize={36}>
                {(d?.distribution_l_kwh ?? []).map((b, i) => <Cell key={i} fill={b.reference ? BI.ok : i >= 4 ? BI.bad : BI.light} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </Grid>

      <SectionTitle sub="Sur toute la période choisie">Top 10</SectionTitle>
      <Grid min={340}>
        <TopTable title="Top 10 consommateurs" subtitle="Conso mesurée cumulée" rows={d?.top_conso} loading={loading} error={q.isError}
          barValue={(r) => r.conso_mesuree_l}
          columns={[
            { label: "Site", render: (r) => <SiteCell id={r.site_id} name={r.site_name} /> },
            { label: "Conso", align: "right", render: (r) => fL(r.conso_mesuree_l) },
            { label: "Mois", align: "right", width: "48px", render: (r) => fNum(r.nb_mois) },
          ]} />
        <TopTable title="Top 10 écarts conso vs ENOC" subtitle="Mesuré − ajouté ENOC. Négatif : plus livré que consommé." rows={d?.top_ecart_enoc} loading={loading} error={q.isError}
          barValue={(r) => r.ecart_l} barColor={(r) => ((r.ecart_l ?? 0) < 0 ? BI.bad : BI.warn)}
          columns={[
            { label: "Site", render: (r) => <SiteCell id={r.site_id} name={r.site_name} /> },
            { label: "Mesuré", align: "right", render: (r) => fL(r.conso_mesuree_l) },
            { label: "ENOC", align: "right", render: (r) => fL(r.enoc_ajoutee_l) },
            { label: "Écart", align: "right", render: (r) => <span style={{ fontWeight: 800, color: (r.ecart_l ?? 0) < 0 ? FT.red : FT.orange }}>{(r.ecart_l ?? 0) > 0 ? "+" : ""}{fL(r.ecart_l)}</span> },
          ]} />
        <TopTable title="Top 10 L/kWh les plus élevés" subtitle="Sites à contrôler (charge faible, fuite, capteur)." rows={d?.top_l_kwh} loading={loading} error={q.isError}
          barValue={(r) => r.l_kwh} barColor={BI.bad}
          columns={[
            { label: "Site", render: (r) => <SiteCell id={r.site_id} name={r.site_name} /> },
            { label: "L/kWh", align: "right", render: (r) => <span style={{ fontWeight: 800, color: (r.l_kwh ?? 0) > refHi ? FT.red : FT.text }}>{fRatio(r.l_kwh)}</span> },
            { label: "kWh GE", align: "right", render: (r) => fNum(r.ge_prod_kwh) },
          ]} />
      </Grid>
    </div>
  );
}
