// Vue BI — Suivi Stock : état actuel des cuves, autonomie, fraîcheur des relevés, répartition, classements.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { downloadBiExport, getBiStock } from "@/services/fuelTracking";
import { monthLabel } from "../helpers";
import { FT } from "../theme";
import {
  BI, BiKpi, ChartCard, FilterBar, FilterSelect, Grid, KpiRow, SectionTitle, SiteCell, TopTable,
  axisProps, fDays, fDec1, fL, fLabel, fNum, fPct, labelStyle, tooltipStyle,
} from "./kit";

const LEVEL_COLOR = { critique: BI.bad, alerte: BI.warn, moyen: BI.light, bon: BI.primary, inconnu: BI.unknown } as const;
const AUTONOMY_COLOR = [BI.bad, BI.warn, BI.light, BI.secondary, BI.primary];
const AGE_COLOR = [BI.primary, BI.secondary, BI.light, BI.warn, BI.bad, BI.unknown];

export function StockBi({ toMonth }: { toMonth: string | null }) {
  const [country, setCountry] = useState("");
  const params = { country, month: toMonth ?? undefined };
  const q = useQuery({
    queryKey: ["fuel-bi-stock", country, toMonth],
    queryFn: () => getBiStock(params),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
  const d = q.data;
  const k = d?.kpis;
  const loading = q.isLoading;
  const fillColor = (pct: number | null) => (pct == null ? BI.unknown : pct < 15 ? BI.bad : pct < 40 ? BI.warn : BI.secondary);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <FilterBar
        note={k ? `Dernier relevé ${k.derniere_mesure ? new Date(k.derniere_mesure).toLocaleDateString("fr-FR") : "—"} · autonomie calculée sur ${monthLabel(k.mois_reference_autonomie)}` : undefined}
        onExport={() => downloadBiExport("stock", params, `suivi_stock_${today}.xlsx`)}
      >
        <FilterSelect label="Pays" value={country} options={d?.filters.countries ?? []} onChange={setCountry} />
      </FilterBar>

      {q.isError && <div role="alert" style={{ color: FT.red, fontSize: 12.5 }}>Chargement impossible. Les onglets détaillés plus bas restent consultables.</div>}

      <KpiRow>
        <BiKpi label="Stock en cuve" value={fNum(k?.stock_total_l)} unit="L"
          sub={k?.remplissage_pct != null ? `${fPct(k.remplissage_pct)} de la capacité` : undefined}
          hint="Somme des derniers relevés capteur des sites avec GE." />
        <BiKpi label="Cuves sous 15 %" value={fNum(k?.nb_critique)} alert={k?.nb_critique ? "bad" : null}
          sub={k ? `${fNum(k.nb_alerte)} autres entre 15 et 40 %` : undefined} />
        <BiKpi label="Autonomie < 3 jours" value={fNum(k?.nb_autonomie_moins_3j)} alert={k?.nb_autonomie_moins_3j ? "bad" : null} sub="sites à ravitailler en premier"
          hint="Stock actuel ÷ conso mesurée moyenne par jour du mois de référence." />
        <BiKpi label="Autonomie médiane" value={fDec1(k?.autonomie_mediane_j)} unit="jours" sub="sites à la conso mesurée connue" />
        <BiKpi label="Stock connu" value={fPct(k?.stock_connu_pct)} sub={k ? `${fNum(k.nb_stock_connu)} / ${fNum(k.nb_sites)} sites GE` : undefined} />
        <BiKpi label="Relevés de plus de 7 jours" value={fNum(k?.nb_releves_anciens)} alert={k?.nb_releves_anciens ? "warn" : null} sub="stock à confirmer sur place" />
      </KpiRow>

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
        <ChartCard title="Autonomie restante" info="Stock actuel ÷ conso mesurée moyenne par jour. Sites sans conso mesurée exclus."
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

      <ChartCard title="Stock et cuves critiques par pays" loading={loading} error={q.isError} empty={!d?.by_country?.length}
        height={Math.max(160, (d?.by_country?.length ?? 0) * 32 + 20)}>
        <ResponsiveContainer>
          <BarChart data={d?.by_country ?? []} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="label" {...axisProps} width={90} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => (n === "Stock" ? fL(v as number | null) : `${fNum(v as number)} cuves`)} />
            <Bar dataKey="stock_l" name="Stock" fill={BI.primary} maxBarSize={18}>
              <LabelList dataKey="stock_l" position="right" formatter={fLabel} style={labelStyle} />
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
    </div>
  );
}
