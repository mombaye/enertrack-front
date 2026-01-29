import { api } from "@/services/api";
export type DRFList<T> = { count: number; next: string | null; previous: string | null; results: T[] };

export type SonatelInvoice = {
  id: number;
  numero_compte_contrat: string;
  numero_facture: string;

  site_id?: string | null;
  site_name?: string | null;

  date_comptable_facture?: string | null;
  date_debut_periode?: string | null;
  date_fin_periode?: string | null;

  montant_hors_tva?: string | null;
  montant_ttc?: string | null;

  abonnement_calcule?: string | null;
  penalite_abonnement_calculee?: string | null;
  energie_calculee?: string | null;

  status: "CREATED" | "VALIDATED" | "CONTESTED";
};

export async function listInvoices(params: any) {
  const { data } = await api.get<DRFList<SonatelInvoice>>("/sonatel-billing/records/", { params });
  return data;
}
