// Vues BI — Commande (fichier Ops mensuel) et Estimation commande (calcul automatique).
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FuelCommandeEstimationResponse, FuelCommandeResponse, FuelCommandeSyntheseRow } from "@/services/fuelTracking";
import { monthLabel } from "../helpers";
import { FT } from "../theme";
import { BI, ChartCard, Grid, SectionTitle, SiteCell, TopTable, axisProps, fL, fNum, fShort, tooltipStyle } from "./kit";

function SyntheseChart({ title, rows, cur, prev, loading, error }: {
  title: string; rows: FuelCommandeSyntheseRow[] | undefined; cur: string; prev: string; loading: boolean; error: boolean;
}) {
  const data = (rows ?? []).filter((r) => !r.is_total_row);
  return (
    <ChartCard title={title} subtitle="Commande totale (normale + hivernale), mois courant vs mois précédent."
      legend={[{ label: cur, color: BI.primary }, { label: prev, color: BI.light }]}
      loading={loading} error={error} empty={!data.length} height={Math.max(200, data.length * 40 + 30)}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid stroke={BI.grid} horizontal={false} />
          <XAxis type="number" {...axisProps} tickFormatter={fShort} />
          <YAxis type="category" dataKey="label" {...axisProps} width={120} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => fL(v as number)} />
          <Bar dataKey="total_l" name={cur} fill={BI.primary} radius={[0, 4, 4, 0]} maxBarSize={14} />
          <Bar dataKey="total_prev_l" name={prev} fill={BI.light} radius={[0, 4, 4, 0]} maxBarSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function CommandeBi({ data, loading, error }: { data: FuelCommandeResponse | undefined; loading: boolean; error: boolean }) {
  const cur = monthLabel(data?.month_year);
  const prev = data?.prev_month_year ? monthLabel(data.prev_month_year) : "Mois précédent";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionTitle sub={`Fichier de commande Ops — ${cur}`}>Vue d'ensemble</SectionTitle>
      <Grid>
        <SyntheseChart title="Commande par catégorie / batch" rows={data?.synthese.categorie} cur={cur} prev={prev} loading={loading} error={error} />
        <SyntheseChart title="Commande par typologie facturée" rows={data?.synthese.typologie} cur={cur} prev={prev} loading={loading} error={error} />
      </Grid>
    </div>
  );
}

const CONF_COLOR: Record<string, string> = { "Élevée": BI.ok, Moyenne: BI.warn, Faible: BI.bad };

export function EstimationBi({ data, loading, error }: { data: FuelCommandeEstimationResponse | undefined; loading: boolean; error: boolean }) {
  const sites = data?.sites ?? [];
  const conf = (["Élevée", "Moyenne", "Faible"] as const).map((c) => ({ label: c, nb_sites: sites.filter((s) => s.confiance === c).length }));
  const topCommande = [...sites].sort((a, b) => b.commande_avec_marge_l - a.commande_avec_marge_l).slice(0, 10);
  // Stock final estimé le plus bas = risque de rupture ; seuls les sites au stock connu (sinon le chiffre n'a pas de sens).
  const topRupture = sites.filter((s) => s.stock_connu).sort((a, b) => a.stock_final_estime_l - b.stock_final_estime_l).slice(0, 10);
  const k = data?.kpis;
  const vsOps = k?.total_commande_ops_reference_l != null
    ? [{ label: "Estimation EnerTrack", value: k.total_commande_estimee_l }, { label: `Commande Ops ${monthLabel(k.ops_reference_month)}`, value: k.total_commande_ops_reference_l }]
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionTitle sub={data?.target_month ? `Estimation pour ${monthLabel(data.target_month)} — marge ${data.marge_pct} %` : undefined}>Vue d'ensemble</SectionTitle>
      <Grid min={320}>
        <ChartCard title="Niveau de confiance" subtitle="Selon l'historique disponible et la connaissance du stock."
          legend={conf.map((c) => ({ label: `${c.label} · ${fNum(c.nb_sites)}`, color: CONF_COLOR[c.label] }))}
          loading={loading} error={error} empty={!sites.length}>
          <ResponsiveContainer>
            <PieChart>
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${fNum(v as number)} sites`} />
              <Pie data={conf} dataKey="nb_sites" nameKey="label" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="#fff">
                {conf.map((c) => <Cell key={c.label} fill={CONF_COLOR[c.label]} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Estimation vs commande Ops" subtitle="Total en litres, marge incluse." loading={loading} error={error} empty={!vsOps.length}>
          <ResponsiveContainer>
            <BarChart data={vsOps} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={BI.grid} vertical={false} />
              <XAxis dataKey="label" {...axisProps} interval={0} />
              <YAxis {...axisProps} tickFormatter={fShort} width={52} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fL(v as number)} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={60}>
                {vsOps.map((_, i) => <Cell key={i} fill={i === 0 ? BI.primary : BI.enoc} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </Grid>
      <Grid min={340}>
        <TopTable title="Top 10 commandes estimées" rows={topCommande} loading={loading} error={error} barValue={(r) => r.commande_avec_marge_l}
          columns={[
            { label: "Site", render: (r) => <SiteCell id={r.site_id} name={r.site_name} /> },
            { label: "Commande", align: "right", render: (r) => fL(r.commande_avec_marge_l) },
            { label: "Confiance", align: "right", render: (r) => <span style={{ color: CONF_COLOR[r.confiance], fontWeight: 800 }}>{r.confiance}</span> },
          ]} />
        <TopTable title="Top 10 risques de rupture" subtitle="Stock final estimé le plus bas (sites au stock connu)." rows={topRupture} loading={loading} error={error}
          columns={[
            { label: "Site", render: (r) => <SiteCell id={r.site_id} name={r.site_name} /> },
            { label: "Stock final", align: "right", render: (r) => <span style={{ fontWeight: 800, color: r.stock_final_estime_l < 0 ? FT.red : FT.text }}>{fL(r.stock_final_estime_l)}</span> },
            { label: "Stock actuel", align: "right", render: (r) => fL(r.stock_actuel_l) },
          ]} />
      </Grid>
    </div>
  );
}
