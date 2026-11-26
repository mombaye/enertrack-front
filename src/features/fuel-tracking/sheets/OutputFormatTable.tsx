// src/features/fuel-tracking/sheets/OutputFormatTable.tsx
// Tableau de Suivi Conso au format du fichier « Output App Fuel » : blocs INVENTAIRE, DONNÉES DE STOCK INITIAL et DONNÉES DE RAVITAILLEMENT.
// Toutes les valeurs du stock initial sont prises à la DATE EXACTE du relevé initial du fichier (aucune autre période).
import { Fragment, useState, type CSSProperties, type ReactNode } from "react";
import type { ConsoRow } from "@/services/fuelTracking";
import { ColumnFilterMenu, type ColValue } from "./ColumnFilterMenu";

const NAVY = "#1F3864";
const GAP = 14;
const TOT_H = 26;   // hauteur de la ligne de totaux (en tête, figée au défilement)   // largeur (px) de l'espace entre deux blocs du tableau
const fr = (v: string | null | undefined) => (v ? v.split("-").reverse().join("/") : "—");
const num = (v: number | null | undefined, d = 0) => (v === null || v === undefined ? <span style={{ color: "#94A0B4" }}>n.d.</span>
  : v.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }));
const txt = (v: string | null | undefined) => (v ? v : <span style={{ color: "#94A0B4" }}>n.d.</span>);

type Col = { h: string; w: number; f?: string; left?: boolean; tot?: [string, string]; render: (r: ConsoRow) => ReactNode };
export type ColFilters = Record<string, string[]>;
type ColFilterProps = { colFilters?: ColFilters; onColFilter?: (key: string, values: string[] | null) => void; loadValues?: (key: string) => Promise<ColValue[]> };
export type ConsoTotaux = Record<string, Record<string, { total: number | null; sites: number; comptage?: boolean; oui?: boolean; valeur?: string }>> | null | undefined;

const INVENTAIRE: Col[] = [
  { h: "Nom du site", w: 150, f: "site_name", left: true, render: (r) => r.site_name ?? "—" },
  { h: "Région O&M", w: 110, f: "inventaire.region", render: (r) => txt(r.inventaire?.region) },
  { h: "Indoor / Outdoor", w: 90, f: "inventaire.indoor_outdoor", render: (r) => txt(r.inventaire?.indoor_outdoor) },
  { h: "On GRID / Offgrid", w: 90, f: "inventaire.on_grid", render: (r) => txt(r.inventaire?.on_grid) },
  { h: "Typologie Cible", w: 110, f: "inventaire.typologie_cible", render: (r) => txt(r.inventaire?.typologie_cible) },
  { h: "Typologie Facturée", w: 110, f: "inventaire.typologie_facturee", render: (r) => txt(r.inventaire?.typologie_facturee) },
];
const STOCK_INITIAL: Col[] = [
  { h: "Date de Relevé Initiale", w: 95, f: "stock_initial_sources.date", render: (r) => fr(r.stock_initial_sources?.date) },
  { h: "Qtité laissée à la date initiale (relevé de terrain)", w: 115, f: "stock_initial_sources.terrain_l", tot: ["stock_initial_sources", "terrain_l"], render: (r) => num(r.stock_initial_sources?.terrain_l) },
  { h: "Qtité laissée à la date initiale (Société de gardiennage)", w: 115, f: "stock_initial_sources.gardiennage_l", tot: ["stock_initial_sources", "gardiennage_l"], render: (r) => num(r.stock_initial_sources?.gardiennage_l) },
  { h: "Qtité laissée à la date initiale (Fuel Sensor FMS)", w: 115, f: "stock_initial_sources.fms_l", tot: ["stock_initial_sources", "fms_l"], render: (r) => num(r.stock_initial_sources?.fms_l) },
  { h: "Qtité laissée retenue", w: 100, f: "stock_initial_sources.retenue_l", tot: ["stock_initial_sources", "retenue_l"], render: (r) => <b>{num(r.stock_initial_sources?.retenue_l)}</b> },
  { h: "Source de donnée de stock", w: 150, f: "stock_initial_sources.source", left: true, render: (r) => txt(r.stock_initial_sources?.source) },
  { h: "Relevé Visuel Compteur genset (relevé de terrain)", w: 115, f: "stock_initial_sources.compteur_terrain_h", tot: ["stock_initial_sources", "compteur_terrain_h"], render: (r) => num(r.stock_initial_sources?.compteur_terrain_h, 2) },
  { h: "Relevé Visuel Compteur genset (Société de gardiennage)", w: 115, f: "stock_initial_sources.compteur_gardiennage_h", tot: ["stock_initial_sources", "compteur_gardiennage_h"], render: (r) => num(r.stock_initial_sources?.compteur_gardiennage_h, 2) },
  { h: "Relevé Visuel Compteur genset (Index Compteur FMS)", w: 115, f: "stock_initial_sources.compteur_fms_h", tot: ["stock_initial_sources", "compteur_fms_h"], render: (r) => num(r.stock_initial_sources?.compteur_fms_h, 2) },
  { h: "Relevé Compteur genset retenu", w: 105, f: "stock_initial_sources.compteur_retenu_h", tot: ["stock_initial_sources", "compteur_retenu_h"], render: (r) => <b>{num(r.stock_initial_sources?.compteur_retenu_h, 2)}</b> },
  { h: "Source de donnée index compteur", w: 150, f: "stock_initial_sources.source_compteur", left: true, render: (r) => txt(r.stock_initial_sources?.source_compteur) },
];
// Bloc stock final : à la Date de Relevé Finale du fichier ; retenu = FMS, sinon Société de gardiennage, sinon relevé de terrain
const STOCK_FINAL: Col[] = [
  { h: "Date de Relevé Finale", w: 95, f: "ravitaillement.date_finale_fichier", render: (r) => (r.ravitaillement?.date_finale_fichier
    ? <span title="Date lue dans la ligne du fichier de clôture (Closing / Output App Fuel)">{fr(r.ravitaillement.date_finale_fichier)}</span>
    : <span style={{ color: "#94A0B4" }} title="Absente du fichier de clôture">n.d.</span>) },
  { h: "Qtité laissée à la date finale (relevé de terrain)", w: 115, f: "stock_final_sources.terrain_l", tot: ["stock_final_sources", "terrain_l"], render: (r) => num(r.stock_final_sources?.terrain_l) },
  { h: "Qtité laissée à la date finale (Société de gardiennage)", w: 115, f: "stock_final_sources.gardiennage_l", tot: ["stock_final_sources", "gardiennage_l"], render: (r) => num(r.stock_final_sources?.gardiennage_l) },
  { h: "Qtité laissée à la date finale (Fuel Sensor FMS)", w: 115, f: "stock_final_sources.fms_l", tot: ["stock_final_sources", "fms_l"], render: (r) => num(r.stock_final_sources?.fms_l) },
  { h: "Qtité laissée retenue", w: 100, f: "stock_final_sources.retenue_l", tot: ["stock_final_sources", "retenue_l"], render: (r) => <b>{num(r.stock_final_sources?.retenue_l)}</b> },
  { h: "Source de donnée de stock", w: 150, f: "stock_final_sources.source", left: true, render: (r) => txt(r.stock_final_sources?.source) },
  { h: "Relevé Visuel Compteur genset (relevé de terrain)", w: 115, f: "stock_final_sources.compteur_terrain_h", tot: ["stock_final_sources", "compteur_terrain_h"], render: (r) => num(r.stock_final_sources?.compteur_terrain_h, 2) },
  { h: "Relevé Visuel Compteur genset (Société de gardiennage)", w: 115, f: "stock_final_sources.compteur_gardiennage_h", tot: ["stock_final_sources", "compteur_gardiennage_h"], render: (r) => num(r.stock_final_sources?.compteur_gardiennage_h, 2) },
  { h: "Relevé Visuel Compteur genset (Index Compteur FMS)", w: 115, f: "stock_final_sources.compteur_fms_h", tot: ["stock_final_sources", "compteur_fms_h"], render: (r) => num(r.stock_final_sources?.compteur_fms_h, 2) },
  { h: "Relevé Compteur genset retenu", w: 105, f: "stock_final_sources.compteur_retenu_h", tot: ["stock_final_sources", "compteur_retenu_h"], render: (r) => <b>{num(r.stock_final_sources?.compteur_retenu_h, 2)}</b> },
  { h: "Source de donnée index compteur", w: 150, f: "stock_final_sources.source_compteur", left: true, render: (r) => txt(r.stock_final_sources?.source_compteur) },
];
// Fabricant et type de GE : fichier Base GE (Configuration) d'abord — fabricant lu dans le libellé « Type de GE » — puis Snowflake / ENOC ; source affichée ; plusieurs GE séparés par « / »
// Puissance PRP : GENSET DB du fichier de clôture (type de GE exact) ; plusieurs GE séparés par « / » ; raison au survol si absente
const prp = (r: ConsoRow, v: number[] | null | undefined) => (v && v.length
  ? <span title={r.estimation_theorique?.prp_source ?? undefined}>{v.map((x) => x.toLocaleString("fr-FR", { maximumFractionDigits: 2 })).join(" / ")}</span>
  : <span style={{ color: "#94A0B4" }} title={r.estimation_theorique?.prp_motif ?? "Type de GE inconnu"}>n.d.</span>);
// Temps de marche GE (h) sur la plage du fichier ; au survol : source et jours renseignés / jours de la période
const heures = (v: number | null | undefined, tip: string) => (v === null || v === undefined
  ? <span style={{ color: "#94A0B4" }} title={tip}>n.d.</span>
  : <span title={tip}>{v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>);
const joursTip = (r: ConsoRow, n: number | null | undefined, src: string) =>
  `${src} — ${n ?? 0} jour(s) renseigné(s) sur ${r.estimation_theorique?.tm_jours_periode ?? "?"} (lendemain de la date initiale → date finale)`;
// Puissance (kW) : n.d. si non mesurée (jamais 0 par défaut), source / raison au survol
const kw = (v: number | null | undefined, tip: string) => (v === null || v === undefined
  ? <span style={{ color: "#94A0B4" }} title={tip}>n.d.</span>
  : <span title={tip}>{v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>);
// Min / max d'une puissance : mêmes valeurs journalières que la médiane ; n.d. quand la médiane l'est (jamais 0)
type MinMax = "p_rect" | "p_ge" | "p_grid";
const SOURCE_MM: Record<MinMax, string> = {
  p_rect: "jours qualifiés (≥ 50 % de disponibilité), sinon mesures valides de la période (RECTIFIER_EFFICIENCY_STATUS)",
  p_ge: "jours de marche (production GE ÷ heures de marche, GENSET_REPORT) ; jour au-delà de 105 % × kVA × 0,8 écarté",
  p_grid: "puissances AC journalières (compteur AC, Snowflake), mesures > 0",
};
const mm = (p: MinMax, which: "min" | "max", label: string): Col => ({
  h: `Puissance ${which} mesurée ${label} (kW)`, w: 105, f: `estimation_theorique.${p}_${which}_kw`,
  render: (r) => {
    const e = r.estimation_theorique as Record<string, unknown> | undefined;
    const v = e?.[`${p}_${which}_kw`] as number | null | undefined;
    return kw(v, v == null ? ((e?.[`${p}_motif`] as string | null | undefined) ?? "Aucune mesure sur la période")
      : `${which === "min" ? "Plus petite" : "Plus grande"} des valeurs qui servent à la médiane : ${SOURCE_MM[p]}`);
  },
});
const ESTIMATION_THEORIQUE: Col[] = [
  { h: "Fabriquant GE", w: 130, f: "estimation_theorique.fabricant_ge", left: true, tot: ["estimation_theorique", "fabricant_ge"], render: (r) => txt(r.estimation_theorique?.fabricant_ge) },
  { h: "Type de GE", w: 130, f: "estimation_theorique.type_ge", left: true, tot: ["estimation_theorique", "type_ge"], render: (r) => txt(r.estimation_theorique?.type_ge) },
  { h: "Source de donnée GE", w: 170, f: "estimation_theorique.source_ge", left: true, tot: ["estimation_theorique", "source_ge"], render: (r) => txt(r.estimation_theorique?.source_ge) },
  { h: "Puissance PRP (KVA)", w: 95, f: "estimation_theorique.prp_kva", tot: ["estimation_theorique", "prp_kva"], render: (r) => prp(r, r.estimation_theorique?.prp_kva) },
  { h: "Puissance PRP (KW)", w: 95, f: "estimation_theorique.prp_kw", tot: ["estimation_theorique", "prp_kw"], render: (r) => prp(r, r.estimation_theorique?.prp_kw) },
  { h: "Temps de marche GE (Alarme day_dg_on FMS)", w: 115, f: "estimation_theorique.tm_dg_on_h", tot: ["estimation_theorique", "tm_dg_on_h"], render: (r) => heures(r.estimation_theorique?.tm_dg_on_h,
    joursTip(r, r.estimation_theorique?.tm_dg_on_jours, "Snowflake GENSET_REPORT (Day DG On)")) },
  { h: "Temps de marche GE (Alarme day_rectifier_on FMS)", w: 115, f: "estimation_theorique.tm_rectifier_h", tot: ["estimation_theorique", "tm_rectifier_h"], render: (r) => heures(r.estimation_theorique?.tm_rectifier_h,
    r.estimation_theorique?.tm_rectifier_motif ?? `${joursTip(r, r.estimation_theorique?.tm_rectifier_jours, "Snowflake RECTIFIER_EFFICIENCY_STATUS : créneaux 5 min Good / Aged / Warning")} — disponibilité ${r.estimation_theorique?.tm_rectifier_dispo_pct ?? "n.d."} %${r.estimation_theorique?.tm_rectifier_off_grid === true ? "" : r.estimation_theorique?.tm_rectifier_off_grid === false ? " — site raccordé au réseau : heures réseau + GE, non retenues comme temps de marche GE" : " — type de raccordement inconnu : non retenues comme temps de marche GE"}`) },
  { h: "Temps de marche GE (relevé de terrain)", w: 115, f: "estimation_theorique.tm_terrain_h", tot: ["estimation_theorique", "tm_terrain_h"], render: (r) => heures(r.estimation_theorique?.tm_terrain_h,
    r.estimation_theorique?.tm_terrain_motif ?? "Relevé Visuel Compteur genset (relevé de terrain) : relevé final − relevé initial") },
  { h: "Temps de marche GE (Index Compteur FMS)", w: 115, f: "estimation_theorique.tm_index_fms_h", tot: ["estimation_theorique", "tm_index_fms_h"], render: (r) => heures(r.estimation_theorique?.tm_index_fms_h,
    r.estimation_theorique?.tm_index_fms_motif ?? "Relevé Visuel Compteur genset (Index Compteur FMS) : relevé final − relevé initial") },
  { h: "Temps de marche GE retenu", w: 105, f: "estimation_theorique.tm_retenu_h", tot: ["estimation_theorique", "tm_retenu_h"], render: (r) => <b>{heures(r.estimation_theorique?.tm_retenu_h,
    r.estimation_theorique?.tm_source ? `Retenu : ${r.estimation_theorique.tm_source}` : "Aucune source de temps de marche pour ce site")}</b> },
  { h: "Source de donnée Temps de marche GE", w: 160, f: "estimation_theorique.tm_source", left: true, tot: ["estimation_theorique", "tm_source"], render: (r) => (r.estimation_theorique?.tm_source
    ? <span title="Ordre : Index Compteur FMS → relevé de terrain → Alarme day_dg_on FMS → Alarme day_rectifier_on FMS">{r.estimation_theorique.tm_source}</span>
    : txt(null)) },
  mm("p_rect", "min", "redresseur"),
  { h: "Puissance médiane mesurée redresseur (kW)", w: 115, f: "estimation_theorique.p_rect_kw", tot: ["estimation_theorique", "p_rect_kw"], render: (r) => kw(r.estimation_theorique?.p_rect_kw,
    [`P_DC ÷ rendement (RECTIFIER_EFFICIENCY_STATUS) — source : ${r.estimation_theorique?.p_rect_source ?? "PUISSANCE_REDRESSEUR_INDISPONIBLE"}`,
     `${r.estimation_theorique?.p_rect_jours ?? 0} jour(s) qualifié(s) (≥ 50 % de disponibilité)`,
     r.estimation_theorique?.p_rect_dispo_pct != null ? `disponibilité période ${r.estimation_theorique.p_rect_dispo_pct.toLocaleString("fr-FR")} %` : null,
     r.estimation_theorique?.p_rect_motif ?? null].filter(Boolean).join(" ; ")) },
  mm("p_rect", "max", "redresseur"),
  mm("p_ge", "min", "générateur"),
  { h: "Puissance médiane mesurée générateur (kW)", w: 115, f: "estimation_theorique.p_ge_kw", tot: ["estimation_theorique", "p_ge_kw"], render: (r) => kw(r.estimation_theorique?.p_ge_kw,
    r.estimation_theorique?.p_ge_motif ?? `Médiane de la production GE ÷ heures de marche (GENSET_REPORT, Snowflake) — ${r.estimation_theorique?.p_ge_jours ?? 0} jour(s) de marche ; jour au-delà de 105 % × kVA × 0,8 écarté`) },
  mm("p_ge", "max", "générateur"),
  mm("p_grid", "min", "Grid"),
  { h: "Puissance Grid médiane mesurée (kW)", w: 115, f: "estimation_theorique.p_grid_kw", tot: ["estimation_theorique", "p_grid_kw"], render: (r) => kw(r.estimation_theorique?.p_grid_kw,
    `Médiane des puissances AC journalières (compteur AC, Snowflake) — ${r.estimation_theorique?.p_grid_jours ?? 0} jour(s) mesuré(s)`) },
  mm("p_grid", "max", "Grid"),
  { h: "Puissance Médiane Load DC telco (kW)", w: 115, f: "estimation_theorique.p_load_dc_kw", tot: ["estimation_theorique", "p_load_dc_kw"], render: (r) => kw(r.estimation_theorique?.p_load_dc_kw,
    r.estimation_theorique?.p_load_dc_motif ?? `Médiane du load DC telco journalier (AVERAGE_LOAD, Snowflake) — ${r.estimation_theorique?.p_load_dc_jours ?? 0} jour(s) mesuré(s)`) },
  { h: "Puissance Médiane Recharge batterie (kW)", w: 115, f: "estimation_theorique.p_batt_kw", tot: ["estimation_theorique", "p_batt_kw"], render: (r) => {
    const e = r.estimation_theorique;
    const tip = [`Médiane des médianes journalières de l'équipe data (BATTERY_REPORT : courant × tension ÷ 1000, mesures en charge), jours ≥ 50 % de télémétrie — source : ${e?.p_batt_source ?? "BATTERY_CHARGE_TELEMETRY_UNAVAILABLE"}`,
      e?.p_batt_pos != null ? `${e.p_batt_pos} pas en charge` : null,
      e?.p_batt_current_a != null ? `courant médian ${e.p_batt_current_a.toLocaleString("fr-FR")} A` : null,
      e?.p_batt_voltage_v != null ? `tension médiane ${e.p_batt_voltage_v.toLocaleString("fr-FR")} V` : null,
      e?.p_batt_dispo_pct != null ? `disponibilité télémétrie ${e.p_batt_dispo_pct.toLocaleString("fr-FR")} %` : null,
      e?.p_batt_reserve ?? null, e?.p_batt_motif ?? null].filter(Boolean).join(" ; ");
    return e?.p_batt_kw != null && e.p_batt_reserve
      ? <span title={tip} style={{ color: "#B7791F" }}>{e.p_batt_kw.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 3 })} *</span>
      : kw(e?.p_batt_kw, tip);
  } },
  { h: "Puissance retenue (kW)", w: 110, f: "estimation_theorique.p_retenue_kw", tot: ["estimation_theorique", "p_retenue_kw"], render: (r) => {
    const e = r.estimation_theorique;
    const tip = [e?.p_retenue_source ? `Source : ${SELECTION_LABEL[e.p_retenue_source] ?? e.p_retenue_source}` : null,
      "Règle : maximum entre puissance médiane GE et puissance médiane redresseur ; sinon Load DC telco + Recharge batterie",
      e?.p_retenue_motif ?? null].filter(Boolean).join(" ; ");
    return e?.p_retenue_kw != null && e.p_retenue_reserve
      ? <span title={tip} style={{ color: "#B7791F" }}>{e.p_retenue_kw.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} *</span>
      : <b>{kw(e?.p_retenue_kw, tip)}</b>;
  } },
  { h: "Source de donnée Puissance retenue", w: 170, f: "estimation_theorique.p_retenue_source", left: true, tot: ["estimation_theorique", "p_retenue_source"], render: (r) => {
    const e = r.estimation_theorique;
    const src = e?.p_retenue_source;
    if (!src) return <span style={{ color: "#94A0B4" }} title={e?.p_retenue_motif ?? "Puissance retenue n.d."}>n.d.</span>;
    const tip = [SELECTION_ORIGINE[src] ?? null,
      "Ordre : maximum entre Puissance médiane générateur et Puissance médiane redresseur ; sinon Load DC telco + Recharge batterie",
      e?.p_retenue_motif ?? null].filter(Boolean).join(" ; ");
    return <span title={tip} style={e?.p_retenue_reserve ? { color: "#B7791F" } : undefined}>
      {SELECTION_SOURCE[src] ?? src}{e?.p_retenue_reserve ? " *" : ""}</span>;
  } },
  { h: "Taux de charge GE (%)", w: 95, f: "estimation_theorique.taux_charge", render: (r) => {
    const e = r.estimation_theorique;
    const tip = e?.taux_charge_motif ?? "Puissance retenue ÷ Puissance PRP (kW) du GE";
    return e?.taux_charge == null ? <span style={{ color: "#94A0B4" }} title={tip}>n.d.</span>
      : <span title={tip}>{(e.taux_charge * 100).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %</span>;
  } },
  { h: "CPH théorique (L/h)", w: 95, f: "estimation_theorique.cph_l_h", render: (r) => {
    const e = r.estimation_theorique;
    const tip = e?.cph_a != null
      ? `CPH = a·x² + b·x + c (x = taux de charge) avec a = ${e.cph_a}, b = ${e.cph_b}, c = ${e.cph_c} (GENSET DB, type ${e.type_ge ?? "?"})${e.cph_extrapolation ? " ; charge < 50 % : extrapolation de la courbe" : ""}`
      : (e?.conso_theorique_motif ?? "Courbe GENSET DB non disponible");
    return e?.cph_l_h != null && e.cph_extrapolation
      ? <span title={tip} style={{ color: "#B7791F" }}>{e.cph_l_h.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} *</span>
      : kw(e?.cph_l_h, tip);
  } },
  { h: "Consommation théorique (L)", w: 110, f: "estimation_theorique.conso_theorique_l", tot: ["estimation_theorique", "conso_theorique_l"], render: (r) => {
    const e = r.estimation_theorique;
    const tip = e?.conso_theorique_motif ?? "CPH théorique × Temps de marche GE retenu";
    return e?.conso_theorique_l != null && e.cph_extrapolation
      ? <span title={tip} style={{ color: "#B7791F" }}>{e.conso_theorique_l.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} *</span>
      : <b>{kw(e?.conso_theorique_l, tip)}</b>;
  } },
  { h: "Consommation Snowflake fuel sensor (L)", w: 120, f: "estimation_theorique.conso_fuel_sensor_l", tot: ["estimation_theorique", "conso_fuel_sensor_l"], render: (r) => {
    const e = r.estimation_theorique;
    const tip = [`Somme des consommations mesurées du jour (VW_FUEL_REPORT, filtre strict) — ${e?.conso_fuel_sensor_jours ?? 0} jour(s) mesuré(s) sur ${e?.conso_fuel_sensor_jours_periode ?? "?"}`,
      e?.conso_fuel_sensor_motif ?? null].filter(Boolean).join(" ; ");
    return e?.conso_fuel_sensor_l != null && e.conso_fuel_sensor_reserve
      ? <span title={tip} style={{ color: "#B7791F" }}>{e.conso_fuel_sensor_l.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} *</span>
      : kw(e?.conso_fuel_sensor_l, tip);
  } },
  { h: "Source de donnée Estimation Conso Fuel théorique", w: 170, f: "estimation_theorique.conso_retenue_source", left: true, render: (r) => {
    const e = r.estimation_theorique;
    return e?.conso_retenue_source
      ? <span title="CPH théorique (L/h) × Temps de marche GE retenu">{e.conso_retenue_source}</span>
      : <span style={{ color: "#94A0B4" }} title={e?.conso_retenue_motif ?? "Consommation théorique n.d."}>n.d.</span>;
  } },
];
// Bloc « ANALYSE VARIATION DE STOCK Vs ESTIMATION THÉORIQUE » : règles du fichier Output App Fuel d'Ops ; n.d. avec sa raison au survol
// Valeur négative (variation de stock, DELTA) : même signalement que le bloc Conso théorique (ocre + « * »), explication au survol
const NEG_VAR = "le stock final et les sorties dépassent le stock initial et les entrées : mouvement manquant ou relevé de stock erroné à vérifier";
const NEG_DELTA = "la variation de stock observée dépasse la consommation théorique : stock initial / final ou mouvement à vérifier";
const litres = (v: number | null | undefined, tip: string, bold = false, neg?: string) => (v === null || v === undefined
  ? <span style={{ color: "#94A0B4" }} title={tip}>n.d.</span>
  : v < 0 ? <span title={`Valeur négative${neg ? ` : ${neg}` : ""} — ${tip}`} style={{ color: "#B7791F", fontWeight: bold ? 700 : undefined }}>
      {v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} *</span>
  : <span title={tip} style={bold ? { fontWeight: 700 } : undefined}>{v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>);
const VAR_FORMULE = "Qtité laissée retenue (initiale) + EYDON + CARTE TOTAL + Ajout − Retrait − QTE volée − QTE vidangée / Fuite − Qtité laissée retenue (finale)";
const ANALYSE_VARIATION: Col[] = [
  { h: "Estimation Conso Fuel Théorique retenue  (L)", w: 120, f: "analyse_variation.conso_theorique_retenue_l", tot: ["analyse_variation", "conso_theorique_retenue_l"],
    render: (r) => litres(r.analyse_variation?.conso_theorique_retenue_l, r.analyse_variation?.conso_theorique_motif ?? "CPH théorique × Temps de marche GE retenu") },
  { h: "Variation de stock Fuel considéréé  (L)", w: 120, f: "analyse_variation.variation_l", tot: ["analyse_variation", "variation_l"],
    render: (r) => litres(r.analyse_variation?.variation_l, r.analyse_variation?.variation_motif ?? VAR_FORMULE, false, NEG_VAR) },
  { h: "Analysis #3: Grande différence entre la Conso observée et à la  Conso Théorique  ?", w: 150, f: "analyse_variation.grande_difference",
    tot: ["analyse_variation", "grande_difference"], render: (r) => {
      const a = r.analyse_variation;
      if (!a?.grande_difference) return <span style={{ color: "#94A0B4" }} title={a?.motif ?? "DELTA non calculable"}>n.d.</span>;
      const oui = a.grande_difference === "Oui";
      return <span title={`« Oui » si l'écart entre conso théorique et variation de stock dépasse ${a.seuil_l} L (dans un sens ou dans l'autre)`}
        style={{ fontWeight: 800, color: oui ? "#B42318" : "#1E7B3C" }}>{a.grande_difference}</span>;
    } },
  { h: "DELTA (Conso Théorique Vs Conso Observée)", w: 120, f: "analyse_variation.delta_l", tot: ["analyse_variation", "delta_l"],
    render: (r) => litres(r.analyse_variation?.delta_l, r.analyse_variation?.motif ?? "Estimation Conso Fuel Théorique retenue − Variation de stock Fuel considérée", true, NEG_DELTA) },
  // Process validation conso fuel : conforme si |Variation de stock − Consommation théorique| ≤ max(50 L ; 5 %)
  { h: "Alerte App Fuel", w: 120, f: "analyse_variation.alerte", tot: ["analyse_variation", "alerte"], render: (r) => {
    const a = r.analyse_variation;
    if (!a?.alerte) return <span style={{ color: "#94A0B4" }} title={a?.alerte_motif ?? "Variation de stock ou conso théorique n.d."}>n.d.</span>;
    const ecart = a.alerte === "En écart";
    return <span title={a.alerte_motif ?? undefined} style={{ fontWeight: 800, padding: "2px 8px", borderRadius: 999,
      background: ecart ? "#FDE8E8" : "#E6F4EA", color: ecart ? "#B42318" : "#1E7B3C" }}>{ecart ? "⚠ En écart" : "✓ Conforme"}</span>;
  } },
];
const SELECTION_LABEL: Record<string, string> = {
  PUISSANCE_MEDIANE_GE: "puissance médiane GE", PUISSANCE_MEDIANE_REDRESSEUR: "puissance médiane redresseur",
  LOAD_DC_PLUS_RECHARGE_BATTERIE: "Load DC telco + Recharge batterie", LOAD_DC_SEUL: "Load DC telco seul (recharge batterie n.d.)",
};
// Colonne « Source de donnée Puissance retenue » : libellé de la colonne d'où vient la valeur retenue, origine au survol
const SELECTION_SOURCE: Record<string, string> = {
  PUISSANCE_MEDIANE_GE: "Puissance médiane mesurée générateur", PUISSANCE_MEDIANE_REDRESSEUR: "Puissance médiane mesurée redresseur",
  LOAD_DC_PLUS_RECHARGE_BATTERIE: "Load DC telco + Recharge batterie", LOAD_DC_SEUL: "Load DC telco seul",
};
const SELECTION_ORIGINE: Record<string, string> = {
  PUISSANCE_MEDIANE_GE: "Production GE ÷ heures de marche (GENSET_REPORT, Snowflake)",
  PUISSANCE_MEDIANE_REDRESSEUR: "P_DC ÷ rendement (RECTIFIER_EFFICIENCY_STATUS, Snowflake)",
  LOAD_DC_PLUS_RECHARGE_BATTERIE: "Load DC telco (AVERAGE_LOAD, Snowflake) + Recharge batterie (courant × tension, télémétrie gFMS)",
  LOAD_DC_SEUL: "Load DC telco (AVERAGE_LOAD, Snowflake) ; recharge batterie n.d. : puissance probablement sous-estimée",
};
// 6 totaux lus dans ENOC sur la plage de dates de la ligne du fichier du site (Date de Relevé Initiale → Date de Relevé Finale)
const periodeEnoc = (r: ConsoRow) => (r.ravitaillement?.debut && r.ravitaillement?.fin
  ? `ENOC, du ${fr(r.ravitaillement.debut)} au ${fr(r.ravitaillement.fin)} (${r.ravitaillement.nb_mouvements_enoc ?? 0} mouvement(s) sur le site)`
  : "Pas de dates de relevé dans le fichier pour ce site : non calculé");
const enoc = (v: (r: ConsoRow) => number | null | undefined) => (r: ConsoRow) => <span title={periodeEnoc(r)}>{num(v(r))}</span>;
const RAVITAILLEMENT: Col[] = [
  { h: "Total Livraison Fuel EYDON", w: 105, f: "ravitaillement.eydon_l", tot: ["ravitaillement", "eydon_l"], render: enoc((r) => r.ravitaillement?.eydon_l) },
  { h: "Total Livraison Fuel CARTE TOTAL", w: 105, f: "ravitaillement.carte_total_l", tot: ["ravitaillement", "carte_total_l"], render: enoc((r) => r.ravitaillement?.carte_total_l) },
  { h: "Total Ajout", w: 90, f: "ravitaillement.ajout_l", tot: ["ravitaillement", "ajout_l"], render: enoc((r) => r.ravitaillement?.ajout_l) },
  { h: "Total Retrait", w: 90, f: "ravitaillement.retrait_l", tot: ["ravitaillement", "retrait_l"], render: enoc((r) => r.ravitaillement?.retrait_l) },
  { h: "Total QTE volée déclarée", w: 100, f: "ravitaillement.vole_l", tot: ["ravitaillement", "vole_l"], render: enoc((r) => r.ravitaillement?.vole_l) },
  { h: "Total QTE vidangée / Fuite / Ecart de Stock", w: 120, f: "ravitaillement.fuite_l", tot: ["ravitaillement", "fuite_l"], render: enoc((r) => r.ravitaillement?.fuite_l) },
];

export function OutputFormatTable({ rows, onDetail, totaux, nbSites, colFilters, onColFilter, loadValues }: { rows: ConsoRow[]; onDetail: (r: ConsoRow) => void; totaux?: ConsoTotaux; nbSites?: number } & ColFilterProps) {
  const [menu, setMenu] = useState<{ key: string; title: string; anchor: DOMRect } | null>(null);
  // En-tête de colonne + bouton ▼ (filtre « comme Excel ») ; bouton plein quand un filtre est actif sur la colonne
  const head = (title: string, key?: string) => {
    if (!key || !onColFilter || !loadValues) return title;
    const on = !!colFilters?.[key];
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <span>{title}</span>
        <button type="button" aria-label={`Filtrer la colonne ${title}${on ? " (filtre actif)" : ""}`} aria-haspopup="dialog" aria-expanded={menu?.key === key}
          title={on ? `Filtre actif : ${colFilters![key].length} valeur(s)` : "Filtrer"}
          onClick={(e) => { const a = (e.currentTarget as HTMLElement).getBoundingClientRect(); setMenu(menu?.key === key ? null : { key, title, anchor: a }); }}
          style={{ flex: "none", width: 18, height: 18, padding: 0, borderRadius: 4, border: "1px solid #fff", cursor: "pointer", fontSize: 9, lineHeight: 1,
            background: on ? "#FFC000" : "transparent", color: on ? "#000" : "#fff" }}>{on ? "▼●" : "▼"}</button>
      </span>
    );
  };
  const th: CSSProperties = { background: NAVY, color: "#fff", fontSize: 11, fontWeight: 700, padding: "8px 6px", border: "1px solid #8EA9DB", textAlign: "center",
    verticalAlign: "middle", lineHeight: 1.25, position: "sticky", top: TOT_H + 30, zIndex: 2 };
  const group: CSSProperties = { background: "#fff", color: "#000", fontSize: 12.5, fontWeight: 800, padding: "6px", border: "2px solid #000", textAlign: "center",
    position: "sticky", top: TOT_H, zIndex: 3, height: 30 };
  // Ligne de totaux (comme la ligne SUBTOTAL du fichier) : somme sur TOUS les sites du filtre, pas seulement la page
  const totStyle: CSSProperties = { background: "#FFF2CC", color: "#000", fontSize: 11.5, fontWeight: 800, padding: "4px 6px", border: "1px solid #D9E1F2",
    textAlign: "center", position: "sticky", top: 0, zIndex: 3, height: TOT_H, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
  const totCell = (c: Col) => {
    if (!c.tot) return <th key={c.h} style={{ ...totStyle, background: "#fff", border: "none" }} />;
    const t = totaux?.[c.tot[0]]?.[c.tot[1]];
    const v = t?.total;
    return (
      <th key={c.h} scope="col" style={totStyle}
        title={t ? (t.oui ? `${t.total ?? 0} site(s) « ${t.valeur ?? "Oui"} » sur ${t.sites} site(s) calculé(s)${nbSites ? ` / ${nbSites} site(s) du filtre` : ""}` : t.comptage ? `${t.sites} site(s) avec un ${c.h.toLowerCase()}${nbSites ? ` sur ${nbSites} site(s) du filtre` : ""} — cases « n.d. » non comptées`
          : `Total sur ${t.sites} site(s) renseigné(s)${nbSites ? ` / ${nbSites} site(s) du filtre` : ""} — cases « n.d. » non comptées`) : "Total en cours de calcul"}>
        {v === null || v === undefined ? <span style={{ color: "#94A0B4" }}>{totaux ? "n.d." : "…"}</span>
          : t?.oui ? `${v.toLocaleString("fr-FR")} ${t.valeur ?? "Oui"} / ${t.sites.toLocaleString("fr-FR")}`
          : t?.comptage ? `${v.toLocaleString("fr-FR")}${nbSites ? ` / ${nbSites.toLocaleString("fr-FR")}` : ""} sites`
          : v.toLocaleString("fr-FR", { maximumFractionDigits: c.tot[1].endsWith("_h") || c.tot[1].endsWith("_kw") ? 2 : 0 })}
      </th>
    );
  };
  const td: CSSProperties = { fontSize: 12, padding: "5px 6px", border: "1px solid #D9E1F2", textAlign: "center", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
  const groups: Array<{ name: string; cols: Col[] }> = [
    { name: "INVENTAIRE", cols: INVENTAIRE }, { name: "DONNEES DE STOCK INITIAL", cols: STOCK_INITIAL },
    { name: "DONNEES DE RAVITAILLEMENT", cols: RAVITAILLEMENT }, { name: "DONNEES DE STOCK FINAL", cols: STOCK_FINAL },
    { name: "ESTIMATION CONSOMMATION FUEL THEORIQUE", cols: ESTIMATION_THEORIQUE },
    { name: "ANALYSE VARIATION DE STOCK Vs ESTIMATION THEORIQUE", cols: ANALYSE_VARIATION },
  ];
  const all = groups.flatMap((g) => g.cols);
  // Colonne vide entre deux blocs : séparation visuelle nette (aucune donnée, ignorée par les lecteurs d'écran)
  const gap: CSSProperties = { width: GAP, minWidth: GAP, maxWidth: GAP, padding: 0, border: "none", background: "#fff" };
  const spacer = (k: string, sticky?: CSSProperties) => <td key={k} aria-hidden style={{ ...gap, ...sticky }} />;
  return (
    <div style={{ overflow: "auto", maxHeight: "72vh" }} tabIndex={0} aria-label="Tableau des sites au format du fichier Output App Fuel">
      <table style={{ borderCollapse: "collapse", width: "max-content", minWidth: "100%" }}>
        <thead>
          <tr aria-label="Totaux sur tous les sites du filtre">
            <th style={{ ...totStyle, position: "sticky", left: 0, zIndex: 6, textAlign: "left" }}>Total</th>
            {groups.map((g) => (
              <Fragment key={g.name}>
                <th aria-hidden style={{ ...gap, position: "sticky", top: 0, zIndex: 3 }} />
                {g.cols.map(totCell)}
              </Fragment>
            ))}
          </tr>
          <tr>
            <th style={{ ...group, position: "sticky", left: 0, zIndex: 5 }} />
            {groups.map((g) => (
              <Fragment key={g.name}>
                <th aria-hidden style={{ ...gap, position: "sticky", top: TOT_H, zIndex: 3 }} />
                <th colSpan={g.cols.length} style={group}>{g.name}</th>
              </Fragment>
            ))}
          </tr>
          <tr>
            <th style={{ ...th, minWidth: 95, position: "sticky", left: 0, zIndex: 4 }}>{head("ID du site", "site_id")}</th>
            {groups.map((g) => (
              <Fragment key={g.name}>
                <th aria-hidden style={{ ...gap, position: "sticky", top: TOT_H + 30, zIndex: 2 }} />
                {g.cols.map((c) => <th key={c.h} scope="col" style={{ ...th, minWidth: c.w, maxWidth: c.w }}>{head(c.h, c.f)}</th>)}
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
      {menu && loadValues && onColFilter && (
        <ColumnFilterMenu key={menu.key} title={menu.title} anchor={menu.anchor} selected={colFilters?.[menu.key]} load={() => loadValues(menu.key)}
          onApply={(v) => { onColFilter(menu.key, v); setMenu(null); }} onClose={() => setMenu(null)} />
      )}
    </div>
  );
}
