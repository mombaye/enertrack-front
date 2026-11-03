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
