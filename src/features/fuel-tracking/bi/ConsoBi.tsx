// Vue BI — Suivi Conso (Sénégal) : tendance, conso journalière, concentration, target, rendement,
// carte de chaleur zone × mois, qualité capteur, classements. Chaque indicateur s'explique au clic.
// Pilotée par la période du header. Export Excel = mêmes calculs, toutes les lignes.
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Line, LineChart, ReferenceArea, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { downloadBiExport, getBiConso, getBiConsoSources, type BiConsoResponse, type BiConsoSourceKey } from "@/services/fuelTracking";
import { monthLabel } from "../helpers";
import { ConsoComparaisonSection } from "../sheets/ConsoComparaisonSection";
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

const SOURCES: Array<{ key: BiConsoSourceKey; label: string; color: string }> = [
  { key: "variation", label: "Variation de stock", color: BI.primary },
  { key: "closing", label: "Consommation Closing", color: BI.secondary },
  { key: "instrumentee", label: "Instrumentée Snowflake", color: BI.light },
  { key: "cph_complete", label: "CPH complète", color: BI.enoc },
];

/** Les 4 mesures de la consommation, chacune sur son propre périmètre de sites : jamais additionnées. */
function ConsoSources({ params, enabled, single, kpis, children }: {
  params: { from_month?: string; to_month?: string; month?: string; zone?: string }; enabled: boolean; single: boolean; kpis?: ReactNode; children?: ReactNode;
}) {
  const q = useQuery({
    queryKey: ["fuel-bi-conso-sources", params.from_month, params.to_month, params.month, params.zone],
    queryFn: () => getBiConsoSources(params),
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const s = q.data;
  const ok = !!s?.disponible;
  const chart = ok ? SOURCES.map((c) => ({ ...c, total_l: s.kpis[c.key]?.total_l ?? null, sites: s.kpis[c.key]?.sites ?? 0 })) : [];
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  const value = (key: BiConsoSourceKey) => (q.isLoading ? "…" : q.isError || !ok ? "—" : fNum(s.kpis[key]?.total_l));
  return (
    <>
      {q.isError && <div role="alert" style={{ color: FT.red, fontSize: 12.5 }}>Mesures indisponibles pour le moment (calcul CPH ou bilans de stock en échec). Les autres indicateurs restent valables.</div>}
      {s && !s.disponible && (
        <div style={{ fontSize: 12.5, color: FT.textMid, background: FT.slateL, borderRadius: 4, padding: "8px 12px" }}>
          Non calculé : {s.motif}{!single ? " Utilisez le filtre « Mois »." : ""}
        </div>
      )}
      <KpiRow>
        {SOURCES.map((c) => (
          <BiKpi key={c.key} label={c.label} detail={"Les 4 mesures côte à côte"} detailLabel="Comparer les 4 mesures" value={value(c.key)} unit="L"
            sub={ok ? `${fNum(s.kpis[c.key]?.sites)} / ${fNum(s.sites)} sites` : undefined}
            alert={c.key === "variation" && ok && (s.explain.variation?.valeurs.find((v) => v.label.startsWith("Variations négatives"))?.valeur ?? 0) as number > 0 ? "warn" : null}
            explain={ok ? s.explain[c.key] : null} />
        ))}
        {kpis}
      </KpiRow>
      <div style={{ fontSize: 11.5, color: FT.textSub, marginTop: -4 }}>
        Cliquez sur un chiffre pour voir comment il est calculé.
        {ok ? ` Les 4 mesures : sites du fichier Closing, du ${fmtDate(s.debut)} au ${fmtDate(s.fin)}, chacune sur ses propres sites, jamais additionnées.` : ""}
      </div>
      {children}
      {ok && chart.some((c) => c.total_l != null) && (
        <ChartCard title="Les 4 mesures côte à côte"
          info="Chaque barre est un total indépendant, calculé sur les sites où la mesure existe (nombre de sites à droite). Un écart important entre deux mesures se contrôle site par site dans l'onglet Consommations."
          height={170}>
          <ResponsiveContainer>
            <BarChart data={chart} layout="vertical" margin={{ top: 0, right: 110, left: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="label" {...axisProps} width={150} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fL(v as number | null)} />
              <Bar dataKey="total_l" name="Total" maxBarSize={20}>
                {chart.map((c) => <Cell key={c.key} fill={c.color} />)}
                <LabelList dataKey="total_l" position="right" style={labelStyle}
                  content={(p) => {
                    const { x = 0, y = 0, width = 0, height = 0, index = 0 } = p as { x?: number; y?: number; width?: number; height?: number; index?: number };
                    const r = chart[index];
                    if (!r || r.total_l == null) return null;
                    return <text x={Number(x) + Number(width) + 6} y={Number(y) + Number(height) / 2} dy={4} style={labelStyle} fill={FT.text}>{`${fShort(r.total_l)} L · ${fNum(r.sites)} sites`}</text>;
                  }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </>
  );
}

/** Période exacte du tableau par site : le mois choisi, sinon la période du header si ≤ 3 mois, sinon son dernier mois.
 * Fin bornée à hier (aucune donnée du jour en cours). */
function tablePeriod(fromMonth: string, toMonth: string, month: string): { debut: string; fin: string; label: string } {
  const idx = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
  const a = month || (idx(toMonth) - idx(fromMonth) < 3 ? fromMonth : toMonth);
  const b = month || toMonth;
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const last = new Date(Number(b.slice(0, 4)), Number(b.slice(5, 7)), 0);
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const label = a === b ? monthLabel(a) : `${monthLabel(a)} → ${monthLabel(b)}`;
  return { debut: `${a}-01`, fin: iso(last > yesterday ? yesterday : last), label: a !== fromMonth && !month ? `${label} (3 mois au plus)` : label };
}

const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });

/** Matrice zone × mois colorée selon la valeur (L / site / jour), comme une matrice Power BI. */
function ZoneMonthMatrix({ data }: { data: NonNullable<BiConsoResponse["zone_month"]> }) {
  const vals = data.cells.map((c) => c.l_site_jour).filter((v): v is number => v != null);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const cell = (z: string, m: string) => data.cells.find((c) => c.zone === z && c.month === m);
  const shade = (v: number) => {
    const t = hi > lo ? (v - lo) / (hi - lo) : 0.5;
    // du bleu très clair (#E4EFFE) au navy Camusat (#0B1F4D)
    const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
    return `rgb(${mix(228, 11)}, ${mix(239, 31)}, ${mix(254, 77)})`;
  };
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "separate", borderSpacing: 3, width: "100%", fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", fontWeight: 600, color: FT.textMid, padding: "4px 6px" }}>Zone</th>
            {data.months.map((m) => <th key={m} style={{ fontWeight: 600, color: FT.textMid, padding: "4px 6px", whiteSpace: "nowrap" }}>{monthLabel(m)}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.zones.map((z) => (
            <tr key={z}>
              <td style={{ fontWeight: 600, color: FT.navy, padding: "4px 6px", whiteSpace: "nowrap" }}>{z}</td>
              {data.months.map((m) => {
                const c = cell(z, m);
                const v = c?.l_site_jour;
                const dark = v != null && hi > lo && (v - lo) / (hi - lo) > 0.55;
                return (
                  <td key={m} title={c ? `${z} · ${monthLabel(m)} : ${fDec1(v)} L / site / jour sur ${fNum(c.nb_sites)} sites` : `${z} · ${monthLabel(m)} : pas de mesure`}
                    style={{ textAlign: "center", padding: "7px 6px", borderRadius: 3, background: v == null ? FT.slateL : shade(v), color: v == null ? FT.textSub : dark ? "#fff" : FT.text, fontWeight: 600 }}>
                    {v == null ? "—" : fDec1(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ConsoBi({ fromMonth, toMonth }: { fromMonth: string | null; toMonth: string | null }) {
  const [zone, setZone] = useState("");
  const [typology, setTypology] = useState("");
  const [month, setMonth] = useState("");
  // Le mois choisi doit rester dans la période du header ; sinon on revient à « toute la période ».
  const effMonth = month && fromMonth && toMonth && month >= fromMonth && month <= toMonth ? month : "";
  const params = { from_month: fromMonth ?? undefined, to_month: toMonth ?? undefined, month: effMonth || undefined, zone, typology };
  const q = useQuery({
    queryKey: ["fuel-bi-conso", fromMonth, toMonth, effMonth, zone, typology],
    queryFn: () => getBiConso(params),
    enabled: !!fromMonth && !!toMonth,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
  const d = q.data;
  const k = d?.kpis;
  const x = d?.explain;
  const loading = q.isLoading || !fromMonth;
  const monthly = (d?.monthly ?? []).map((m) => ({ ...m, label: monthLabel(m.month), ...m.qualite }));
  const daily = d?.daily ?? [];
  const dailyAvg = daily.length ? daily.reduce((a, r) => a + (r.conso_mesuree_l ?? 0), 0) / daily.length : null;
  const [refLo, refHi] = d?.reference_l_kwh ?? [0.25, 0.3];
  const prevLabel = d?.previous_months?.length ? `${monthLabel(d.previous_months[0])} – ${monthLabel(d.previous_months[d.previous_months.length - 1])}` : null;
  const vsPrev = prevLabel && !(d?.mois_unique ?? !!effMonth) ? `vs ${prevLabel}` : "";
  const typo = (d?.by_typology ?? []).filter((t) => t.l_site_jour != null).sort((a, b) => (b.l_site_jour ?? 0) - (a.l_site_jour ?? 0));
  const zones = (d?.by_zone ?? []).filter((z) => z.conso_mesuree_l != null);
  const tol = k?.tolerance_target_pct ?? 10;
  const pareto = d?.pareto;
  const single = d?.mois_unique ?? !!effMonth;
  const monthOptions = (d?.available_months ?? []).filter((m) => !!fromMonth && !!toMonth && m >= fromMonth && m <= toMonth).reverse();
  const delta = (v: number | null | undefined) => (single ? undefined : v);
  const quality = QUALITY.map((c) => ({ ...c, nb_sites: monthly[0]?.qualite[c.key] ?? 0 }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <FilterBar
        note={!d?.months?.length ? "Sénégal" : single ? `Sénégal · ${monthLabel(d.months[0])} uniquement` : `Sénégal · ${monthLabel(d.months[0])} → ${monthLabel(d.months[d.months.length - 1])}`}
        onExport={() => downloadBiExport("conso", params, effMonth ? `suivi_conso_${effMonth}.xlsx` : `suivi_conso_${d?.from_month ?? fromMonth}_${d?.to_month ?? toMonth}.xlsx`)}
      >
        <FilterSelect label="Mois" value={effMonth} options={monthOptions} onChange={setMonth} allLabel="Toute la période" format={monthLabel} />
        <FilterSelect label="Zone" value={zone} options={d?.filters.zones ?? []} onChange={setZone} allLabel="Toutes" />
        <FilterSelect label="Typologie" value={typology} options={d?.filters.typologies ?? []} onChange={setTypology} allLabel="Toutes" />
      </FilterBar>

      {q.isError && <div role="alert" style={{ color: FT.red, fontSize: 12.5 }}>Chargement impossible. Les tableaux détaillés plus bas restent consultables.</div>}

      <ConsoSources params={{ from_month: params.from_month, to_month: params.to_month, month: params.month, zone: zone || undefined }}
        enabled={!!fromMonth && !!toMonth} single={single}
        kpis={<>
          <BiKpi label="Conso mesurée" detail={"Plus gros consommateurs"} value={fNum(k?.conso_mesuree_l)} unit="L" delta={delta(d?.deltas?.conso_mesuree_l)} upIsGood={false}
            sub={vsPrev || (k ? `${fNum(k.nb_sites_mesure)} sites mesurés` : undefined)} explain={x?.conso_mesuree_l} />
          <BiKpi label="Moyenne par site et par jour" detail={"Moyenne L / site / jour, par zone et par mois"} detailLabel="Voir par zone et par mois" value={fDec1(k?.l_site_jour)} unit="L" delta={delta(d?.deltas?.l_site_jour)} upIsGood={false}
            sub={vsPrev || undefined} explain={x?.l_site_jour} />
        </>}>
        {fromMonth && toMonth && <ConsoComparaisonSection scope={{ ...tablePeriod(fromMonth, toMonth, effMonth), zone: zone || undefined }} />}
      </ConsoSources>

      {!single && <ChartCard title="Consommé et livré par mois"
        info="Barres : conso mesurée par capteur. Ligne : litres livrés ENOC. Les deux ne sont jamais additionnés ; un écart durable se contrôle site par site."
        legend={[{ label: "Conso mesurée", color: BI.primary }, { label: "Livré ENOC", color: BI.enoc, dashed: true }]}
        loading={loading} error={q.isError} empty={!monthly.length} height={260}>
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
      </ChartCard>}

      <Grid min={420}>
        <ChartCard title={single && d?.months?.[0] ? `Conso journalière · ${monthLabel(d.months[0])}` : "Conso journalière"}
          info="Somme des consommations mesurées chaque jour (faits journaliers Snowflake). Ligne pointillée : moyenne de la période. Un creux brutal signale souvent une coupure de remontée capteur, pas une baisse réelle."
          loading={loading} error={q.isError} empty={!daily.length} height={230}>
          <ResponsiveContainer>
            <AreaChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="biDaily" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={BI.secondary} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={BI.secondary} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={BI.grid} vertical={false} />
              <XAxis dataKey="date" {...axisProps} tickFormatter={dayLabel} minTickGap={28} />
              <YAxis {...axisProps} tickFormatter={fShort} width={44} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => new Date(String(v)).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                formatter={(v, n) => (n === "Conso mesurée" ? fL(v as number) : `${fNum(v as number)}`)} />
              {dailyAvg != null && <ReferenceLine y={dailyAvg} stroke={FT.navy} strokeDasharray="4 4" strokeOpacity={0.6} />}
              <Area dataKey="conso_mesuree_l" name="Conso mesurée" stroke={BI.secondary} strokeWidth={1.8} fill="url(#biDaily)" />
              <Area dataKey="nb_sites" name="Sites mesurés" stroke="none" fill="none" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Concentration de la conso"
          info="Sites classés du plus gros au plus petit consommateur. La courbe montre la part cumulée de la conso : plus elle monte vite, plus quelques sites pèsent lourd."
          loading={loading} error={q.isError} empty={!pareto?.points.length} height={230}
          action={pareto?.pct_sites_80 != null ? <span style={{ fontSize: 12, color: FT.textMid }}><b style={{ color: FT.navy }}>{fPct(pareto.pct_sites_80)}</b> des sites font 80 % de la conso</span> : undefined}>
          <ResponsiveContainer>
            <LineChart data={pareto?.points ?? []} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={BI.grid} />
              <XAxis type="number" dataKey="pct_sites" domain={[0, 100]} {...axisProps} tickFormatter={(v) => `${v} %`} />
              <YAxis domain={[0, 100]} {...axisProps} tickFormatter={(v) => `${v} %`} width={44} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => `${fPct(v as number)} des sites`} formatter={(v) => [`${fPct(v as number)} de la conso`, ""]} />
              <ReferenceLine y={80} stroke={BI.warn} strokeDasharray="4 4" />
              {pareto?.pct_sites_80 != null && <ReferenceLine x={pareto.pct_sites_80} stroke={BI.warn} strokeDasharray="4 4" />}
              <Line dataKey="pct_conso" stroke={FT.navy} strokeWidth={2.2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </Grid>

      {!single && <ChartCard title="Moyenne L / site / jour, par zone et par mois"
        info="Conso mesurée ÷ jours-site mesurés. Plus la case est foncée, plus la zone consomme par site. Survolez une case pour le nombre de sites."
        loading={loading} error={q.isError} empty={!d?.zone_month?.cells.length} height={Math.max(120, (d?.zone_month?.zones.length ?? 0) * 36 + 40)}>
        {d?.zone_month ? <ZoneMonthMatrix data={d.zone_month} /> : null}
      </ChartCard>}

      {!single && <Grid>
        <ChartCard title="Conso vs target"
          info="Sites ayant un target actif et une conso mesurée le mois considéré. Barre rouge : au-delà de la tolérance."
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
      </Grid>}

      <Grid min={520}>
        <ChartCard title="Conso mesurée par zone" loading={loading} error={q.isError} empty={!zones.length}
          height={Math.max(200, zones.length * 30 + 20)}>
          <ResponsiveContainer>
            <BarChart data={zones} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="label" {...axisProps} width={90} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fL(v as number | null)} />
              <Bar dataKey="conso_mesuree_l" name="Conso mesurée" fill={BI.primary} maxBarSize={18}>
                <LabelList dataKey="conso_mesuree_l" position="right" formatter={fLabel} style={labelStyle} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Moyenne L / site / jour par typologie" info="Conso mesurée ÷ jours-site mesurés, sur toute la période."
          loading={loading} error={q.isError} empty={!typo.length} height={Math.max(200, typo.length * 30 + 20)}>
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
        <ChartCard title="Qualité des relevés capteur"
          info="Statut qualité du dernier relevé du mois, par site GE. « Sans relevé » : pas de statut remonté par le capteur."
          legend={QUALITY.map((q) => ({ label: q.label, color: q.color }))}
          loading={loading} error={q.isError} empty={!monthly.length}>
          {single ? (
            <ResponsiveContainer>
              <BarChart data={quality} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="label" {...axisProps} width={110} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${fNum(v as number)} sites`} />
                <Bar dataKey="nb_sites" name="Sites" maxBarSize={22}>
                  {quality.map((c) => <Cell key={c.key} fill={c.color} />)}
                  <LabelList dataKey="nb_sites" position="right" style={labelStyle} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
          <ResponsiveContainer>
            <BarChart data={monthly} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={BI.grid} vertical={false} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} allowDecimals={false} width={44} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${fNum(v as number)} sites`} />
              {QUALITY.map((q) => <Bar key={q.key} dataKey={q.key} name={q.label} stackId="q" fill={q.color} maxBarSize={34} />)}
            </BarChart>
          </ResponsiveContainer>
          )}
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

      <SectionTitle sub={`${single ? "Mois choisi" : "Période complète"} · liste intégrale dans l'export Excel`}>Classements par site</SectionTitle>
      <Grid min={480}>
        <TopTable title="Plus gros consommateurs" rows={d?.top_conso} loading={loading} error={q.isError}
          barValue={(r) => r.conso_mesuree_l}
          columns={[
            { label: "Site", render: (r) => <SiteCell id={r.site_id} name={r.site_name} /> },
            { label: "Conso", align: "right", render: (r) => fL(r.conso_mesuree_l) },
            { label: "L/jour", align: "right", width: "60px", render: (r) => fDec1(r.l_site_jour) },
            { label: "Zone", align: "right", width: "56px", render: (r) => r.zone ?? "—" },
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
