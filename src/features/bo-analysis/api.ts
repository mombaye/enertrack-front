// src/features/bo-analysis/api.ts
import { api } from "@/services/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CategorieBOValue =
  | "site_off_grid"
  | "fonctionnement_optimal"
  | "dysfonctionnement"
  | "bureaux_sonatel"
  | "installation_materiels"
  | "optimal_observation"
  | "hors_scope_esco"
  | "verif_facturation_senelec"
  | "pass_through"
  | "changement_typologie"
  | "changement_tarif"
  | "typologie_validee_attente"
  | "autre";

export type ActionOwnerValue = "ras" | "om" | "rot" | "grid_manager" | "adel" | "autre";

export const CATEGORIE_BO_OPTIONS: { value: CategorieBOValue; label: string }[] = [
  { value: "site_off_grid", label: "Site off-grid" },
  { value: "fonctionnement_optimal", label: "Fonctionnement optimal" },
  { value: "dysfonctionnement", label: "Dysfonctionnement & correction materials" },
  { value: "bureaux_sonatel", label: "Site avec bureaux, facturation par Sonatel" },
  { value: "installation_materiels", label: "Installation des matériels" },
  { value: "optimal_observation", label: "Fonctionnement optimal sous observation (faible marge négative)" },
  { value: "hors_scope_esco", label: "Site hors scope ESCO" },
  { value: "verif_facturation_senelec", label: "Vérification facturation SENELEC" },
  { value: "pass_through", label: "Site_OG en pass-through" },
  { value: "changement_typologie", label: "Changement de typologie à faire" },
  { value: "changement_tarif", label: "Changement Tarif avec SENELEC" },
  { value: "typologie_validee_attente", label: "Changement typologie validé, attente matériels PV + PWC" },
  { value: "autre", label: "Autre" },
];

export const ACTION_OWNER_OPTIONS: { value: ActionOwnerValue; label: string }[] = [
  { value: "ras", label: "RAS" },
  { value: "om", label: "O&M" },
  { value: "rot", label: "ROT" },
  { value: "grid_manager", label: "Grid Manager" },
  { value: "adel", label: "ADEL" },
  { value: "autre", label: "Autre" },
];

export interface BOAnalysisDetail {
  categorie_bo: CategorieBOValue;
  categorie_bo_display: string;
  categorie_bo_autre: string;
  commentaire_bo: string;
  action_owner: ActionOwnerValue;
  action_owner_display: string;
  action_owner_autre: string;
  commentaire: string;
  check_done: boolean;
  submitted_by_username: string;
  submitted_at: string;
}

export interface BOAnalysisRequest {
  id: number;
  site_id: string;
  site_name: string | null;
  year: number;
  month: number;
  status: "pending" | "in_progress" | "done";
  notes: string;
  requested_by: number;
  requested_by_username: string;
  assigned_bo: number | null;
  assigned_bo_username: string | null;
  targeted_bos: number[];
  targeted_bos_usernames: string[];
  requested_at: string;
  updated_at: string;
  analysis: BOAnalysisDetail | null;
}

export interface BORequestsPage {
  count: number;
  page: number;
  page_size: number;
  pages: number;
  results: BOAnalysisRequest[];
}

export interface BOMarginSnapshot {
  id: number;
  site_id: string;
  site_name: string;
  zone: string;
  typologie_reelle: string;
  statut_marge: string;
  categorie_bo: CategorieBOValue | "";
  categorie_bo_display: string | null;
  categorie_bo_autre: string;
  commentaire_bo: string;
  action_owner: ActionOwnerValue | "";
  action_owner_display: string | null;
  action_owner_autre: string;
  commentaire: string;
  check_done: boolean;
  redevance_vs_estimation_a: string | null;
  redevance_vs_estimation_b: string | null;
  month_a_label: string;
  month_b_label: string;
}

export interface BOSnapshotsPage {
  count: number;
  page: number;
  page_size: number;
  pages: number;
  results: BOMarginSnapshot[];
}

export interface BOUser {
  id: number;
  username: string;
  email: string;
}

// ─── Requests workflow ─────────────────────────────────────────────────────────

export async function fetchBORequests(params: {
  site?: string; status?: string; year?: number; month?: number; mine?: boolean; page?: number; page_size?: number;
} = {}): Promise<BORequestsPage> {
  const { data } = await api.get("/bo-analysis/requests/", { params });
  return data;
}

export async function createBORequest(payload: {
  site_id: string; year: number; month: number; targeted_bos?: number[]; notes?: string;
}): Promise<BOAnalysisRequest> {
  const { data } = await api.post("/bo-analysis/requests/", payload);
  return data;
}

export interface BOBulkCreateResult {
  message: string;
  created: number;
  request_ids: number[];
  errors: Array<{ site_id: string; error: string }>;
}

export async function createBORequestsBulk(payload: {
  items: Array<{ site_id: string; year: number; month: number }>;
  targeted_bos?: number[];
  notes?: string;
}): Promise<BOBulkCreateResult> {
  const { data } = await api.post("/bo-analysis/requests/bulk/", payload);
  return data;
}

export async function patchBORequest(id: number, payload: { assigned_bo?: number | null; status?: string }): Promise<BOAnalysisRequest> {
  const { data } = await api.patch(`/bo-analysis/requests/${id}/`, payload);
  return data;
}

export async function submitBOAnalysis(id: number, payload: {
  categorie_bo: CategorieBOValue;
  categorie_bo_autre?: string;
  commentaire_bo?: string;
  action_owner: ActionOwnerValue;
  action_owner_autre?: string;
  commentaire?: string;
  check_done?: boolean;
}): Promise<BOAnalysisRequest> {
  const { data } = await api.post(`/bo-analysis/requests/${id}/submit/`, payload);
  return data;
}

// ─── Historical reference snapshot ─────────────────────────────────────────────

export async function fetchBOSnapshots(params: {
  site?: string; categorie_bo?: string; zone?: string; search?: string; page?: number; page_size?: number;
} = {}): Promise<BOSnapshotsPage> {
  const { data } = await api.get("/bo-analysis/snapshots/", { params });
  return data;
}

// ─── BO users (pour l'assignation) ─────────────────────────────────────────────

export async function fetchBOUsers(): Promise<BOUser[]> {
  const { data } = await api.get("/users/", { params: { role: "bo" } });
  return Array.isArray(data) ? data : data?.results ?? [];
}
