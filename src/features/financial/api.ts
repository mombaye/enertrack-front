// src/features/financial/services.ts
import { api } from "@/services/api";
import { SonatelBillingStats } from "../sonatelBilling/api";

// ─── Types ────────────────────────────────────────────────────────────────────



export interface LoadsPage {
  count: number;
  page: number;
  page_size: number;
  pages: number;
  results: SiteMonthlyLoad[];
}

export interface FinancialEvaluation {
  id: number;
  site_id: string;
  site_name: string;
  zone: string | null;
  year: number;
  month: number;
  load_w: number | null;
  typology: string | null;
  configuration: string | null;
  redevance: string | null;
  montant_htva: string | null;
  marge: string | null;
  marge_statut: "OK" | "NOK" | null;
  hors_catalogue: boolean;
  fee_rule_load_w: number | null;
  periode_courte: boolean;
  nb_jours_factures: number | null;
  recurrence_mois_nok: number;
  recurrence_type: "light" | "critique" | null;
}

export interface EvaluationsPage {
  count: number;
  page: number;
  page_size: number;
  pages: number;
  results: FinancialEvaluation[];
}

export interface EvaluateResult {
  message: string;
  processed: number;
  ok: number;
  nok: number;
  no_load: number;
  no_fee_rule: number;
  no_invoice: number;
  hors_catalogue: number;
  periode_courte: boolean;
}

export interface FeeRuleImportResult {
  message: string;
  total_parsed: number;
  created: number;
  updated: number;
  skipped: number;
  errors_sample: { record: string; error: string }[];
}

export interface LoadImportResult {
  message: string;
  created: number;
  updated: number;
  skipped: number;
  errors_sample: { row: number; error: string }[];
}

// ── Dashboard types ───────────────────────────────────────────────────────────

export interface FacturesRedevancesPeriod {
  period: string;           // "2026-01"
  total_redevance: string;
  total_facture: string;
  total_marge: string;
  sites_ok: number;
  sites_nok: number;
}

export interface SiteMargeRow {
  site_id: string;
  site_name: string;
  marge_moyenne: string;
  nb_mois: number;
  nb_nok: number;
}

export interface SiteRecurrentRow {
  site_id: string;
  site_name: string;
  recurrence_type: "light" | "critique";
  mois_nok: number;
  marge_moyenne: string;
}




// ─── Evaluations ──────────────────────────────────────────────────────────────

export interface EvaluationStats {
  total_redevance: string;
  total_facture:   string;
  total_marge:     string;
  count_ok:        number;
  count_nok:       number;
  count_pc:        number;  // période courte
  count_hc:        number;  // hors catalogue
  count_total:     number;
}

export const fetchEvaluationStats = async (params: {
  year: number;
  month?: number;
  month_start?: number;
  month_end?: number;
}): Promise<EvaluationStats> => {
  const { data } = await api.get("/financial/evaluations/stats/", { params });
  return data;
};


export const runEvaluation = async (params: {
  year: number;
  month: number;
}): Promise<EvaluateResult> => {
  const { data } = await api.post("/financial/evaluate/", params);
  return data;
};

export const fetchEvaluations = async (params?: {
  year?: number;
  month?: number;
  month_start?: number;
  month_end?: number;
  statut?: "OK" | "NOK";
  hors_catalogue?: boolean;
  site?: string;
  search?: string;
  typology?: string;
  zone?: string;
  recurrence_type?: "light" | "critique";
  page?: number;
  page_size?: number;
}): Promise<EvaluationsPage> => {
  const { data } = await api.get("/financial/evaluations/", { params });
  return data;
};

export const exportEvaluationsCSV = (params?: {
  year?: number;
  month?: number;
  month_start?: number;
  month_end?: number;
  statut?: "OK" | "NOK";
  search?: string;
  typology?: string;
  zone?: string;
  recurrence_type?: "light" | "critique";
}) => {
  return api.get("/financial/evaluations/", {
    params: { ...params, export: "csv" },
    responseType: "blob",
  }).then(({ data }) => {
    const href = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = href;
    const suffix = params?.month
      ? `${params?.year || "all"}_${params?.month}`
      : `${params?.year || "all"}_${params?.month_start || 1}-${params?.month_end || 12}`;
    a.download = `evaluations_${suffix}.csv`;
    a.click();
    URL.revokeObjectURL(href);
  });
};

// ─── Dashboards ───────────────────────────────────────────────────────────────

export const fetchFacturesVsRedevances = async (params?: {
  year?: number;
  month?: number;
  month_start?: number;
  month_end?: number;
}): Promise<FacturesRedevancesPeriod[]> => {
  const { data } = await api.get("/financial/dashboard/factures-vs-redevances/", { params });
  return data;
};

export const fetchMargeParSite = async (params?: {
  year?: number;
  month?: number;
  month_start?: number;
  month_end?: number;
  limit?: number;
}): Promise<SiteMargeRow[]> => {
  const { data } = await api.get("/financial/dashboard/marge-par-site/", { params });
  return data;
};

export const fetchSitesRecurrents = async (params?: {
  year?: number;
  month?: number;
  month_start?: number;
  month_end?: number;
  recurrence_type?: "light" | "critique";
}): Promise<SiteRecurrentRow[]> => {
  const { data } = await api.get("/financial/dashboard/sites-recurrents/", { params });
  return data;
};


export function getSonatelBillingStats(params: {
  start: string;
  end: string;
  site?: string;
}) {
  return api.get("/sonatel-billing/stats/", { params }).then((r) => r.data as SonatelBillingStats);
}

export interface EvaluationDetailDiagnostic {
  type: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  message: string;
  detail: string;
}

export interface EvaluationDetail {
  site: {
    site_id: string;
    name: string | null;
    zone: string | null;
    typology: string | null;
    configuration: string | null;
    grid_fee: boolean | null;
    invoice_payment: string | null;
  };
  period: {
    year: number;
    month_start: number;
    month_end: number;
  };
  contract_id: string | null;
  current: {
    period: string;
    typology: string | null;
    configuration: string | null;
    load_w: number | null;
    redevance: string | null;
    montant_htva: string | null;
    marge: string | null;
    marge_statut: "OK" | "NOK" | null;
    hors_catalogue: boolean;
    recurrence_type: "light" | "critique" | null;
    recurrence_mois: number;
    periode_courte: boolean;
    nb_jours_factures: number | null;
  } | null;
  summary: {
    total_marge: string;
    count_ok: number;
    count_nok: number;
    count_hors_catalogue: number;
    count_periode_courte: number;
    billing_total_ht: string;
    billing_total_cosphi: string;
    billing_total_penalite: string;
    cert_count: number;
    cert_status_counts: Record<string, number>;
  };
  history: Array<{
    period: string;
    year: number;
    month: number;
    redevance: string | null;
    montant_htva: string | null;
    marge: string | null;
    marge_statut: "OK" | "NOK" | null;
    load_w: number | null;
    hors_catalogue: boolean;
    periode_courte: boolean;
    nb_jours: number | null;
    recurrence_type: "light" | "critique" | null;
    recurrence_mois_nok: number;
  }>;
  billing: {
    summary: {
      total_ht: string;
      total_cosphi: string;
      total_penalite: string;
    };
    rows: Array<{
      period: string;
      year: number;
      month: number;
      montant_hors_tva: string;
      energie: string;
      abonnement: string;
      montant_cosinus_phi: string;
      penalite_abonnement: string;
      puissance_souscrite: string | null;
      puissance_max: string | null;
      cosphi: string | null;
      nb_jours: number | null;
    }>;
  };
  certification: {
    summary: Record<string, number>;
    rows: Array<{
      period: string;
      status: string;
      certified_by_rule: string | null;
      ratio_fms: string | null;
      ratio_fms_30j: string | null;
      energie_fms: string | null;
      energie_fms_30j: string | null;
      energie_senelec: string | null;
      energie_senelec_30j: string | null;
      montant_coherent: boolean | null;
      variation_montant: string | null;
      fms_available: boolean;
      acm_available: boolean;
      fms_error: string | null;
      acm_error: string | null;
    }>;
  };
  diagnostics: EvaluationDetailDiagnostic[];
}

export const fetchEvaluationDetail = async (
  siteId: string,
  params: { year: number; month_start?: number; month_end?: number; month?: number; }
): Promise<EvaluationDetail> => {
  const { data } = await api.get(`/financial/evaluations/${siteId}/detail/`, { params });
  return data;
};


// src/features/financial/api.ts — Ajouter ces types et fonctions

// ─── Analytics Types ──────────────────────────────────────────────────────────

export interface AnalyticsSummary {
  periode: string;
  total_redevance: string;
  total_facture: string;
  total_marge: string;
  marge_negative_totale: string;
  marge_positive_totale: string;
  avg_marge: string;
  count_total: number;
  count_ok: number;
  count_nok: number;
  taux_ok_pct: number;
  taux_nok_pct: number;
  count_hc: number;
  count_pc: number;
  count_no_load: number;
  count_no_rule: number;
  count_light: number;
  count_critique: number;
}

export interface CauseDetail {
  sites_count: number;
  montant_facteur: string;
  contribution_ecart: string;
  pct_ecart: number;
}

export interface AnalyticsDecomposition {
  total_ecart_negatif: string;
  causes: {
    cosphi: CauseDetail;
    depassement_puissance: CauseDetail;
    hors_catalogue: CauseDetail;
    load_manquant: CauseDetail;
    regle_manquante: CauseDetail;
    autres: CauseDetail;
  };
}

export interface EvolutionMonth {
  period: string;
  month: number;
  total_redevance: string;
  total_facture: string;
  total_marge: string;
  avg_marge: string;
  count_ok: number;
  count_nok: number;
  count_hc: number;
  taux_nok_pct: number;
}

export interface TopSiteNOK {
  site_id: string;
  site_name: string;
  zone: string | null;
  marge_totale: string;
  marge_moyenne: string;
  nb_mois_nok: number;
  nb_hors_catalogue: number;
  montant_cosphi: string;
  montant_penalite: string;
}

export interface ImpactFacteur {
  key: string;
  label: string;
  montant: string;
  pct: number;
  color: string;
}

export interface AnalyticsImpact {
  total_ht: string;
  facteurs: ImpactFacteur[];
}

export interface Recommandation {
  priorite: "CRITIQUE" | "HAUTE" | "MOYENNE" | "BASSE";
  categorie: string;
  titre: string;
  description: string;
  action: string;
  impact_potentiel: string;
}

export interface AnalyticsFullReport {
  summary: AnalyticsSummary;
  decomposition: AnalyticsDecomposition;
  evolution: EvolutionMonth[];
  top_sites: TopSiteNOK[];
  impact: AnalyticsImpact;
  recommandations: Recommandation[];
}

// ─── Analytics API ────────────────────────────────────────────────────────────

export const fetchAnalyticsFullReport = async (params: {
  year: number;
  month_start: number;
  month_end: number;
}): Promise<AnalyticsFullReport> => {
  const { data } = await api.get("/financial/analytics/full-report/", { params });
  return data;
};

export const fetchAnalyticsSummary = async (params: {
  year: number;
  month_start: number;
  month_end: number;
}): Promise<AnalyticsSummary> => {
  const { data } = await api.get("/financial/analytics/summary/", { params });
  return data;
};

export const fetchAnalyticsDecomposition = async (params: {
  year: number;
  month_start: number;
  month_end: number;
}): Promise<AnalyticsDecomposition> => {
  const { data } = await api.get("/financial/analytics/decomposition/", { params });
  return data;
};

export const fetchAnalyticsEvolution = async (year: number): Promise<EvolutionMonth[]> => {
  const { data } = await api.get("/financial/analytics/evolution/", { params: { year } });
  return data;
};

export const fetchAnalyticsTopSites = async (params: {
  year: number;
  month_start: number;
  month_end: number;
  limit?: number;
}): Promise<TopSiteNOK[]> => {
  const { data } = await api.get("/financial/analytics/top-sites/", { params });
  return data;
};

export const fetchAnalyticsRecommandations = async (params: {
  year: number;
  month_start: number;
  month_end: number;
}): Promise<Recommandation[]> => {
  const { data } = await api.get("/financial/analytics/recommandations/", { params });
  return data;
};



export type SiteMonthlyLoad = {
  id: number;
  site_id: string;
  site_name: string;
  year: number;
  month: number;
  load_w: number;
  source: "aligne" | "previsionnel" | "manual" | "import";
};

export type FinancialFeeRule = {
  id: number;
  typology: string;
  configuration: "OUTDOOR" | "INDOOR";
  load_w: number;
  redevance: string;
  cible_kwh?: string | null;
  cible_kwh_j?: string | null;
};

export type PagedResult<T> = {
  count: number;
  page: number;
  page_size: number;
  pages: number;
  results: T[];
};

export async function fetchMonthlyLoads(params: {
  search?: string;
  year?: number;
  month?: number;
  source?: string;
  page?: number;
  page_size?: number;
}) {
  const { data } = await api.get<PagedResult<SiteMonthlyLoad>>("/financial/loads/", { params });
  return data;
}

export async function updateMonthlyLoad(id: number, load_w: number) {
  const { data } = await api.patch<SiteMonthlyLoad>(`/financial/loads/${id}/`, { load_w });
  return data;
}

export async function importMonthlyLoads(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await api.post("/financial/loads/import/", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function fetchFeeRules(params: {
  typology?: string;
  configuration?: string;
}) {
  const { data } = await api.get<{ count: number; results: FinancialFeeRule[] }>("/financial/fee-rules/", {
    params,
  });
  return data;
}

export async function importFeeRules(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await api.post("/financial/fee-rules/import/", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export type EvaluateFinancialMonthResult = {
  message: string;
  processed: number;
  ok: number;
  nok: number;
  no_load: number;
  no_fee_rule: number;
  no_invoice: number;
  hors_catalogue: number;
  periode_courte?: number;
};

export async function evaluateFinancialMonth(params: { year: number; month: number }) {
  const { data } = await api.post<EvaluateFinancialMonthResult>("/financial/evaluate/", params);
  return data;
}

export async function evaluateFinancialRange(params: {
  year: number;
  month?: number;
  month_start?: number;
  month_end?: number;
}) {
  const year = Number(params.year);
  if (!year) throw new Error("Année invalide");

  if (params.month) {
    const res = await evaluateFinancialMonth({ year, month: Number(params.month) });
    return {
      mode: "single" as const,
      processed_months: 1,
      months: [{ month: Number(params.month), ...res }],
      totals: {
        processed: res.processed || 0,
        ok: res.ok || 0,
        nok: res.nok || 0,
        no_load: res.no_load || 0,
        no_fee_rule: res.no_fee_rule || 0,
        no_invoice: res.no_invoice || 0,
        hors_catalogue: res.hors_catalogue || 0,
        periode_courte: res.periode_courte || 0,
      },
    };
  }

  let ms = Number(params.month_start);
  let me = Number(params.month_end);

  if (!ms || !me) throw new Error("Choisis un mois ou une plage de mois");
  if (ms > me) [ms, me] = [me, ms];

  const months: Array<{ month: number } & EvaluateFinancialMonthResult> = [];

  for (let m = ms; m <= me; m++) {
    const res = await evaluateFinancialMonth({ year, month: m });
    months.push({ month: m, ...res });
  }

  return {
    mode: "range" as const,
    processed_months: months.length,
    months,
    totals: months.reduce(
      (acc, r) => {
        acc.processed += r.processed || 0;
        acc.ok += r.ok || 0;
        acc.nok += r.nok || 0;
        acc.no_load += r.no_load || 0;
        acc.no_fee_rule += r.no_fee_rule || 0;
        acc.no_invoice += r.no_invoice || 0;
        acc.hors_catalogue += r.hors_catalogue || 0;
        acc.periode_courte += r.periode_courte || 0;
        return acc;
      },
      {
        processed: 0,
        ok: 0,
        nok: 0,
        no_load: 0,
        no_fee_rule: 0,
        no_invoice: 0,
        hors_catalogue: 0,
        periode_courte: 0,
      }
    ),
  };
}