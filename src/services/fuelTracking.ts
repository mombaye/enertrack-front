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
  conso_estimee_enoc_l: number | null;
  conso_estimee_nb_releves: number | null;
  conso_specifique_moy_l_kwh: number | null;
  sensor_status: string | null;
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
