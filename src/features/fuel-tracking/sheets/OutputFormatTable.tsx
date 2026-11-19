// src/features/fuel-tracking/sheets/OutputFormatTable.tsx
// Tableau de Suivi Conso au format du fichier « Output App Fuel » : blocs INVENTAIRE, DONNÉES DE STOCK INITIAL et DONNÉES DE RAVITAILLEMENT.
// Toutes les valeurs du stock initial sont prises à la DATE EXACTE du relevé initial du fichier (aucune autre période).
import { Fragment, type CSSProperties, type ReactNode } from "react";
import type { ConsoRow } from "@/services/fuelTracking";

const NAVY = "#1F3864";
const GAP = 14;   // largeur (px) de l'espace entre deux blocs du tableau
const fr = (v: string | null | undefined) => (v ? v.split("-").reverse().join("/") : "—");
const num = (v: number | null | undefined, d = 0) => (v === null || v === undefined ? <span style={{ color: "#94A0B4" }}>n.d.</span>
  : v.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }));
const txt = (v: string | null | undefined) => (v ? v : <span style={{ color: "#94A0B4" }}>n.d.</span>);

type Col = { h: string; w: number; left?: boolean; render: (r: ConsoRow) => ReactNode };

const INVENTAIRE: Col[] = [
  { h: "Nom du site", w: 150, left: true, render: (r) => r.site_name ?? "—" },
  { h: "Région O&M", w: 110, render: (r) => txt(r.inventaire?.region) },
  { h: "Indoor / Outdoor", w: 90, render: (r) => txt(r.inventaire?.indoor_outdoor) },
  { h: "On GRID / Offgrid", w: 90, render: (r) => txt(r.inventaire?.on_grid) },
  { h: "Typologie Cible", w: 110, render: (r) => txt(r.inventaire?.typologie_cible) },
  { h: "Typologie Facturée", w: 110, render: (r) => txt(r.inventaire?.typologie_facturee) },
];
const STOCK_INITIAL: Col[] = [
  { h: "Date de Relevé Initiale", w: 95, render: (r) => fr(r.stock_initial_sources?.date) },
  { h: "Qtité laissée à la date initiale (relevé de terrain)", w: 115, render: (r) => num(r.stock_initial_sources?.terrain_l) },
  { h: "Qtité laissée à la date initiale (Société de gardiennage)", w: 115, render: (r) => num(r.stock_initial_sources?.gardiennage_l) },
  { h: "Qtité laissée à la date initiale (Fuel Sensor FMS)", w: 115, render: (r) => num(r.stock_initial_sources?.fms_l) },
  { h: "Qtité laissée retenue", w: 100, render: (r) => <b>{num(r.stock_initial_sources?.retenue_l)}</b> },
  { h: "Source de donnée de stock", w: 150, left: true, render: (r) => txt(r.stock_initial_sources?.source) },
  { h: "Relevé Visuel Compteur genset (relevé de terrain)", w: 115, render: (r) => num(r.stock_initial_sources?.compteur_terrain_h, 2) },
  { h: "Relevé Visuel Compteur genset (Société de gardiennage)", w: 115, render: (r) => num(r.stock_initial_sources?.compteur_gardiennage_h, 2) },
  { h: "Relevé Visuel Compteur genset (Index Compteur FMS)", w: 115, render: (r) => num(r.stock_initial_sources?.compteur_fms_h, 2) },
  { h: "Relevé Compteur genset retenu", w: 105, render: (r) => <b>{num(r.stock_initial_sources?.compteur_retenu_h, 2)}</b> },
  { h: "Source de donnée index compteur", w: 150, left: true, render: (r) => txt(r.stock_initial_sources?.source_compteur) },
];
// Bloc stock final : à la Date de Relevé Finale du fichier ; retenu = FMS, sinon Société de gardiennage, sinon relevé de terrain
const STOCK_FINAL: Col[] = [
  { h: "Date de Relevé Finale", w: 95, render: (r) => (r.ravitaillement?.date_finale_fichier
    ? <span title="Date lue dans la ligne du fichier de clôture (Closing / Output App Fuel)">{fr(r.ravitaillement.date_finale_fichier)}</span>
    : <span style={{ color: "#94A0B4" }} title="Absente du fichier de clôture">n.d.</span>) },
  { h: "Qtité laissée à la date finale (relevé de terrain)", w: 115, render: (r) => num(r.stock_final_sources?.terrain_l) },
  { h: "Qtité laissée à la date finale (Société de gardiennage)", w: 115, render: (r) => num(r.stock_final_sources?.gardiennage_l) },
  { h: "Qtité laissée à la date finale (Fuel Sensor FMS)", w: 115, render: (r) => num(r.stock_final_sources?.fms_l) },
  { h: "Qtité laissée retenue", w: 100, render: (r) => <b>{num(r.stock_final_sources?.retenue_l)}</b> },
  { h: "Source de donnée de stock", w: 150, left: true, render: (r) => txt(r.stock_final_sources?.source) },
  { h: "Relevé Visuel Compteur genset (relevé de terrain)", w: 115, render: (r) => num(r.stock_final_sources?.compteur_terrain_h, 2) },
  { h: "Relevé Visuel Compteur genset (Société de gardiennage)", w: 115, render: (r) => num(r.stock_final_sources?.compteur_gardiennage_h, 2) },
  { h: "Relevé Visuel Compteur genset (Index Compteur FMS)", w: 115, render: (r) => num(r.stock_final_sources?.compteur_fms_h, 2) },
  { h: "Relevé Compteur genset retenu", w: 105, render: (r) => <b>{num(r.stock_final_sources?.compteur_retenu_h, 2)}</b> },
  { h: "Source de donnée index compteur", w: 150, left: true, render: (r) => txt(r.stock_final_sources?.source_compteur) },
];
// Fabricant / type de GE, champ par champ : Snowflake (SITE_DG, puis son historique), sinon ENOC ; source affichée ; plusieurs GE séparés par « / »
// Puissance PRP : GENSET DB du fichier de clôture (type de GE exact) ; plusieurs GE séparés par « / » ; raison au survol si absente
const prp = (r: ConsoRow, v: number[] | null | undefined) => (v && v.length
  ? <span title={r.estimation_theorique?.prp_source ?? undefined}>{v.map((x) => x.toLocaleString("fr-FR", { maximumFractionDigits: 2 })).join(" / ")}</span>
  : <span style={{ color: "#94A0B4" }} title={r.estimation_theorique?.prp_motif ?? "Type de GE inconnu"}>n.d.</span>);
const ESTIMATION_THEORIQUE: Col[] = [
  { h: "Fabriquant GE", w: 130, left: true, render: (r) => txt(r.estimation_theorique?.fabricant_ge) },
  { h: "Type de GE", w: 120, left: true, render: (r) => txt(r.estimation_theorique?.type_ge) },
  { h: "Source de donnée GE", w: 170, left: true, render: (r) => txt(r.estimation_theorique?.source_ge) },
  { h: "Puissance PRP (KVA)", w: 95, render: (r) => prp(r, r.estimation_theorique?.prp_kva) },
  { h: "Puissance PRP (KW)", w: 95, render: (r) => prp(r, r.estimation_theorique?.prp_kw) },
];
// 6 totaux lus dans ENOC sur la plage de dates de la ligne du fichier du site (Date de Relevé Initiale → Date de Relevé Finale)
const periodeEnoc = (r: ConsoRow) => (r.ravitaillement?.debut && r.ravitaillement?.fin
  ? `ENOC, du ${fr(r.ravitaillement.debut)} au ${fr(r.ravitaillement.fin)} (${r.ravitaillement.nb_mouvements_enoc ?? 0} mouvement(s) sur le site)`
  : "Pas de dates de relevé dans le fichier pour ce site : non calculé");
const enoc = (v: (r: ConsoRow) => number | null | undefined) => (r: ConsoRow) => <span title={periodeEnoc(r)}>{num(v(r))}</span>;
const RAVITAILLEMENT: Col[] = [
  { h: "Total Livraison Fuel EYDON", w: 105, render: enoc((r) => r.ravitaillement?.eydon_l) },
  { h: "Total Livraison Fuel CARTE TOTAL", w: 105, render: enoc((r) => r.ravitaillement?.carte_total_l) },
  { h: "Total Ajout", w: 90, render: enoc((r) => r.ravitaillement?.ajout_l) },
  { h: "Total Retrait", w: 90, render: enoc((r) => r.ravitaillement?.retrait_l) },
  { h: "Total QTE volée déclarée", w: 100, render: enoc((r) => r.ravitaillement?.vole_l) },
  { h: "Total QTE vidangée / Fuite / Ecart de Stock", w: 120, render: enoc((r) => r.ravitaillement?.fuite_l) },
];

export function OutputFormatTable({ rows, onDetail }: { rows: ConsoRow[]; onDetail: (r: ConsoRow) => void }) {
  const th: CSSProperties = { background: NAVY, color: "#fff", fontSize: 11, fontWeight: 700, padding: "8px 6px", border: "1px solid #8EA9DB", textAlign: "center",
    verticalAlign: "middle", lineHeight: 1.25, position: "sticky", top: 30, zIndex: 2 };
  const group: CSSProperties = { background: "#fff", color: "#000", fontSize: 12.5, fontWeight: 800, padding: "6px", border: "2px solid #000", textAlign: "center",
    position: "sticky", top: 0, zIndex: 3, height: 30 };
  const td: CSSProperties = { fontSize: 12, padding: "5px 6px", border: "1px solid #D9E1F2", textAlign: "center", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
  const groups: Array<{ name: string; cols: Col[] }> = [
    { name: "INVENTAIRE", cols: INVENTAIRE }, { name: "DONNEES DE STOCK INITIAL", cols: STOCK_INITIAL },
    { name: "DONNEES DE RAVITAILLEMENT", cols: RAVITAILLEMENT }, { name: "DONNEES DE STOCK FINAL", cols: STOCK_FINAL },
    { name: "ESTIMATION CONSOMMATION FUEL THEORIQUE", cols: ESTIMATION_THEORIQUE },
  ];
  const all = groups.flatMap((g) => g.cols);
  // Colonne vide entre deux blocs : séparation visuelle nette (aucune donnée, ignorée par les lecteurs d'écran)
  const gap: CSSProperties = { width: GAP, minWidth: GAP, maxWidth: GAP, padding: 0, border: "none", background: "#fff" };
  const spacer = (k: string, sticky?: CSSProperties) => <td key={k} aria-hidden style={{ ...gap, ...sticky }} />;
  return (
    <div style={{ overflow: "auto", maxHeight: "72vh" }} tabIndex={0} aria-label="Tableau des sites au format du fichier Output App Fuel">
      <table style={{ borderCollapse: "collapse", width: "max-content", minWidth: "100%" }}>
        <thead>
          <tr>
            <th style={{ ...group, position: "sticky", left: 0, zIndex: 5 }} />
            {groups.map((g) => (
              <Fragment key={g.name}>
                <th aria-hidden style={{ ...gap, position: "sticky", top: 0, zIndex: 3 }} />
                <th colSpan={g.cols.length} style={group}>{g.name}</th>
              </Fragment>
            ))}
          </tr>
          <tr>
            <th style={{ ...th, minWidth: 95, position: "sticky", left: 0, zIndex: 4 }}>ID du site</th>
            {groups.map((g) => (
              <Fragment key={g.name}>
                <th aria-hidden style={{ ...gap, position: "sticky", top: 30, zIndex: 2 }} />
                {g.cols.map((c) => <th key={c.h} scope="col" style={{ ...th, minWidth: c.w, maxWidth: c.w }}>{c.h}</th>)}
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const bg = i % 2 ? "#F2F6FC" : "#fff";
            return (
              <tr key={r.site_id} style={{ background: bg }}>
                <td style={{ ...td, background: bg, position: "sticky", left: 0, zIndex: 1 }}>
                  <button type="button" onClick={() => onDetail(r)} aria-label={`Voir le détail du site ${r.site_id}`} title="Voir le détail"
                    style={{ border: "none", background: "none", padding: 0, fontWeight: 800, fontSize: 12, color: NAVY, cursor: "pointer", textDecoration: "underline dotted" }}>{r.site_id}</button>
                </td>
                {groups.map((g) => (
                  <Fragment key={g.name}>
                    {spacer(`gap-${g.name}`)}
                    {g.cols.map((c) => <td key={c.h} style={{ ...td, ...(c.left ? { textAlign: "left" } : {}) }}>{c.render(r)}</td>)}
                  </Fragment>
                ))}
              </tr>
            );
          })}
          {rows.length === 0 && <tr><td colSpan={all.length + groups.length + 1} style={{ ...td, textAlign: "left", padding: 20 }}>Aucun site ne correspond aux filtres pour cette période.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
