// Vue BI — Suivi Conso : tendance, target, rendement L/kWh, qualité capteur, répartition, classements.
// Pilotée par la période du header. Export Excel = mêmes calculs, toutes les lignes.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { downloadBiExport, getBiConso } from "@/services/fuelTracking";
import { monthLabel } from "../helpers";
import { FT } from "../theme";
import {
  BI, BiKpi, ChartCard, FilterBar, FilterSelect, Grid, KpiRow, SectionTitle, SiteCell, TopTable,
  axisProps, fDec1, fL, fLabel, fNum, fPct, fRatio, fShort, fSignedPct, labelStyle, tooltipStyle,
} from "./kit";

const QUALITY = [
  { key: "OK", label: "Relevé valide", color: BI.primary },
  { key: "LOW_QUALITY", label: "Qualité faible", color: BI.light },
  { key: "NO_VALID_LEVEL", label: "Niveau invalide", color: BI.warn },
  { key: "Autre / absent", label: "Sans relevé", color: BI.unknown },
] as const;

export function ConsoBi({ fromMonth, toMonth }: { fromMonth: string | null; toMonth: string | null }) {
  const [country, setCountry] = useState("");
  const [typology, setTypology] = useState("");
  const params = { from_month: fromMonth ?? undefined, to_month: toMonth ?? undefined, country, typology };
  const q = useQuery({
    queryKey: ["fuel-bi-conso", fromMonth, toMonth, country, typology],
    queryFn: () => getBiConso(params),
    enabled: !!fromMonth && !!toMonth,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
  const d = q.data;
  const k = d?.kpis;
  const loading = q.isLoading || !fromMonth;
  const monthly = (d?.monthly ?? []).map((m) => ({ ...m, label: monthLabel(m.month), ...m.qualite }));
  const [refLo, refHi] = d?.reference_l_kwh ?? [0.25, 0.3];
  const prevLabel = d?.previous_months?.length ? `${monthLabel(d.previous_months[0])} – ${monthLabel(d.previous_months[d.previous_months.length - 1])}` : null;
  const vsPrev = prevLabel ? `vs ${prevLabel}` : "";
  const typo = (d?.by_typology ?? []).filter((t) => t.l_site_jour != null).sort((a, b) => (b.l_site_jour ?? 0) - (a.l_site_jour ?? 0));
  const tol = k?.tolerance_target_pct ?? 10;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <FilterBar
        note={d?.months?.length ? `${monthLabel(d.months[0])} → ${monthLabel(d.months[d.months.length - 1])}` : undefined}
        onExport={() => downloadBiExport("conso", params, `suivi_conso_${d?.from_month ?? fromMonth}_${d?.to_month ?? toMonth}.xlsx`)}
      >
        <FilterSelect label="Pays" value={country} options={d?.filters.countries ?? []} onChange={setCountry} />
        <FilterSelect label="Typologie" value={typology} options={d?.filters.typologies ?? []} onChange={setTypology} allLabel="Toutes" />
      </FilterBar>

      {q.isError && <div role="alert" style={{ color: FT.red, fontSize: 12.5 }}>Chargement impossible. Les tableaux détaillés plus bas restent consultables.</div>}

      <KpiRow>
        <BiKpi label="Conso mesurée" value={fNum(k?.conso_mesuree_l)} unit="L" delta={d?.deltas?.conso_mesuree_l} upIsGood={false}
          sub={vsPrev} hint="Somme des consommations capteur (chute de niveau détectée), sites avec GE." />
        <BiKpi label="Moyenne par site et par jour" value={fDec1(k?.l_site_jour)} unit="L" delta={d?.deltas?.l_site_jour} upIsGood={false}
          sub={vsPrev} hint="Conso mesurée ÷ nombre de jours-site réellement mesurés." />
        <BiKpi label="Rendement GE" value={fRatio(k?.l_kwh)} unit="L/kWh" delta={d?.deltas?.l_kwh} upIsGood={false}
          alert={k?.l_kwh == null ? null : k.l_kwh > refHi + 0.05 ? "bad" : k.l_kwh > refHi ? "warn" : null}
          sub={`norme ${fRatio(refLo)} – ${fRatio(refHi)}`} hint="Ratio des sommes : litres mesurés ÷ kWh produits par le GE, sur les sites ayant les deux." />
        <BiKpi label="Écart au target" value={fSignedPct(k?.ecart_target_pct)}
          alert={k?.ecart_target_pct == null ? null : k.ecart_target_pct > tol ? "bad" : null}
          sub={k ? `${fNum(k.nb_sites_au_dessus_target)} sites au-dessus sur ${fNum(k.nb_sites_target)}${k.nb_targets_a_confirmer ? ` · ${fNum(k.nb_targets_a_confirmer)} targets non confirmés` : ""}` : undefined}
          hint={`Conso mesurée vs target mensuel × mois mesurés, sites ayant un target actif. Tolérance ±${tol} %.`} />
        <BiKpi label="Livré ENOC" value={fNum(k?.enoc_ajoutee_l)} unit="L" delta={d?.deltas?.enoc_ajoutee_l} upIsGood={false}
          sub={k?.nb_ravitaillements != null ? `${fNum(k.nb_ravitaillements)} demandes` : undefined} />
        <BiKpi label="Sites mesurés" value={fPct(k?.couverture_pct)} delta={d?.deltas?.couverture_pts} deltaUnit="pts"
          sub={k ? `${fNum(k.nb_sites_mesure)} / ${fNum(k.nb_sites)} sites GE` : undefined} />
      </KpiRow>

      <ChartCard title="Consommé et livré par mois"
        info="Barres : conso mesurée par capteur. Ligne : litres livrés ENOC. Les deux ne sont jamais additionnés ; un écart durable se contrôle site par site."
        legend={[{ label: "Conso mesurée", color: BI.primary }, { label: "Livré ENOC", color: BI.enoc, dashed: true }]}
        loading={loading} error={q.isError} empty={!monthly.length} height={270}>
        <ResponsiveContainer>
          <ComposedChart data={monthly} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={BI.grid} vertical={false} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} tickFormatter={fShort} width={48} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => fL(v as number | null)} />
            <Bar dataKey="conso_mesuree_l" name="Conso mesurée" fill={BI.primary} maxBarSize={34}>
              <LabelList dataKey="conso_mesuree_l" position="top" formatter={fLabel} style={labelStyle} />
            </Bar>
            <Line dataKey="enoc_ajoutee_l" name="Livré ENOC" stroke={BI.enoc} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2.5, fill: BI.enoc }} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <Grid>
        <ChartCard title="Conso vs target"
          info="Sites ayant un target actif et une conso mesurée le mois considéré. Target = target mensuel du site."
          legend={[{ label: "Conso mesurée", color: BI.secondary }, { label: "Target", color: FT.navy, dashed: true }]}
          loading={loading} error={q.isError} empty={!monthly.some((m) => m.target_l != null)}>
          <ResponsiveContainer>
            <ComposedChart data={monthly} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={BI.grid} vertical={false} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={fShort} width={48} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fL(v as number | null)} />
              <Bar dataKey="conso_vs_target_l" name="Conso mesurée" maxBarSize={30}>
                {monthly.map((m, i) => (
                  <Cell key={i} fill={m.target_l != null && m.conso_vs_target_l != null && m.conso_vs_target_l > m.target_l * (1 + tol / 100) ? BI.bad : BI.secondary} />
                ))}
              </Bar>
              <Line dataKey="target_l" name="Target" stroke={FT.navy} strokeWidth={2} strokeDasharray="5 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Rendement GE (L/kWh)" info="Zone verte : 0,25 – 0,30 L/kWh, plage normale d'un groupe diesel correctement chargé."
          loading={loading} error={q.isError} empty={!monthly.some((m) => m.l_kwh != null)}>
          <ResponsiveContainer>
            <ComposedChart data={monthly} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={BI.grid} vertical={false} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} domain={[0.15, "auto"]} tickFormatter={(v) => fRatio(v)} width={40} />
              <ReferenceArea y1={refLo} y2={refHi} fill={BI.band} fillOpacity={1} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${fRatio(v as number | null)} L/kWh`} />
              <Line dataKey="l_kwh" name="L/kWh" stroke={BI.secondary} strokeWidth={2} dot={{ r: 3, fill: BI.secondary }}>
                <LabelList dataKey="l_kwh" position="top" formatter={(v: unknown) => (typeof v === "number" ? fRatio(v) : "")} style={labelStyle} />
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </Grid>

      <Grid>
        <ChartCard title="Qualité des relevés capteur"
          info="Statut qualité du dernier relevé du mois, par site GE. « Sans relevé » : pas de statut remonté par le capteur."
          legend={QUALITY.map((x) => ({ label: x.label, color: x.color }))}
          loading={loading} error={q.isError} empty={!monthly.length}>
          <ResponsiveContainer>
            <BarChart data={monthly} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={BI.grid} vertical={false} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} allowDecimals={false} width={44} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${fNum(v as number)} sites`} />
              {QUALITY.map((x) => <Bar key={x.key} dataKey={x.key} name={x.label} stackId="q" fill={x.color} maxBarSize={34} />)}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Moyenne L / site / jour par typologie" info="Conso mesurée ÷ jours-site mesurés, sur toute la période."
          loading={loading} error={q.isError} empty={!typo.length} height={Math.max(220, typo.length * 30 + 20)}>
          <ResponsiveContainer>
            <BarChart data={typo} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="label" {...axisProps} width={120} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${fDec1(v as number | null)} L/jour`} />
              <Bar dataKey="l_site_jour" name="L / site / jour" fill={BI.secondary} maxBarSize={18}>
                <LabelList dataKey="l_site_jour" position="right" formatter={(v: unknown) => (typeof v === "number" ? fDec1(v) : "")} style={labelStyle} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </Grid>

      <Grid min={320}>
        <ChartCard title="Conso mesurée par pays" loading={loading} error={q.isError} empty={!d?.by_country?.length}
          height={Math.max(200, (d?.by_country?.length ?? 0) * 32 + 20)}>
          <ResponsiveContainer>
            <BarChart data={d?.by_country ?? []} layout="vertical" margin={{ top: 0, right: 44, left: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="label" {...axisProps} width={90} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fL(v as number | null)} />
              <Bar dataKey="conso_mesuree_l" name="Conso mesurée" fill={BI.primary} maxBarSize={18}>
                <LabelList dataKey="conso_mesuree_l" position="right" formatter={fLabel} style={labelStyle} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Sites par rendement (L/kWh)" info="Sites ayant produit au moins 100 kWh sur la période. En vert : la norme."
          loading={loading} error={q.isError} empty={!d?.distribution_l_kwh?.some((b) => b.nb_sites > 0)}>
          <ResponsiveContainer>
            <BarChart data={d?.distribution_l_kwh ?? []} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={BI.grid} vertical={false} />
              <XAxis dataKey="label" {...axisProps} interval={0} />
              <YAxis {...axisProps} allowDecimals={false} width={36} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${fNum(v as number)} sites`} />
              <Bar dataKey="nb_sites" maxBarSize={36}>
                {(d?.distribution_l_kwh ?? []).map((b, i) => <Cell key={i} fill={b.reference ? BI.ok : i >= 4 ? BI.bad : BI.light} />)}
                <LabelList dataKey="nb_sites" position="top" style={labelStyle} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </Grid>

      <SectionTitle sub="Période complète · liste intégrale dans l'export Excel">Classements par site</SectionTitle>
      <Grid min={480}>
        <TopTable title="Plus gros consommateurs" rows={d?.top_conso} loading={loading} error={q.isError}
          barValue={(r) => r.conso_mesuree_l}
          columns={[
            { label: "Site", render: (r) => <SiteCell id={r.site_id} name={r.site_name} /> },
            { label: "Conso", align: "right", render: (r) => fL(r.conso_mesuree_l) },
            { label: "L/jour", align: "right", width: "60px", render: (r) => fDec1(r.l_site_jour) },
          ]} />
        <TopTable title="Dépassements du target" info={`Sites au-delà de la tolérance de ${tol} %, classés par écart. * = target non confirmé.`} rows={d?.top_target} loading={loading} error={q.isError}
          barValue={(r) => r.ecart_target_pct} barColumn={3} barColor={BI.bad}
          columns={[
            { label: "Site", render: (r) => <SiteCell id={r.site_id} name={r.site_name} /> },
            { label: "Conso", align: "right", render: (r) => fL(r.conso_mesuree_l) },
            { label: "Target", align: "right", render: (r) => <span title={r.target_confirme ? "Target confirmé" : "Target non confirmé"}>{fL(r.target_l)}{r.target_confirme ? "" : " *"}</span> },
            { label: "Écart", align: "right", render: (r) => <span style={{ color: FT.red, fontWeight: 600 }}>{fSignedPct(r.ecart_target_pct)}</span> },
          ]} />
        <TopTable title="Écarts consommé / livré" info="Conso mesurée − litres livrés ENOC. Négatif : plus livré que consommé (stock qui monte, ou livraison à vérifier)."
          rows={d?.top_ecart_enoc} loading={loading} error={q.isError}
          barValue={(r) => r.ecart_enoc_l} barColumn={3} barColor={(r) => ((r.ecart_enoc_l ?? 0) < 0 ? BI.bad : BI.warn)}
          columns={[
            { label: "Site", render: (r) => <SiteCell id={r.site_id} name={r.site_name} /> },
            { label: "Mesuré", align: "right", render: (r) => fL(r.conso_mesuree_l) },
            { label: "Livré", align: "right", render: (r) => fL(r.enoc_ajoutee_l) },
            { label: "Écart", align: "right", render: (r) => <span style={{ fontWeight: 600, color: (r.ecart_enoc_l ?? 0) < 0 ? FT.red : FT.orange }}>{(r.ecart_enoc_l ?? 0) > 0 ? "+" : ""}{fL(r.ecart_enoc_l)}</span> },
          ]} />
        <TopTable title="Rendement le plus dégradé" info="L/kWh le plus élevé (sites ≥ 100 kWh) : GE sous-chargé, fuite ou capteur à contrôler."
          rows={d?.top_l_kwh} loading={loading} error={q.isError} barValue={(r) => r.l_kwh} barColor={BI.bad}
          columns={[
            { label: "Site", render: (r) => <SiteCell id={r.site_id} name={r.site_name} /> },
            { label: "L/kWh", align: "right", render: (r) => <span style={{ fontWeight: 600, color: (r.l_kwh ?? 0) > refHi ? FT.red : FT.text }}>{fRatio(r.l_kwh)}</span> },
            { label: "kWh GE", align: "right", render: (r) => fNum(r.ge_prod_kwh) },
          ]} />
      </Grid>
    </div>
  );
}
