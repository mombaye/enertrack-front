// src/services/certification.ts
import { api } from "@/services/api";

export type CertBatchStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED";

export type CertResultStatus =
  | "PENDING_CERTIFICATION"
  | "UNKNOWN_CONTRACT"
  | "FMS_UNAVAILABLE"
  | "CERTIFIED_FMS"
  | "CERTIFIED_SENELEC"
  | "NEEDS_REVIEW"
  | "MESURE_A_VERIFIER"; // ✅ v4 — alerte mesure (Conso_Facturée < 50% FMS ou Histo)

export type CertifiedByRule =
  | "FMS_PERIODE"   // Grid primaire — période
  | "FMS_30J"       // Grid primaire — 30j
  | "ACM_PERIODE"   // ACM fallback  — période
  | "ACM_30J"       // ACM fallback  — 30j
  | "HISTO_3MOIS";

export type CertificationBatch = {
  id: number;
  import_batch: number;
  echeance: string;
  echeance_year: number | null;
  echeance_month: number | null;
  status: CertBatchStatus;
  celery_task_id: string | null;
  launched_by: number | null;
  launched_by_username: string | null;
  launched_at: string;
  finished_at: string | null;
  total: number;
  certified_fms: number;
  certified_senelec: number;
  needs_review: number;
  unknown_contract: number;
  fms_unavailable: number;
  mesure_alert: number; // ✅ v4
};

export type CertificationBatchDetail = CertificationBatch & {
  breakdown: {
    certified_fms_pct: number;
    certified_senelec_pct: number;
    needs_review_pct: number;
    unknown_contract_pct: number;
    fms_unavailable_pct: number;
    mesure_alert_pct: number; // ✅ v4
  };
};

export type CertificationResult = {
  id: number;
  cert_batch: number;
  invoice: number;

  // Infos facture
  numero_facture: string;
  numero_compte_contrat: string;
  date_debut_periode: string;
  date_fin_periode: string;
  montant_ttc: string | null;
  montant_hors_tva: string | null;

  // Infos site
  site: number | null;
  site_id: string | null;
  site_name: string | null;

  // Statut
  status: CertResultStatus;
  certified_by_rule: CertifiedByRule | null;
  computed_at: string;

  // Étape 4 — consommations normalisées
  conso_facturee_periode: string | null;
  nb_jours_facturation: number | null;
  conso_facturee_30j: string | null;

  // Étape 5 — FMS Grid (source PRIMAIRE)
  fms_available: boolean;
  conso_fms_periode: string | null;
  conso_fms_30j: string | null;
  fms_last_complete_month: string | null;
  fms_error: string | null;

  // Étape 6 — Historique Sénélec
  histo_last_conso: string | null;
  histo_3mois_avg: string | null;

  // Étape 7A — Ratios FMS Grid
  ratio_fms_periode: string | null;
  ratio_fms_30j: string | null;
  ratio_histo_3mois: string | null;

  // Étape 7B — AC Power Meter (fallback si Grid absent)
  acm_available: boolean;
  estim_conso_acm_periode: string | null;
  estim_conso_acm_30j: string | null;
  ratio_acm_periode: string | null;
  ratio_acm_30j: string | null;
  acm_error: string | null;

  // Étape 9 — Alerte mesure v4
  flag_mesure_alert: boolean; // ✅ v4 — TRUE si Conso < 50% FMS ou Histo

  // Étape 10 — Cohérence montant
  montant_htva_calcule: string | null;
  variation_montant_pct: string | null;
  montant_coherent: boolean | null;
  montant_check_error: string | null;
};

export type BatchStatusPoll = {
  cert_batch_id: number;
  status: CertBatchStatus;
  echeance: string;
  launched_at: string;
  finished_at: string | null;
  celery_task_id: string | null;
  counters: {
    total: number;
    certified_fms: number;
    certified_senelec: number;
    needs_review: number;
    unknown_contract: number;
    fms_unavailable: number;
    mesure_alert: number; // ✅ v4
  };
};

export type EfmsHealth = {
  efms_reachable: boolean;
  host: string;
  port: number;
  checked_at: string;
};

const BASE = "/certification";

export async function launchCertification(import_batch_id: number) {
  const { data } = await api.post<{
    cert_batch_id: number;
    celery_task_id: string;
    status: CertBatchStatus;
    echeance: string;
    detail: string;
  }>(`${BASE}/batches/launch/`, { import_batch_id });
  return data;
}

export async function listCertBatches(params?: {
  status?: CertBatchStatus;
  year?: number;
  month?: number;
}) {
  const { data } = await api.get<CertificationBatch[]>(`${BASE}/batches/`, { params });
  return data;
}

export async function getCertBatch(id: number) {
  const { data } = await api.get<CertificationBatchDetail>(`${BASE}/batches/${id}/`);
  return data;
}

export async function pollBatchStatus(id: number) {
  const { data } = await api.get<BatchStatusPoll>(`${BASE}/batches/${id}/status/`);
  return data;
}

export async function listCertResults(params?: {
  cert_batch?: number;
  status?: CertResultStatus;
  site?: string;
  invoice?: string;
  fms_available?: boolean;
  flag_mesure_alert?: boolean; // ✅ v4
  page?: number;
  page_size?: number;
}) {
  const { data } = await api.get(`${BASE}/results/`, { params });
  return data;
}

export async function checkEfmsHealth() {
  const { data } = await api.get<EfmsHealth>(`${BASE}/efms-health/`);
  return data;
}

export type BillingImportTaskStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILURE";

export type BillingBatchTaskStatus = {
  id: number;
  task_id: string | null;
  task_status: BillingImportTaskStatus | null;
  task_progress: number;
  task_message: string | null;
  task_meta?: {
    rows_created?: number;
    rows_updated?: number;
    monthly_rows_created?: number;
    skipped_missing_required?: number;
    skipped_invalid_period?: number;
    skipped_duplicate_in_file?: number;
    issues_logged?: number;
    invoices_missing_site_count?: number;
    invoices_missing_site_sample?: string[];
  } | null;
  task_updated_at: string | null;
  source_filename: string;
  imported_at: string | null;
};

export async function pollBillingImportStatus(batchId: number) {
  const { data } = await api.get<BillingBatchTaskStatus>(
    `/sonatel-billing/batches/${batchId}/task-status/`
  );
  return data;
}