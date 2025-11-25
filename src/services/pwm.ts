// ==================================
// src/services/pwm.ts
// ==================================
import { api } from "@/services/api";

/* --- Types --- */
export type Country = { id: number; name: string };
export type Site =   { id: number; site_id: string; site_name?: string | null; country?: Country | null };

export type PwmReport = {
  id: string | number;

  country: Country | null;
  site: Site | null;

  report_date?: string | null;   // “Report Date” en tête
  period_start: string;          // “Start Date”
  period_end: string;            // “End Date”
  source_filename?: string | null;

  // Métadonnées éventuelles
  site_name?: string | null;
  site_class?: string | null;

  // États d’installation (si tu les exposes)
  grid_status?: string | null;
  dg_status?: string | null;
  solar_status?: string | null;

  // Mesures clés (subset utile pour l’UI)
  typology_power_w?: number | null;
  grid_act_pwm_avg_w?: number | null;

  dc1_pwm_avg_w?: number | null;
  dc2_pwm_avg_w?: number | null;
  dc3_pwm_avg_w?: number | null;
  dc4_pwm_avg_w?: number | null;
  dc5_pwm_avg_w?: number | null;
  dc6_pwm_avg_w?: number | null;
  dc7_pwm_avg_w?: number | null;
  dc8_pwm_avg_w?: number | null;
  dc9_pwm_avg_w?: number | null;
  dc10_pwm_avg_w?: number | null;
  dc11_pwm_avg_w?: number | null;
  dc12_pwm_avg_w?: number | null;

  total_pwm_min_w?: number | null;
  total_pwm_avg_w?: number | null;
  total_pwm_max_w?: number | null;
  total_pwc_avg_load_w?: number | null;

  dc_pwm_avg_uptime_pct?: number | null;
  pwc_uptime_pct?: number | null;
  router_uptime_pct?: number | null;

  typology_load_vs_pwm_real_load_pct?: number | null;
  grid_availability_pct?: number | null;

  number_grid_cuts?: number | null;
  total_grid_cuts_minutes?: number | null;
};

export type PwmListParams = {
  page?: number;
  page_size?: number;
  q?: string;              // recherche libre (site id / nom)
  country?: string;
  site_id?: string;
  date_from?: string;      // yyyy-mm-dd
  date_to?: string;        // yyyy-mm-dd
};

/* --- List --- */
export async function listPwmReports(params: PwmListParams = {}) {
  const { data } = await api.get("/pwm/", {
    params: {
      page: params.page,
      page_size: params.page_size,
      q: params.q,
      country: params.country,
      site_id: params.site_id,
      date_from: params.date_from,
      date_to: params.date_to,
    },
  });

  // ✅ Supporte pagination DRF OU tableau brut
  const items: PwmReport[] = Array.isArray(data)
    ? (data as PwmReport[])
    : ((data?.results ?? data?.items ?? []) as PwmReport[]);

  const total: number = Array.isArray(data)
    ? data.length
    : (data?.count ?? data?.total ?? items.length ?? 0);

  return { items, total };
}

/* --- Import --- */
export async function uploadPwmFile(file: File, extra?: Record<string, string>) {
  const formData = new FormData();
  formData.append("file", file);
  if (extra) Object.entries(extra).forEach(([k, v]) => v && formData.append(k, v));

  const { data } = await api.post("/pwm/import/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

/* --- Delete (optionnel si exposé côté API) --- */
export async function deletePwmReport(id: string | number) {
  const { data } = await api.delete(`/pwm/${id}/`);
  return data;
}

/* --- KPI/agrégats (optionnels si exposés) --- */
export async function fetchPwmKPI() {
  const { data } = await api.get("/pwm/kpi-stats/");
  return data;
}

export async function fetchPwmStatsRange(params: { date_from?: string; date_to?: string } = {}) {
  const { data } = await api.get("/pwm/stats/", { params });
  return data;
}
