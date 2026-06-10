import { api } from "@/services/api";

export type OptimizationBatch = {
  id: number;
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED";
  launched_at?: string;
  started_at?: string;
  finished_at?: string;
  celery_task_id?: string | null;
  only_eligible_sites?: boolean;
  contracts_count: number;
  contracts_analyzed: number;
  contracts_skipped: number;
  optimizable_power_count: number;
  total_power_gain: string | number;
  optimizable_tariff_count: number;
  total_tariff_gain: string | number;
  optimizable_total_count: number;
  total_best_gain: string | number;
  error_message?: string | null;
};

export type OptimizationResult = {
  id: number;
  batch: number;
  status: "OK" | "SKIPPED" | "ERROR";
  numero_compte_contrat: string;
  site?: number | null;
  site_id?: string | null;
  site_code?: string | null;
  site_name?: string | null;
  date_ref?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  invoices_count?: number;
  prorated_invoice_count?: number;
  conso_annuelle?: string | number | null;
  montant_ht_annuel?: string | number | null;
  ps_current?: string | number | null;
  pmax_avg?: string | number | null;
  pmax_max?: string | number | null;
  puissance_transfo?: string | number | null;
  cosphi_avg?: string | number | null;
  tariff_current?: string | null;
  tariff_family?: "MT" | "BT" | "UNKNOWN";
  facture_reference?: string | number | null;
  ps_min_applicable?: string | number | null;
  ps_optimized?: string | number | null;
  facture_power_optimized?: string | number | null;
  gain_power?: string | number | null;
  tariff_optimized?: string | null;
  facture_tariff_optimized?: string | number | null;
  gain_tariff?: string | number | null;
  best_optimization_type?: "NONE" | "POWER" | "TARIFF" | "BOTH";
  best_facture_optimized?: string | number | null;
  best_gain?: string | number | null;
  warning_message?: string | null;
  error_message?: string | null;
  computed_at?: string;
};

export type PaginatedOptimizationResults = {
  rows: OptimizationResult[];
  count: number;
  next: string | null;
  previous: string | null;
};

function normalizeListResponse<T>(payload: any): T[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function normalizePaginatedResults(payload: any): PaginatedOptimizationResults {
  if (Array.isArray(payload)) {
    return {
      rows: payload,
      count: payload.length,
      next: null,
      previous: null,
    };
  }

  return {
    rows: Array.isArray(payload?.results) ? payload.results : [],
    count: Number(payload?.count || 0),
    next: payload?.next || null,
    previous: payload?.previous || null,
  };
}

export async function runPowerOptimizationApi(payload: {
  eligible?: boolean;
  ref_date?: string;
}) {
  const { data } = await api.post("/optimization/run-power/", {
    eligible: payload.eligible ?? true,
    ref_date: payload.ref_date || undefined,
  });

  return data as {
    message: string;
    batch: OptimizationBatch;
  };
}

export async function listOptimizationBatchesApi() {
  const { data } = await api.get("/optimization/batches/", {
    params: {
      page_size: 10,
    },
  });

  return normalizeListResponse<OptimizationBatch>(data);
}

export async function listOptimizationResultsApi(params?: {
  batch?: number | string;
  search?: string;
  best_type?: string;
  status?: string;
  gain_only?: boolean;
  page?: number;
  page_size?: number;
}) {
  const { data } = await api.get("/optimization/results/", {
    params: {
      batch: params?.batch || undefined,
      search: params?.search || undefined,
      best_type: params?.best_type || undefined,
      status: params?.status || undefined,
      gain_only: params?.gain_only ? "true" : undefined,
      page: params?.page || 1,
      page_size: params?.page_size || 25,
    },
  });

  return normalizePaginatedResults(data);
}