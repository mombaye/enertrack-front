import { api } from "@/services/api";

export type DRFList<T> = { count: number; next: string | null; previous: string | null; results: T[] };

export type ImportBatch = {
  id: number;
  kind: string; // SENELEC_INVOICE / STATUS_UPDATE / ...
  source_filename: string;
  imported_at: string;
  imported_by?: number | null;
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

export async function listBatches(params?: { kind?: string; page?: number; page_size?: number }) {
  const { data } = await api.get<DRFList<ImportBatch>>("/sonatel-billing/batches/", { params });
  return data;
}

export async function getBatchIssues(batchId: number, params?: { severity?: string }) {
  const { data } = await api.get<ImportIssue[]>(`/sonatel-billing/batches/${batchId}/issues/`, { params });
  return data;
}

export async function importInvoices(file: File, echeance: any) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("echeance", echeance); // ✅ NEW
  const { data } = await api.post("/sonatel-billing/batches/import/", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data as {
    batch: ImportBatch;
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
  };
}



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
