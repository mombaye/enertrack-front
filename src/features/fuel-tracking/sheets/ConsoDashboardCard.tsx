// Dashboard : synthèse de pilotage des trois consommations sur la dernière période complète avec bilan.
import { useQuery } from "@tanstack/react-query";
import { getConsommations } from "@/services/fuelTracking";
import { FT } from "../theme";

const nf = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} L`);

export function ConsoDashboardCard({ onOpen }: { onOpen?: () => void }) {
  const q = useQuery({ queryKey: ["consommations-dashboard"], queryFn: () => getConsommations({ page_size: 1 }), staleTime: 60_000 });
  const d = q.data;
  const k = d?.kpis;
  const items: Array<[string, string, string]> = k ? [
    ["Consommation réelle stock", nf(k.reel.total_l), `${k.reel.sites_calculables} sites calculables`],
    ["Instrumentée Snowflake", nf(k.instrumentee.total_l), `${k.instrumentee.sites_couverts} sites couverts · non certifiée`],
    ["Théorique CPH", nf(k.theorique.total_l), `${k.theorique.sites_complets} complets · estimation`],
    ["Sites certifiables", String(k.reel.sites_certifiables), `${k.reel.sites_avec_reserve} avec réserve`],
    ["Sites à traiter", String(k.a_traiter.sites_non_calculables), `${k.a_traiter.conflits_enoc_closing} conflits ENOC/Closing`],
  ] : [];
  return (
    <section aria-label="Synthèse des consommations" style={{ border: FT.borderCrisp, background: FT.card, borderRadius: FT.radius, boxShadow: FT.shadow, padding: "14px 16px", display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, alignItems: "baseline" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: FT.text }}>Réel · instrumentée · théorique</div>
          <div style={{ fontSize: 12, color: FT.textMid }}>{d?.periode ? `Dernière période calculée : ${d.periode.libelle}` : q.isLoading ? "Chargement…" : "Aucun bilan de stock calculé."}</div>
        </div>
        {onOpen && <button type="button" onClick={onOpen} style={{ fontSize: 12, fontWeight: 800, padding: "7px 12px", borderRadius: 8, border: `1px solid ${FT.border}`, background: FT.card, cursor: "pointer" }}>Ouvrir Suivis Consommations</button>}
      </div>
      {q.isError && <div role="alert" style={{ color: FT.red, fontSize: 12.5, fontWeight: 700 }}>Synthèse indisponible (erreur serveur).</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
        {items.map(([label, value, sub]) => (
          <div key={label} style={{ borderLeft: `3px solid ${FT.blue}`, paddingLeft: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: FT.textSub, textTransform: "uppercase" }}>{label}</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: FT.text, fontVariantNumeric: "tabular-nums" }}>{value}</div>
            <div style={{ fontSize: 11, color: FT.textMid }}>{sub}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
