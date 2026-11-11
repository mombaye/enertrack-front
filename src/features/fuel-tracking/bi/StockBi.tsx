// Vue BI — Suivi Stock : état actuel des cuves, autonomie, répartition par pays, Top 10.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Database, Hourglass, Warehouse } from "lucide-react";
import { getBiStock } from "@/services/fuelTracking";
import { monthLabel } from "../helpers";
import { FT } from "../theme";
import {
  BI, BiKpi, ChartCard, FilterBar, FilterSelect, Grid, KpiRow, SectionTitle, SiteCell, TopTable,
  axisProps, fL, fNum, fPct, fShort, tooltipStyle,
} from "./kit";

const LEVEL_COLOR = { critique: BI.bad, alerte: BI.warn, moyen: BI.light, bon: BI.primary, inconnu: BI.unknown } as const;
const AUTONOMY_COLOR = [BI.bad, BI.warn, BI.light, BI.secondary, BI.primary];

export function StockBi({ toMonth }: { toMonth: string | null }) {
  const [country, setCountry] = useState("");
  const q = useQuery({
    queryKey: ["fuel-bi-stock", country, toMonth],
    queryFn: () => getBiStock({ country, month: toMonth ?? undefined }),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
  const d = q.data;
  const k = d?.kpis;
  const loading = q.isLoading;
  const fillColor = (pct: number | null) => (pct == null ? BI.unknown : pct < 15 ? BI.bad : pct < 40 ? BI.warn : BI.secondary);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <FilterBar note={k ? `Stock actuel (dernier relevé ${k.derniere_mesure ? new Date(k.derniere_mesure).toLocaleDateString("fr-FR") : "—"}) · autonomie sur la conso de ${monthLabel(k.mois_reference_autonomie)}` : undefined}>
        <FilterSelect label="Pays" value={country} options={d?.filters.countries ?? []} onChange={setCountry} />
      </FilterBar>

      {q.isError && <div role="alert" style={{ color: FT.red, fontSize: 12.5, fontWeight: 600 }}>Vue BI stock indisponible : erreur de chargement. Les onglets détaillés plus bas restent consultables.</div>}

      <KpiRow>
        <BiKpi label="Stock total (capteur)" value={fL(k?.stock_total_l)} tone="blue" icon={<Warehouse size={13} />}
          sub={k?.remplissage_pct != null ? `${fPct(k.remplissage_pct)} de la capacité` : undefined} />
        <BiKpi label="Stock connu" value={fPct(k?.stock_connu_pct)} tone="cyan" icon={<Database size={13} />}
          sub={k ? `${fNum(k.nb_stock_connu)} / ${fNum(k.nb_sites)} sites GE` : undefined} />
        <BiKpi label="Cuves critiques (< 15 %)" value={fNum(k?.nb_critique)} tone="red" icon={<AlertTriangle size={13} />}
          sub={k ? `+ ${fNum(k.nb_alerte)} en alerte (15–40 %)` : undefined} />
        <BiKpi label="Autonomie < 3 jours" value={fNum(k?.nb_autonomie_moins_3j)} tone="orange" icon={<Hourglass size={13} />} sub="à ravitailler en priorité" />
      </KpiRow>

      <Grid min={320}>
        <ChartCard title="Niveau de remplissage des cuves" subtitle="Nombre de sites GE par tranche. « Inconnu » : aucun relevé exploitable."
          loading={loading} error={q.isError} empty={!d?.distribution_remplissage?.some((b) => b.nb_sites > 0)}>
          <ResponsiveContainer>
            <BarChart data={d?.distribution_remplissage ?? []} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={BI.grid} vertical={false} />
              <XAxis dataKey="label" {...axisProps} interval={0} />
              <YAxis {...axisProps} allowDecimals={false} width={40} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${fNum(v as number)} sites`} />
              <Bar dataKey="nb_sites" radius={[4, 4, 0, 0]} maxBarSize={44}>
                {(d?.distribution_remplissage ?? []).map((b, i) => <Cell key={i} fill={LEVEL_COLOR[b.niveau]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Autonomie estimée" subtitle="Stock actuel ÷ conso mesurée moyenne par jour. Sites sans conso mesurée exclus."
          loading={loading} error={q.isError} empty={!d?.distribution_autonomie?.some((b) => b.nb_sites > 0)}>
          <ResponsiveContainer>
            <BarChart data={d?.distribution_autonomie ?? []} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={BI.grid} vertical={false} />
              <XAxis dataKey="label" {...axisProps} interval={0} />
              <YAxis {...axisProps} allowDecimals={false} width={40} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${fNum(v as number)} sites`} />
              <Bar dataKey="nb_sites" radius={[4, 4, 0, 0]} maxBarSize={44}>
                {(d?.distribution_autonomie ?? []).map((_, i) => <Cell key={i} fill={AUTONOMY_COLOR[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Stock par pays" loading={loading} error={q.isError} empty={!d?.by_country?.length}
          height={Math.max(180, (d?.by_country?.length ?? 0) * 34 + 30)}>
          <ResponsiveContainer>
            <BarChart data={d?.by_country ?? []} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={BI.grid} horizontal={false} />
              <XAxis type="number" {...axisProps} tickFormatter={fShort} />
              <YAxis type="category" dataKey="label" {...axisProps} width={92} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fL(v as number | null)} />
              <Bar dataKey="stock_l" name="Stock" fill={BI.secondary} radius={[0, 4, 4, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </Grid>

      <SectionTitle sub="État actuel">Top 10</SectionTitle>
      <Grid min={340}>
        <TopTable title="Top 10 cuves les plus basses" rows={d?.top_critique} loading={loading} error={q.isError}
          barValue={(r) => r.remplissage_pct} barColor={(r) => fillColor(r.remplissage_pct)}
          columns={[
            { label: "Site", render: (r) => <SiteCell id={r.site_id} name={r.site_name} /> },
            { label: "Remplissage", align: "right", render: (r) => <span style={{ fontWeight: 800, color: fillColor(r.remplissage_pct) }}>{fPct(r.remplissage_pct)}</span> },
            { label: "Stock", align: "right", render: (r) => fL(r.stock_l) },
          ]} />
        <TopTable title="Top 10 autonomie la plus faible" subtitle="Ravitaillements à planifier en premier." rows={d?.top_autonomie_faible} loading={loading} error={q.isError}
          barValue={(r) => r.autonomie_j} barColor={(r) => ((r.autonomie_j ?? 99) < 3 ? BI.bad : BI.warn)}
          columns={[
            { label: "Site", render: (r) => <SiteCell id={r.site_id} name={r.site_name} /> },
            { label: "Autonomie", align: "right", render: (r) => <span style={{ fontWeight: 800, color: (r.autonomie_j ?? 99) < 3 ? FT.red : FT.text }}>{r.autonomie_j != null ? `${r.autonomie_j} j` : "—"}</span> },
            { label: "Stock", align: "right", render: (r) => fL(r.stock_l) },
          ]} />
        <TopTable title="Top 10 stocks les plus importants" rows={d?.top_stock} loading={loading} error={q.isError} barValue={(r) => r.stock_l}
          columns={[
            { label: "Site", render: (r) => <SiteCell id={r.site_id} name={r.site_name} /> },
            { label: "Stock", align: "right", render: (r) => fL(r.stock_l) },
            { label: "Capacité", align: "right", render: (r) => fL(r.capacite_l) },
          ]} />
      </Grid>
    </div>
  );
}
