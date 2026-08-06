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
  /** Mois pour lesquels un fichier a déjà été importé, triés du plus récent au plus ancien. */
  available_months: string[];
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
  /** Feuille "Suivis commande" importée en même temps (voir suivi_commande_import.py) — null si échec, ne bloque pas l'import principal. */
  suivi_commande_rows_imported: number | null;
  suivi_commande_error: string | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Vrai si l'erreur axios n'a jamais reçu de réponse du serveur (coupure
 * réseau, timeout de connexion...) — par opposition à une erreur métier
 * (400/500) renvoyée par le backend, qu'il ne faut pas réessayer aveuglément. */
function isNetworkError(err: any) {
  return !err?.response;
}

/**
 * Upload du classeur Excel mensuel complet ("Commande FUEL ESCO SENEGAL
 * <mois>.xlsb") — le backend en extrait la feuille "Synthèse Commande" et
 * remplace les lignes du mois concerné dans FuelCommandeSynthese, ainsi que
 * la feuille "Suivis commande" (colonnes bleues) dans FuelSuiviCommandeSite.
 * Le mois concerné et le mois précédent (ex: Août / Juillet) sont
 * obligatoires — fournis par l'utilisateur, pas de détection automatique
 * côté serveur.
 *
 * Le fichier peut peser plusieurs dizaines de Mo : `onProgress` (0-100)
 * permet d'afficher une progression d'upload plutôt qu'un écran figé, et les
 * échecs purement réseau (pas d'erreur renvoyée par le serveur — coupure,
 * timeout de connexion) sont réessayés automatiquement avant d'abandonner.
 */
export async function importFuelCommandeSynthese(
  file: File,
  monthYear: string,
  prevMonthYear: string,
  onProgress?: (pct: number) => void,
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("month_year", monthYear);
  formData.append("prev_month_year", prevMonthYear);

  const MAX_ATTEMPTS = 3;
  let lastErr: any;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      onProgress?.(0);
      const { data } = await api.post<FuelCommandeSyntheseImportResult>(`${BASE}/commande-synthese/import/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (evt) => {
          if (evt.total) onProgress?.(Math.round((evt.loaded / evt.total) * 100));
        },
      });
      return data;
    } catch (err: any) {
      lastErr = err;
      if (!isNetworkError(err) || attempt === MAX_ATTEMPTS) throw err;
      await sleep(1500 * attempt);
    }
  }
  throw lastErr;
}

export type FuelCommandeSyntheseHistoryItem = {
  month_year: string;
  prev_month_year: string | null;
  filename: string | null;
  imported_at: string | null;
  rows_commande_synthese: number;
  rows_suivi_commande: number;
};

/** Historique des imports (un par mois) — pour le bouton "Historique". */
export async function getFuelCommandeSyntheseHistory() {
  const { data } = await api.get<{ results: FuelCommandeSyntheseHistoryItem[] }>(`${BASE}/commande-synthese/history/`);
  return data.results;
}

/** Supprime toutes les données importées (Synthèse Commande + Suivis commande) pour un mois donné. */
export async function deleteFuelCommandeSyntheseMonth(monthYear: string) {
  const { data } = await api.delete<{ month_year: string; deleted_commande_synthese: number; deleted_suivi_commande: number }>(
    `${BASE}/commande-synthese/history/`,
    { params: { month: monthYear } },
  );
  return data;
}

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export type FuelSuiviCommandeSite = {
  site_id: string;
  site_name: string | null;
  typologie_contractuelle: string | null;
  load_commande: number;
  indoor_outdoor: string | null;
  longitude: number | null;
  batch: string | null;
  typologie_facturee: string | null;
  conso_moy_jour_l: number;
  commande_sans_marge_l: number;
  commande_avec_marge_l: number;
  estimation_stock_final_l: number;
  typo_operations: string | null;
};

export type FuelSuiviCommandeKpis = {
  total_sites: number;
  total_conso_moy_jour_l: number;
  total_commande_sans_marge_l: number;
  total_commande_avec_marge_l: number;
  total_estimation_stock_final_l: number;
};

export type FuelSuiviCommandeResponse = {
  month_year: string | null;
  data: FuelSuiviCommandeSite[];
  pagination: Pagination | null;
  available_months: string[];
  kpis: FuelSuiviCommandeKpis | null;
};

/**
 * Liste paginée du snapshot par site — colonnes mises en bleu de la feuille
 * "Suivis commande", import brut sans recalcul.
 */
export async function getFuelSuiviCommande(params?: { month?: string; search?: string; page?: number; limit?: number }) {
  const { data } = await api.get<FuelSuiviCommandeResponse>(`${BASE}/suivi-commande/`, {
    params: cleanParams(params ?? {}),
  });
  return data;
}
