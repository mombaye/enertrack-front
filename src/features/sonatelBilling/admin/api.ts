import { api } from "@/services/api";

export type DRFList<T> = { count: number; next: string | null; previous: string | null; results: T[] };

export type TariffRate = {
  id: number;
  category: string;
  energie_k1: string | null; // Heures Hors Pointe
  energie_k2: string | null; // Heures de Pointe
  prime_fixe: string | null;
  date_debut: string; // YYYY-MM-DD
  date_fin: string;   // YYYY-MM-DD
  last_seen_at?: string | null;
  last_seen_batch?: number | null;
};

export type ContractSiteLink = {
  id: number;
  numero_compte_contrat: string;
  site: {
    id: number;      // pk
    site_id: string; // code site
    name?: string;
  };
  first_seen_at: string;
  last_seen_at: string;
  source_filename?: string | null;
  imported_by?: number | null;
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

// -------- Tariffs --------
export async function listTariffs(params: { search?: string; category?: string; page?: number; page_size?: number }) {
  const res = await api.get<DRFList<TariffRate>>(`/sonatel-billing/tariff-rates/${qs(params)}`);
  return res.data;
}

export async function createTariff(payload: Partial<TariffRate>) {
  const res = await api.post<TariffRate>(`/sonatel-billing/tariff-rates/`, payload);
  return res.data;
}

export async function updateTariff(id: number, payload: Partial<TariffRate>) {
  const res = await api.patch<TariffRate>(`/sonatel-billing/tariff-rates/${id}/`, payload);
  return res.data;
}

export async function deleteTariff(id: number) {
  await api.delete(`/sonatel-billing/tariff-rates/${id}/`);
}

export async function importTariffs(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await api.post(`/sonatel-billing/tariff-rates/import/`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

// -------- Contract ↔ Site --------
export async function listContractLinks(params: { search?: string; page?: number; page_size?: number }) {
  const res = await api.get<DRFList<ContractSiteLink>>(`/sonatel-billing/contract-site-links/${qs(params)}`);
  return res.data;
}

export async function resolveContract(contract: string) {
  const res = await api.get(`/sonatel-billing/contract-site-links/resolve/${qs({ contract })}`);
  return res.data as { numero_compte_contrat: string; site_pk: number; site_id: string };
}

export async function importContractLinks(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await api.post(`/sonatel-billing/contract-site-links/import/`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}



export async function computeBill(payload: {
  contract: string;
  date: string;      // YYYY-MM-DD
  k1?: string;
  k2?: string;
  category?: string; // optionnel
}) {
  const { data } = await api.post("/sonatel-billing/compute/", payload);
  return data;
}


// features/sonatelBilling/admin/api.ts
export async function importConsumptions(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await api.post("/sonatel-billing/consumptions/import/", fd);
  return data;
}

export async function computePreinvoices(batch_id: number) {
  const { data } = await api.post("/sonatel-billing/preinvoices/compute-from-batch/", { batch_id });
  return data;
}

export async function listPreinvoices(params: { search?: string; page?: number; page_size?: number; batch_id?: number; status?: string }) {
  const { data } = await api.get("/sonatel-billing/preinvoices/", { params });
  return data;
}

// export: juste ouvrir l’url
export function exportPreinvoicesCsv(batch_id?: number) {
  const qs = batch_id ? `?batch_id=${batch_id}` : "";
  window.open(`/sonatel-billing/preinvoices/export-csv/${qs}`, "_blank");
}




