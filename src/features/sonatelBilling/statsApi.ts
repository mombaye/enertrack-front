// src/features/sonatelBilling/statsApi.ts
import { api } from "@/services/api"; // adapte à ton axios instance

export type TopSiteRow = {
  site_id: string;
  site_name?: string;
  conso?: number;
  montant_ht?: number;
  montant_cosphi?: number;
  penalite_prime?: number;
  penalite_abonnement?: number;
  abonnement?: number;
};

export type EvolutionPoint = {
  period: string;          // "2026-01" ou "2026-01-01" selon ton backend
  invoices: number;
  montant_ht: number;
  montant_ttc: number;
  nrj: number;
  abonnement: number;
  penalite_prime: number;
  cosphi: number;
};

export type HtPart = {
  key: "NRJ" | "COSPHI" | "PEN_PRIME" | "ABONNEMENT";
  label: string;
  value: number;
  percent: number; // 0..100
};

export type SonatelStats = {
  range: { start: string; end: string };
  top: {
    conso_vs_montant: TopSiteRow[];
    cosphi: TopSiteRow[];
    pen_prime: TopSiteRow[];
    pen_abonnement: TopSiteRow[];
  };
  evolution: EvolutionPoint[];
  distribution_ht: {
    total_ht: number;
    parts: HtPart[];
  };
};

export async function getSonatelStats(params: { start: string; end: string }) {
  const { data } = await api.get<SonatelStats>("/sonatel-billing/stats/", { params });
  return data;
}
