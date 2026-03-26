import { api } from "@/services/api";

export interface Site {
  id: number;
  site_id: string;
  name: string;

  modernized: boolean | null;
  ordered_typology: string | null;
  installed_typology: string | null;
  billing_typology: string | null;

  contract_number: string | null;
  meter_number: string | null;

  analysis_load: number | null;
  load_band: string | null;

  site_type: string | null;
  ordered_site_type: string | null;
  installed_site_type: string | null;

  configuration: string | null;
  target_mapping_key: string | null;

  transformer_capacity: number | null;

  indoor_billed_outdoor: boolean | null;
  not_yet_solarized: boolean | null;
  solarization_date: string | null;

  energy_desk_comment: string | null;
  load_comment_category: string | null;

  invoice_payment: string | null;
  grid_fee: boolean | null;
  batch_operational: string | null;

  scope_status: "IN_SCOPE" | "OUT_OF_SCOPE" | "UNKNOWN" | null;
  meter_status: string | null;

  zone: string | null;
  country: string;

  created_at?: string;
  updated_at?: string;
}

export interface GridTargetRule {
  id: number;
  configuration: string;
  site_type: string | null;
  load_band: string | null;

  target_kwh: number | null;
  target_kwh_per_day: number | null;
  grid_fee_amount: number | null;

  active: boolean;
  source_sheet: string | null;
  source_row: number | null;

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

  return api
    .post("/core/import/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((res) => res.data);
};

export const fetchGridTargetRules = (params?: Record<string, any>) =>
  api
    .get<GridTargetRule[] | { results: GridTargetRule[] }>("/core/grid-target-rules/", {
      params,
    })
    .then((res) => {
      const data = res.data;
      return Array.isArray(data) ? data : data.results || [];
    });

export const fetchGridTargetRuleById = (id: number) =>
  api.get<GridTargetRule>(`/core/grid-target-rules/${id}/`).then((res) => res.data);

export const createGridTargetRule = (data: Partial<GridTargetRule>) =>
  api.post<GridTargetRule>("/core/grid-target-rules/", data).then((res) => res.data);

export const updateGridTargetRule = (id: number, data: Partial<GridTargetRule>) =>
  api.put<GridTargetRule>(`/core/grid-target-rules/${id}/`, data).then((res) => res.data);

export const patchGridTargetRule = (id: number, data: Partial<GridTargetRule>) =>
  api.patch<GridTargetRule>(`/core/grid-target-rules/${id}/`, data).then((res) => res.data);

export const deleteGridTargetRule = (id: number) =>
  api.delete(`/core/grid-target-rules/${id}/`).then((res) => res.data);

export const importGridTargetRulesExcel = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  return api
    .post("/core/grid-target-rules/import/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((res) => res.data);
};