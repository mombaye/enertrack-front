import { api } from "@/services/api";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface EstimationBatch {
  id: number;
  year: number;
  month: number;
  label: string;
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED";
  created_at: string;
  finished_at: string | null;
  total: number;
  count_acm: number;
  count_grid: number;
  count_histo: number;
  count_nc: number;
  count_hors_scope: number;
}

export interface EstimationResult {
  id: number;
  batch: number;
  site_id: string;
  site_name: string;
  numero_compte_contrat: string;
  source_utilisee: "ACM" | "GRID" | "HISTO" | "THEORIQUE" | "TARGET" | "NC" | "HORS_SCOPE";
  acm_disponible: boolean;
  acm_conso_kwh: string | null;
  grid_disponible: boolean;
  grid_conso_kwh: string | null;
  fiabilite_grid: "CORRECT" | "NOT_CORRECT" | "MISSING" | "NA";
  fiabilite_ratio: string | null;
  histo_disponible: boolean;
  histo_conso_30j: string | null;
  histo_nb_mois: number | null;
  nb_jours_mois: number | null;
  conso_estimee_kwh: string | null;
  montant_estime: string | null;
  montant_nrj: string | null;
  montant_abonnement: string | null;
  montant_redevance: string | null;
  montant_tco: string | null;
  error_message: string | null;
  computed_at: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────
export const fetchBatches = async (): Promise<{ results: EstimationBatch[]; count: number }> => {
  const { data } = await api.get("/estimation/batches/");
  return data;
};

export const fetchBatchStatus = async (id: number): Promise<EstimationBatch> => {
  const { data } = await api.get(`/estimation/batches/${id}/status/`);
  return data;
};

export const fetchResults = async (batchId: number, page: number, source?: string): Promise<{ results: EstimationResult[]; count: number }> => {
  const { data } = await api.get("/estimation/results/", {
    params: { batch: batchId, page, page_size: 25, ...(source ? { source } : {}) },
  });
  return data;
};

export const launchBatch = async ({ year, month }: { year: number; month: number }) => {
  const { data } = await api.post("/estimation/batches/launch/", { year, month });
  return data;
};