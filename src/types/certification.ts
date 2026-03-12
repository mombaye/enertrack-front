// types/certification.ts
export type CertifiedByRule =
  | "ACM_PERIODE"
  | "ACM_30J"
  | "FMS_PERIODE"
  | "FMS_30J"
  | "HISTO_3MOIS";

export const RULE_LABELS: Record<CertifiedByRule, string> = {
  ACM_PERIODE:  "ACM · Période",
  ACM_30J:      "ACM · 30 jours",
  FMS_PERIODE:  "Grid · Période",
  FMS_30J:      "Grid · 30 jours",
  HISTO_3MOIS:  "Historique Sénélec",
};

export const RULE_COLORS: Record<CertifiedByRule, string> = {
  ACM_PERIODE: "bg-emerald-100 text-emerald-800",
  ACM_30J:     "bg-emerald-100 text-emerald-800",
  FMS_PERIODE: "bg-blue-100   text-blue-800",
  FMS_30J:     "bg-blue-100   text-blue-800",
  HISTO_3MOIS: "bg-purple-100 text-purple-800",
};