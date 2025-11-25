// src/services/siteEnergy.ts
import { api } from "@/services/api";

export type SiteRef = {
  id: number;
  site_id: string;
  site_name: string;
  country?: { id: number; name: string };
};

export type SiteEnergyRow = {
  id: string;
  site: SiteRef;
  year: number;
  month: number | string;
  grid_status: "YES"|"NO"|"NM"|"NI"|"0DG"|"NC";
  dg_status: "YES"|"NO"|"NM"|"NI"|"0DG"|"NC";
  solar_status: "YES"|"NO"|"NM"|"NI"|"0DG"|"NC";
  grid_energy_kwh?: number | null;
  solar_energy_kwh?: number | null;
  telecom_load_kwh?: number | null;
  grid_energy_pct?: number | null;
  rer_pct?: number | null;
  router_availability_pct?: number | null;
  pwm_availability_pct?: number | null;
  pwc_availability_pct?: number | null;
  source_filename?: string | null;
  imported_at?: string;
};

export type SiteEnergyListParams = {
  page?: number;
  page_size?: number;
  q?: string;
  year?: string | number;
  month?: string | number;
  country?: string;
};

export async function listSiteEnergy(params: SiteEnergyListParams = {}) {
  const { data } = await api.get("/site-energy/", { params });
  const items: SiteEnergyRow[] = Array.isArray(data)
    ? data
    : (data?.results ?? data?.items ?? []);
  const total: number = Array.isArray(data)
    ? data.length
    : (data?.count ?? data?.total ?? items.length ?? 0);
  return { items, total };
}

export async function uploadSiteEnergyFile(file: File, extra?: Record<string, string>) {
  const fd = new FormData();
  fd.append("file", file);
  if (extra) Object.entries(extra).forEach(([k,v])=> v && fd.append(k, v));
  const { data } = await api.post("/site-energy/import/", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
