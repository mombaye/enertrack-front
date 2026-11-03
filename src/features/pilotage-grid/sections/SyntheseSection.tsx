// Synthèse — part payée, indicateurs, consommation K1/K2 et montant HTVA par mois, variations, coûts au kWh.
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getPgSynthese, pgApiError, type PgFilterState } from "@/services/pilotageGrid";
import { INK, K1, K2, MUTED, RULE, ST_COLOR, energy, f1, fmtN, ml, money, signed1 } from "../format";
import { KpiRow, Panel, StateBox, td, tdn, th, thn } from "../PgUi";

export function SyntheseSection({ filters, onOpenSite }: { filters: PgFilterState; onOpenSite: (siteKey: string) => void }) {
  const q = useQuery({ queryKey: ["pg-synthese", filters], queryFn: () => getPgSynthese(filters), placeholderData: keepPreviousData, staleTime: 60_000 });
  if (q.isLoading) return <StateBox kind="loading">Calcul de la synthèse…</StateBox>;
  if (q.isError || !q.data) return <StateBox kind="error">Synthèse indisponible : {pgApiError(q.error)}</StateBox>;
  const d = q.data;
  const total = d.statuts.reduce((a, s) => a + s.ttc, 0);
  const k = d.kpis;
  const chart = d.mensuel.map((m) => ({ ...m, label: ml(m.month) }));

  return (
    <div style={{ display: "grid", gap: 14, opacity: q.isFetching ? 0.65 : 1 }} aria-busy={q.isFetching}>
      <section style={{ display: "grid", gridTemplateColumns: "minmax(180px, 280px) 1fr", gap: 24, alignItems: "center", padding: "8px 4px" }}>
        <div>
          <div style={{ fontSize: 56, fontWeight: 800, color: INK, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{f1(d.pct_paye)}<small style={{ fontSize: 24 }}> %</small></div>
          <div style={{ color: MUTED, fontSize: 13 }}>du montant TTC facturé est payé</div>
        </div>
        <div>
          <div role="img" aria-label="Répartition du montant TTC par statut" style={{ display: "flex", height: 34, borderRadius: 6, overflow: "hidden", background: "#E4EBE9" }}>
            {d.statuts.map((s) => <div key={s.idx} title={`${s.label} : ${money(s.ttc)}`} style={{ width: `${total ? (s.ttc / total) * 100 : 0}%`, background: ST_COLOR[s.idx] }} />)}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: MUTED, marginTop: 3 }}>{[0, 25, 50, 75, 100].map((p) => <span key={p}>{p} %</span>)}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 8, fontSize: 12.5 }}>
            {d.statuts.map((s) => (
              <span key={s.idx}><span aria-hidden style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: ST_COLOR[s.idx], marginRight: 6 }} />{s.label} <b>{money(s.ttc)}</b></span>
            ))}
          </div>
        </div>
      </section>

      <KpiRow items={[
        ["Montant TTC facturé", `${money(k.ttc)} FCFA`, `${fmtN(k.nb_factures)} factures (date comptable)`],
        ["Reste à traiter", `${money(k.reste)} FCFA`, `${fmtN(k.reste_nb)} factures non payées`],
        ["Consommation", energy(k.kwh), `dont K2 ${f1(k.k2_pct)} %`],
        ["Montant HTVA", `${money(k.ht)} FCFA`, "mois calendaires, après prorata"],
        ["Coût moyen", `${fmtN(k.cout_kwh)} FCFA/kWh`, "HTVA / consommation"],
        ["Sites facturés", fmtN(k.sites_factures), `${fmtN(k.avec_changement_contrat)} avec changement de contrat`],
      ]} />

      <Panel title="Consommation K1 / K2 et montant HTVA par mois calendaire" note="Factures réparties au prorata des jours, anciens contrats ignorés après bascule.">
        <div style={{ height: 340 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={RULE} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: MUTED, fontSize: 11 }} interval="preserveStartEnd" minTickGap={14} axisLine={{ stroke: RULE }} tickLine={false} />
              <YAxis yAxisId="y" tick={{ fill: MUTED, fontSize: 11 }} tickFormatter={money} axisLine={false} tickLine={false} width={56} />
              <YAxis yAxisId="y2" orientation="right" tick={{ fill: MUTED, fontSize: 11 }} tickFormatter={money} axisLine={false} tickLine={false} width={56} />
              <Tooltip formatter={(v: number, name: string) => [`${fmtN(v)} ${name === "Montant HTVA" ? "FCFA" : "kWh"}`, name]} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="y" dataKey="k1" name="Conso K1" stackId="c" fill={K1} />
              <Bar yAxisId="y" dataKey="k2" name="Conso K2" stackId="c" fill={K2} />
              <Line yAxisId="y2" type="monotone" dataKey="ht" name="Montant HTVA" stroke={INK} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 14 }}>
        <Panel title="Variations de consommation" note={d.variations_note}>
          <div style={{ overflow: "auto", maxHeight: 420 }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead><tr><th style={th}>Site</th><th style={th}>Site_Name</th><th style={thn}>Moyenne 6 mois</th><th style={thn}>Dernier mois</th><th style={thn}>Écart</th></tr></thead>
              <tbody>
                {d.variations.map((v) => (
                  <tr key={v.site} tabIndex={0} onClick={() => onOpenSite(v.site)} onKeyDown={(e) => e.key === "Enter" && onOpenSite(v.site)} style={{ cursor: "pointer" }}>
                    <td style={{ ...td, fontWeight: 800 }}>{v.label}</td><td style={td}>{v.name}</td><td style={tdn}>{fmtN(v.avg)}</td><td style={tdn}>{fmtN(v.last)}</td>
                    <td style={{ ...tdn, color: v.d > 0 ? "#B0425A" : "#2E7D5B", fontWeight: 700 }}>{signed1(v.d)} %</td>
                  </tr>
                ))}
                {d.variations.length === 0 && <tr><td colSpan={5} style={{ ...td, color: MUTED }}>Pas assez de mois complets sur la période choisie.</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Coûts au kWh les plus élevés" note="HTVA rapporté à la consommation sur la période, sites de plus de 1 000 kWh par mois en moyenne.">
          <div style={{ overflow: "auto", maxHeight: 420 }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead><tr><th style={th}>Site</th><th style={th}>Site_Name</th><th style={th}>Tarif</th><th style={thn}>P. souscrite</th><th style={thn}>kWh / mois</th><th style={thn}>FCFA / kWh</th></tr></thead>
              <tbody>
                {d.couts.map((c) => (
                  <tr key={c.site} tabIndex={0} onClick={() => onOpenSite(c.site)} onKeyDown={(e) => e.key === "Enter" && onOpenSite(c.site)} style={{ cursor: "pointer" }}>
                    <td style={{ ...td, fontWeight: 800 }}>{c.label}</td><td style={td}>{c.name}</td><td style={td}>{c.tarif}</td>
                    <td style={tdn}>{c.ps === null ? "—" : `${f1(c.ps)} kW`}</td><td style={tdn}>{fmtN(c.moy)}</td><td style={tdn}>{fmtN(c.pu)}</td>
                  </tr>
                ))}
                {d.couts.length === 0 && <tr><td colSpan={6} style={{ ...td, color: MUTED }}>Aucun site au-dessus du seuil sur cette période.</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
