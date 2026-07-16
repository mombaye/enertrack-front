// src/features/fuel-tracking/helpers.ts
// Fonctions pures de formatage et de dérivation des champs — extraites pour
// être partagées entre toutes les feuilles du classeur.

import type { FuelEnocMovement, FuelMonthlyRow } from "@/services/fuelTracking";

export const fmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
export const fmt1 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
export const fmt2 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

export function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function n(value: unknown) {
  const v = Number(value || 0);
  return Number.isFinite(v) ? v : 0;
}

export function fmtL(value: unknown) {
  const v = n(value);
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${fmt1.format(abs / 1_000_000)} ML`;
  if (abs >= 1_000) return `${sign}${fmt1.format(abs / 1_000)} kL`;
  return `${fmt.format(v)} L`;
}

export function fmtDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function dash(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

export function maybeNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function fmtMaybeL(value: unknown) {
  const parsed = maybeNumber(value);
  return parsed === null ? "—" : fmtL(parsed);
}

export function fmtMaybeKva(value: unknown) {
  const parsed = maybeNumber(value);
  return parsed === null ? "—" : `${fmt1.format(parsed)} KVA`;
}

// Variantes sans suffixe d'unité — l'unité est portée par l'en-tête de colonne,
// pas répétée dans chaque cellule (Journal + Conso Mensuelle).
export function fmtNum(value: unknown) {
  return fmt.format(n(value));
}

export function fmtMaybeNum(value: unknown) {
  const parsed = maybeNumber(value);
  return parsed === null ? "—" : fmt.format(parsed);
}

export function fmtMaybeKvaNum(value: unknown) {
  const parsed = maybeNumber(value);
  return parsed === null ? "—" : fmt1.format(parsed);
}

export function statusTone(code?: string) {
  if (code === "OK") return "green" as const;
  if (code === "WARNING") return "orange" as const;
  if (code === "NOK") return "red" as const;
  if (code === "EFMS_ONLY") return "blue" as const;
  if (code === "ENOC_ONLY") return "violet" as const;
  return "slate" as const;
}

export function operationTypeTone(type?: string | null) {
  if (type === "PONCTION") return "violet" as const;
  if (type === "TRUCK") return "blue" as const;
  if (type === "TOTAL_CARD") return "orange" as const;
  return "slate" as const;
}

export function modernizedLabel(row: FuelMonthlyRow) {
  if (row.site_ref?.modernized === true) return "Modernisé";
  if (row.site_ref?.modernized === false) return "Existant";
  if (row.enoc_site_ref?.modernised_date) return "Modernisé";
  return "—";
}

export function siteTypology(row: FuelMonthlyRow) {
  return (
    row.site_ref?.billing_typology ||
    row.enoc_site_ref?.typology_contractual ||
    row.enoc_site_ref?.new_typo ||
    row.enoc_site_ref?.typo_simple ||
    "—"
  );
}

export function realTypology(row: FuelMonthlyRow) {
  return row.site_ref?.installed_typology || row.enoc_site_ref?.new_typo || row.enoc_site_ref?.typo_simple || "—";
}

export function siteConfig(row: FuelMonthlyRow) {
  return row.site_ref?.configuration || row.enoc_site_ref?.ongrid_offgrid || row.enoc_site_ref?.indoor_outdoor_after_passive || "—";
}

export function siteLoad(row: FuelMonthlyRow) {
  return row.site_ref?.analysis_load ?? row.enoc_site_ref?.new_load_contract_v2 ?? row.enoc_site_ref?.new_load ?? row.enoc_site_ref?.load ?? null;
}

export function primaryGe(row: FuelMonthlyRow) {
  return row.ge_ref?.primary_asset || row.ge_ref?.assets?.[0] || null;
}

export function secondGe(row: FuelMonthlyRow) {
  return row.ge_ref?.assets?.[1] || null;
}

export function geBrand1(row: FuelMonthlyRow) {
  return primaryGe(row)?.brand || row.ge_snapshot?.ge_brand || "—";
}

export function geBrand2(row: FuelMonthlyRow) {
  return secondGe(row)?.brand || "—";
}

/** Facteur de charge = Load site (W) / Puissance nominale GE (KVA × 1000). */
export function facteurCharge(row: FuelMonthlyRow): number | null {
  const load = siteLoad(row);
  const kva = gePower1(row);
  if (load === null || load === undefined || !kva) return null;
  const pct = (n(load) / (n(kva) * 1000)) * 100;
  return Number.isFinite(pct) ? pct : null;
}

/**
 * Conso [L/h] théorique = courbe calibrée par modèle de GE (catalogue GENSET DB),
 * conso(x) = a·x² + b·x + c avec x = facteur de charge (fraction, 1.0 = 100%).
 * Remplace un simple ratio load/puissance par la courbe réelle du constructeur.
 * Retourne null si aucun modèle GE n'a pu être identifié dans le catalogue
 * (voir primaryGe(row)?.fuel_curve?.confidence pour la fiabilité du match).
 */
export function consoTheoriqueLH(row: FuelMonthlyRow): number | null {
  const curve = primaryGe(row)?.fuel_curve;
  if (!curve?.matched || curve.coef_a == null || curve.coef_b == null || curve.coef_c == null) return null;
  const pct = facteurCharge(row);
  if (pct === null) return null;
  const x = pct / 100;
  const conso = curve.coef_a * x * x + curve.coef_b * x + curve.coef_c;
  return Number.isFinite(conso) ? Math.max(conso, 0) : null;
}

/**
 * CPH cible [L/h] = matrice CPH (feuille "CPH", mesures réelles par famille
 * moteur), interpolée linéairement entre les deux points encadrant le
 * facteur de charge réel du site. Seule la famille Perkins est actuellement
 * renseignée dans la source — retourne null pour les autres marques (pas de
 * cible plutôt qu'une comparaison trompeuse).
 */
export function cphTargetLH(row: FuelMonthlyRow): number | null {
  const target = primaryGe(row)?.cph_target;
  if (!target?.matched || !target.points?.length) return null;
  const pct = facteurCharge(row);
  if (pct === null) return null;
  const x = pct / 100;
  const points = target.points;

  if (x <= points[0][0]) return points[0][1];
  if (x >= points[points.length - 1][0]) return points[points.length - 1][1];

  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (x >= x0 && x <= x1) {
      if (x1 === x0) return y0;
      const t = (x - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return null;
}

/**
 * Conso RMS = bilan matière sur la télémétrie Snowflake (niveau de cuve) :
 * Stock Ouv. RMS + Refueling + Ajout In − Prélèvement Out − Stock Clôt. RMS.
 * Même formule que "Conso Réelle" du template, appliquée aux valeurs RMS.
 */
export function consoRms(row: FuelMonthlyRow): number | null {
  const { ouv_rms, clot_rms } = row.stock;
  if (ouv_rms === null || ouv_rms === undefined || clot_rms === null || clot_rms === undefined) return null;
  return n(ouv_rms) + n(row.enoc.refueling_liters) + n(row.enoc.ajout_in_liters) - n(row.enoc.prelevement_out_liters) - n(clot_rms);
}

export function gePower1(row: FuelMonthlyRow) {
  return primaryGe(row)?.power_kva ?? row.ge_snapshot?.ge_power_kva ?? row.enoc_site_ref?.ge1_power_kva ?? null;
}

export function gePower2(row: FuelMonthlyRow) {
  return secondGe(row)?.power_kva ?? row.enoc_site_ref?.ge2_power_kva ?? null;
}

export function tankCapacity1(row: FuelMonthlyRow) {
  return primaryGe(row)?.tank_capacity_liters ?? row.ge_snapshot?.tank_capacity_liters ?? row.enoc_site_ref?.fuel_tank_capacity_liters ?? null;
}

export function tankCapacity2(row: FuelMonthlyRow) {
  return secondGe(row)?.tank_capacity_liters ?? null;
}

export function tankType(value: unknown, shape?: string | null) {
  if (value === true) return "Connectée";
  if (value === false) return "Non connectée";
  const raw = String(value ?? "").toLowerCase().trim();
  if (["true", "oui", "yes", "1", "connected"].includes(raw)) return "Connectée";
  if (["false", "non", "no", "0", "not_connected"].includes(raw)) return "Non connectée";

  const shapeRaw = String(shape ?? "").toLowerCase();
  if (shapeRaw.includes("interne")) return "Interne";
  if (shapeRaw.includes("externe")) return "Externe";
  if (shape) return shape;

  return "—";
}

export function journalSource(r: FuelEnocMovement) {
  return (
    r.ponction?.source_site_name ||
    r.raw_payload?.ponction?.source_site_name ||
    r.raw_payload?.site_context?.site_name ||
    r.site_name ||
    "—"
  );
}

export function journalRmsHourMeter(r: FuelEnocMovement) {
  return r.raw_payload?.rms_hour_meter || r.raw_payload?.rms_ge_hour_meter || r.raw_payload?.site_context?.rms_hour_meter || null;
}

export function blGapLiters(r: FuelEnocMovement) {
  const bl = maybeNumber(r.delivery_note_quantity_liters);
  const measured = maybeNumber(r.quantity_added_liters);
  if (bl === null || measured === null) return null;
  return bl - measured;
}

export function blGapPercent(r: FuelEnocMovement) {
  const bl = maybeNumber(r.delivery_note_quantity_liters);
  const gap = blGapLiters(r);
  if (bl === null || bl === 0 || gap === null) return null;
  return (gap / bl) * 100;
}

export function balanceCheck(r: FuelEnocMovement) {
  const gap = blGapLiters(r);
  if (gap === null) return "—";
  if (Math.abs(gap) <= 1) return "OK";
  return "Écart";
}
