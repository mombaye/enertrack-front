import { api } from "@/services/api";

export interface Site {
  id: number;
  site_id: string;
  name: string;

  modernized: boolean | null;
  ordered_typology: string | null;
  installed_typology: string | null;
  contract_number: string | null;
  meter_number: string | null;
  billing_typology: string | null;
  load_analyses: number | null;
  site_type: string | null;
  transformer_capacity: number | null;

  indoor_billed_outdoor: boolean | null;
  not_yet_solarized: boolean | null;
  energy_desk_comment: string | null;

  invoice_payment: string | null;
  grid_fee: boolean | null;
  batch_operational: string | null;

  zone: string | null;
  country: string;

  created_at?: string;
  updated_at?: string;
}

export const fetchSites = (params?: Record<string, any>) =>
  api.get<Site[] | { results: Site[] }>("/core/sites/", { params }).then((res) => {
    const data = res.data;
    return Array.isArray(data) ? data : data.results || [];
  });

export const fetchSiteById = (id: number) =>
  api.get<Site>(`/core/sites/${id}/`).then((res) => res.data);

export const createSite = (data: Partial<Site>) =>
  api.post<Site>("/core/sites/", data).then((res) => res.data);

export const updateSite = (id: number, data: Partial<Site>) =>
  api.put<Site>(`/core/sites/${id}/`, data).then((res) => res.data);

export const patchSite = (id: number, data: Partial<Site>) =>
  api.patch<Site>(`/core/sites/${id}/`, data).then((res) => res.data);

export const deleteSite = (id: number) =>
  api.delete(`/core/sites/${id}/`).then((res) => res.data);

export const importSitesExcel = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  return api.post("/core/import/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then((res) => res.data);
};