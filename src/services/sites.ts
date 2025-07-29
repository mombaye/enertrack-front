// src/services/sites.ts
import { api } from "./api";

export interface Site {
  id: number;
  site_id: string;
  name: string;
  is_new: boolean;
  installation_date: string | null;
  activation_date: string | null;
  is_billed: boolean;
  real_typology: string | null;
  contratual_typology: string | null;
  billing_typology: string | null;
  power_kw: number | null;
  batch_aktivco: string | null;
  batch_operational: string | null;
  zone: string | null;
  country: string;
}

export const fetchSites = (params?: Record<string, any>) =>
  api.get<Site[]>("/core/sites/", { params }).then(res => res.data);

export const createSite = (data: Partial<Site>) =>
  api.post<Site>("/core/sites/", data).then(res => res.data);

export const updateSite = (id: number, data: Partial<Site>) =>
  api.put<Site>(`/core/sites/${id}/`, data).then(res => res.data);

export const deleteSite = (id: number) =>
  api.delete(`/core/sites/${id}/`).then(res => res.data);

export const importSitesExcel = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.post("/core/import/", formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
};
