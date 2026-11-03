// Les 11 parties du fichier « Pilotage Grid », dans le même ordre. `tab` = identifiant de l'onglet dans l'interface d'origine.
export type PgDatasetKey = "paiements" | "sites" | "demandes" | "efficacite" | "tarifs" | "cosphi" | "redevance";

export const DATASET_KEYS: PgDatasetKey[] = ["paiements", "sites", "demandes", "efficacite", "tarifs", "cosphi", "redevance"];

export type PgSection = { slug: string; tab: string; label: string; datasets: PgDatasetKey[] };

export const PG_SECTIONS: PgSection[] = [
  { slug: "synthese", tab: "syn", label: "Synthèse", datasets: ["sites", "paiements"] },
  { slug: "paiements", tab: "pay", label: "Paiements", datasets: ["paiements"] },
  { slug: "sites", tab: "sit", label: "Sites", datasets: ["sites"] },
  { slug: "fiche-site", tab: "fic", label: "Fiche site", datasets: ["sites", "cosphi"] },
  { slug: "non-parvenues", tab: "gap", label: "Non parvenues", datasets: ["sites", "paiements"] },
  { slug: "sites-demandes", tab: "dem", label: "Sites demandés", datasets: ["demandes"] },
  { slug: "efficacite-energetique", tab: "eff", label: "Efficacité énergétique", datasets: ["efficacite"] },
  { slug: "config-nouvelle-baie", tab: "nb", label: "Config Nouvelle Baie", datasets: ["sites", "paiements"] },
  { slug: "redevance", tab: "red", label: "Redevance", datasets: ["redevance"] },
  { slug: "changements-de-tarif", tab: "tar", label: "Changements de tarif", datasets: ["tarifs"] },
  { slug: "contrats-et-controles", tab: "ctr", label: "Contrats et contrôles", datasets: ["sites"] },
];

export const DATASET_LABELS: Record<PgDatasetKey, string> = {
  paiements: "Paiements (factures, statuts, hors scope)",
  sites: "Sites et séries mensuelles",
  demandes: "Sites demandés",
  efficacite: "Efficacité énergétique",
  tarifs: "Changements de tarif",
  cosphi: "cos φ par site",
  redevance: "Redevance",
};
