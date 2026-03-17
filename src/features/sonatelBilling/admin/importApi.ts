// src/features/sonatelBilling/admin/importApi.ts
import { api } from "@/services/api";

export type DRFList<T> = { count: number; next: string | null; previous: string | null; results: T[] };

export type TaskStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILURE";

export type ImportBatch = {
  id: number;
  kind: string;
  source_filename: string;
  imported_at: string;
  imported_by?: number | null;
  task_id?: string | null;
  task_status: TaskStatus;
  task_progress: number;       // 0-100
  task_message: string;
  task_meta?: ImportResult | null;
  task_updated_at?: string | null;
};

export type ImportResult = {
  rows_created: number;
  rows_updated: number;
  monthly_rows_created: number;
  skipped_missing_required: number;
  skipped_invalid_period: number;
  skipped_duplicate_in_file: number;
  issues_logged: number;
  contract_months_upserted: number;
  contract_months_deleted: number;
  invoices_missing_site_count: number;
  invoices_missing_site_sample: string[];
  // champs de progression intermédiaire
  rows_processed?: number;
  total_rows?: number;
  created?: number;
  updated?: number;
  issues?: number;
  missing_site?: number;
};

export type ImportIssue = {
  id: number;
  row_number: number | null;
  severity: "INFO" | "WARN" | "ERROR";
  field?: string | null;
  message: string;
  raw_data?: any;
  created_at: string;
};

// ── Batches ───────────────────────────────────────────────────────────────────

export async function listBatches(params?: { kind?: string; page?: number; page_size?: number }) {
  const { data } = await api.get<DRFList<ImportBatch>>("/sonatel-billing/batches/", { params });
  return data;
}

export async function getBatchTaskStatus(batchId: number): Promise<ImportBatch> {
  const { data } = await api.get<ImportBatch>(
    `/sonatel-billing/batches/${batchId}/task-status/`
  );
  return data;
}

export async function getBatchIssues(batchId: number, params?: { severity?: string }) {
  const { data } = await api.get<ImportIssue[]>(
    `/sonatel-billing/batches/${batchId}/issues/`,
    { params }
  );
  return data;
}

// ── Import async ──────────────────────────────────────────────────────────────

/**
 * Lance l'import en arrière-plan. Retourne immédiatement avec { batch, task_id }.
 * Utiliser pollImportStatus() pour suivre la progression.
 */
export async function startImportInvoices(
  file: File,
  echeance: string
): Promise<{ batch: ImportBatch; task_id: string }> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("echeance", echeance);
  const { data } = await api.post(
    "/sonatel-billing/batches/import/",
    fd,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data as { batch: ImportBatch; task_id: string };
}

/**
 * Poll la progression d'un batch jusqu'à SUCCESS ou FAILURE.
 * @param batchId - ID du batch retourné par startImportInvoices
 * @param onProgress - callback appelé à chaque tick
 * @param intervalMs - intervalle de polling (défaut: 1500ms)
 */
export function pollImportStatus(
  batchId: number,
  onProgress: (batch: ImportBatch) => void,
  intervalMs = 1500
): () => void {
  let stopped = false;
  let timeoutId: ReturnType<typeof setTimeout>;

  const poll = async () => {
    if (stopped) return;
    try {
      const batch = await getBatchTaskStatus(batchId);
      onProgress(batch);
      if (batch.task_status === "SUCCESS" || batch.task_status === "FAILURE") {
        return;
      }
    } catch {
      // réseau instable — on continue quand même
    }
    if (!stopped) {
      timeoutId = setTimeout(poll, intervalMs);
    }
  };

  timeoutId = setTimeout(poll, 400); // premier tick rapide

  return () => {
    stopped = true;
    clearTimeout(timeoutId);
  };
}

// ── Autres imports (inchangés) ────────────────────────────────────────────────

export async function importStatusUpdate(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await api.post("/sonatel-billing/batches/import-status-update/", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data as {
    batch_id: number;
    updated: number;
    skipped: number;
    issues_logged: number;
    file: string;
  };
}