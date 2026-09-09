import { api } from "@/services/api";

const BASE = "/fuel-tracking";

function cleanParams(params: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== ""
    )
  );
}

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export type FuelConsommationSite = {
  site_id: string;
  site_name: string | null;
  typology: string | null;
  typologie_simple: string | null;
  site_type: string | null;
  type_ge: string | null;
  dg_count: string | null;
  power_supply: string | null;
  has_genset: boolean;
  has_genset_snowflake: boolean;
  has_genset_enoc: boolean;
  nb_ge_enoc: number | null;
  conso_snowflake_l: number | null;
  nb_jours_data: number;
  conso_estimee_snowflake_l: number | null;
  conso_estimee_snowflake_nb_releves: number | null;
  conso_estimee_enoc_l: number | null;
  conso_estimee_nb_releves: number | null;
  conso_specifique_moy_l_kwh: number | null;
  ge_prod_kwh: number | null;
  sensor_status: string | null;
  // Colonnes qualité VW_FUEL_REPORT — audit (spec 2026-08).
  quality_status: string | null;
  raw_point_count: number | null;
  valid_point_count: number | null;
  isolated_spike_count: number | null;
  over_capacity_point_count: number | null;
  refill_detected: boolean;
  estimated_refill_volume_l: number | null;
  enoc_qte_demandee_l: number;
  enoc_qte_validee_l: number;
  enoc_qte_ajoutee_l: number;
  enoc_nb_demandes: number;
  ecart_conso_vs_enoc_l: number | null;
  // Estimation CPH (télémétrie GFMS_DATA_TRACKER_NC) — 3e source, indépendante
  // des 2 ci-dessus, pour les GE sans capteur de cuve fiable. "Sans litre
  // inventé" : conso_estimee_cph_l ne compte que les jours au statut OK ;
  // cph_status_breakdown explique pourquoi les autres jours sont vides.
  conso_estimee_cph_l: number | null;
  cph_l_per_h_moy: number | null;
  cph_nb_jours_ok: number | null;
  cph_nb_jours_calcules: number | null;
  cph_calculation_status: string | null;
  cph_status_breakdown: Record<string, number> | null;
  cph_runtime_h_total: number | null;
  cph_runtime_source: "TRACKER_5MIN" | "DSE_CONTROLLER" | "DG_ON_CALCULATED" | "RECTIFIER_STATUS_5MIN" | null;
  /** Heures cumulées par source sur le mois, ex. {"DSE_CONTROLLER": 45.2, "TRACKER_5MIN": 3.1} — cph_runtime_source est la clé au plus d'heures. */
  cph_runtime_source_breakdown: Record<string, number> | null;
  cph_ge_type: string | null;
  cph_pge_kva: number | null;
  cph_power_factor: number | null;
  cph_spc_l_per_kwh: number | null;
  conso_fichier_l: number | null;
  fichier_source: string | null;
  // Colonnes Suivis Consommation (2026-08) — sourcées de Base GE.xlsx
  // (identité, running time, CPH L/h, conso estimée/mesurée, charge GE) +
  // détail énergie du pipeline CPH Snowflake (absent du fichier).
  pge_kva_fichier: number | null;
  ge_load_pct_fichier: number | null;
  cph_lph_fichier: number | null;
  // Valeurs résolues — Running Time/Conso estimée : pipeline CPH Snowflake
  // (télémétrie) exclusivement ; _source indique l'origine précise (ex.
  // "snowflake_dse_controller", "cph_snowflake"). Conso mesurée vue :
  // Snowflake (capteur) en priorité, relevé de gardiennage (jauge manuelle)
  // en repli quand Snowflake n'a rien — voir import_gardien_conso.
  ge_runtime_fichier_h: number | null;
  ge_runtime_source: string | null;
  conso_estimee_fichier_l: number | null;
  conso_estimee_source: string | null;
  conso_mesuree_fichier_l: number | null;
  conso_mesuree_source: "snowflake" | "gardiennage" | null;
  gardien_statut: string | null;
  ecart_fichier_l: number | null;
  ecart_fichier_pct: number | null;
  cph_site_load_energy_kwh: number | null;
  cph_battery_dc_energy_kwh: number | null;
  cph_battery_ac_energy_kwh: number | null;
  cph_total_ge_energy_kwh: number | null;
  // Explique, pour les valeurs manquantes de cette ligne (Running Time,
  // Conso estimée, Conso mesurée vue), pourquoi aucune source disponible
  // ne les a fournies. null si tout est renseigné.
  commentaire: string | null;
  // Facturation (ESCO SN — Facturation par site, mensuel) — null si le
  // site n'apparaît pas dans le dernier fichier importé.
  facturation_active_fichier: boolean | null;
  facturation_avec_ge_fichier: boolean | null;
  configuration_fichier: string | null;
};

export type FuelConsommationKpis = {
  total_sites: number;
  sites_avec_ge: number;
  sites_sans_ge: number;
  sites_ge_enoc_only: number;
  sites_avec_ge_incomplet: number;
  sites_avec_conso: number;
  sites_avec_estimation: number;
  total_conso_snowflake_l: number;
  total_enoc_qte_ajoutee_l: number;
  total_enoc_nb_demandes: number;
  runtime_source_counts: {
    tracker_5min: number;
    dse_controller: number;
    dg_on_calculated: number;
    rectifier_status_5min: number;
    none: number;
  };
  configuration_counts: {
    indoor: number;
    outdoor: number;
    none: number;
  };
  factures_payees: number;
  factures_impayees: number;
  factures_total: number;
};

export type FuelRuntimeSourceFilter = "tracker_5min" | "dse_controller" | "dg_on_calculated" | "rectifier_status_5min" | "none";
export type FuelConfigurationFilter = "indoor" | "outdoor" | "none";

export type FuelSourceStatus = {
  connected: boolean;
  last_status: "RUNNING" | "SUCCESS" | "FAILED" | null;
  last_run_at: string | null;
  /** Date de la donnée la plus récente réellement disponible côté source
   * (pas l'heure d'exécution de la synchro) — révèle une source en retard
   * même quand la synchro elle-même tourne et "réussit" normalement. */
  last_data_date: string | null;
  error: string | null;
};

export type FuelConsommationSources = {
  snowflake: FuelSourceStatus;
  enoc: FuelSourceStatus;
};

export type FuelCphParametersStatus = {
  sites_configures: number;
  dernier_import: string | null;
};

// Recoupement Snowflake/ENOC/fichiers de référence — explique d'où viennent
// les effectifs Avec GE/Sans GE et où se situent les sites des fichiers
// (Base GE.xlsx / Base août 26 validée) par rapport aux sites GE réseau.
export type FuelGeDetection = {
  total_sites: number;
  avec_ge: number;
  sans_ge: number;
  avec_ge_snowflake: number;
  avec_ge_enoc: number;
  vus_seulement_enoc: number;
  vus_seulement_snowflake: number;
  vus_par_les_deux: number;
  sites_dans_fichier: number;
  dans_fichier_et_ge: number;
  dans_fichier_sans_ge: number;
  ge_hors_fichier: number;
};

export type FuelConsommationResponse = {
  month_year: string | null;
  data: FuelConsommationSite[];
  pagination: Pagination | null;
  available_months: string[];
  kpis: FuelConsommationKpis | null;
  sources?: FuelConsommationSources;
  cph_parameters?: FuelCphParametersStatus;
  ge_detection?: FuelGeDetection | null;
};

/**
 * Consommation carburant mensuelle par site — automatisée (Snowflake +
 * ENOC), voir sync_fuel_consommation côté backend. Pas d'upload : alimentée
 * par une synchronisation planifiée.
 */
export type FuelGeDetectionFilter =
  | "avec_ge"
  | "sans_ge"
  | "avec_ge_snowflake"
  | "avec_ge_enoc"
  | "vus_seulement_enoc"
  | "vus_seulement_snowflake"
  | "vus_par_les_deux"
  | "sites_dans_fichier"
  | "dans_fichier_et_ge"
  | "dans_fichier_sans_ge"
  | "ge_hors_fichier";

export async function getFuelConsommation(params?: { month?: string; search?: string; country?: string; has_genset?: "true" | "false" | "incomplete"; detection?: FuelGeDetectionFilter; runtime_source?: FuelRuntimeSourceFilter; configuration?: FuelConfigurationFilter; page?: number; limit?: number }) {
  const { data } = await api.get<FuelConsommationResponse>(`${BASE}/consommation/`, {
    params: cleanParams(params ?? {}),
  });
  return data;
}

export type FuelConsommationMonthlyPoint = {
  month_year: string;
  nb_sites_ge: number;
  nb_sites_avec_conso: number;
  nb_sites_monitored: number;
  total_conso_snowflake_l: number;
  total_enoc_qte_ajoutee_l: number;
  total_enoc_nb_demandes: number;
  nb_sites_enoc_ajoutee: number;
  conso_specifique_moy_l_kwh: number | null;
  total_conso_estimee_cph_l: number;
  nb_sites_avec_cph: number;
  nb_sites_incomplet: number;
};

export type FuelConsommationTopSite = {
  site_id: string;
  site_name: string | null;
  total_conso_l: number;
  nb_mois_avec_conso: number;
};

export type FuelConsommationDashboard = {
  months: string[];
  monthly: FuelConsommationMonthlyPoint[];
  top_sites: FuelConsommationTopSite[];
  total_ge_sites: number;
  available_months: string[];
  cph_parameters: FuelCphParametersStatus;
  ge_detection: FuelGeDetection | null;
};

/**
 * Vue d'ensemble pour l'onglet Dashboard. Portée de months/monthly/top_sites,
 * par ordre de priorité : from_month+to_month (plage explicite) > month seul
 * (mois choisi dans le header) > par défaut, les 3 derniers mois disponibles
 * (jamais tout l'historique).
 */
export async function getFuelConsommationDashboard(params?: { month?: string; from_month?: string; to_month?: string }) {
  const { data } = await api.get<FuelConsommationDashboard>(`${BASE}/consommation/dashboard/`, {
    params: cleanParams(params ?? {}),
  });
  return data;
}

export type FuelStockSite = {
  site_id: string;
  site_name: string | null;
  typology: string | null;
  site_type: string | null;
  dg_count: string | null;
  power_supply: string | null;
  has_genset: boolean;
  has_genset_snowflake: boolean;
  has_genset_enoc: boolean;
  nb_ge_enoc: number | null;
  stock_snowflake_l: number | null;
  capacity_snowflake_l: number | null;
  stock_snowflake_pct: number | null;
  stock_snowflake_date: string | null;
  quality_status: string | null;
  stock_enoc_l: number | null;
  stock_enoc_date: string | null;
  commentaire: string | null;
};

export type FuelStockKpis = {
  total_sites: number;
  sites_avec_ge: number;
  sites_sans_ge: number;
  sites_avec_stock_snowflake: number;
  sites_avec_stock_enoc: number;
  sites_stock_critique: number;
  sites_stock_alerte: number;
  sites_sans_aucun_stock: number;
};

export type FuelStockResponse = {
  data: FuelStockSite[];
  pagination: Pagination;
  kpis: FuelStockKpis;
  sources: FuelConsommationSources;
};

/**
 * Stock carburant ACTUEL par site — pas de notion de mois (contrairement à
 * getFuelConsommation), une seule ligne par site remplacée à chaque sync
 * (sync_fuel_stock). Jointure Snowflake (VW_FUEL_REPORT) + ENOC
 * (fuel_level_readings), 2 sources distinctes jamais fusionnées.
 */
export async function getFuelStock(params?: { search?: string; has_genset?: "true" | "false"; page?: number; limit?: number }) {
  const { data } = await api.get<FuelStockResponse>(`${BASE}/stock/`, {
    params: cleanParams(params ?? {}),
  });
  return data;
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

export type FuelCommandeSite = {
  site_id: string;
  site_name: string | null;
  typologie_contractuelle: string | null;
  load_commande: number;
  indoor_outdoor: string | null;
  batch: string | null;
  typologie_facturee: string | null;
  typo_operations: string | null;
  conso_moy_jour_l: number;
  commande_sans_marge_l: number;
  commande_avec_marge_l: number;
  estimation_stock_final_l: number;
};

export type FuelCommandeKpis = {
  total_sites: number;
  total_commande_avec_marge_l: number;
  total_commande_sans_marge_l: number;
  nb_sites_commande_positive: number;
  nb_sites_stock_negatif: number;
};

export type FuelCommandeResponse = {
  month_year: string | null;
  prev_month_year: string | null;
  available_months: string[];
  synthese: {
    categorie: FuelCommandeSyntheseRow[];
    typologie: FuelCommandeSyntheseRow[];
  };
  sites: {
    data: FuelCommandeSite[];
    pagination: Pagination | null;
    kpis: FuelCommandeKpis | null;
  };
};

/**
 * Commande carburant mensuelle — import mensuel brut (pas de synchro
 * automatisée : commande décidée par l'équipe Ops dans un fichier Excel,
 * voir import_commande_fuel côté backend), lecture seule, aucun upload sur
 * cette page.
 */
export async function getFuelCommandes(params?: { month?: string; search?: string; page?: number; limit?: number }) {
  const { data } = await api.get<FuelCommandeResponse>(`${BASE}/commandes/`, {
    params: cleanParams(params ?? {}),
  });
  return data;
}

export type FuelCommandeConfiance = "Élevée" | "Moyenne" | "Faible";

export type FuelCommandeEstimationSite = {
  site_id: string;
  site_name: string | null;
  nb_mois_historique: number;
  sources_historique: string[];
  conso_jour_ponderee_l: number;
  conso_projetee_l: number;
  stock_actuel_l: number | null;
  stock_connu: boolean;
  capacite_cuve_l: number | null;
  commande_sans_marge_l: number;
  commande_avec_marge_l: number;
  plafonnee_par_capacite: boolean;
  stock_final_estime_l: number;
  confiance: FuelCommandeConfiance;
  commande_ops_reference_l: number | null;
};

export type FuelCommandeEstimationKpis = {
  nb_sites: number;
  total_commande_estimee_l: number;
  nb_sites_rupture_prevue: number;
  nb_sites_confiance_faible: number;
  nb_sites_confiance_elevee: number;
  total_commande_ops_reference_l: number | null;
  ops_reference_month: string | null;
};

export type FuelCommandeEstimationResponse = {
  target_month: string | null;
  source_months: string[];
  marge_pct: number;
  kpis: FuelCommandeEstimationKpis | null;
  sites: FuelCommandeEstimationSite[];
};

/**
 * Estimation carburant du mois suivant — calculée à partir des données
 * automatisées (Consommation + Stock), indépendante de l'import manuel Ops.
 * Voir FuelCommandeEstimationView côté backend pour la méthodologie.
 */
export async function getFuelCommandeEstimation(params?: { marge?: number; search?: string }) {
  const { data } = await api.get<FuelCommandeEstimationResponse>(`${BASE}/commandes/estimation/`, {
    params: cleanParams(params ?? {}),
  });
  return data;
}
