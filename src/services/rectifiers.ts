// src/services/rectifiers.ts
import { api } from "@/services/api";

export type SiteRef = {
  id: number;
  site_id: string;
  site_name: string;
  country?: { id: number; name: string };
};

export type RectifierReading = {
  id: string;
  country: number | { id: number; name: string };
  site: SiteRef;
  param_name: string;
  param_value: number | null;
  measure?: string | null;
  measured_at: string;           // ISO
  source_filename?: string | null;
  imported_at?: string;
};

export type RectifierListParams = {
  page?: number;
  page_size?: number;
  q?: string;
  site_id?: string;
  country?: string;
  param?: string;
  date_from?: string; // "2025-05-01"
  date_to?: string;   // "2025-05-31"
};

export async function listRectifiers(params: RectifierListParams = {}) {
  const { data } = await api.get("/rectifiers/", { params });
  const items: RectifierReading[] = Array.isArray(data)
    ? data
    : (data?.results ?? data?.items ?? []);
  const total: number = Array.isArray(data)
    ? data.length
    : (data?.count ?? data?.total ?? items.length ?? 0);
  return { items, total };
}

export async function uploadRectifierFile(file: File, extra?: Record<string, string>) {
  const fd = new FormData();
  fd.append("file", file);
  if (extra) Object.entries(extra).forEach(([k,v]) => v && fd.append(k, v));
  const { data } = await api.post("/rectifiers/import/", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
