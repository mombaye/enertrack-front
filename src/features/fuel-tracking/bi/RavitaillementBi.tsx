// Plan de ravitaillement : quels sites livrer, avant quelle date, et combien.
// Mêmes stocks et même conso que Suivi Stock. Le stock du jour est une ESTIMATION (relevé − conso depuis le relevé),
// toujours affichée à côté du stock relevé et de sa date. Quantité non calculable = « — » avec le motif, jamais 0.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { downloadBiExport, getRavitaillement, type RavitaillementRow } from "@/services/fuelTracking";
import { monthLabel } from "../helpers";
import { FT } from "../theme";
import {
  BI, BiKpi, ChartCard, FilterBar, FilterSelect, Grid, KpiRow, SectionTitle, SiteCell, TopTable,
  axisProps, fDays, fL, fNum, labelStyle, tooltipStyle,
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
        note={p ? `Sénégal · conso de ${monthLabel(p.mois_reference)} · stock du jour estimé depuis le dernier relevé` : undefined}
        onExport={() => downloadBiExport("ravitaillement", params, `plan_ravitaillement_${today}.xlsx`)}
      >
        <FilterSelect label="Horizon" value={horizon} options={["3", "14", "30"]} onChange={setHorizon} allLabel="7 jours" format={(o) => `${o} jours`} />
        <FilterSelect label="Marge" value={securite} options={["0", "1", "3", "5"]} onChange={setSecurite} allLabel="2 jours" format={(o) => `${o} jour${+o > 1 ? "s" : ""}`} />
        <FilterSelect label="Remplir à" value={cible} options={["80", "100"]} onChange={setCible} allLabel="90 %" format={(o) => `${o} %`} />
      </FilterBar>

      {q.isError && <div role="alert" style={{ color: FT.red, fontSize: 12.5 }}>Chargement impossible. Réessayez avec le bouton Rafraîchir.</div>}

      <KpiRow>
        <BiKpi label="Sites à livrer" detail="Plan de livraison" detailLabel="Voir le plan" value={fNum(k?.nb_sites)} explain={x?.nb_sites}
          sub={p && k ? `sous ${p.horizon} jours · ${fNum(k.nb_au_dela)} sites au-delà` : undefined} />
        <BiKpi label="À livrer aujourd'hui ou demain" detail="Plan de livraison" detailLabel="Voir les urgences" value={fNum(k?.nb_urgent)}
          explain={x?.nb_urgent} alert={k?.nb_urgent ? "bad" : null} sub="en tête du plan" />
        <BiKpi label="Litres à livrer" detail="Livraisons par jour" detailLabel="Voir par jour" value={fNum(k?.quantite_l)} unit="L" explain={x?.quantite_l}
          sub={k?.nb_sans_quantite ? `${fNum(k.nb_sans_quantite)} sites sans quantité (cuve inconnue)` : p ? `pour remplir à ${p.cible} %` : undefined} />
        <BiKpi label="Sites hors plan" detail="Sites hors plan" detailLabel="Voir les motifs" value={fNum(k?.nb_hors_plan)} explain={x?.nb_hors_plan}
          alert={k?.nb_hors_plan ? "warn" : null} sub={k ? `rupture non calculable, sur ${fNum(k.nb_sites_ge)} sites GE` : undefined} />
      </KpiRow>

      <Grid min={340}>
        <ChartCard title="Livraisons par jour" info="Nombre de sites à livrer au plus tard ce jour-là. Le premier jour regroupe les sites déjà sous la marge de sécurité."
          loading={loading} error={q.isError} empty={!d?.by_day?.some((b) => b.nb_sites > 0)}>
          <ResponsiveContainer>
            <BarChart data={d?.by_day ?? []} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={BI.grid} vertical={false} />
              <XAxis dataKey="date" {...axisProps} interval={0} tickFormatter={fDay} />
              <YAxis {...axisProps} allowDecimals={false} width={36} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => fDate(v as string)}
                formatter={(v, _n, item) => [`${fNum(v as number)} sites · ${fL((item.payload as { quantite_l: number }).quantite_l)}`, "À livrer"]} />
              <Bar dataKey="nb_sites" fill={BI.primary} maxBarSize={40}>
                <LabelList dataKey="nb_sites" position="top" style={labelStyle} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <TopTable title="Par zone" info="Sites du plan et litres à livrer, par zone." rows={d?.by_zone} loading={loading} error={q.isError}
          barValue={(r) => r.quantite_l} barColumn={3}
          columns={[
            { label: "Zone", render: (r) => r.zone },
            { label: "Sites", align: "right", render: (r) => fNum(r.nb_sites) },
            { label: "Urgents", align: "right", render: (r) => <span style={{ color: r.nb_urgent ? FT.red : FT.text, fontWeight: r.nb_urgent ? 700 : 400 }}>{fNum(r.nb_urgent)}</span> },
            { label: "Litres", align: "right", render: (r) => fL(r.quantite_l) },
          ]} />
      </Grid>

      <SectionTitle sub={d ? (d.plan.length > PLAN_MAX ? `${PLAN_MAX} premiers sur ${fNum(d.plan.length)} · liste intégrale dans l'export Excel` : "classé par date limite de livraison") : undefined}>
        Plan de livraison
      </SectionTitle>
      <TopTable title="Plan de livraison" rows={d?.plan.slice(0, PLAN_MAX)} loading={loading} error={q.isError}
        info="Stock estimé = stock relevé − conso par jour × jours écoulés depuis le relevé. Relevé de plus de 7 jours : à confirmer avant de livrer."
        barValue={(r) => r.quantite_l} barColumn={5}
        columns={[
          { label: "À livrer avant", render: (r) => <Priority r={r} today={today} /> },
          { label: "Site", render: (r) => <SiteCell id={r.site_id} name={r.site_name} /> },
          { label: "Zone", render: (r) => r.zone ?? "—" },
          {
            label: "Stock estimé", align: "right", render: (r) => (
              <span title={`Relevé : ${fL(r.stock_releve_l)} le ${fDate(r.date_releve)}`}>
                {fL(r.stock_estime_l)}
                <span style={{ display: "block", fontSize: 11, color: r.releve_ancien ? "#9A6200" : FT.textSub }}>
                  {r.source_stock ? `${r.source_stock}${r.stock_source_estime ? " (estimé)" : ""} · ` : ""}{r.releve_ancien ? `${r.date_releve ? fDate(r.date_releve) : "sans date"} · à confirmer` : fDate(r.date_releve)}
                </span>
              </span>
            ),
          },
          { label: "Rupture estimée", align: "right", render: (r) => <span>{fDate(r.date_rupture)}<span style={{ display: "block", fontSize: 11, color: FT.textSub }}>{fDays(r.jours_avant_rupture)} · {fL(r.conso_jour_l)}/j</span></span> },
          {
            label: "Quantité", align: "right", render: (r) => r.quantite_l != null
              ? <span style={{ fontWeight: 600 }}>{fL(r.quantite_l)}</span>
              : <span title={r.quantite_motif ?? undefined} style={{ color: FT.textSub }}>— <span style={{ fontSize: 11 }}>{r.quantite_motif}</span></span>,
          },
        ]} />

      <TopTable title="Sites hors plan" info="Sites GE dont la date de rupture ne peut pas être calculée : à vérifier sur place."
        rows={d?.hors_plan.slice(0, PLAN_MAX)} loading={loading} error={q.isError}
        columns={[
          { label: "Site", render: (r) => <SiteCell id={r.site_id} name={r.site_name} /> },
          { label: "Zone", render: (r) => r.zone ?? "—" },
          { label: "Motif", render: (r) => <span style={{ color: FT.textMid }}>{r.motif}</span> },
        ]} />
    </div>
  );
}
