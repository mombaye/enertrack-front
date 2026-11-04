// « Santé des données » : fraîcheur de chaque source et relevés gardiens en retard (lecture seule, aucune donnée inventée).
import { useQuery } from "@tanstack/react-query";
import { getDataHealth } from "@/services/fuelTracking";
import { FT } from "../theme";

const day = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString("fr-FR") : "aucune donnée");

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
        Santé des données — {c.sites_releve_en_retard + c.sites_sans_releve_gardien} site(s) du Closing sans relevé gardien récent
      </summary>
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
