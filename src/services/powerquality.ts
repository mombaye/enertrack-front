// src/services/powerquality.ts
import { api } from "@/services/api";

export type PQCountry = { id: number; name: string };
export type PQSite = { id: number; site_id: string; site_name: string; country?: PQCountry };

export type PQReport = {
  id: string;
  country: PQCountry;
  site: PQSite;

  begin_period: string;
  end_period: string;
  extract_date?: string | null;

  mono_vmin_v?: number | null;
  mono_vavg_v?: number | null;
  mono_vmax_v?: number | null;
  mono_imin_a?: number | null;
  mono_iavg_a?: number | null;
  mono_imax_a?: number | null;
  mono_pmin_kw?: number | null;
  mono_pavg_kw?: number | null;
  mono_pmax_kw?: number | null;
  mono_total_energy_kwh?: number | null;
  mono_energy_consumed_kwh?: number | null;

  tri_total_energy_kwh?: number | null;
  tri_active_energy_kwh?: number | null;
  tri_reactive_energy_kvarh?: number | null;
  tri_apparent_energy_kvah?: number | null;

  source_filename?: string | null;
  imported_at?: string;
};

export type PQListParams = {
  page?: number;
  page_size?: number;
  q?: string;
  country?: string;
  date_from?: string; // ISO date
  date_to?: string;   // ISO date
};

export async function listPQReports(params: PQListParams = {}) {
  const { data } = await api.get("/pq/", { params });
  const items: PQReport[] = Array.isArray(data)
    ? data
    : (data?.results ?? data?.items ?? []);
  const total: number = Array.isArray(data)
    ? data.length
    : (data?.count ?? data?.total ?? items.length ?? 0);
  return { items, total };
}

export async function uploadPQFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post("/pq/import/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
