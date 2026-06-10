import { api } from "@/services/api";

export type PenaltyFilter = "both" | "cosphi" | "penalty";

export type ImpactedSiteRow = {
  site_id: string;
  site_name: string | null;
  numero_compte_contrat: string;
  valeur_cosinus_phi: number | null;
  montant_cosphi: string;
  penalite_prime: string;
  montant_hors_tva: string;
  pct_cosphi_sur_ht: number;
  pct_penalty_sur_ht: number;
};

export type ImpactedSitesMonth = {
  period: string;
  sites: ImpactedSiteRow[];
  totaux: {
    montant_cosphi: string;
    penalite_prime: string;
    sites_count: number;
  };
};

export type ImpactedSitesResponse = {
  range: {
    start: string;
    end: string;
  };
  filter: PenaltyFilter;
  summary: {
    total_cosphi: string;
    total_penalty: string;
    sites_cosphi_count: number;
    sites_penalty_count: number;
  };
  by_month: ImpactedSitesMonth[];
};

export async function getImpactedSitesApi(params: {
  start: string;
  end: string;
  filter?: PenaltyFilter;
  min_amount?: number;
}) {
  const { data } = await api.get<ImpactedSitesResponse>(
    "/billing/impacted-sites/",
    {
      params: {
        start: params.start,
        end: params.end,
        filter: params.filter || "both",
        min_amount: params.min_amount ?? 0,
      },
    }
  );

  return data;
}