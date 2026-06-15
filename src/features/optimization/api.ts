import { api } from "@/services/api";

export type OptimizationStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED";
export type OptimizationResultStatus = "OK" | "SKIPPED" | "ERROR";
export type TariffFamily = "MT" | "BT" | "UNKNOWN";
export type BestOptimizationType = "NONE" | "POWER" | "TARIFF" | "BOTH";

export type OptimizationBatch = {
  id: number;
  status: OptimizationStatus;

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

  status: OptimizationResultStatus;

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
  tariff_family?: TariffFamily;

  facture_reference?: string | number | null;

  ps_min_applicable?: string | number | null;
  ps_optimized?: string | number | null;
  facture_power_optimized?: string | number | null;
  gain_power?: string | number | null;

  tariff_optimized?: string | null;
  facture_tariff_optimized?: string | number | null;
  gain_tariff?: string | number | null;

  best_optimization_type?: BestOptimizationType;
  best_facture_optimized?: string | number | null;
  best_gain?: string | number | null;

  simulation_details?: any;

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

/**
 * Lance l’optimisation Puissance + Tarif.
 *
 * Le backend garde encore l’URL /run-power/ pour compatibilité,
 * mais le traitement calcule maintenant puissance, tarif et meilleur scénario.
 */
export async function runOptimizationApi(payload: {
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

/**
 * Alias temporaire pour ne pas casser les composants existants.
 * À terme, utilise plutôt runOptimizationApi dans la page.
 */
export const runPowerOptimizationApi = runOptimizationApi;

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
  best_type?: BestOptimizationType | string;
  status?: OptimizationResultStatus | string;
  gain_only?: boolean;
  no_gain_only?: boolean;
  tariff_current?: string;
  tariff_optimized?: string;
  site_id?: string;
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
      no_gain_only: params?.no_gain_only ? "true" : undefined,

      tariff_current: params?.tariff_current || undefined,
      tariff_optimized: params?.tariff_optimized || undefined,
      site_id: params?.site_id || undefined,

      page: params?.page || 1,
      page_size: params?.page_size || 25,
    },
  });

  return normalizePaginatedResults(data);
}

export async function listAllOptimizationResultsApi(params?: {
  batch?: number | string;
  search?: string;
  best_type?: BestOptimizationType | string;
  status?: OptimizationResultStatus | string;
  gain_only?: boolean;
  no_gain_only?: boolean;
  tariff_current?: string;
  tariff_optimized?: string;
  site_id?: string;
}) {
  const pageSize = 100;
  let page = 1;
  let allRows: OptimizationResult[] = [];

  while (true) {
    const res = await listOptimizationResultsApi({
      ...params,
      page,
      page_size: pageSize,
    });

    allRows = [...allRows, ...res.rows];

    if (allRows.length >= res.count || res.rows.length === 0) {
      break;
    }

    page += 1;
  }

  return allRows;
}

export async function getOptimizationResultApi(id: number | string) {
  const { data } = await api.get<OptimizationResult>(
    `/optimization/results/${id}/`
  );

  return data;
}