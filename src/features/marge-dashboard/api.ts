// src/features/marge-dashboard/api.ts
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";

export interface MargeRow {
  site_id: string;
  site_name: string;
  region: string;
  batch: string;
  typo_facturee: string;
  indoor_outdoor: string;
  modernise: string;
  redevance_mai: number | null;
  redevance_juin: number | null;
  conso_mai_xof: number | null;
  conso_juin_xof: number | null;
  marge_mai_est: number | null;
  marge_juin_est: number | null;
  statut_est: "OK" | "NOK" | "RAS";
  factures_reelles: number | null;
  marge_reelle: number | null;
  statut_reelle: "OK" | "NOK" | "RAS";
  categorie_bo: string;
  comment_bo: string;
  owner: string;
  commentaire: string;
}

export interface MargePeriod {
  year: number;
  month: number;
}

export interface MargeDashboardMeta {
  total_sites: number;
  month_a_label: string;
  month_b_label: string;
  year: number;
  available_years: number[];
  available_periods: MargePeriod[];
  reelle_year: number;
  reelle_month: number;
}

export interface MargeDashboardData {
  rows: MargeRow[];
  meta: MargeDashboardMeta;
}

export async function fetchMargeDashboard(period?: MargePeriod): Promise<MargeDashboardData> {
  const { data } = await api.get<MargeDashboardData>("/financial/marge-dashboard/", {
    params: period ? { year: period.year, month: period.month } : {},
  });
  return data;
}

export function useMargeDashboard(period?: MargePeriod) {
  return useQuery({
    queryKey: ["marge-dashboard", period ? `${period.year}-${period.month}` : "default"],
    queryFn: () => fetchMargeDashboard(period),
    staleTime: 5 * 60 * 1000,
  });
}
