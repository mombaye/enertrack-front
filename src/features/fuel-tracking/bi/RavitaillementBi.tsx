// Plan de ravitaillement : quels sites livrer, avant quelle date, et combien.
// Mêmes stocks et même conso que Suivi Stock. Le stock du jour est une ESTIMATION (relevé − conso depuis le relevé),
// toujours affichée à côté du stock relevé et de sa date. Quantité non calculable = « — » avec le motif, jamais 0.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { downloadBiExport, getRavitaillement, type RavitaillementRow } from "@/services/fuelTracking";
import { monthLabel } from "../helpers";
import { FT } from "../theme";
import {
  BI, BiKpi, ChartCard, FilterBar, FilterSelect, Grid, KpiRow, Pill, SiteCell, TopTable,
  axisProps, fDec1, fL, fNum, labelStyle, tooltipStyle,
} from "./kit";

const PLAN_MAX = 100;
const fDate = (iso: string | null | undefined) => (iso ? new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) : "—");
const fDay = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit" });

function Priority({ r, today }: { r: RavitaillementRow; today: string }) {
  const urgent = r.priorite === "URGENT";
  const label = r.livrer_avant <= today ? "Aujourd'hui" : urgent ? "Demain" : fDate(r.livrer_avant);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
      {urgent && <span aria-hidden style={{ width: 7, height: 7, borderRadius: 4, background: FT.red, flexShrink: 0 }} />}
      <span style={{ fontWeight: urgent ? 700 : 500, color: urgent ? FT.red : FT.text }}>{label}</span>
      {urgent && <span className="sr-only">urgent</span>}
    </span>
  );
}

export function RavitaillementBi({ toMonth, zone }: { toMonth: string | null; zone: string }) {
  const [horizon, setHorizon] = useState("");
  const [securite, setSecurite] = useState("");
  const [cible, setCible] = useState("");
  const params = { zone, month: toMonth ?? undefined, horizon, securite, cible };
  const q = useQuery({
    queryKey: ["fuel-bi-ravitaillement", zone, toMonth, horizon, securite, cible],
    queryFn: () => getRavitaillement(params),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
  const d = q.data;
  const k = d?.kpis;
  const x = d?.explain;
  const p = d?.parametres;
  const loading = q.isLoading;
  const today = p?.aujourdhui ?? new Date().toISOString().slice(0, 10);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <FilterBar title="Plan de ravitaillement"
        note={p ? `quels sites livrer, avant quelle date, et combien · conso de ${monthLabel(p.mois_reference)}` : "quels sites livrer, avant quelle date, et combien"}
        onExport={() => downloadBiExport("ravitaillement", params, `plan_ravitaillement_${today}.xlsx`)}
      >
        <FilterSelect label="Horizon" value={horizon} options={["3", "14", "30"]} onChange={setHorizon} allLabel="7 jours" format={(o) => `${o} jours`} />
        <FilterSelect label="Marge avant rupture" value={securite} options={["0", "1", "3", "5"]} onChange={setSecurite} allLabel="2 jours" format={(o) => `${o} jour${+o > 1 ? "s" : ""}`} />
        <FilterSelect label="Remplir la cuve à" value={cible} options={["80", "100"]} onChange={setCible} allLabel="90 %" format={(o) => `${o} %`} />
        <span style={{ fontSize: 12, color: "#7D889B", flex: "1 1 260px", alignSelf: "center" }}>Stock du jour estimé : stock relevé − conso par jour × jours depuis le relevé. Quantité arrondie aux 50 L supérieurs.</span>
      </FilterBar>

      {q.isError && <div role="alert" style={{ color: FT.red, fontSize: 12.5 }}>Chargement impossible. Réessayez avec le bouton Rafraîchir.</div>}

      <KpiRow>
        <BiKpi label="Sites à livrer" detail="Plan de livraison" detailLabel="Voir le plan" value={fNum(k?.nb_sites)} explain={x?.nb_sites}
          sub={p && k ? `sous ${p.horizon} jours · ${fNum(k.nb_au_dela)} sites au-delà` : undefined} />
        <BiKpi label="À livrer d'ici demain" detail="Plan de livraison" detailLabel="Voir les urgences" value={fNum(k?.nb_urgent)}
          explain={x?.nb_urgent} alert={k?.nb_urgent ? "bad" : null} sub="en tête du plan" />
        <BiKpi label="Litres à livrer" detail="Livraisons par jour" detailLabel="Voir par jour" value={fNum(k?.quantite_l)} unit="L" explain={x?.quantite_l}
          sub={k?.nb_sans_quantite ? `${fNum(k.nb_sans_quantite)} sites sans quantité (cuve inconnue)` : p ? `pour remplir à ${p.cible} %` : undefined} />
        <BiKpi label="Sites hors plan" detail="Sites hors plan" detailLabel="Voir les motifs" value={fNum(k?.nb_hors_plan)} explain={x?.nb_hors_plan}
          alert={k?.nb_hors_plan ? "warn" : null} sub={k ? `rupture non calculable, sur ${fNum(k.nb_sites_ge)} sites GE` : undefined} />
      </KpiRow>

      <Grid min={480}>
        <ChartCard title="Livraisons par jour" sub="sites à livrer au plus tard ce jour-là" info="Nombre de sites à livrer au plus tard ce jour-là. Le premier jour regroupe les sites déjà sous la marge de sécurité."
          loading={loading} error={q.isError} empty={!d?.by_day?.some((b) => b.nb_sites > 0)}>
          <ResponsiveContainer>
            <BarChart data={d?.by_day ?? []} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={BI.grid} vertical={false} />
              <XAxis dataKey="date" {...axisProps} interval={0} tickFormatter={fDay} />
              <YAxis {...axisProps} allowDecimals={false} width={36} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => fDate(v as string)}
                formatter={(v, _n, item) => [`${fNum(v as number)} sites · ${fL((item.payload as { quantite_l: number }).quantite_l)}`, "À livrer"]} />
              <Bar dataKey="nb_sites" maxBarSize={40} radius={[4, 4, 0, 0]}>
                {(d?.by_day ?? []).map((b, i) => <Cell key={b.date} fill={i <= 1 ? "#D03B3B" : "#2a78d6"} />)}
                <LabelList dataKey="nb_sites" position="top" style={labelStyle} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <TopTable title="Par région" sub="sites et litres du plan" info="Sites du plan et litres à livrer, par région." rows={d?.by_zone} loading={loading} error={q.isError}
          barValue={(r) => r.quantite_l} barColumn={3}
          columns={[
            { label: "Région", render: (r) => r.zone },
            { label: "Sites", align: "right", render: (r) => fNum(r.nb_sites) },
            { label: "D'ici demain", align: "right", render: (r) => <span style={{ color: r.nb_urgent ? FT.red : FT.text, fontWeight: r.nb_urgent ? 700 : 400 }}>{fNum(r.nb_urgent)}</span> },
            { label: "Litres", align: "right", render: (r) => fL(r.quantite_l) },
          ]} />
      </Grid>

      <TopTable title="Plan de livraison" rows={d?.plan.slice(0, PLAN_MAX)} loading={loading} error={q.isError}
        sub={d ? `${fNum(d.plan.length)} sites · classés par date limite de livraison${d.plan.length > PLAN_MAX ? ` · ${PLAN_MAX} premiers affichés, liste intégrale dans l'export Excel` : ""}` : undefined}
        info="Stock estimé = stock relevé − conso par jour × jours écoulés depuis le relevé. Relevé de plus de 7 jours : à confirmer avant de livrer."
        columns={[
          { label: "À livrer avant", render: (r) => <Priority r={r} today={today} /> },
          { label: "Site", render: (r) => <SiteCell id={r.site_id} name={r.site_name} /> },
          { label: "Région", render: (r) => r.zone ?? "—" },
          {
            label: "Stock relevé", align: "right", render: (r) => (
              <span style={{ whiteSpace: "nowrap" }} title={r.source_stock ? `Source : ${r.source_stock}` : undefined}>
                {fL(r.stock_releve_l)} <span style={{ fontSize: 11, color: FT.textSub }}>{r.date_releve ? fDate(r.date_releve) : "sans date"}</span>
                {r.stock_source_estime && <> <Pill tone="warn">Estimé</Pill></>}
                {r.releve_ancien && <> <Pill tone="warn">à confirmer</Pill></>}
              </span>
            ),
          },
          { label: "Stock estimé", align: "right", render: (r) => <b style={{ fontWeight: 800 }}>{fNum(r.stock_estime_l)}</b> },
          { label: "L / jour", align: "right", render: (r) => fDec1(r.conso_jour_l) },
          { label: "Rupture estimée", align: "right", render: (r) => <span style={{ whiteSpace: "nowrap" }}>{fDate(r.date_rupture)} <span style={{ fontSize: 11, color: FT.textSub }}>{fDec1(r.jours_avant_rupture)} j</span></span> },
          { label: "Cuve", align: "right", render: (r) => r.capacite_l ? fNum(r.capacite_l) : <span style={{ color: FT.textSub }}>inconnue</span> },
          {
            label: "Quantité", align: "right", render: (r) => r.quantite_l != null
              ? <b style={{ fontWeight: 800 }}>{fL(r.quantite_l)}</b>
              : <span title={r.quantite_motif ?? undefined} style={{ color: FT.textSub }}>— {r.quantite_motif}</span>,
          },
        ]} />

      <TopTable title="Sites hors plan" sub={d ? `${fNum(d.hors_plan.length)} sites · à vérifier sur place` : undefined} info="Sites GE dont la date de rupture ne peut pas être calculée : à vérifier sur place."
        rows={d?.hors_plan.slice(0, PLAN_MAX)} loading={loading} error={q.isError}
        columns={[
          { label: "Site", render: (r) => <SiteCell id={r.site_id} name={r.site_name} /> },
          { label: "Région", render: (r) => r.zone ?? "—" },
          { label: "Motif", render: (r) => <span style={{ color: FT.textMid }}>{r.motif}</span> },
        ]} />
    </div>
  );
}
