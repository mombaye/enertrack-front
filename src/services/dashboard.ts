// src/services/dashboard.ts

import { api } from "@/services/api";

export interface DashboardRange {
  start: string;
  end: string;
}

export interface DashboardEvolutionPoint {
  period:      string;
  invoices:    number;
  montant_ht:  string;
  montant_ttc: string;
  nrj:         string;
  conso:       string;
  abonnement:  string;
  pen_prime:   string;
  cosphi:      string;
}

export interface DashboardStatusDist {
  status:  string;
  count:   number;
  percent: number;
}

export interface DashboardLastImport {
  id:              number;
  source_filename: string;
  imported_at:     string;
}

export interface DashboardBilling {
  total_invoices:      number;
  total_ttc:           string;
  total_ht:            string;
  total_nrj:           string;
  total_conso_kwh:     string;
  total_abo:           string;
  total_pen:           string;
  total_cosphi:        string;
  active_contracts:    number;
  active_sites:        number;
  last_import:         DashboardLastImport | null;
  status_distribution: DashboardStatusDist[];
  evolution:           DashboardEvolutionPoint[];
}

export interface DashboardCertBatch {
  id:               number;
  echeance:         string;
  status:           string;
  launched_at:      string | null;
  finished_at:      string | null;
  total:            number;
  certified_fms:    number;
  certified_senelec:number;
  needs_review:     number;
  unknown_contract: number;
  fms_unavailable:  number;
}

export interface DashboardCertification {
  last_batch:             DashboardCertBatch | null;
  global_rate: {
    certified_fms:     number;
    certified_senelec: number;
    needs_review:      number;
    unknown_contract:  number;
    fms_unavailable:   number;
  };
  history:                DashboardCertBatch[];
  total_batches_in_range: number;
}

export interface DashboardSummary {
  range:         DashboardRange;
  billing:       DashboardBilling;
  certification: DashboardCertification;
}

export async function getDashboardSummary(params: {
  start?: string;
  end?: string;
}): Promise<DashboardSummary> {
  const { data } = await api.get("/dashboard/summary/", { params });
  return data;
}