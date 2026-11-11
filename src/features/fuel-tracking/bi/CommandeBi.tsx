// Vues BI — Commande (fichier Ops mensuel) et Estimation commande (calcul automatique), avec export Excel.
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { downloadBiExport, type FuelCommandeEstimationResponse, type FuelCommandeResponse, type FuelCommandeSyntheseRow } from "@/services/fuelTracking";
import { monthLabel } from "../helpers";
import { FT } from "../theme";
import { BI, ChartCard, ExportButton, Grid, SectionTitle, SiteCell, TopTable, axisProps, fL, fLabel, fNum, fShort, labelStyle, tooltipStyle } from "./kit";

function SyntheseChart({ title, rows, cur, prev, loading, error }: {
  title: string; rows: FuelCommandeSyntheseRow[] | undefined; cur: string; prev: string; loading: boolean; error: boolean;
}) {
  const data = (rows ?? []).filter((r) => !r.is_total_row);
  return (
    <ChartCard title={title} info="Commande totale (normale + hivernale) du fichier Ops, mois courant et mois précédent."
      legend={[{ label: cur, color: BI.primary }, { label: prev, color: BI.light }]}
      loading={loading} error={error} empty={!data.length} height={Math.max(200, data.length * 44 + 20)}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 44, left: 0, bottom: 0 }} barGap={2}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="label" {...axisProps} width={120} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => fL(v as number)} />
          <Bar dataKey="total_l" name={cur} fill={BI.primary} maxBarSize={14}>
            <LabelList dataKey="total_l" position="right" formatter={fLabel} style={labelStyle} />
          </Bar>
          <Bar dataKey="total_prev_l" name={prev} fill={BI.light} maxBarSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function CommandeBi({ data, loading, error }: { data: FuelCommandeResponse | undefined; loading: boolean; error: boolean }) {
  const cur = monthLabel(data?.month_year);
  const prev = data?.prev_month_year ? monthLabel(data.prev_month_year) : "Mois précédent";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SectionTitle sub={`Fichier de commande Ops · ${cur}`}
        action={data?.month_year ? <ExportButton onExport={() => downloadBiExport("commande", { month: data.month_year ?? undefined }, `commande_ops_${data.month_year}.xlsx`)} /> : undefined}>
        Synthèse de la commande
      </SectionTitle>
      <Grid>
        <SyntheseChart title="Par catégorie / batch" rows={data?.synthese.categorie} cur={cur} prev={prev} loading={loading} error={error} />
        <SyntheseChart title="Par typologie facturée" rows={data?.synthese.typologie} cur={cur} prev={prev} loading={loading} error={error} />
      </Grid>
    </div>
  );
}

const CONF_COLOR: Record<string, string> = { "Élevée": BI.primary, Moyenne: BI.light, Faible: BI.warn };

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
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SectionTitle sub={data?.target_month ? `${monthLabel(data.target_month)} · marge ${data.marge_pct} %` : undefined}
        action={data?.target_month ? <ExportButton onExport={() => downloadBiExport("estimation", {}, `estimation_commande_${data.target_month}.xlsx`)} /> : undefined}>
        Synthèse de l'estimation
      </SectionTitle>
      <Grid min={320}>
        <ChartCard title="Fiabilité de l'estimation" info="Élevée : historique mesuré suffisant et stock connu. Faible : historique court ou stock inconnu."
          loading={loading} error={error} empty={!sites.length} height={170}>
          <ResponsiveContainer>
            <BarChart data={conf} layout="vertical" margin={{ top: 0, right: 44, left: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="label" {...axisProps} width={76} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${fNum(v as number)} sites`} />
              <Bar dataKey="nb_sites" name="Sites" maxBarSize={22}>
                {conf.map((c) => <Cell key={c.label} fill={CONF_COLOR[c.label]} />)}
                <LabelList dataKey="nb_sites" position="right" style={labelStyle} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Estimation et commande Ops" info="Total en litres, marge incluse." loading={loading} error={error} empty={!vsOps.length} height={170}>
          <ResponsiveContainer>
            <BarChart data={vsOps} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="label" {...axisProps} width={150} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fL(v as number)} />
              <Bar dataKey="value" maxBarSize={26}>
                {vsOps.map((_, i) => <Cell key={i} fill={i === 0 ? BI.primary : BI.light} />)}
                <LabelList dataKey="value" position="right" formatter={(v: unknown) => (typeof v === "number" ? `${fShort(v)} L` : "")} style={labelStyle} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </Grid>
      <Grid min={340}>
        <TopTable title="Plus grosses commandes estimées" rows={topCommande} loading={loading} error={error} barValue={(r) => r.commande_avec_marge_l}
          columns={[
            { label: "Site", render: (r) => <SiteCell id={r.site_id} name={r.site_name} /> },
            { label: "Commande", align: "right", render: (r) => fL(r.commande_avec_marge_l) },
            { label: "Fiabilité", align: "right", render: (r) => <span style={{ color: r.confiance === "Faible" ? FT.orange : FT.textMid }}>{r.confiance}</span> },
          ]} />
        <TopTable title="Risques de rupture" info="Stock final estimé le plus bas, sites au stock connu uniquement." rows={topRupture} loading={loading} error={error}
          columns={[
            { label: "Site", render: (r) => <SiteCell id={r.site_id} name={r.site_name} /> },
            { label: "Stock final", align: "right", render: (r) => <span style={{ fontWeight: 600, color: r.stock_final_estime_l < 0 ? FT.red : FT.text }}>{fL(r.stock_final_estime_l)}</span> },
            { label: "Stock actuel", align: "right", render: (r) => fL(r.stock_actuel_l) },
          ]} />
      </Grid>
    </div>
  );
}
