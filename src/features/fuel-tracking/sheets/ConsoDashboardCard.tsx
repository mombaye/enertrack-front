// Dashboard : indicateurs de pilotage des cinq mesures sur la dernière période complète avec bilan (chaque KPI a son infobulle).
import { useQuery } from "@tanstack/react-query";
import { getConsommations } from "@/services/fuelTracking";
import { FT } from "../theme";
import { HelpTip } from "./cphBadges";

const L = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} L`);
const N = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v.toLocaleString("fr-FR", { maximumFractionDigits: 0 }));
const signed = (v: number | null | undefined, d = 0) => (v === null || v === undefined ? "—" : `${v > 0 ? "+" : ""}${v.toLocaleString("fr-FR", { maximumFractionDigits: d })}`);

export function ConsoDashboardCard({ onOpen }: { onOpen?: () => void }) {
  const q = useQuery({ queryKey: ["consommations-dashboard"], queryFn: () => getConsommations({ page_size: 1 }), staleTime: 60_000 });
  const d = q.data;
  const compatible = !!(d?.kpis as { variation?: unknown } | undefined)?.variation;
  const k = compatible ? d?.kpis : undefined;
  const A = d?.aide ?? {};
  const t = k?.target;
  const items: Array<[string, string, string, string | undefined]> = k && t ? [
    ["Variation de stock calculée (L)", L(k.variation.total_l), `${N(k.variation.sites)} sites calculables`, A.variation],
    ["Consommation réelle certifiée (L)", L(k.certifiee.total_l), `${N(k.bilans.certifies)} bilan(s) certifié(s)`, A.certifiee],
    ["Consommation Closing (L)", L(k.closing.total_l), `${N(k.closing.sites)} sites`, A.closing],
    ["Instrumentée Snowflake (L)", L(k.instrumentee.total_l), `${N(k.instrumentee.sites)} sites couverts`, A.instrumentee],
    ["CPH complète (L)", L(k.cph_complete.total_l), `${N(k.cph_complete.sites)} sites · couverture ${N(k.couverture_cph_pct)} %`, A.cph_complete],
    ["CPH partielle (L)", L(k.cph_partielle.total_l), `${N(k.cph_partielle.sites)} sites (jamais un total complet)`, A.cph_partielle],
    ["Target fuel total période (L)", L(t.total_periode_l), `${N(t.sites_avec_target)} sites avec target · ${N(t.sites_sans_target)} exclus faute de target`, A.target],
    ["Écart global variation vs target", t.ecart_global_l === null ? "—" : `${signed(t.ecart_global_l)} L${t.ecart_global_pct === null ? "" : ` (${signed(t.ecart_global_pct, 1)} %)`}`,
      `(Σ variations − Σ targets) / Σ targets · ${N(t.sites_comparables)} sites comparables`, "Calculé sur la somme des variations comparables et la somme des targets comparables (jamais une moyenne de pourcentages site par site)."],
    ["Target moyen / site couvert", L(t.target_moyen_site_l), `Variation moyenne : ${L(t.variation_moyenne_site_l)}`, undefined],
    ["Bilans prêts à certifier", N(k.bilans.prets), "données stock et mouvements cohérentes", undefined],
    ["Bilans avec réserve", N(k.bilans.avec_reserve), "estimation avec réserve", undefined],
    ["Bilans non calculables", N(k.bilans.non_calculables), `${N(k.bilans.variation_calculee)} variation(s) à contrôler en plus`, undefined],
    ["Bilans certifiés", N(k.bilans.certifies), "validés par le Fuel Manager", undefined],
    ["Taux de couverture target", `${N(t.couverture_pct)} %`, `${N(t.a_confirmer)} target(s) historique(s) à confirmer`, undefined],
    // KPI 15 — Couverture CPH complète : kpis.couverture_cph_pct = sites CPH complète / sites (conso_comparison.py)
    ["Couverture CPH complète (%)", k.couverture_cph_pct === null ? "—" : `${N(k.couverture_cph_pct)} %`,
      `${N(k.cph_complete.sites)} / ${N(k.sites)} sites · ${N(k.cph_partielle.sites)} autre(s) en CPH partielle (non comptés)`,
      "Part des sites pour lesquels la consommation théorique CPH est complète sur toute la période sélectionnée. Les sites en CPH partielle ne sont pas comptés. Un site sans courbe abaque ou sans runtime n'est pas couvert, même si le GE a tourné."],
  ] : [];
  return (
    <section aria-label="Synthèse des consommations" style={{ border: FT.borderCrisp, background: FT.card, borderRadius: FT.radius, boxShadow: FT.shadow, padding: "14px 16px", display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, alignItems: "baseline" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: FT.text }}>Variation de stock · Closing · instrumentée · CPH · certifiée</div>
          <div style={{ fontSize: 12, color: FT.textMid }}>{d?.periode ? `Dernière période calculée : ${d.periode.libelle}` : q.isLoading ? "Chargement…" : "Aucun bilan de stock calculé."}</div>
        </div>
        {onOpen && <button type="button" onClick={onOpen} style={{ fontSize: 12, fontWeight: 800, padding: "7px 12px", borderRadius: 8, border: `1px solid ${FT.border}`, background: FT.card, cursor: "pointer" }}>Ouvrir Suivis Consommations</button>}
      </div>
      {d && !compatible && <div role="alert" style={{ color: FT.orange, fontSize: 12.5, fontWeight: 700 }}>Version de l'API incompatible : redémarrez le backend sur la dernière version.</div>}
      {q.isError && <div role="alert" style={{ color: FT.red, fontSize: 12.5, fontWeight: 700 }}>Synthèse indisponible (erreur serveur).</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
        {items.map(([label, value, sub, help]) => (
          <div key={label} style={{ borderLeft: `3px solid ${FT.blue}`, paddingLeft: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: FT.textSub, textTransform: "uppercase" }}>{label}{help && <HelpTip text={help} label={label} />}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: FT.text, fontVariantNumeric: "tabular-nums" }}>{value}</div>
            <div style={{ fontSize: 11, color: FT.textMid }}>{sub}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
