import { api } from "@/services/api";

export type DRFList<T> = { count: number; next: string | null; previous: string | null; results: T[] };

export type SiteLite = {
  id: number;        // pk Site
  site_id: string;   // code site
  name?: string;
};

export type SonatelInvoice = {
  id: number;
  site?: SiteLite | null;

  numero_compte_contrat: string;
  numero_facture: string;
  date_comptable_facture?: string | null;

  date_debut_periode: string; // YYYY-MM-DD
  date_fin_periode: string;

  montant_hors_tva: string | null;
  montant_ttc: string | null;

  // ✅ données cibles
  abonnement_calcule: string | null;
  penalite_abonnement_calculee: string | null;
  energie_calculee: string | null;

  status: "CREATED" | "VALIDATED" | "CONTESTED";
};

export type MonthlySynthesis = {
  id: number;
  year: number;
  month: number;

  numero_compte_contrat: string;
  numero_facture: string;

  // ✅ enrichi côté serializer (pour “site partout”)
  site_id?: string | null;
  site_name?: string | null;

  conso: string | null;
  montant_hors_tva: string | null;
  montant_ttc: string | null;

  abonnement_calcule: string | null;
  penalite_abonnement_calculee: string | null;
  energie_calculee: string | null;

  status: "CREATED" | "VALIDATED" | "CONTESTED";
};

export type ContractMonth = {
  id: number;
  year: number;
  month: number;
  numero_compte_contrat: string;

  // ✅ enrichi côté serializer
  site_id?: string | null;
  site_name?: string | null;

  conso: string | null;
  montant_hors_tva: string | null;
  montant_ttc: string | null;

  abonnement_calcule: string | null;
  penalite_abonnement_calculee: string | null;
  energie_calculee: string | null;

  invoices_count: number;
};

export type ImportBatch = {
  id: number;
  kind: string;
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

function qs(params: Record<string, any>) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : "";
}

// -------------------- LISTS --------------------
export async function listInvoices(params: {
  search?: string;
  status?: string;
  site?: string; // site_id
  page?: number;
  page_size?: number;
  start?: string; // ✅ NEW
  end?: string;   // ✅ NEW
}) {
  const { data } = await api.get<DRFList<SonatelInvoice>>(`/sonatel-billing/records/${qs(params)}`);
  return data;
}

export async function listMonthly(params: {
  year?: number;
  month?: number;
  account?: string;
  facture?: string;
  status?: string;
  site?: string; // site_id (si tu le gères côté backend)
  page?: number;
  page_size?: number;
  start?: string; // ✅ NEW
  end?: string;   // ✅ NEW
}) {
  const { data } = await api.get<DRFList<MonthlySynthesis>>(`/sonatel-billing/monthly/${qs(params)}`);
  return data;
}

export async function listContractMonths(params: {
  year?: number;
  month?: number;
  account?: string;
  status?: string;
  site?: string;
  page?: number;
  page_size?: number;
}) {
  const { data } = await api.get<DRFList<ContractMonth>>(`/sonatel-billing/contract-months/${qs(params)}`);
  return data;
}



// -------------------- IMPORTS --------------------
export async function importInvoicesFile(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await api.post(`/sonatel-billing/batches/import/`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function importStatusUpdateFile(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await api.post(`/sonatel-billing/batches/import-status-update/`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

// -------------------- BATCHES / ISSUES --------------------
export async function listBatches(params: { kind?: string; page?: number; page_size?: number }) {
  const { data } = await api.get<DRFList<ImportBatch>>(`/sonatel-billing/batches/${qs(params)}`);
  return data;
}

export async function listBatchIssues(batchId: number, params: { severity?: string } = {}) {
  const { data } = await api.get<ImportIssue[]>(`/sonatel-billing/batches/${batchId}/issues/${qs(params)}`);
  return data;
}





export type SonatelBillingStats = {
  range: { start: string; end: string };
  top: {
    conso_vs_montant: Array<any>;
    cosphi: Array<any>;
    pen_prime: Array<any>;
    abonnement: Array<any>;
  };
  evolution: Array<{
    period: string;
    invoices: number;
    montant_ht: string;
    montant_ttc: string;
    nrj: string;
    abonnement: string;
    penalite_prime: string;
    cosphi: string;
  }>;
  distribution_ht: {
    total_ht: string;
    parts: Array<{ key: string; label: string; value: string; percent: number }>;
  };
};

export function getSonatelBillingStats(params: { start: string; end: string }) {
  // ⚠️ adapte si ton baseURL inclut déjà /api
  return api.get("/sonatel-billing/stats/", { params }).then((r) => r.data as SonatelBillingStats);
}