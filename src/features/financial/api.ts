// src/features/financial/services.ts
import { api } from "@/services/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FinancialFeeRule {
  id: number;
  typology: string;
  configuration: "INDOOR" | "OUTDOOR";
  load_w: number;
  redevance: string;
  cible_kwh: string | null;
  cible_kwh_j: string | null;
}

export interface SiteMonthlyLoad {
  id: number;
  site_id: string;
  site_name: string;
  year: number;
  month: number;
  load_w: number;
  source: "aligne" | "previsionnel" | "manual" | "import";
}

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

// ─── Fee Rules ────────────────────────────────────────────────────────────────

export const fetchFeeRules = async (params?: {
  typology?: string;
  configuration?: string;
}): Promise<{ count: number; results: FinancialFeeRule[] }> => {
  const { data } = await api.get("/financial/fee-rules/", { params });
  return data;
};

export const importFeeRules = async (file: File): Promise<FeeRuleImportResult> => {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post("/financial/fee-rules/import/", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

// ─── Monthly Loads ────────────────────────────────────────────────────────────

export const fetchMonthlyLoads = async (params?: {
  site?: string;
  year?: number;
  month?: number;
  source?: "import" | "manual";
  search?: string;
  page?: number;
  page_size?: number;
}): Promise<LoadsPage> => {
  const { data } = await api.get("/financial/loads/", { params });
  return data;
};

export const updateMonthlyLoad = async (
  id: number,
  load_w: number
): Promise<SiteMonthlyLoad> => {
  const { data } = await api.patch(`/financial/loads/${id}/`, { load_w });
  return data;
};

export const importMonthlyLoads = async (
  file: File,
  format?: "alignement" | "proposition" | "simple"
): Promise<LoadImportResult & { format_detecte: string; source_assignee: string; periode_couverte: string }> => {
  const form = new FormData();
  form.append("file", file);
  if (format) form.append("format", format);
  const { data } = await api.post("/financial/loads/import/", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

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
  month: number;
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
  statut?: "OK" | "NOK";
  search?: string;
  typology?: string;
  zone?: string;
  recurrence_type?: "light" | "critique";
}) => {
  const base = api.defaults.baseURL || "";
  const qp = new URLSearchParams();
  qp.set("export", "csv");
  if (params) {
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "") qp.set(k, String(v)); });
  }
  // Déclencher le téléchargement directement via href
  const token = localStorage.getItem("access") || localStorage.getItem("token") || "";
  const url = `${base}/financial/evaluations/?${qp.toString()}`;
  // Utilise fetch pour récupérer le CSV avec l'auth header
  return api.get("/financial/evaluations/", {
    params: { ...params, export: "csv" },
    responseType: "blob",
  }).then(({ data }) => {
    const href = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = href;
    a.download = `evaluations_${params?.year || "all"}_${params?.month || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(href);
  });
};

// ─── Dashboards ───────────────────────────────────────────────────────────────

export const fetchFacturesVsRedevances = async (
  year?: number
): Promise<FacturesRedevancesPeriod[]> => {
  const { data } = await api.get("/financial/dashboard/factures-vs-redevances/", {
    params: year ? { year } : {},
  });
  return data;
};

export const fetchMargeParSite = async (params?: {
  year?: number;
  month?: number;
  limit?: number;
}): Promise<SiteMargeRow[]> => {
  const { data } = await api.get("/financial/dashboard/marge-par-site/", { params });
  return data;
};

export const fetchSitesRecurrents = async (
  recurrence_type?: "light" | "critique"
): Promise<SiteRecurrentRow[]> => {
  const { data } = await api.get("/financial/dashboard/sites-recurrents/", {
    params: recurrence_type ? { recurrence_type } : {},
  });
  return data;
};