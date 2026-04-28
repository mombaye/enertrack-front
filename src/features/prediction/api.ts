// src/features/prediction/api.ts
import { api } from "@/services/api";

export type PredictionEvent = {
  name: string;
  date: string;
  window_start?: string;
  window_end?: string;
  days_in_month?: number;
  zone_weight?: number;
  pressure?: number;
};

export type PredictionMeteo = {
  temp_max_mean?: number;
  temp_min_mean?: number;
  precip_total?: number;
  humidity_max?: number;
  et0_mean?: number;
  is_hivernage?: number;
  meteo_source?: string;
};

export type PredictionBaseline = {
  lag_1m?: number;
  lag_3m?: number;
  lag_6m?: number;
  lag_12m?: number;
  same_month_avg?: number;
  rolling_3m?: number;
  rolling_6m?: number;
  trend_3m_vs_12m?: number;
};

export type PredictionEstimation = {
  available?: boolean;
  source?: string | null;
  conso_estimee_kwh?: number | null;
  source_score?: number;
};

export type PredictionMonth = {
  period: string;
  year: number;
  month: number;

  conso_pred: number;
  conso_full_month_model?: number | null;
  conso_rule_based?: number | null;
  conso_ml?: number | null;

  observed_kwh?: number;
  remaining_pred_kwh?: number;
  is_partial_month?: boolean;
  observed_days?: number;
  remaining_days?: number;

  ht_pred: number;
  redevance?: number;
  marge_pred: number;
  marge_ok: boolean;

  ic_lo: number;
  ic_hi: number;
  confidence: number;
  fnp_score: number;

  baseline?: PredictionBaseline;
  events?: PredictionEvent[];
  event_pressure?: number;
  meteo?: PredictionMeteo;
  estimation?: PredictionEstimation;
  explanation?: string[];

  // Compat ancienne version
  top_factors?: { feature: string; impact: number }[];
};

export type PredictionHistoricMonth = {
  period: string;
  conso?: number;
  conso_full?: number;
  ht?: number;
  days?: number;
  is_partial?: boolean;
};

export type PredictionResponse = {
  site_id: string;
  site_name?: string | null;

  // Ancien champ possible
  zone?: string;

  // Nouveaux champs backend
  zone_raw?: string;
  zone_normalized?: string;

  horizon: number;
  period_start?: string;
  period_end?: string;
  generated_at: string;
  model_version: string;
  model_used?: boolean;

  historic: PredictionHistoricMonth[];
  predictions: PredictionMonth[];
};

export type PredictionParams = {
  site: string;
  horizon?: number;
  year_start?: number;
  month_start?: number;
  year_end?: number;
  month_end?: number;
};

export function getPrediction(params: PredictionParams) {
  return api
    .get<PredictionResponse>("/prediction/forecast/", { params })
    .then((r) => r.data);
}

// ─────────────────────────────────────────────
// Bulk / parc global
// ─────────────────────────────────────────────

export type PredictionBulkSummary = {
  period_start: string;
  period_end: string;
  zone?: string | null;
  sites_requested: number;
  sites_processed: number;
  sites_error: number;
  months_predicted: number;
  total_conso_pred: number;
  total_ht_pred: number;
  total_marge_pred: number;
  months_marge_nok: number;
  avg_confidence: number;
};

export type PredictionBulkResponse = {
  mode: "bulk";
  generated_at: string;
  summary: PredictionBulkSummary;
  results: PredictionResponse[];
  errors: { "Site ID": string; Erreur: string }[];
};

export type PredictionBulkParams = {
  horizon?: number;
  year_start?: number;
  month_start?: number;
  year_end?: number;
  month_end?: number;
  zone?: string;
  search?: string;
  limit?: number;
};

export function getPredictionBulk(params: PredictionBulkParams) {
  return api
    .get<PredictionBulkResponse>("/prediction/forecast-bulk/", { params })
    .then((r) => r.data);
}

export async function exportPredictionBulkExcel(params: PredictionBulkParams) {
  const response = await api.get("/prediction/forecast-bulk/", {
    params: {
      ...params,
      export: "xlsx",
    },
    responseType: "blob",
  });

  const contentDisposition = response.headers?.["content-disposition"];
  const match = contentDisposition?.match(/filename="?([^"]+)"?/);
  const filename =
    match?.[1] ||
    `prediction_parc_${params.year_start || ""}_${params.month_start || ""}.xlsx`;

  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}