// Paiements — statuts, échéances par porteur, mois comptable, régions, ancienneté des impayés, liste des factures.
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getPgFactures, getPgPaiements, pgApiError, type PgFilterState, type PgSeries } from "@/services/pilotageGrid";
import { INK, MUTED, POR_COLOR, RULE, ST_COLOR, dfr, f1, fmtN, ml, money } from "../format";
import { KpiRow, Panel, StateBox, smallBtn, td, tdn, th, thn } from "../PgUi";

const ST_LABELS = ["Payée", "Annulée", "Impayée", "Hors scope / remplacée / annulée (AZ)", "Sans statut (Impayées/Rempl/Hors Scope)"];

function Stacked({ labels, series, fmt, horizontal, pct, fmtLabel }: {
  labels: string[]; series: Array<{ key: string; name: string; data: number[]; color: string }>; fmt: (v: number) => string;
  horizontal?: boolean; pct?: boolean; fmtLabel?: (l: string) => string;
}) {
  const data = labels.map((l, i) => ({ label: fmtLabel ? fmtLabel(l) : l, ...Object.fromEntries(series.map((s) => [s.key, s.data[i] ?? 0])) }));
  const axisFmt = (v: number) => (pct ? `${v} %` : fmt(v));
  return (
    <div style={{ height: horizontal ? Math.max(260, labels.length * 26 + 70) : 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 6, right: 10, bottom: 0, left: horizontal ? 8 : 0 }}>
          <CartesianGrid stroke={RULE} horizontal={!horizontal} vertical={!!horizontal} />
          {horizontal
            ? (<><XAxis type="number" tick={{ fill: MUTED, fontSize: 11 }} tickFormatter={axisFmt} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="label" tick={{ fill: MUTED, fontSize: 11 }} width={48} axisLine={false} tickLine={false} /></>)
            : (<><XAxis dataKey="label" tick={{ fill: MUTED, fontSize: 11 }} minTickGap={10} axisLine={{ stroke: RULE }} tickLine={false} /><YAxis tick={{ fill: MUTED, fontSize: 11 }} tickFormatter={axisFmt} axisLine={false} tickLine={false} width={56} /></>)}
          <Tooltip formatter={(v: number, n: string) => [pct ? `${f1(v)} %` : fmt(v), n]} />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
          {series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.name} stackId="a" fill={s.color} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const byStatut = (s: PgSeries) => ({ key: `s${s.statut}`, name: s.label ?? ST_LABELS[s.statut ?? 0], data: s.data, color: ST_COLOR[s.statut ?? 0] });

export function PaiementsSection({ filters, onOpenSite }: { filters: PgFilterState; onOpenSite: (siteKey: string) => void }) {
  const [metric, setMetric] = useState<"ttc" | "nb">("ttc");
  const [sel, setSel] = useState<number[]>([1, 2, 3, 4]);
  const [qIn, setQIn] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const pay = useQuery({ queryKey: ["pg-paiements", filters, metric], queryFn: () => getPgPaiements(filters, metric), placeholderData: keepPreviousData, staleTime: 60_000 });
  const fac = useQuery({
    queryKey: ["pg-factures", filters, sel, q, page],
    queryFn: () => getPgFactures(filters, { statuts: sel.join(","), q, page, page_size: 50 }),
    placeholderData: keepPreviousData, staleTime: 60_000,
  });
  const fmtV = metric === "ttc" ? money : fmtN;

  if (pay.isLoading) return <StateBox kind="loading">Calcul des paiements…</StateBox>;
  if (pay.isError || !pay.data) return <StateBox kind="error">Paiements indisponibles : {pgApiError(pay.error)}</StateBox>;
  const d = pay.data;
  const s = d.kpis.statuts;
  const totalPages = fac.data ? Math.max(1, Math.ceil(fac.data.total / fac.data.page_size)) : 1;

  return (
    <div style={{ display: "grid", gap: 14, opacity: pay.isFetching ? 0.65 : 1 }} aria-busy={pay.isFetching}>
      <div role="group" aria-label="Mesure des graphiques" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: MUTED }}>Mesure des graphiques :</span>
        {([["ttc", "Montant TTC"], ["nb", "Nombre de factures"]] as const).map(([k, label]) => (
          <button key={k} type="button" aria-pressed={metric === k} onClick={() => setMetric(k)} style={{ ...smallBtn, background: metric === k ? INK : "#fff", color: metric === k ? "#fff" : INK }}>{label}</button>
        ))}
      </div>

      <KpiRow items={[
        ["Factures", fmtN(d.kpis.nb), `${money(d.kpis.ttc)} FCFA TTC`],
        ["Payé", `${money(s[0].ttc)} FCFA`, `${fmtN(s[0].nb)} factures`],
        ["Annulé", `${money(s[1].ttc)} FCFA`, `${fmtN(s[1].nb)} factures (paires + / −)`],
        ["Impayées (AZ)", `${money(s[2].ttc)} FCFA`, `${fmtN(s[2].nb)} factures`],
        ["Hors scope / remplacées", `${money(s[3].ttc)} FCFA`, `${fmtN(s[3].nb)} factures`],
        ["Sans statut", `${money(s[4].ttc)} FCFA`, `${fmtN(s[4].nb)} factures`],
      ]} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))", gap: 14 }}>
        <Panel title="Factures payées par échéance et par porteur" note="Mois d'échéance de paiement, hors « Sans porteur ».">
          <Stacked labels={d.echeance.labels} fmtLabel={ml} fmt={fmtV}
            series={d.echeance.series.map((x) => ({ key: x.porteur, name: x.porteur, data: x.data, color: POR_COLOR[x.porteur] ?? "#8E8E8E" }))} />
        </Panel>
        <Panel title="Par mois comptable et par statut" note="Mois de la date comptable de la facture.">
          <Stacked labels={d.comptable.labels} fmtLabel={ml} fmt={fmtV} series={d.comptable.series.map(byStatut)} />
        </Panel>
        <Panel title="Répartition par région" note="Part de chaque statut hors « Payée », triée de la région la moins payée à la plus payée.">
          <Stacked labels={d.regions.labels} fmt={fmtV} pct horizontal series={d.regions.series.map(byStatut)} />
        </Panel>
        <Panel title="Ancienneté des factures non payées" note="Année de la date comptable.">
          <Stacked labels={d.anciennete.labels} fmt={fmtV} series={d.anciennete.series.map(byStatut)} />
        </Panel>
      </div>

      <Panel title="Factures" note="Cliquez sur une facture pour ouvrir la fiche du site.">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 8 }}>
          {[1, 2, 3, 4].map((i) => (
            <button key={i} type="button" aria-pressed={sel.includes(i)} onClick={() => { setSel((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i].sort())); setPage(1); }}
              style={{ ...smallBtn, borderColor: sel.includes(i) ? ST_COLOR[i] : RULE, background: sel.includes(i) ? "#fff" : "#F2F5F4", opacity: sel.includes(i) ? 1 : 0.6 }}>
              <span aria-hidden style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: ST_COLOR[i], marginRight: 6 }} />{ST_LABELS[i]}
            </button>
          ))}
          <input type="search" value={qIn} placeholder="N° facture, contrat, site, localisation" aria-label="Rechercher une facture"
            onChange={(e) => { setQIn(e.target.value); }} onKeyDown={(e) => { if (e.key === "Enter") { setQ(qIn.trim()); setPage(1); } }} onBlur={() => { if (qIn.trim() !== q) { setQ(qIn.trim()); setPage(1); } }}
            style={{ minWidth: 260, padding: "6px 9px", borderRadius: 8, border: `1px solid ${RULE}`, fontSize: 12.5 }} />
          <span style={{ marginLeft: "auto", fontSize: 12, color: MUTED }}>{fac.data ? `${fmtN(fac.data.total)} factures, ${fmtN(fac.data.ttc)} FCFA TTC` : ""}</span>
        </div>
        {fac.isError ? <StateBox kind="error">Liste indisponible : {pgApiError(fac.error)}</StateBox> : (
          <div style={{ overflow: "auto", maxHeight: 460, opacity: fac.isFetching ? 0.6 : 1 }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead><tr><th style={th}>N° facture</th><th style={th}>Contrat</th><th style={th}>Site</th><th style={th}>Nom</th><th style={th}>Localisation</th><th style={th}>Date comptable</th><th style={thn}>TTC (FCFA)</th><th style={th}>Statut</th><th style={th}>Porteur</th></tr></thead>
              <tbody>
                {(fac.data?.rows ?? []).map((r) => (
                  <tr key={`${r.numero}-${r.contrat}`} tabIndex={0} onClick={() => onOpenSite(r.site_id)} onKeyDown={(e) => e.key === "Enter" && onOpenSite(r.site_id)} style={{ cursor: "pointer" }}>
                    <td style={td}>{r.numero}</td><td style={td}>{r.contrat}</td><td style={{ ...td, fontWeight: 800 }}>{r.site_id}</td><td style={td}>{r.site_name}</td><td style={td}>{r.localisation}</td>
                    <td style={td}>{dfr(r.date)}</td><td style={tdn}>{fmtN(r.ttc)}</td>
                    <td style={td}><span aria-hidden style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: ST_COLOR[r.statut], marginRight: 6 }} />{ST_LABELS[r.statut]}</td><td style={td}>{r.porteur}</td>
                  </tr>
                ))}
                {fac.data && fac.data.rows.length === 0 && <tr><td colSpan={9} style={{ ...td, color: MUTED, padding: 16 }}>Aucune facture ne correspond. Élargissez la période ou réactivez un statut.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, fontSize: 12, color: MUTED }}>
          <span>Page {page} / {totalPages}</span>
          <span style={{ display: "inline-flex", gap: 6 }}>
            <button type="button" style={smallBtn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Précédent</button>
            <button type="button" style={smallBtn} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Suivant</button>
          </span>
        </div>
      </Panel>
    </div>
  );
}
