// ==================================\n// src/services/energy.ts\n// ==================================\nimport { api } from "@/services/api";
import { api } from "@/services/api";

export type EnergyMonthlyStat = {
  id: string;
  country: { id: number; name: string };
  year: number;
  month: number;
  sites_integrated?: number | null;
  sites_monitored?: number | null;
  grid_mwh?: number | null;
  solar_mwh?: number | null;
  generators_mwh?: number | null;
  telecom_mwh?: number | null;
  grid_pct?: number | null;
  rer_pct?: number | null;
  generators_pct?: number | null;
  avg_telecom_load_mw?: number | null;
  source_filename?: string | null;
  imported_at?: string;
};



export type EnergyListParams = {
  page?: number;
  page_size?: number;
  year?: string | number;
  search?: string;
};

export async function listEnergyStats(params: EnergyListParams = {}) {
  const { data } = await api.get("/energy/", {
    params: {
      page: params.page,
      page_size: params.page_size,
      year: params.year,
      search: params.search,
    },
  });

  // ✅ Gérer les deux formes: paginée OU tableau brut
  const items: EnergyMonthlyStat[] = Array.isArray(data)
    ? (data as EnergyMonthlyStat[])
    : ((data?.results ?? data?.items ?? []) as EnergyMonthlyStat[]);

  const total: number = Array.isArray(data)
    ? data.length
    : (data?.count ?? data?.total ?? items.length ?? 0);

  return { items, total };
}

export async function uploadEnergyFile(file: File, extra?: Record<string, string>) {
  const formData = new FormData();
  formData.append("file", file);
  if (extra) Object.entries(extra).forEach(([k,v]) => v && formData.append(k, v));
  const { data } = await api.post("/energy/import/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function deleteEnergyStat(id: string) {
  const { data } = await api.delete(`/energy/${id}/`);
  return data;
}

// Optionnel (si tu exposes ces endpoints côté backend)
export async function fetchEnergyKPI() {
  const { data } = await api.get("/energy/kpi-stats/");
  return data; // { total_grid, total_solar, total_gen, rer_avg, load_avg, ... }
}

export async function fetchEnergyStatsRange({ start_year, end_year }: { start_year?: number; end_year?: number } = {}) {
  const { data } = await api.get("/energy/stats/", { params: { start_year, end_year } });
  return data; // tableau d'agrégats par mois/année selon ton implémentation backend
}
