// src/features/fuel-tracking/exportWorkbook.ts
// Export du classeur complet au format .xlsx, structure identique au template source.

import * as XLSX from "xlsx";
import type { FuelEnocMovement, FuelMonthlyRow } from "@/services/fuelTracking";
import {
  balanceCheck,
  blGapLiters,
  blGapPercent,
  geBrand1,
  geBrand2,
  gePower1,
  gePower2,
  journalRmsHourMeter,
  journalSource,
  modernizedLabel,
  n,
  realTypology,
  secondGe,
  siteConfig,
  siteTypology,
  primaryGe,
  tankCapacity1,
  tankCapacity2,
  tankType,
} from "./helpers";

function buildSheetRowsConso(rows: FuelMonthlyRow[]) {
  return rows.map((r) => ({
    "Site ID": r.site_id,
    "Site Name": r.site_name,
    "Région": r.zone_label || r.zone || r.enoc_site_ref?.region,
    "Neuf/Existant": modernizedLabel(r),
    "Batch": r.site_ref?.batch_operational || r.enoc_site_ref?.batch_operational || r.enoc_site_ref?.batch,
    "Typo Facturée": siteTypology(r),
    "Typo Réelle": realTypology(r),
    "Conf": siteConfig(r),
    "Marque GE 1": geBrand1(r),
    "Capacité GE1 (KVA)": gePower1(r),
    "Capacité Cuve GE1 (L)": tankCapacity1(r),
    "Type Cuve GE1": tankType(primaryGe(r)?.tank_connected, primaryGe(r)?.tank_shape),
    "Marque GE 2": geBrand2(r),
    "Capacité GE2 (KVA)": gePower2(r),
    "Capacité Cuve GE2 (L)": tankCapacity2(r),
    "Type Cuve GE2": tankType(secondGe(r)?.tank_connected, secondGe(r)?.tank_shape),
    "Refueling ENOC (L)": r.enoc.quantity_added_liters,
    "RH (h)": r.efms.rh_hours,
    "RH source": r.efms.rh_source,
    "Avec DSE": r.efms.avec_dse,
    "Conso Réelle (L)": r.efms.fuel_conso_l,
    "Conso Théorique / eFMS livré (L)": r.efms.fuel_deli_l,
    "CPH Réel (L/h)": r.efms.cph_l_per_hour,
    "Écart livré vs ENOC (L)": r.gaps.deli_vs_enoc_l,
    "Écart livré vs ENOC (%)": r.gaps.deli_vs_enoc_pct,
    "Statut NOK/OK": r.gaps.status.label,
  }));
}

function buildSheetRowsJournal(rows: FuelEnocMovement[]) {
  return rows.map((r) => ({
    "Site ID": r.site_id,
    "N° Ticket FMS": r.request_code,
    "Type d'action": r.operation_type,
    "Date": r.operation_date,
    "Responsable": r.done_by || r.created_by || r.technician_name,
    "Source (Site/Dépôt)": journalSource(r),
    "Qté initiale site (L)": r.level_before || "",
    "Qté transférée (L)": r.quantity_added_liters,
    "Qté finale site (L)": r.level_after || "",
    "Méthode Jaugeage": r.gauging_method || "",
    "DG RH lu contrôleur": r.hour_meter_after || "",
    "Qté init. RMS (L)": r.rms_level_before || "",
    "Qté fin. RMS (L)": r.rms_level_after || "",
    "RMS DG RH": journalRmsHourMeter(r) || "",
    "N° Bon de Livraison": r.delivery_note_number || "",
    "Qté BL (L)": r.delivery_note_quantity_liters || "",
    "Validé Par": r.validated_by,
    "Statut": r.status,
    "Écart BL/Mesuré (L)": blGapLiters(r) ?? "",
    "Écart BL %": blGapPercent(r) ?? "",
    "Balance Check": balanceCheck(r),
  }));
}

export function exportWorkbook({
  month,
  monthlyRows,
  journalRows,
  kpis,
}: {
  month: string;
  monthlyRows: FuelMonthlyRow[];
  journalRows: FuelEnocMovement[];
  kpis: any;
}) {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      { Indicateur: "Consommation ENOC", Valeur: n(kpis?.enoc_quantity_added_liters) },
      { Indicateur: "eFMS livré", Valeur: n(kpis?.fuel_deli_l) },
      { Indicateur: "eFMS conso", Valeur: n(kpis?.fuel_conso_l) },
      { Indicateur: "Écart livré vs ENOC", Valeur: n(kpis?.gap_deli_vs_enoc_l) },
      { Indicateur: "Sites OK", Valeur: n(kpis?.ok) },
      { Indicateur: "Sites NOK", Valeur: n(kpis?.nok) },
    ]),
    "DASHBOARD"
  );

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildSheetRowsJournal(journalRows)), "JOURNAL_RAVITAILLEMENT");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildSheetRowsConso(monthlyRows)), "CONSO_MENSUELLE");

  XLSX.writeFile(wb, `Suivi_Carburant_${month}.xlsx`);
}
