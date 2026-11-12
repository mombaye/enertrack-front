// « Santé des données » : fraîcheur de chaque source et relevés gardiens en retard (lecture seule, aucune donnée inventée).
import { useQuery } from "@tanstack/react-query";
import { getDataHealth, type SourceEtat, type SourceStatus } from "@/services/fuelTracking";
import { FT } from "../theme";

const day = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString("fr-FR") : "aucune donnée");
const when = (v: string | null | undefined) => (v ? new Date(v).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "jamais");

// État affiché en toutes lettres (jamais la couleur seule).
const ETAT: Record<SourceEtat, { label: string; fg: string; bg: string }> = {
  OK: { label: "OK", fg: FT.green, bg: FT.greenL },
  PARTIEL: { label: "Partiel", fg: FT.orange, bg: FT.orangeL },
  RETARD: { label: "En retard", fg: FT.orange, bg: FT.orangeL },
  BLOQUE: { label: "Bloqué", fg: FT.red, bg: FT.redL },
  ECHEC: { label: "Échec", fg: FT.red, bg: FT.redL },
  JAMAIS: { label: "Jamais reçu", fg: FT.slate, bg: FT.slateL },
};

function SourcesStatus({ rows }: { rows: SourceStatus[] }) {
  return (
    <div style={{ display: "grid", gap: 6, margin: "10px 0" }} aria-label="État de chaque source">
      {rows.map((r) => {
        const e = ETAT[r.etat] ?? ETAT.JAMAIS;
        return (
          <div key={r.source} style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: "2px 10px", alignItems: "start", padding: "7px 10px", border: `1px solid ${FT.border}`, borderRadius: 8, fontSize: 12.5 }}>
            <span style={{ justifySelf: "start", padding: "2px 8px", borderRadius: 999, fontWeight: 800, fontSize: 11.5, color: e.fg, background: e.bg }}>{e.label}</span>
            <span><strong>{r.libelle}</strong> <span style={{ color: FT.textMid }}>· dernier succès : {when(r.dernier_succes)}</span></span>
            {r.erreur && <span style={{ gridColumn: 2, color: FT.textMid, overflowWrap: "anywhere" }}>{r.erreur}</span>}
          </div>
        );
      })}
    </div>
  );
}

export function DataHealthPanel() {
  const q = useQuery({ queryKey: ["conso-sante"], queryFn: getDataHealth, staleTime: 60_000 });
  if (q.isLoading) return <div aria-busy="true" style={{ fontSize: 12.5, color: FT.textMid }}>Chargement de la santé des données…</div>;
  if (q.isError || !q.data) return <div role="alert" style={{ fontSize: 12.5, color: FT.red }}>Santé des données indisponible (erreur serveur).</div>;
  const h = q.data, c = h.couverture, s = h.sources;
  const cell = (label: string, value: string, warn = false) => (
    <div style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${warn ? FT.orange : FT.border}`, background: warn ? FT.orangeL : FT.card, minWidth: 150 }}>
      <div style={{ fontSize: 11, color: FT.textMid }}>{label}</div><div style={{ fontWeight: 800, fontSize: 13 }}>{value}</div>
    </div>
  );
  return (
    <details style={{ border: FT.borderCrisp, background: FT.card, borderRadius: FT.radius, padding: "8px 12px" }}>
      <summary style={{ cursor: "pointer", fontWeight: 800, fontSize: 13 }}>
        Santé des données
        {h.etat_sources && h.etat_sources.a_traiter.length > 0 && ` — ${h.etat_sources.a_traiter.length} source(s) à traiter`}
        {" — "}{c.sites_releve_en_retard + c.sites_sans_releve_gardien} site(s) du Closing sans relevé gardien récent
      </summary>
      {h.etat_sources && <SourcesStatus rows={h.etat_sources.sources} />}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "10px 0" }}>
        {cell("Fichier Closing", s.closing ? `${s.closing.fichier} · ${day(s.closing.recu_le)}` : "non importé", !s.closing)}
        {cell("Dernier relevé gardien", day(s.gardiennage.dernier_releve), !s.gardiennage.dernier_releve)}
        {cell("Mouvements ENOC (dernier)", day(s.enoc.dernier_mouvement))}
        {cell("Snowflake (dernière journée)", day(s.snowflake.derniere_journee), (s.snowflake.age_jours ?? 99) > 3)}
        {cell("Target fuel", s.target_fuel ? day(s.target_fuel.recu_le) : "non importé", !s.target_fuel)}
        {cell("Sites base Closing", String(c.sites_base_closing))}
        {cell(`Relevé < ${c.seuil_jours} j`, String(c.sites_releve_gardien_recent))}
        {cell("Relevé en retard", String(c.sites_releve_en_retard), c.sites_releve_en_retard > 0)}
        {cell("Jamais relevé", String(c.sites_sans_releve_gardien), c.sites_sans_releve_gardien > 0)}
      </div>
      {h.releves_en_retard.length > 0 && (
        <div style={{ fontSize: 12.5 }}><strong>Relevés en retard :</strong> {h.releves_en_retard.map((x) => `${x.site_id} (${x.jours} j)`).join(" · ")}</div>
      )}
      {h.sites_sans_releve.length > 0 && (
        <div style={{ fontSize: 12.5, marginTop: 4 }}><strong>Sans aucun relevé gardien :</strong> {h.sites_sans_releve.join(" · ")}</div>
      )}
    </details>
  );
}
