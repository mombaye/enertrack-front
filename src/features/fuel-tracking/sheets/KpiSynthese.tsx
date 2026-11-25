// src/features/fuel-tracking/sheets/KpiSynthese.tsx
// Synthèse du mois : mêmes KPI et même présentation (valeur + libellé, deux colonnes) que l'en-tête du fichier Closing,
// avec le design de l'application. Toutes les valeurs sont les totaux du tableau Suivi Conso (calculs EnerTrack, aucun fichier).
// Chaque valeur est cliquable : une fenêtre explique d'où elle vient et l'opération faite.
import { useState } from "react";
import type { ClosingKpis, ClosingKpiValue } from "@/services/fuelTracking";
import { Modal } from "../ui";
import { FT } from "../theme";

const LEFT = ["nb_sites_ge", "stock_initial_l", "appoint_initial_l", "commande_mois_suivant_l", "commande_non_livree_l", "livree_l", "autre_l"];
const MIDDLE = ["conso_moyenne_jour_l", "stock_final_l", "appoint_final_l", "conso_releves_l", "perdue_l", "check_l", "nb_sites"];

const fmt = (k: string, n: number | null | undefined) => {
  if (n === null || n === undefined) return "n.d.";
  if (k === "conso_moyenne_jour_l") return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (k === "check_l" && Math.abs(n) < 0.5) return "-";
  const r = Math.round(n);
  return r < 0 ? `(${Math.abs(r).toLocaleString("fr-FR")})` : r.toLocaleString("fr-FR");
};
const fr = (v: string) => v.split("-").reverse().join("/");

export function KpiSynthese({ data }: { data: ClosingKpis | null | undefined }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!data) return null;
  const k = data.kpis;
  const [y, m] = data.mois.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const full = !data.debut || (data.debut.endsWith("-01") && data.fin === `${data.mois}-${String(last).padStart(2, "0")}`);
  const titre = full ? new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) : `du ${fr(data.debut!)} au ${fr(data.fin!)}`;

  const Row = ({ id }: { id: string }) => {
    const v: ClosingKpiValue | undefined = k[id];
    const neg = v?.valeur !== null && v?.valeur !== undefined && v.valeur < 0;
    return (
      <button type="button" onClick={() => setOpen(id)} title="Voir d'où vient cette valeur"
        style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 12, alignItems: "baseline", width: "100%", textAlign: "left", padding: "7px 8px",
          border: "none", borderBottom: `1px solid ${FT.border}`, background: "transparent", cursor: "pointer", borderRadius: 6 }}
        onMouseEnter={(e) => { e.currentTarget.style.background = FT.blueL; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
        <span style={{ textAlign: "right", fontWeight: 800, fontSize: 14, fontVariantNumeric: "tabular-nums", color: v?.valeur == null ? FT.textSub : neg ? FT.red : FT.navy }}>
          {fmt(id, v?.valeur)}
        </span>
        <span style={{ fontSize: 12.5, color: FT.text }}>{v?.libelle ?? id}</span>
      </button>
    );
  };

  const cur = open ? k[open] : null;
  const det = cur?.detail;
  return (
    <section aria-label="Synthèse conso fuel" style={{ border: FT.borderCrisp, background: FT.card, borderRadius: 14, boxShadow: FT.shadow, padding: "12px 16px" }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: FT.text, marginBottom: 6 }}>Synthèse conso fuel — {titre}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "0 28px" }}>
        <div>{LEFT.map((id) => <Row key={id} id={id} />)}</div>
        <div>{MIDDLE.map((id) => <Row key={id} id={id} />)}</div>
      </div>
      <div style={{ fontSize: 11, color: FT.textSub, marginTop: 6 }}>Cliquez sur une valeur pour voir d'où elle vient. « n.d. » = donnée non disponible (jamais remplacée par 0).</div>

      {open && cur && (
        <Modal title={cur.libelle} onClose={() => setOpen(null)} maxWidth={620}>
          <div style={{ display: "grid", gap: 12, fontSize: 13, color: FT.text }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: FT.navy, fontVariantNumeric: "tabular-nums" }}>{fmt(open, cur.valeur)}{cur.valeur != null && open !== "nb_sites" && open !== "nb_sites_ge" && open !== "conso_moyenne_jour_l" ? " L" : open === "conso_moyenne_jour_l" && cur.valeur != null ? " L/jour" : ""}</div>
            {det ? (
              <>
                <div><div style={{ fontWeight: 800, marginBottom: 2 }}>D'où vient la donnée</div>{det.source}</div>
                <div><div style={{ fontWeight: 800, marginBottom: 2 }}>Opération faite</div>{det.operation}</div>
                {det.composantes.length > 0 && (
                  <table style={{ borderCollapse: "collapse", width: "100%" }}>
                    <tbody>
                      {det.composantes.map((c) => (
                        <tr key={c.libelle} style={{ borderBottom: `1px solid ${FT.border}` }}>
                          <td style={{ padding: "5px 4px" }}>{c.libelle}</td>
                          <td style={{ padding: "5px 4px", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                            {c.valeur === null ? "n.d." : c.valeur.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div style={{ fontSize: 12, color: FT.textMid }}><b>Périmètre :</b> {det.perimetre} <b>Période :</b> {fr(det.periode[0])} → {fr(det.periode[1])}.</div>
              </>
            ) : <div>Pas de détail disponible pour cette valeur.</div>}
          </div>
        </Modal>
      )}
    </section>
  );
}
