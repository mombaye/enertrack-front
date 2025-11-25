// src/services/sonatelBilling.ts
import { api } from "@/services/api";

export type ImportBatch = {
  id: number;
  source_filename: string;
  imported_at: string;
};

export type SonatelInvoice = {
  id: number;
  batch: number;
  numero_compte_contrat: string;
  partenaire?: string | null;
  localite?: string | null;
  arrondissement?: string | null;
  rue?: string | null;
  numero_facture: string;
  date_comptable_facture: string;
  montant_total_energie?: string | null;
  montant_redevance?: string | null;
  montant_tco?: string | null;
  montant_hors_tva?: string | null;
  montant_tva?: string | null;
  montant_ttc?: string | null;
  date_debut_periode: string;
  date_fin_periode: string;
  ancien_index_k1?: string | null;
  ancien_index_k2?: string | null;
  nouvel_index_k1?: string | null;
  nouvel_index_k2?: string | null;
  conso_facturee?: string | null;
  agence?: string | null;
  numero_compteur?: string | null;
};

export type MonthlyRow = {
  id: number;
  source: number;
  year: number;
  month: number;
  days_in_month: number;
  days_covered: number;
  conso?: string | null;
  montant_energie?: string | null;
  montant_ttc?: string | null;
  numero_compte_contrat: string;
  numero_facture: string;
};

export async function importSonatelFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<{ batch: ImportBatch; rows_created: number }>(
    "/sonatel-billing/batches/import/",
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data;
}

export async function listBatches() {
  const { data } = await api.get<ImportBatch[]>("/sonatel-billing/batches/");
  return data;
}

export async function listInvoices(params?: {
  search?: string; // numero_facture | compte | compteur
  page?: number;
  page_size?: number;
}) {
  // si ton api n’a pas de pagination DRF, on ignore page/page_size
  const { data } = await api.get<SonatelInvoice[]>("/sonatel-billing/records/", {
    params,
  });
  return data;
}

export async function listMonthly(params?: {
  year?: number | string;
  month?: number | string;
  account?: string;
  facture?: string;
}) {
  const { data } = await api.get<MonthlyRow[]>("/sonatel-billing/monthly/", {
    params,
  });
  return data;
}
