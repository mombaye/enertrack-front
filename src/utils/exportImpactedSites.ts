// src/utils/exportImpactedSites.ts
// Export Excel des sites impactés par cos phi et pénalité prime
// Librairie : xlsx (SheetJS) — npm install xlsx

import * as XLSX from "xlsx";
import type { ImpactedSitesResponse } from "@/services/sonatelBilling";

function fmtNum(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

export function exportImpactedSitesToExcel(
  data: ImpactedSitesResponse,
  filename?: string
): void {
  const wb = XLSX.utils.book_new();

  // ── Feuille 1 : Détail par mois ───────────────────────────────────────────
  const detailRows: Record<string, unknown>[] = [];

  for (const month of data.by_month) {
    for (const site of month.sites) {
      detailRows.push({
        "Période":                  month.period,
        "Site ID":                  site.site_id,
        "Site Nom":                 site.site_name,
        "N° Contrat":               site.numero_compte_contrat,
        "Valeur Cos φ":             site.valeur_cosinus_phi ?? "",
        "Statut Cos φ":             getCosPhiLabel(site.valeur_cosinus_phi),
        "Montant Cos φ (FCFA)":     fmtNum(site.montant_cosphi),
        "% Cos φ / HT":             fmtNum(site.pct_cosphi_sur_ht),
        "Pénalité Prime (FCFA)":    fmtNum(site.penalite_prime),
        "% Pénalité / HT":          fmtNum(site.pct_penalty_sur_ht),
        "Montant HT (FCFA)":        fmtNum(site.montant_hors_tva),
        "Impact Total (FCFA)":      fmtNum(site.montant_cosphi) + fmtNum(site.penalite_prime),
      });
    }

    // Ligne totaux du mois (en surbrillance via style)
    detailRows.push({
      "Période":                  `TOTAL ${month.period}`,
      "Site ID":                  "",
      "Site Nom":                 `${month.totaux.sites_count} site(s)`,
      "N° Contrat":               "",
      "Valeur Cos φ":             "",
      "Statut Cos φ":             "",
      "Montant Cos φ (FCFA)":     fmtNum(month.totaux.montant_cosphi),
      "% Cos φ / HT":             "",
      "Pénalité Prime (FCFA)":    fmtNum(month.totaux.penalite_prime),
      "% Pénalité / HT":          "",
      "Montant HT (FCFA)":        "",
      "Impact Total (FCFA)":      fmtNum(month.totaux.montant_cosphi) + fmtNum(month.totaux.penalite_prime),
    });

    // Ligne vide pour séparation visuelle entre mois
    detailRows.push({} as Record<string, unknown>);
  }

  const wsDetail = XLSX.utils.json_to_sheet(detailRows);

  // Largeurs de colonnes
  wsDetail["!cols"] = [
    { wch: 12 },  // Période
    { wch: 14 },  // Site ID
    { wch: 28 },  // Site Nom
    { wch: 18 },  // N° Contrat
    { wch: 14 },  // Valeur Cos φ
    { wch: 14 },  // Statut Cos φ
    { wch: 22 },  // Montant Cos φ
    { wch: 14 },  // % Cos φ / HT
    { wch: 22 },  // Pénalité Prime
    { wch: 16 },  // % Pénalité / HT
    { wch: 20 },  // Montant HT
    { wch: 20 },  // Impact Total
  ];

  XLSX.utils.book_append_sheet(wb, wsDetail, "Détail par mois");

  // ── Feuille 2 : Résumé par site ───────────────────────────────────────────
  const siteMap = new Map<string, {
    site_id: string;
    site_name: string;
    numero_compte_contrat: string;
    total_cosphi: number;
    total_penalty: number;
    total_ht: number;
    mois_count: number;
  }>();

  for (const month of data.by_month) {
    for (const site of month.sites) {
      const key = site.site_id;
      const existing = siteMap.get(key);
      if (existing) {
        existing.total_cosphi   += fmtNum(site.montant_cosphi);
        existing.total_penalty  += fmtNum(site.penalite_prime);
        existing.total_ht       += fmtNum(site.montant_hors_tva);
        existing.mois_count     += 1;
      } else {
        siteMap.set(key, {
          site_id:                site.site_id,
          site_name:              site.site_name,
          numero_compte_contrat:  site.numero_compte_contrat,
          total_cosphi:           fmtNum(site.montant_cosphi),
          total_penalty:          fmtNum(site.penalite_prime),
          total_ht:               fmtNum(site.montant_hors_tva),
          mois_count:             1,
        });
      }
    }
  }

  const summaryRows = Array.from(siteMap.values())
    .sort((a, b) => (b.total_cosphi + b.total_penalty) - (a.total_cosphi + a.total_penalty))
    .map(s => ({
      "Site ID":                  s.site_id,
      "Site Nom":                 s.site_name,
      "N° Contrat":               s.numero_compte_contrat,
      "Total Cos φ (FCFA)":       Math.round(s.total_cosphi * 100) / 100,
      "Total Pénalité (FCFA)":    Math.round(s.total_penalty * 100) / 100,
      "Impact Total (FCFA)":      Math.round((s.total_cosphi + s.total_penalty) * 100) / 100,
      "Total HT (FCFA)":          Math.round(s.total_ht * 100) / 100,
      "Nb Mois impactés":         s.mois_count,
      "% Impact / HT":            s.total_ht > 0
        ? Math.round((s.total_cosphi + s.total_penalty) / s.total_ht * 10000) / 100
        : 0,
    }));

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary["!cols"] = [
    { wch: 14 }, { wch: 28 }, { wch: 18 },
    { wch: 22 }, { wch: 22 }, { wch: 20 },
    { wch: 20 }, { wch: 16 }, { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(wb, wsSummary, "Résumé par site");

  // ── Feuille 3 : Récapitulatif global ─────────────────────────────────────
  const recapRows = [
    { "Indicateur": "Période début",              "Valeur": data.range.start },
    { "Indicateur": "Période fin",                "Valeur": data.range.end },
    { "Indicateur": "Filtre appliqué",            "Valeur": data.filter },
    { "Indicateur": "",                           "Valeur": "" },
    { "Indicateur": "Total Cos φ (FCFA)",         "Valeur": fmtNum(data.summary.total_cosphi) },
    { "Indicateur": "Total Pénalité Prime (FCFA)","Valeur": fmtNum(data.summary.total_penalty) },
    { "Indicateur": "Impact total (FCFA)",        "Valeur": fmtNum(data.summary.total_cosphi) + fmtNum(data.summary.total_penalty) },
    { "Indicateur": "",                           "Valeur": "" },
    { "Indicateur": "Nb sites avec Cos φ",        "Valeur": data.summary.sites_cosphi_count },
    { "Indicateur": "Nb sites avec Pénalité",     "Valeur": data.summary.sites_penalty_count },
    { "Indicateur": "Nb mois couverts",           "Valeur": data.by_month.length },
  ];

  const wsRecap = XLSX.utils.json_to_sheet(recapRows);
  wsRecap["!cols"] = [{ wch: 30 }, { wch: 20 }];

  XLSX.utils.book_append_sheet(wb, wsRecap, "Récapitulatif");

  // ── Export ────────────────────────────────────────────────────────────────
  const defaultFilename = `penalites_cosphi_${data.range.start}_${data.range.end}.xlsx`;
  XLSX.writeFile(wb, filename || defaultFilename);
}

function getCosPhiLabel(value: number | null): string {
  if (value === null) return "—";
  if (value > 0.95) return "Bonus";
  if (value >= 0.80) return "OK";
  if (value >= 0.75) return "Pénalité faible";
  if (value >= 0.65) return "Pénalité modérée";
  if (value >= 0.50) return "Pénalité élevée";
  return "Pénalité critique";
}