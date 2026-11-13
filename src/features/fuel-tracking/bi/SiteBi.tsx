// Fiche site (Sénégal) : tout ce qu'EnerTrack sait d'un site sur la période du header —
// conso mesurée, livraisons ENOC, target, rendement, stock et autonomie, les 4 mesures de la
// consommation (bilan de stock, Closing, instrumentée, CPH), jour par jour et mois par mois.
// Mêmes règles que les vues globales : une valeur absente reste « — », jamais 0.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { getBiConsoSources, getBiSite, type BiConsoSourceKey, type BiSiteResponse } from "@/services/fuelTracking";
import { monthLabel } from "../helpers";
import { FT } from "../theme";
import { Card } from "../ui";
import { motif as cphMotif } from "./CphBi";
import {
  BI, BiKpi, ChartCard, FilterBar, FilterSelect, Grid, KpiRow, SectionTitle, StateBox, TopTable,
  axisProps, fDays, fDec1, fL, fLabel, fNum, fPct, fRatio, fShort, fSignedPct, labelStyle, tooltipStyle,
} from "./kit";

const BILAN: Record<string, string> = {
  NON_CALCULABLE: "Non calculable", VARIATION_CALCULEE: "Variation à contrôler", ESTIMATION_AVEC_RESERVE: "Estimation avec réserve",
  PRET_A_CERTIFIER: "Prêt à certifier", CONSOMMATION_REELLE_CERTIFIEE: "Réelle certifiée",
};
const QUALITE: Record<string, string> = { OK: "Relevé valide", LOW_QUALITY: "Qualité faible", NO_VALID_LEVEL: "Niveau invalide" };
const MEASURES: Array<{ key: BiConsoSourceKey; label: string }> = [
  { key: "variation", label: "Variation de stock" }, { key: "closing", label: "Consommation Closing" },
  { key: "instrumentee", label: "Instrumentée Snowflake" }, { key: "cph_complete", label: "CPH complète" },
];
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
const dateFr = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—");

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, color: FT.textSub, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 13, color: FT.text, fontWeight: 600, marginTop: 2 }}>{children ?? "—"}</div>
    </div>
  );
}

/** Les 4 mesures du site + d'où elles viennent (bilan de stock, CPH, couverture capteur). */
function SiteMeasures({ siteId, params, single }: { siteId: string; params: { from_month?: string; to_month?: string; month?: string }; single: boolean }) {
  const q = useQuery({
    queryKey: ["fuel-bi-site-sources", siteId, params.from_month, params.to_month, params.month],
    queryFn: () => getBiConsoSources({ ...params, site: siteId }),
    staleTime: 5 * 60_000, retry: false,
  });
  const s = q.data;
  const ok = !!s?.disponible;
  const d = s?.site;
  const value = (k: BiConsoSourceKey) => (q.isLoading ? "…" : q.isError || !ok ? "—" : fNum(s.kpis[k]?.total_l));
  return (
    <>
      <SectionTitle sub={ok ? `${dateFr(s.debut)} → ${dateFr(s.fin)} · quatre mesures indépendantes, jamais additionnées` : "Mêmes chiffres que l'onglet Consommations"}>
        Les 4 mesures de la consommation
      </SectionTitle>
      {q.isError && <div role="alert" style={{ color: FT.red, fontSize: 12.5 }}>Mesures indisponibles pour le moment (calcul CPH ou bilans de stock en échec).</div>}
      {s && !s.disponible && (
        <div style={{ fontSize: 12.5, color: FT.textMid, background: FT.slateL, borderRadius: 4, padding: "8px 12px" }}>
          Non calculé : {s.motif}{!single ? " Utilisez le filtre « Mois »." : ""}
        </div>
      )}
      {ok && d && !d.correspondance.utilise && (
        <div style={{ fontSize: 12.5, color: FT.orange }}>Site absent du fichier Closing : ses valeurs sont affichées pour information, il n'entre pas dans les totaux du Sénégal.</div>
      )}
      {ok && !d && <div style={{ fontSize: 12.5, color: FT.textMid }}>Aucun bilan de stock ni calcul CPH pour ce site sur la période.</div>}
      <KpiRow>
        {MEASURES.map((m) => (
          <BiKpi key={m.key} label={m.label} value={value(m.key)} unit="L" explain={ok ? s.explain[m.key] : null}
            alert={m.key === "variation" && (s?.kpis.variation?.total_l ?? 0) < 0 ? "bad" : null}
            sub={!d ? undefined
              : m.key === "variation" ? BILAN[d.stock.statut] ?? d.stock.statut
              : m.key === "instrumentee" ? `${fNum(d.instrumentee.jours_mesure)} / ${fNum(d.instrumentee.jours)} jours mesurés`
              : m.key === "cph_complete" ? (d.cph.statut === "COMPLET" ? `${fNum(d.cph.runtime_h)} h × ${fRatio(d.cph.cph_l_h)} L/h`
                : d.cph.statut === "PARTIEL" ? `Partielle : ${fL(d.cph.partielle_l)} (non retenue)` : d.cph.motif_code ? cphMotif(d.cph.motif_code) : "Non calculée")
              : undefined} />
        ))}
      </KpiRow>
      {ok && d && (
        <Card style={{ padding: "12px 16px", borderRadius: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: FT.text, marginBottom: 8 }}>Bilan de stock de la période</div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "6px 12px", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
            <span>Stock début <b>{fL(d.stock.initial_l)}</b>{d.stock.source_initial ? <span style={{ color: FT.textSub, fontSize: 11.5 }}> ({d.stock.source_initial})</span> : null}</span>
            <span style={{ color: FT.textSub }}>+</span>
            <span>Entrées <b>{fL(d.stock.entrees_l)}</b></span>
            <span style={{ color: FT.textSub }}>−</span>
            <span>Stock fin <b>{fL(d.stock.final_l)}</b>{d.stock.source_final ? <span style={{ color: FT.textSub, fontSize: 11.5 }}> ({d.stock.source_final})</span> : null}</span>
            <span style={{ color: FT.textSub }}>=</span>
            <span style={{ color: (d.stock.variation_l ?? 0) < 0 ? FT.red : FT.navy }}>Variation <b>{fL(d.stock.variation_l)}</b></span>
          </div>
          {(d.stock.motif || d.stock.action) && (
            <div style={{ marginTop: 8, fontSize: 12, color: FT.textMid, lineHeight: 1.5 }}>
              {d.stock.motif && <div>{d.stock.motif}</div>}
              {d.stock.action && <div><b>À faire :</b> {d.stock.action}</div>}
            </div>
          )}
          <div style={{ marginTop: 8, display: "flex", gap: 18, flexWrap: "wrap", fontSize: 12, color: FT.textMid }}>
            {d.modele_ge && <span>GE : <b style={{ color: FT.text }}>{d.modele_ge}</b>{d.puissance_nominale_kva != null ? ` · ${fNum(d.puissance_nominale_kva)} kVA` : ""}</span>}
            {d.cph.charge_pct != null && <span>Charge moyenne GE : <b style={{ color: FT.text }}>{fDec1(d.cph.charge_pct)} %</b></span>}
            {d.target.periode_l != null && <span>Target de la période : <b style={{ color: FT.text }}>{fL(d.target.periode_l)}</b></span>}
          </div>
        </Card>
      )}
    </>
  );
}

export function SiteBi({ siteId, fromMonth, toMonth, onClose }: { siteId: string; fromMonth: string | null; toMonth: string | null; onClose: () => void }) {
  const [month, setMonth] = useState("");
  const effMonth = month && fromMonth && toMonth && month >= fromMonth && month <= toMonth ? month : "";
  const params = { from_month: fromMonth ?? undefined, to_month: toMonth ?? undefined, month: effMonth || undefined };
  const q = useQuery({
    queryKey: ["fuel-bi-site", siteId, fromMonth, toMonth, effMonth],
    queryFn: () => getBiSite(siteId, params),
    enabled: !!fromMonth && !!toMonth,
    staleTime: 60_000,
    placeholderData: (prev) => (prev?.site.site_id.toUpperCase() === siteId.toUpperCase() ? prev : undefined),
    retry: (n, e) => (e as { response?: { status?: number } })?.response?.status !== 404 && n < 2,
  });
  const d: BiSiteResponse | undefined = q.data;
  const notFound = (q.error as { response?: { status?: number } } | null)?.response?.status === 404;
  const loading = q.isLoading || !fromMonth;
  const k = d?.kpis;
  const x = d?.explain;
  const single = d?.mois_unique ?? !!effMonth;
  const delta = (v: number | null | undefined) => (single ? undefined : v);
  const prevLabel = d?.previous_months?.length ? `vs ${monthLabel(d.previous_months[0])} – ${monthLabel(d.previous_months[d.previous_months.length - 1])}` : "";
  const vsPrev = single ? "" : prevLabel;
  const monthOptions = (d?.available_months ?? []).filter((m) => !!fromMonth && !!toMonth && m >= fromMonth && m <= toMonth).reverse();
  const monthly = (d?.monthly ?? []).map((m) => ({ ...m, label: monthLabel(m.month) }));
  const daily = d?.daily ?? [];
  const hasDaily = daily.some((r) => r.conso_mesuree_l != null || r.runtime_h != null);
  const tol = d?.tolerance_target_pct ?? 10;
  const st = d?.stock;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card style={{ padding: "12px 16px", borderRadius: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button type="button" onClick={onClose} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${FT.border}`, background: FT.slateL, borderRadius: 6, padding: "5px 10px", fontSize: 12.5, color: FT.textMid, cursor: "pointer" }}>
            <ArrowLeft size={14} aria-hidden /> Retour
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: FT.textSub, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase" }}>Fiche site</div>
            <h2 style={{ margin: 0, fontSize: 18, color: FT.navy, fontWeight: 800 }}>
              {d?.site.site_id ?? siteId}{d?.site.site_name ? <span style={{ fontWeight: 500, color: FT.textMid, fontSize: 15 }}> · {d.site.site_name}</span> : null}
            </h2>
          </div>
        </div>
        {d && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginTop: 12, paddingTop: 12, borderTop: `1px solid #E4E9F0` }}>
            <Fact label="Zone">{d.site.zone}</Fact>
            <Fact label="Typologie">{d.site.typologie}</Fact>
            <Fact label="Alimentation">{d.site.alimentation}</Fact>
            <Fact label="Groupe électrogène">{d.site.has_genset ? `Oui${d.site.nb_ge ? ` (${d.site.nb_ge})` : ""}` : "Non"}</Fact>
            <Fact label="Target mensuel">{d.target ? <>{fL(d.target.mensuel_l)}{d.target.confirme ? "" : <span style={{ color: FT.orange, fontWeight: 500 }}> · à confirmer</span>}</> : "Aucun"}</Fact>
            <Fact label="Pays">{d.site.country || "Non renseigné"}</Fact>
          </div>
        )}
      </Card>

      {notFound && <StateBox height={120} text={`Site ${siteId} introuvable dans le périmètre Sénégal.`} />}
      {q.isError && !notFound && <div role="alert" style={{ color: FT.red, fontSize: 12.5 }}>Chargement de la fiche impossible. Réessayez avec le bouton Rafraîchir.</div>}
      {d && !d.site.has_genset && (
        <div style={{ fontSize: 12.5, color: FT.textMid, background: FT.slateL, borderRadius: 4, padding: "8px 12px" }}>
          Site sans groupe électrogène (Solar / Grid) : il est exclu des calculs carburant. Les données éventuellement remontées sont affichées pour information.
        </div>
      )}

      {!notFound && (
        <>
          <FilterBar note={!d ? undefined : single ? `${monthLabel(d.months[0])} uniquement` : `${monthLabel(d.from_month)} → ${monthLabel(d.to_month)}`}>
            <FilterSelect label="Mois" value={effMonth} options={monthOptions} onChange={setMonth} allLabel="Toute la période" format={monthLabel} />
          </FilterBar>

          <KpiRow>
            <BiKpi label="Conso mesurée" value={fNum(k?.conso_mesuree_l)} unit="L" delta={delta(d?.deltas.conso_mesuree_l)} upIsGood={false} sub={vsPrev} explain={x?.conso_mesuree_l} />
            <BiKpi label="Moyenne par jour" value={fDec1(k?.l_site_jour)} unit="L" delta={delta(d?.deltas.l_site_jour)} upIsGood={false}
              sub={k?.jours_mesures != null ? `${fNum(k.jours_mesures)} jours mesurés` : undefined} explain={x?.l_site_jour} />
            <BiKpi label="Rendement GE" value={fRatio(k?.l_kwh)} unit="L/kWh" delta={delta(d?.deltas.l_kwh)} upIsGood={false}
              alert={k?.l_kwh == null ? null : k.l_kwh > 0.35 ? "bad" : k.l_kwh > 0.3 ? "warn" : null} sub="norme 0,25 – 0,30" explain={x?.l_kwh} />
            <BiKpi label="Livré ENOC" value={fNum(k?.enoc_ajoutee_l)} unit="L" delta={delta(d?.deltas.enoc_ajoutee_l)} upIsGood={false}
              sub={k?.nb_ravitaillements != null ? `${fNum(k.nb_ravitaillements)} demandes` : undefined} explain={x?.enoc_ajoutee_l} />
            <BiKpi label="Écart au target" value={fSignedPct(k?.ecart_target_pct)} alert={k?.ecart_target_pct != null && k.ecart_target_pct > tol ? "bad" : null}
              sub={k?.target_l != null ? `target ${fL(k.target_l)}` : "pas de target actif"} explain={x?.ecart_target_pct} />
            <BiKpi label="Stock en cuve" value={fNum(st?.stock_l)} unit="L"
              alert={st?.remplissage_pct != null && st.remplissage_pct < 15 ? "bad" : null}
              sub={st?.remplissage_pct != null ? `${fPct(st.remplissage_pct)} · ${dateFr(st.date)}` : "aucun relevé"} explain={x?.stock_l} />
            <BiKpi label="Autonomie" value={fDec1(st?.autonomie_j)} unit="jours" alert={st?.autonomie_j != null && st.autonomie_j < 3 ? "bad" : null}
              sub={st?.conso_jour_l != null ? `à ${fDec1(st.conso_jour_l)} L / jour` : undefined} explain={x?.autonomie_j} />
          </KpiRow>
          <div style={{ fontSize: 11.5, color: FT.textSub, marginTop: -4 }}>Cliquez sur un chiffre pour voir comment il est calculé.</div>

          <SiteMeasures siteId={d?.site.site_id ?? siteId} params={params} single={single} />

          <ChartCard title={single && d ? `Conso journalière · ${monthLabel(d.months[0])}` : "Conso journalière"}
            info="Barres : litres mesurés par le capteur chaque jour. Ligne : heures de marche du GE (Snowflake, brut). Un jour sans barre = pas de mesure, pas 0 L."
            legend={[{ label: "Conso mesurée (L)", color: BI.secondary }, { label: "Heures de marche GE", color: BI.enoc }]}
            loading={loading} error={q.isError} empty={!hasDaily} height={240}>
            <ResponsiveContainer>
              <ComposedChart data={daily} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={BI.grid} vertical={false} />
                <XAxis dataKey="date" {...axisProps} tickFormatter={dayLabel} minTickGap={24} />
                <YAxis yAxisId="l" {...axisProps} tickFormatter={fShort} width={40} />
                <YAxis yAxisId="h" orientation="right" {...axisProps} width={30} domain={[0, 24]} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => new Date(String(v)).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                  formatter={(v, n) => (n === "Heures de marche GE" ? `${fDec1(v as number | null)} h` : fL(v as number | null))} />
                <Bar yAxisId="l" dataKey="conso_mesuree_l" name="Conso mesurée" fill={BI.secondary} maxBarSize={14} />
                <Line yAxisId="h" dataKey="runtime_h" name="Heures de marche GE" stroke={BI.enoc} strokeWidth={1.6} dot={false} connectNulls={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          {!single && (
            <Grid>
              <ChartCard title="Mesuré, livré et target par mois"
                info="Barres : conso mesurée. Ligne pointillée orange : livré ENOC. Ligne navy : target mensuel. Mois sans barre = pas de mesure."
                legend={[{ label: "Conso mesurée", color: BI.primary }, { label: "Livré ENOC", color: BI.enoc, dashed: true }, { label: "Target", color: FT.navy, dashed: true }]}
                loading={loading} error={q.isError} empty={!monthly.some((m) => m.present)}>
                <ResponsiveContainer>
                  <ComposedChart data={monthly} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={BI.grid} vertical={false} />
                    <XAxis dataKey="label" {...axisProps} />
                    <YAxis {...axisProps} tickFormatter={fShort} width={44} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => fL(v as number | null)} />
                    <Bar dataKey="conso_mesuree_l" name="Conso mesurée" maxBarSize={30}>
                      {monthly.map((m, i) => <Cell key={i} fill={m.target_l != null && m.conso_mesuree_l != null && m.conso_mesuree_l > m.target_l * (1 + tol / 100) ? BI.bad : BI.primary} />)}
                      <LabelList dataKey="conso_mesuree_l" position="top" formatter={fLabel} style={labelStyle} />
                    </Bar>
                    <Line dataKey="enoc_ajoutee_l" name="Livré ENOC" stroke={BI.enoc} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2.5, fill: BI.enoc }} connectNulls={false} />
                    {d?.target?.mensuel_l != null && <ReferenceLine y={d.target.mensuel_l} stroke={FT.navy} strokeDasharray="4 4" />}
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Moyenne L / jour par mois" info="Conso mesurée ÷ jours mesurés du mois : comparable d'un mois à l'autre même si la couverture capteur varie."
                loading={loading} error={q.isError} empty={!monthly.some((m) => m.l_jour != null)}>
                <ResponsiveContainer>
                  <BarChart data={monthly} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={BI.grid} vertical={false} />
                    <XAxis dataKey="label" {...axisProps} />
                    <YAxis {...axisProps} width={36} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${fDec1(v as number | null)} L / jour`} />
                    <Bar dataKey="l_jour" name="L / jour" fill={BI.secondary} maxBarSize={30}>
                      <LabelList dataKey="l_jour" position="top" formatter={(v: unknown) => (typeof v === "number" ? fDec1(v) : "")} style={labelStyle} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </Grid>
          )}

          <Grid min={480}>
            <TopTable title="Mois par mois" info="« — » : pas de valeur (jamais 0). Qualité : statut du dernier relevé capteur du mois."
              rows={monthly} loading={loading} error={q.isError}
              columns={[
                { label: "Mois", render: (m) => <span style={{ fontWeight: 600 }}>{m.label}</span> },
                { label: "Mesuré", align: "right", render: (m) => fL(m.conso_mesuree_l) },
                { label: "Jours", align: "right", width: "48px", render: (m) => fNum(m.jours_mesures) },
                { label: "L/jour", align: "right", width: "56px", render: (m) => fDec1(m.l_jour) },
                { label: "Livré", align: "right", render: (m) => fL(m.enoc_ajoutee_l) },
                { label: "L/kWh", align: "right", width: "56px", render: (m) => <span style={{ color: (m.l_kwh ?? 0) > 0.3 ? FT.red : undefined }}>{fRatio(m.l_kwh)}</span> },
                { label: "Qualité", align: "right", render: (m) => <span style={{ color: m.qualite && m.qualite !== "OK" ? FT.orange : FT.textMid }}>{m.qualite ? QUALITE[m.qualite] ?? m.qualite : "—"}</span> },
              ]} />
            <TopTable title="Ravitaillements ENOC" info="Opérations ENOC du site sur la période, de la plus récente à la plus ancienne."
              rows={d?.enoc} loading={loading} error={q.isError} barValue={(r) => r.ajoute_l} barColumn={2} barColor={BI.enoc}
              columns={[
                { label: "Date", render: (r) => dateFr(r.date) },
                { label: "Type", render: (r) => <span style={{ fontSize: 12 }}>{r.type ?? "—"}{r.statut && r.statut !== "done" ? <span style={{ color: FT.textSub }}> · {r.statut}</span> : null}</span> },
                { label: "Ajouté", align: "right", render: (r) => fL(r.ajoute_l) },
                { label: "Demandé", align: "right", render: (r) => fL(r.demande_l) },
                { label: "Niveau", align: "right", render: (r) => (r.niveau_avant == null && r.niveau_apres == null ? "—" : `${fNum(r.niveau_avant)} → ${fNum(r.niveau_apres)}${r.unite ? ` ${r.unite}` : ""}`) },
              ]} />
          </Grid>
          {st && (
            <div style={{ fontSize: 12, color: FT.textMid }}>
              Stock : dernier relevé capteur le {dateFr(st.date)}{st.age_releve_j != null && st.age_releve_j > 7 ? <b style={{ color: FT.orange }}> (il y a {fDays(st.age_releve_j)}, à confirmer)</b> : null}
              {st.stock_enoc_l != null ? ` · stock déclaré ENOC ${fL(st.stock_enoc_l)} le ${dateFr(st.date_enoc)}` : ""}
              {st.capacite_l != null ? ` · cuve de ${fL(st.capacite_l)}` : ""}.
            </div>
          )}
        </>
      )}
    </div>
  );
}
