// src/features/fuel-tracking/sheets/ClosingSiteTable.tsx
// Tableau par site au format de la feuille « Synthese conso fuel » du fichier Closing : seules les colonnes utiles au suivi conso.
import type { CSSProperties } from "react";
import type { ConsoRow } from "@/services/fuelTracking";

const NAVY = "#1F3864";
const num = (v: number | null | undefined, d = 0) => {
  if (v === null || v === undefined) return <span style={{ color: "#94A0B4" }}>—</span>;
  const s = Math.abs(v).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
  return v < 0 ? <span style={{ color: "#C00000" }}>({s})</span> : <>{s}</>;
};
const day = (v: string | null | undefined) => (v ? v.split("-").reverse().join("/") : "—");
const sum = (...xs: Array<number | null | undefined>) => (xs.every((x) => x === null || x === undefined) ? null : xs.reduce<number>((t, x) => t + (x ?? 0), 0));

type Col = { h: string; w: number; left?: boolean; render: (r: ConsoRow) => React.ReactNode; tone?: string };

const STATUT: Record<string, { label: string; fg: string; bg: string }> = {
  REFERENCE_CLOSING: { label: "Fichier Closing", fg: "#1D4ED8", bg: "#E5EEFF" },
  PRET_A_CERTIFIER: { label: "Bilan OK", fg: "#12805C", bg: "#E4F7EC" },
  ESTIMATION_AVEC_RESERVE: { label: "Avec réserve", fg: "#C2660A", bg: "#FFF1DD" },
  VARIATION_CALCULEE: { label: "À contrôler", fg: "#B42323", bg: "#FDE8E8" },
  NON_CALCULABLE: { label: "Non calculable", fg: "#5B6B82", bg: "#EEF1F6" },
  CONSOMMATION_REELLE_CERTIFIEE: { label: "Certifié", fg: "#1D4ED8", bg: "#E5EEFF" },
};

const COLS: Col[] = [
  { h: "ID du site", w: 96, left: true, render: (r) => r.site_id },
  { h: "Nom du site", w: 170, left: true, render: (r) => r.site_name ?? "—" },
  { h: "Date de Relevé Initiale", w: 92, render: (r) => day(r.stock.date_initial) },
  { h: "Qtité laissée à la date du relevé (initiale)", w: 104, render: (r) => num(r.stock.initial_l) },
  { h: "Total Livraison", w: 92, tone: "#E2EFDA", render: (r) => num(sum(r.stock.livraisons_externes_l, r.stock.carte_total_l)) },
  { h: "Qté Rajoutée ou Retirée de la cuve", w: 100, render: (r) => num(sum(r.stock.rajouts_l, r.stock.ponctions_entrantes_l, r.stock.retraits_l === null ? null : -(r.stock.retraits_l ?? 0), r.stock.ponctions_sortantes_l === null ? null : -(r.stock.ponctions_sortantes_l ?? 0))) },
  { h: "Qté Volée", w: 80, tone: "#FCE4D6", render: (r) => num(r.stock.vols_l) },
  { h: "Qté vidangée / Fuite / Écart", w: 92, tone: "#FCE4D6", render: (r) => num(r.stock.vidanges_l) },
  { h: "Date de Relevé Finale", w: 92, render: (r) => day(r.stock.date_final) },
  { h: "Qtité laissée à la date du relevé (finale)", w: 104, render: (r) => num(r.stock.final_l) },
  { h: "Qtité cons considérée (L)", w: 104, tone: "#FFF2CC", render: (r) => <b>{num(r.stock.variation_l)}</b> },
  { h: "Nbre Jour cons", w: 70, render: (r) => num(r.stock.jours) },
  { h: "Conso Moyenne [L/jr]", w: 84, render: (r) => num(r.stock.conso_moyenne_jour_l, 2) },
  { h: "Conso théorique considérée [L] (CPH)", w: 110, render: (r) => num(r.cph.complete_l ?? r.cph.partielle_l) },
  { h: "Écart Conso Théorique Vs Conso Variation", w: 110, render: (r) => num((r.cph.complete_l ?? r.cph.partielle_l) === null || (r.cph.complete_l ?? r.cph.partielle_l) === undefined || r.stock.variation_l === null ? null : (r.cph.complete_l ?? r.cph.partielle_l)! - r.stock.variation_l) },
  { h: "Conso Closing / Ops (L)", w: 96, render: (r) => num(r.closing.conso_l) },
];

export function ClosingSiteTable({ rows, onDetail }: { rows: ConsoRow[]; onDetail: (r: ConsoRow) => void }) {
  const th: CSSProperties = { background: NAVY, color: "#fff", fontSize: 11, fontWeight: 700, padding: "8px 6px", border: "1px solid #8EA9DB", verticalAlign: "middle", textAlign: "center", lineHeight: 1.25, position: "sticky", top: 0, zIndex: 2 };
  const td: CSSProperties = { fontSize: 12, padding: "5px 6px", border: "1px solid #D9E1F2", textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
  const sticky = (i: number): CSSProperties => (i === 0 ? { position: "sticky", left: 0, zIndex: 1 } : i === 1 ? { position: "sticky", left: COLS[0].w, zIndex: 1 } : {});
  return (
    <div style={{ overflow: "auto", maxHeight: "72vh", border: `2px solid ${NAVY}` }} tabIndex={0} aria-label="Synthèse conso fuel par site">
      <table style={{ borderCollapse: "collapse", width: "max-content", minWidth: "100%" }}>
        <thead>
          <tr>
            {COLS.map((c, i) => <th key={c.h} scope="col" style={{ ...th, minWidth: c.w, maxWidth: c.w, ...(i < 2 ? { ...sticky(i), zIndex: 3 } : {}) }}>{c.h}</th>)}
            <th scope="col" style={{ ...th, minWidth: 110 }}>Statut</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            const bg = idx % 2 ? "#F2F6FC" : "#fff";
            const st = STATUT[r.stock.statut] ?? STATUT.NON_CALCULABLE;
            const out = r.correspondance && !r.correspondance.utilise;
            return (
              <tr key={r.site_id} style={{ background: bg, opacity: out ? 0.6 : 1 }} title={out ? r.correspondance?.motif ?? "" : r.stock.motif ?? ""}>
                {COLS.map((c, i) => (
                  <td key={c.h} style={{ ...td, background: c.tone && !out ? c.tone : bg, ...(c.left ? { textAlign: "left", maxWidth: c.w, overflow: "hidden", textOverflow: "ellipsis" } : {}), ...sticky(i) }}>
                    {i === 0 ? (
                      <button type="button" onClick={() => onDetail(r)} aria-label={`Voir le détail du site ${r.site_id}`}
                        style={{ border: "none", background: "none", padding: 0, fontWeight: 800, fontSize: 12, color: NAVY, cursor: "pointer", textDecoration: "underline dotted" }}>{r.site_id}</button>
                    ) : c.render(r)}
                  </td>
                ))}
                <td style={{ ...td, textAlign: "center" }}>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: st.bg, color: st.fg }}>{out ? "Hors périmètre" : st.label}</span>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && <tr><td colSpan={COLS.length + 1} style={{ ...td, textAlign: "left", padding: 20, color: "#5B6B82" }}>Aucun site ne correspond aux filtres pour cette période.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
