// Vue BI — Contrôle CPH : couverture du calcul, motifs de blocage, charge vs CPH, Top 10.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import { Clock, Cpu, Fuel, Scale } from "lucide-react";
import { getBiCph } from "@/services/fuelTracking";
import { monthLabel } from "../helpers";
import { FT } from "../theme";
import {
  BI, BiKpi, ChartCard, FilterBar, FilterSelect, Grid, KpiRow, SectionTitle, SiteCell, TopTable,
  axisProps, fL, fNum, fPct, fRatio, fShort, fSignedPct, tooltipStyle,
} from "./kit";

const STATUT_LABEL: Record<string, string> = { COMPLET: "CPH complet", PARTIEL: "CPH partiel", NON_CALCULE: "Non calculé" };
const STATUT_COLOR: Record<string, string> = { COMPLET: BI.ok, PARTIEL: BI.warn, NON_CALCULE: BI.unknown };

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

export function CphBi({ fromMonth, toMonth }: { fromMonth: string | null; toMonth: string | null }) {
  const [country, setCountry] = useState("");
  const p = cphPeriod(fromMonth, toMonth);
  const q = useQuery({
    queryKey: ["fuel-bi-cph", p?.start, p?.end, country],
    queryFn: () => getBiCph({ start: p!.start, end: p!.end, country }),
    enabled: !!p,
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });
  const d = q.data;
  const k = d?.kpis;
  const loading = q.isLoading || !p;
  const statuts = (d?.statuts_cph ?? []).map((s) => ({ ...s, name: STATUT_LABEL[s.label] ?? s.label, color: STATUT_COLOR[s.label] ?? BI.light }));
  const countries = (d?.by_country ?? []).map((c) => c.label).filter((c) => c !== "Non renseigné");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <FilterBar note={p ? `Période CPH : ${p.label}${d?.periode?.incomplete ? ` · données Snowflake jusqu'au ${d.periode.donnees_jusqu_au ?? "—"}` : ""}` : undefined}>
        <FilterSelect label="Pays" value={country} options={countries.length ? countries : country ? [country] : []} onChange={setCountry} />
        <span style={{ fontSize: 11.5, color: FT.textSub }}>Le calcul CPH couvre au plus 3 mois (les plus récents de la plage).</span>
      </FilterBar>

      {q.isError && <div role="alert" style={{ color: FT.red, fontSize: 12.5, fontWeight: 600 }}>Vue BI CPH indisponible (calcul ou Snowflake en erreur). Le contrôle détaillé plus bas reste consultable.</div>}

      <KpiRow>
        <BiKpi label="Couverture CPH complète" value={fPct(k?.couverture_cph_pct)} tone="green" icon={<Cpu size={13} />}
          sub={k ? `${fNum(k.nb_cph_complet)} / ${fNum(k.nb_sites_ge)} sites GE` : undefined} />
        <BiKpi label="Conso estimée CPH" value={fL(k?.conso_theorique_l)} tone="blue" icon={<Fuel size={13} />} sub="sites au CPH complet" />
        <BiKpi label="Heures de marche GE" value={k?.runtime_total_h != null ? `${fNum(k.runtime_total_h)} h` : "—"} tone="cyan" icon={<Clock size={13} />}
          sub={k?.cph_moy_l_h != null ? `CPH moyen ${fRatio(k.cph_moy_l_h)} L/h` : undefined} />
        <BiKpi label="Écart mesuré vs CPH" value={fPct(k?.ecart_global_pct)} tone={k?.ecart_global_pct == null ? "slate" : Math.abs(k.ecart_global_pct) > 15 ? "red" : "green"} icon={<Scale size={13} />}
          sub={k ? `sur ${fNum(k.nb_sites_comparables)} sites ayant les deux valeurs` : undefined} />
      </KpiRow>

      <Grid min={320}>
        <ChartCard title="Statut du calcul CPH" subtitle="Sites GE de la période." loading={loading} error={q.isError} empty={!statuts.length}
          legend={statuts.map((s) => ({ label: `${s.name} · ${fNum(s.nb_sites)}`, color: s.color }))}>
          <ResponsiveContainer>
            <PieChart>
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${fNum(v as number)} sites`} />
              <Pie data={statuts} dataKey="nb_sites" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="#fff">
                {statuts.map((s, i) => <Cell key={i} fill={s.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Pourquoi le CPH n'est pas calculé" subtitle="Motif principal, sites non complets." loading={loading} error={q.isError}
          empty={!d?.motifs_non_calcule?.length} height={Math.max(200, (d?.motifs_non_calcule?.length ?? 0) * 32 + 30)}>
          <ResponsiveContainer>
            <BarChart data={d?.motifs_non_calcule ?? []} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={BI.grid} horizontal={false} />
              <XAxis type="number" {...axisProps} allowDecimals={false} />
              <YAxis type="category" dataKey="label" {...axisProps} width={170} tickFormatter={(v: string) => v.replace(/_/g, " ").toLowerCase()} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${fNum(v as number)} sites`} />
              <Bar dataKey="nb_sites" fill={BI.warn} radius={[0, 4, 4, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Couverture CPH par pays" loading={loading} error={q.isError} empty={!d?.by_country?.length}
          legend={[{ label: "CPH complet", color: BI.primary }, { label: "Autres sites GE", color: BI.light }]}
          height={Math.max(260, (d?.by_country?.length ?? 0) * 34 + 30)}>
          <ResponsiveContainer>
            <BarChart data={(d?.by_country ?? []).map((c) => ({ ...c, autres: c.nb_sites - c.nb_cph_complet }))} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={BI.grid} horizontal={false} />
              <XAxis type="number" {...axisProps} allowDecimals={false} />
              <YAxis type="category" dataKey="label" {...axisProps} width={92} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="nb_cph_complet" name="CPH complet" stackId="a" fill={BI.primary} maxBarSize={22} />
              <Bar dataKey="autres" name="Autres sites GE" stackId="a" fill={BI.light} radius={[0, 4, 4, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </Grid>

      <ChartCard title="Charge GE vs CPH (L/h)" subtitle="Un point par site. Charge faible avec CPH élevé = GE surdimensionné ou à vérifier."
        loading={loading} error={q.isError} empty={!d?.charge_vs_cph?.length} height={280}>
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid stroke={BI.grid} />
            <XAxis type="number" dataKey="charge_pct" name="Charge" unit=" %" {...axisProps} domain={[0, "auto"]} />
            <YAxis type="number" dataKey="cph_l_h" name="CPH" unit=" L/h" {...axisProps} width={56} />
            <ZAxis range={[28, 28]} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: "3 3" }}
              formatter={(v, n) => (n === "Charge" ? `${fRatio(v as number)} %` : `${fRatio(v as number)} L/h`)} />
            <Scatter data={d?.charge_vs_cph ?? []} fill={BI.secondary} fillOpacity={0.65} />
          </ScatterChart>
        </ResponsiveContainer>
      </ChartCard>

      <SectionTitle sub="Sur la période CPH">Top 10</SectionTitle>
      <Grid min={340}>
        <TopTable title="Top 10 conso estimée CPH" rows={d?.top_conso_theorique} loading={loading} error={q.isError} barValue={(r) => r.conso_theorique_l}
          columns={[
            { label: "Site", render: (r) => <SiteCell id={r.site_id} name={r.site_name} /> },
            { label: "Conso CPH", align: "right", render: (r) => fL(r.conso_theorique_l) },
            { label: "L/h", align: "right", width: "56px", render: (r) => fRatio(r.cph_l_h) },
          ]} />
        <TopTable title="Top 10 écarts mesuré vs CPH" subtitle="Seulement les sites ayant les deux valeurs." rows={d?.top_ecart_mesure} loading={loading} error={q.isError}
          barValue={(r) => r.ecart_l} barColor={(r) => ((r.ecart_l ?? 0) > 0 ? BI.bad : BI.warn)}
          columns={[
            { label: "Site", render: (r) => <SiteCell id={r.site_id} name={r.site_name} /> },
            { label: "CPH", align: "right", render: (r) => fL(r.conso_theorique_l) },
            { label: "Mesuré", align: "right", render: (r) => fL(r.conso_mesuree_l) },
            { label: "Écart", align: "right", render: (r) => <span style={{ fontWeight: 800, color: Math.abs(r.ecart_pct ?? 0) > 15 ? FT.red : FT.text }}>{fSignedPct(r.ecart_pct)}</span> },
          ]} />
        <TopTable title="Top 10 heures de marche" rows={d?.top_runtime} loading={loading} error={q.isError} barValue={(r) => r.runtime_h}
          columns={[
            { label: "Site", render: (r) => <SiteCell id={r.site_id} name={r.site_name} /> },
            { label: "Heures", align: "right", render: (r) => (r.runtime_h != null ? `${fShort(r.runtime_h)} h` : "—") },
            { label: "Charge", align: "right", width: "64px", render: (r) => fPct(r.charge_pct) },
          ]} />
      </Grid>
    </div>
  );
}
