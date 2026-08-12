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
  site_type: string | null;
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
};

export type FuelConsommationKpis = {
  total_sites: number;
  sites_avec_ge: number;
  sites_sans_ge: number;
  sites_ge_enoc_only: number;
  sites_avec_conso: number;
  sites_avec_estimation: number;
  total_conso_snowflake_l: number;
  total_enoc_qte_ajoutee_l: number;
  total_enoc_nb_demandes: number;
};

export type FuelSourceStatus = {
  connected: boolean;
  last_status: "RUNNING" | "SUCCESS" | "FAILED" | null;
  last_run_at: string | null;
  error: string | null;
};

export type FuelConsommationSources = {
  snowflake: FuelSourceStatus;
  enoc: FuelSourceStatus;
};

export type FuelConsommationResponse = {
  month_year: string | null;
  data: FuelConsommationSite[];
  pagination: Pagination | null;
  available_months: string[];
  kpis: FuelConsommationKpis | null;
  sources?: FuelConsommationSources;
};

/**
 * Consommation carburant mensuelle par site — automatisée (Snowflake +
 * ENOC), voir sync_fuel_consommation côté backend. Pas d'upload : alimentée
 * par une synchronisation planifiée.
 */
export async function getFuelConsommation(params?: { month?: string; search?: string; country?: string; has_genset?: "true" | "false"; page?: number; limit?: number }) {
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
};

export type FuelStockKpis = {
  total_sites: number;
  sites_avec_ge: number;
  sites_sans_ge: number;
  sites_avec_stock_snowflake: number;
  sites_avec_stock_enoc: number;
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
