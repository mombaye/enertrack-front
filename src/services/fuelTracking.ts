import { api } from "@/services/api";

const BASE = "/fuel-tracking";

function cleanParams(params: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== ""
    )
  );
}

export type FuelCommandeSyntheseRow = {
  label: string;
  is_total_row: boolean;
  nb_sites: number;
  commande_normale_l: number;
  commande_hivernale_l: number;
  total_l: number;
  nb_sites_prev: number;
  commande_normale_prev_l: number;
  commande_hivernale_prev_l: number;
  total_prev_l: number;
  ecart_sites: number;
  ecart_qte_l: number;
  commentaires: string | null;
};

export type FuelCommandeSyntheseResponse = {
  month_year: string | null;
  prev_month_year: string | null;
  categorie: FuelCommandeSyntheseRow[];
  typologie: FuelCommandeSyntheseRow[];
};

export async function getFuelCommandeSynthese(params?: { month?: string }) {
  const { data } = await api.get<FuelCommandeSyntheseResponse>(`${BASE}/commande-synthese/`, {
    params: cleanParams(params ?? {}),
  });
  return data;
}

export type FuelCommandeSyntheseImportResult = {
  month_year: string;
  rows_imported: number;
  filename: string;
};

/**
 * Upload du classeur Excel mensuel complet ("Commande FUEL ESCO SENEGAL
 * <mois>.xlsb") — le backend en extrait la feuille "Synthèse Commande" et
 * remplace les lignes du mois détecté dans FuelCommandeSynthese.
 */
export async function importFuelCommandeSynthese(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post<FuelCommandeSyntheseImportResult>(`${BASE}/commande-synthese/import/`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
