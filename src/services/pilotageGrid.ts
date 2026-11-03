import { api } from "@/services/api";
import type { PgDatasetKey } from "@/features/pilotage-grid/sections";

const BASE = "/pilotage-grid";

export type PgDatasetMeta = {
  key: PgDatasetKey;
  label: string;
  sections: string[];
  disponible: boolean;
  version: number | null;
  checksum?: string;
  size_bytes?: number;
  row_counts?: Record<string, number>;
  source?: string;
  source_file?: string;
  note?: string;
  imported_by?: string;
  created_at?: string;
  is_active?: boolean;
};

export async function listPgDatasets() {
  const { data } = await api.get<{ datasets: PgDatasetMeta[]; can_import: boolean }>(`${BASE}/datasets/`);
  return data;
}

export async function getPgDataset(key: PgDatasetKey) {
  const { data } = await api.get<unknown>(`${BASE}/datasets/${key}/`);
  return data;
}

export async function listPgVersions(key: PgDatasetKey) {
  const { data } = await api.get<{ key: string; versions: PgDatasetMeta[] }>(`${BASE}/datasets/${key}/versions/`);
  return data.versions;
}

export async function importPgDataset(key: PgDatasetKey, file: File, note?: string) {
  const form = new FormData();
  form.append("file", file);
  if (note) form.append("note", note);
  const { data } = await api.post<{ created: boolean; unchanged: boolean; dataset: PgDatasetMeta }>(`${BASE}/datasets/${key}/import/`, form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 300_000,
  });
  return data;
}

export async function restorePgVersion(key: PgDatasetKey, version: number) {
  const { data } = await api.post<{ dataset: PgDatasetMeta }>(`${BASE}/datasets/${key}/versions/${version}/restore/`);
  return data.dataset;
}

function saveBlob(blob: Blob, fallback: string, disposition: string | undefined) {
  const name = /filename="?([^";]+)"?/.exec(disposition ?? "")?.[1] ?? fallback;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  return name;
}

export async function exportPgBase() {
  const res = await api.get<Blob>(`${BASE}/export/`, { responseType: "blob" });
  return saveBlob(res.data, "pilotage_grid_base.zip", String(res.headers["content-disposition"] ?? ""));
}

export async function exportPgDataset(key: PgDatasetKey) {
  const res = await api.get<Blob>(`${BASE}/datasets/${key}/export/`, { responseType: "blob" });
  return saveBlob(res.data, `pilotage_${key}.json`, String(res.headers["content-disposition"] ?? ""));
}

export function pgApiError(e: unknown): string {
  const d = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return d ?? (e instanceof Error ? e.message : "Erreur inattendue");
}

// ── Sections calculées côté serveur ────────────────────────────────────────────────────────────────────────────────────────────────
export type PgFilterState = { region?: string; porteur?: string; tarif?: string; tension?: string; from?: string; to?: string };

export type PgFacets = { months: string[]; regions: string[]; porteurs: string[]; tarifs: string[]; default_from: string | null; default_to: string | null };

export type PgStatut = { idx: number; label: string; ttc: number; nb: number };

export type PgSynthese = {
  statuts: PgStatut[];
  pct_paye: number;
  kpis: { ttc: number; nb_factures: number; reste: number; reste_nb: number; kwh: number; k2_pct: number; ht: number; cout_kwh: number; sites_factures: number; avec_changement_contrat: number };
  mensuel: Array<{ month: string; k1: number; k2: number; ht: number }>;
  variations: Array<{ site: string; label: string; name: string; avg: number; last: number; d: number }>;
  variations_note: string;
  couts: Array<{ site: string; label: string; name: string; tarif: string; ps: number | null; moy: number; pu: number }>;
  periode: { from: string; to: string };
};

export type PgSeries = { statut?: number; porteur?: string; label?: string; data: number[] };

export type PgPaiements = {
  metric: "ttc" | "nb";
  kpis: { nb: number; ttc: number; statuts: PgStatut[] };
  echeance: { labels: string[]; series: Array<{ porteur: string; data: number[] }> };
  comptable: { labels: string[]; series: PgSeries[] };
  regions: { labels: string[]; series: PgSeries[] };
  anciennete: { labels: string[]; series: PgSeries[] };
  periode: { from: string; to: string };
};

export type PgFactures = {
  total: number; ttc: number; page: number; page_size: number;
  rows: Array<{ numero: number; contrat: number; site_id: string; site_name: string; date: string; ttc: number; statut: number; porteur: string; localisation: string }>;
};

const clean = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ""));

export async function getPgFacets() {
  const { data } = await api.get<PgFacets>(`${BASE}/facets/`);
  return data;
}

export async function getPgSynthese(f: PgFilterState) {
  const { data } = await api.get<PgSynthese>(`${BASE}/synthese/`, { params: clean(f) });
  return data;
}

export async function getPgPaiements(f: PgFilterState, metric: "ttc" | "nb") {
  const { data } = await api.get<PgPaiements>(`${BASE}/paiements/`, { params: clean({ ...f, metric }) });
  return data;
}

export async function getPgFactures(f: PgFilterState, extra: { statuts: string; q?: string; page: number; page_size: number }) {
  const { data } = await api.get<PgFactures>(`${BASE}/paiements/factures/`, { params: clean({ ...f, ...extra }) });
  return data;
}
