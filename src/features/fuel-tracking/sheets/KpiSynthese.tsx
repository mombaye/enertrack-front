// src/features/fuel-tracking/sheets/KpiSynthese.tsx
// Synthèse du mois : mêmes KPI et même présentation (valeur + libellé, deux colonnes) que l'en-tête du fichier Closing,
// avec le design de l'application. Toutes les valeurs sont les totaux du tableau Suivi Conso (calculs EnerTrack, aucun fichier).
// Chaque valeur est cliquable : une fenêtre explique d'où elle vient et l'opération faite.
import { useState } from "react";
import type { AnalyseGroupe, ClosingKpis, ClosingKpiValue } from "@/services/fuelTracking";
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
      {data.analyse && <AnalyseTable groupes={data.analyse.groupes} total={data.analyse.total} />}
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

// Synthèse « Analyse variation de stock Vs estimation théorique » : nombre de sites et totaux par groupe (mêmes valeurs que le tableau)
const GROUPE_COULEUR: Record<string, string> = { certifies: "#1E7B3C", alerte: "#B42318", sans_theorique: "#6B7A90", non_calculables: "#B7791F" };
const GROUPE_AIDE: Record<string, string> = {
  certifies: "Écart entre variation de stock et conso théorique dans la tolérance max(50 L ; 5 %)",
  alerte: "Écart au-delà de la tolérance, ou variation de stock négative : à instruire auprès des équipes opérationnelles",
  sans_theorique: "Conso théorique non calculable (type de GE, PRP, puissance, courbe ou temps de marche manquant)",
  non_calculables: "Conso théorique calculée mais variation de stock non calculable (stock initial / final ou mouvements ENOC manquants)",
};
const litres = (v: number | null, n: number, total: number) => (v === null
  ? <span style={{ color: FT.textSub }} title="Aucun site du groupe n'a cette valeur">n.d.</span>
  : <span title={n < total ? `Somme sur ${n} site(s) renseigné(s) sur ${total}` : undefined} style={{ color: v < 0 ? FT.red : undefined }}>
      {Math.round(v).toLocaleString("fr-FR")}{n < total ? " *" : ""}</span>);

function AnalyseTable({ groupes, total }: { groupes: AnalyseGroupe[]; total: AnalyseGroupe }) {
  const shown = groupes.filter((g) => g.sites > 0 || g.cle !== "non_calculables");
  const th = { padding: "6px 8px", fontSize: 11.5, fontWeight: 800, color: FT.textMid, textAlign: "right" as const, borderBottom: `2px solid ${FT.border}` };
  const td = { padding: "6px 8px", fontSize: 13, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" as const, borderBottom: `1px solid ${FT.border}` };
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: FT.text, marginBottom: 4 }}>Analyse variation de stock Vs estimation théorique</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 640 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left" }}>Sites</th><th style={th}>Nbre de sites</th><th style={th}>Conso théorique (L)</th>
              <th style={th}>Variation de stock (L)</th><th style={th}>DELTA théorique − variation (L)</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((g) => (
              <tr key={g.cle}>
                <td style={{ ...td, textAlign: "left" }} title={GROUPE_AIDE[g.cle ?? ""]}>
                  <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 999, background: GROUPE_COULEUR[g.cle ?? ""] ?? FT.textSub, marginRight: 8 }} />
                  {g.libelle}
                  {g.dont && g.sites > 0 && (
                    <span style={{ color: FT.textSub, fontSize: 11.5 }}>
                      {" — dont "}{Object.entries(g.dont).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`).join(", ")}
                    </span>
                  )}
                </td>
                <td style={{ ...td, fontWeight: 800, color: GROUPE_COULEUR[g.cle ?? ""] }}>{g.sites.toLocaleString("fr-FR")}</td>
                <td style={td}>{litres(g.conso_theorique_l, g.sites_theorique, g.sites)}</td>
                <td style={td}>{litres(g.variation_l, g.sites_variation, g.sites)}</td>
                <td style={{ ...td, fontWeight: 700 }}>{litres(g.delta_l, g.sites_delta, g.sites)}</td>
              </tr>
            ))}
            <tr style={{ background: "#FFF2CC" }}>
              <td style={{ ...td, textAlign: "left", fontWeight: 800 }}>Total</td>
              <td style={{ ...td, fontWeight: 800 }}>{total.sites.toLocaleString("fr-FR")}</td>
              <td style={{ ...td, fontWeight: 800 }}>{litres(total.conso_theorique_l, total.sites_theorique, total.sites)}</td>
              <td style={{ ...td, fontWeight: 800 }}>{litres(total.variation_l, total.sites_variation, total.sites)}</td>
              <td style={{ ...td, fontWeight: 800 }}>{litres(total.delta_l, total.sites_delta, total.sites)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: FT.textSub, marginTop: 4 }}>
        Chaque site est compté une seule fois. « * » = somme partielle (survolez pour voir sur combien de sites).
      </div>
    </div>
  );
}
