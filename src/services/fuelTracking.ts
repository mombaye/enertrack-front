import { api } from "@/services/api";

const BASE = "/fuel-tracking";

function cleanParams(params: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== ""
    )
  );
}

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export type FuelConsommationSite = {
  site_id: string;
  site_name: string | null;
  typology: string | null;
  typologie_simple: string | null;
  site_type: string | null;
  type_ge: string | null;
  dg_count: string | null;
  power_supply: string | null;
  has_genset: boolean;
  has_genset_snowflake: boolean;
  has_genset_enoc: boolean;
  nb_ge_enoc: number | null;
  conso_snowflake_l: number | null;
  nb_jours_data: number;
  conso_estimee_snowflake_l: number | null;
  conso_estimee_snowflake_nb_releves: number | null;
  conso_estimee_enoc_l: number | null;
  conso_estimee_nb_releves: number | null;
  conso_specifique_moy_l_kwh: number | null;
  ge_prod_kwh: number | null;
  sensor_status: string | null;
  // Colonnes qualité VW_FUEL_REPORT — audit (spec 2026-08).
  quality_status: string | null;
  raw_point_count: number | null;
  valid_point_count: number | null;
  isolated_spike_count: number | null;
  over_capacity_point_count: number | null;
  refill_detected: boolean;
  estimated_refill_volume_l: number | null;
  enoc_qte_demandee_l: number;
  enoc_qte_validee_l: number;
  enoc_qte_ajoutee_l: number;
  enoc_nb_demandes: number;
  ecart_conso_vs_enoc_l: number | null;
  conso_fichier_l: number | null;
  fichier_source: string | null;
  // Valeurs brutes Base GE.xlsx (audit) — n'entrent dans aucun calcul CPH.
  pge_kva_fichier: number | null;
  ge_load_pct_fichier: number | null;
  cph_lph_fichier: number | null;
  // Conso mesurée vue : Snowflake (capteur) en priorité, relevé de
  // gardiennage (jauge manuelle) en repli quand Snowflake n'a rien.
  conso_mesuree_fichier_l: number | null;
  conso_mesuree_source: "snowflake" | "gardiennage" | null;
  gardien_statut: string | null;
  // Explique pourquoi la conso mesurée est absente. null si renseignée.
  commentaire: string | null;
  // Facturation (ESCO SN — Facturation par site, mensuel) — null si le
  // site n'apparaît pas dans le dernier fichier importé.
  facturation_active_fichier: boolean | null;
  facturation_avec_ge_fichier: boolean | null;
  configuration_fichier: string | null;
};

export type FuelConsommationKpis = {
  total_sites: number;
  sites_avec_ge: number;
  sites_sans_ge: number;
  sites_ge_enoc_only: number;
  sites_avec_ge_incomplet: number;
  sites_avec_conso: number;
  sites_avec_donnees_brutes: number;
  sites_avec_estimation: number;
  total_conso_snowflake_l: number;
  total_enoc_qte_ajoutee_l: number;
  total_enoc_nb_demandes: number;
  configuration_counts: {
    indoor: number;
    outdoor: number;
    none: number;
  };
  factures_payees: number;
  factures_impayees: number;
  factures_total: number;
  // KPIs Stan — dénominateur = "ESCO SN Facturation par site",
  // colonne "Facturation avec GE oui|Non = Oui" (463 en sept. 2026).
  // stan_importe=false → import_facturation_par_site non lancé pour ce mois.
  sites_ge_valides_stan: number;
  stan_importe: boolean;
};

export type FuelConfigurationFilter = "indoor" | "outdoor" | "none";

export type FuelSourceStatus = {
  connected: boolean;
  last_status: "RUNNING" | "SUCCESS" | "FAILED" | null;
  last_run_at: string | null;
  /** Date de la donnée la plus récente réellement disponible côté source
   * (pas l'heure d'exécution de la synchro) — révèle une source en retard
   * même quand la synchro elle-même tourne et "réussit" normalement. */
  last_data_date: string | null;
  error: string | null;
};

export type FuelConsommationSources = {
  snowflake: FuelSourceStatus;
  enoc: FuelSourceStatus;
};

// Recoupement Snowflake/ENOC/fichiers de référence — explique d'où viennent
// les effectifs Avec GE/Sans GE et où se situent les sites des fichiers
// (Base GE.xlsx / Base août 26 validée) par rapport aux sites GE réseau.
export type FuelGeDetection = {
  total_sites: number;
  avec_ge: number;
  sans_ge: number;
  avec_ge_snowflake: number;
  avec_ge_enoc: number;
  vus_seulement_enoc: number;
  vus_seulement_snowflake: number;
  vus_par_les_deux: number;
  sites_dans_fichier: number;
  dans_fichier_et_ge: number;
  dans_fichier_sans_ge: number;
  ge_hors_fichier: number;
};

export type FuelConsommationResponse = {
  month_year: string | null;
  data: FuelConsommationSite[];
  pagination: Pagination | null;
  available_months: string[];
  kpis: FuelConsommationKpis | null;
  /** Sites affichés mais absents de Gestion des sites (connus de Snowflake / ENOC / fichiers Ops). */
  sites_hors_referentiel?: number;
  sources?: FuelConsommationSources;
  ge_detection?: FuelGeDetection | null;
};

/**
 * Consommation carburant mensuelle par site — automatisée (Snowflake +
 * ENOC), voir sync_fuel_consommation côté backend. Pas d'upload : alimentée
 * par une synchronisation planifiée.
 */
export type FuelGeDetectionFilter =
  | "avec_ge"
  | "sans_ge"
  | "avec_ge_snowflake"
  | "avec_ge_enoc"
  | "vus_seulement_enoc"
  | "vus_seulement_snowflake"
  | "vus_par_les_deux"
  | "sites_dans_fichier"
  | "dans_fichier_et_ge"
  | "dans_fichier_sans_ge"
  | "ge_hors_fichier";

export async function getFuelConsommation(params?: { month?: string; search?: string; country?: string; has_genset?: "true" | "false" | "incomplete"; detection?: FuelGeDetectionFilter; configuration?: FuelConfigurationFilter; page?: number; limit?: number }) {
  const { data } = await api.get<FuelConsommationResponse>(`${BASE}/consommation/`, {
    params: cleanParams(params ?? {}),
  });
  return data;
}

export type FuelConsommationMonthlyPoint = {
  month_year: string;
  nb_sites_ge: number;
  nb_sites_avec_conso: number;
  nb_sites_monitored: number;
  total_conso_snowflake_l: number;
  total_enoc_qte_ajoutee_l: number;
  total_enoc_nb_demandes: number;
  nb_sites_enoc_ajoutee: number;
  conso_specifique_moy_l_kwh: number | null;
  nb_sites_incomplet: number;
};

export type FuelConsommationTopSite = {
  site_id: string;
  site_name: string | null;
  total_conso_l: number;
  nb_mois_avec_conso: number;
};

export type FuelConsommationDashboardStanKpis = {
  month_year: string;
  sites_ge_valides_stan: number;
  stan_importe: boolean;
};

export type FuelConsommationDashboard = {
  months: string[];
  monthly: FuelConsommationMonthlyPoint[];
  top_sites: FuelConsommationTopSite[];
  total_ge_sites: number;
  available_months: string[];
  ge_detection: FuelGeDetection | null;
  stan_kpis: FuelConsommationDashboardStanKpis | null;
};

/**
 * Vue d'ensemble pour l'onglet Dashboard. Portée de months/monthly/top_sites,
 * par ordre de priorité : from_month+to_month (plage explicite) > month seul
 * (mois choisi dans le header) > par défaut, les 3 derniers mois disponibles
 * (jamais tout l'historique).
 */
export async function getFuelConsommationDashboard(params?: { month?: string; from_month?: string; to_month?: string }) {
  const { data } = await api.get<FuelConsommationDashboard>(`${BASE}/consommation/dashboard/`, {
    params: cleanParams(params ?? {}),
  });
  return data;
}

export type FuelStockSite = {
  site_id: string;
  site_name: string | null;
  typology: string | null;
  site_type: string | null;
  dg_count: string | null;
  power_supply: string | null;
  has_genset: boolean;
  has_genset_snowflake: boolean;
  has_genset_enoc: boolean;
  nb_ge_enoc: number | null;
  stock_snowflake_l: number | null;
  capacity_snowflake_l: number | null;
  stock_snowflake_pct: number | null;
  stock_snowflake_date: string | null;
  quality_status: string | null;
  stock_enoc_l: number | null;
  stock_enoc_date: string | null;
  commentaire: string | null;
};

export type FuelStockKpis = {
  total_sites: number;
  sites_avec_ge: number;
  sites_sans_ge: number;
  sites_avec_stock_snowflake: number;
  sites_avec_stock_enoc: number;
  sites_stock_critique: number;
  sites_stock_alerte: number;
  sites_sans_aucun_stock: number;
};

export type FuelStockResponse = {
  data: FuelStockSite[];
  pagination: Pagination;
  kpis: FuelStockKpis;
  sources: FuelConsommationSources;
};

/**
 * Stock carburant ACTUEL par site — pas de notion de mois (contrairement à
 * getFuelConsommation), une seule ligne par site remplacée à chaque sync
 * (sync_fuel_stock). Jointure Snowflake (VW_FUEL_REPORT) + ENOC
 * (fuel_level_readings), 2 sources distinctes jamais fusionnées.
 */
export async function getFuelStock(params?: { search?: string; has_genset?: "true" | "false"; page?: number; limit?: number }) {
  const { data } = await api.get<FuelStockResponse>(`${BASE}/stock/`, {
    params: cleanParams(params ?? {}),
  });
  return data;
}

export type FuelCommandeSyntheseRow = {
  label: string;
  is_total_row: boolean;
  nb_sites: number;
  commande_normale_l: number;
  commande_hivernale_l: number;
  total_l: number;
  nb_sites_prev: number;
  commande_normale_prev_l: number;
  commande_hivernale_prev_l: number;
  total_prev_l: number;
  ecart_sites: number;
  ecart_qte_l: number;
  commentaires: string | null;
};

export type FuelCommandeSite = {
  site_id: string;
  site_name: string | null;
  typologie_contractuelle: string | null;
  load_commande: number;
  indoor_outdoor: string | null;
  batch: string | null;
  typologie_facturee: string | null;
  typo_operations: string | null;
  conso_moy_jour_l: number;
  commande_sans_marge_l: number;
  commande_avec_marge_l: number;
  estimation_stock_final_l: number;
};

export type FuelCommandeKpis = {
  total_sites: number;
  total_commande_avec_marge_l: number;
  total_commande_sans_marge_l: number;
  nb_sites_commande_positive: number;
  nb_sites_stock_negatif: number;
};

export type FuelCommandeResponse = {
  month_year: string | null;
  prev_month_year: string | null;
  available_months: string[];
  synthese: {
    categorie: FuelCommandeSyntheseRow[];
    typologie: FuelCommandeSyntheseRow[];
  };
  sites: {
    data: FuelCommandeSite[];
    pagination: Pagination | null;
    kpis: FuelCommandeKpis | null;
  };
};

/**
 * Commande carburant mensuelle — import mensuel brut (pas de synchro
 * automatisée : commande décidée par l'équipe Ops dans un fichier Excel,
 * voir import_commande_fuel côté backend), lecture seule, aucun upload sur
 * cette page.
 */
export async function getFuelCommandes(params?: { month?: string; search?: string; page?: number; limit?: number }) {
  const { data } = await api.get<FuelCommandeResponse>(`${BASE}/commandes/`, {
    params: cleanParams(params ?? {}),
  });
  return data;
}

export type FuelCommandeConfiance = "Élevée" | "Moyenne" | "Faible";

export type FuelCommandeEstimationSite = {
  site_id: string;
  site_name: string | null;
  nb_mois_historique: number;
  sources_historique: string[];
  conso_jour_ponderee_l: number;
  conso_projetee_l: number;
  stock_actuel_l: number | null;
  stock_connu: boolean;
  capacite_cuve_l: number | null;
  commande_sans_marge_l: number;
  commande_avec_marge_l: number;
  plafonnee_par_capacite: boolean;
  stock_final_estime_l: number;
  confiance: FuelCommandeConfiance;
  commande_ops_reference_l: number | null;
};

export type FuelCommandeEstimationKpis = {
  nb_sites: number;
  total_commande_estimee_l: number;
  nb_sites_rupture_prevue: number;
  nb_sites_confiance_faible: number;
  nb_sites_confiance_elevee: number;
  total_commande_ops_reference_l: number | null;
  ops_reference_month: string | null;
};

export type FuelCommandeEstimationResponse = {
  target_month: string | null;
  source_months: string[];
  marge_pct: number;
  kpis: FuelCommandeEstimationKpis | null;
  sites: FuelCommandeEstimationSite[];
};

/**
 * Estimation carburant du mois suivant — calculée à partir des données
 * automatisées (Consommation + Stock), indépendante de l'import manuel Ops.
 * Voir FuelCommandeEstimationView côté backend pour la méthodologie.
 */
export async function getFuelCommandeEstimation(params?: { marge?: number; search?: string }) {
  const { data } = await api.get<FuelCommandeEstimationResponse>(`${BASE}/commandes/estimation/`, {
    params: cleanParams(params ?? {}),
  });
  return data;
}

// ─── Contrôle CPH (instruction Suivi Carburant / CPH, abaque PRP 50 Hz) ─────
// Calcul au grain site/jour sur la plage EXACTE demandée, côté backend
// (fuel_tracking/services/cph_engine.py). Toute valeur absente reste null.

export type CphRuntimeSource = "DSE" | "REDRESSEUR" | "DAY_DG_ON" | "COMPTEUR_TERRAIN";
export type CphPowerSource = "PRODUCTION_GE" | "DC_REDRESSEUR" | "ESTIMATION_HISTORIQUE_LOAD_AC";
/** Méthodes de la chaîne de repli puissance, dans l'ordre de tentative. */
export type CphPowerMethod = "DIRECT_DSE_PRODUCTION" | "PDC_REDRESSEUR" | "INDOOR_PDC_LOAD_AC";
export type CphStatutCph = "CPH_CALCULE" | "CPH_PARTIEL" | "CPH_NON_CALCULE" | "NON_CONCERNE_SANS_GE";
export type CphStatutRapprochement =
  | "RAPPROCHEMENT_CALCULE" | "RAPPROCHEMENT_NON_CALCULE_STOCK_ABSENT"
  | "RAPPROCHEMENT_NON_CALCULE_MOUVEMENTS_ABSENTS" | "RAPPROCHEMENT_NON_CALCULE_CPH_INCOMPLET";
export type CphAcStatus =
  | "LOAD_AC_QUALIFIE" | "LOAD_AC_MESURE_ZERO" | "LOAD_AC_INDISPONIBLE" | "LOAD_AC_INCOHERENT" | "LOAD_AC_UNITE_SUSPECTE";
export type CphMethodAttempt = {
  tentee: boolean;
  statut: "RETENUE" | "REJETEE" | "ABSENTE" | "NON_APPLICABLE" | "NON_TENTEE";
  valeur_kw: number | null;
  code: string | null;
  motif: string | null;
  detail: string | null;
};
export type CphAcReference = {
  statut: CphAcStatus;
  p_ac_aux_kw: number | null;
  reason: string | null;
  jours_reference: number;
  mesures: number | null;
  reference_dates: string[];
  mediane_ac_brut: number | null;
  mediane_ac_kw: number | null;
  mediane_p_dc_entree_kw: number | null;
  mediane_ecart_brut_kw: number | null;
  jours_ecart_negatif: number;
  unite_brute: string;
  unite_convertie: string;
  diviseur: number;
  candidats: Array<{ date: string; ac_brut: number | null; ac_kw: number | null; p_dc_entree_kw: number | null; points: number | null }>;
};
export type CphPeriodStatus = "COMPLET" | "PARTIEL" | "NON_CALCULE";
export type CphReconciliationStatus = "OK" | "A_JUSTIFIER" | "A_INVESTIGUER" | "DONNEES_INCOMPLETES" | "CPH_NON_CALCULE" | "NON_CONCERNE";
/** GE = calculé (DG_COUNT Snowflake > 0) ; SANS_GE = affiché hors calcul carburant, avec motif. */
export type CphPerimetre = "GE" | "SANS_GE";
export type CphDayStatus =
  | "CPH_CALCULE" | "GE_A_L_ARRET" | "RUNTIME_ABSENT" | "PUISSANCE_ABSENTE"
  | "COURBE_ABSENTE" | "PUISSANCE_HORS_PLAFOND" | "CPH_HORS_DOMAINE";

export type CphCurveInfo = {
  curve_id: string;
  label: string;
  status: string;
  prp_kva: number;
  prp_kw: number;
  power_factor: number | null;
  a: number;
  b: number;
  c: number;
  source: string;
};

export type CphSourceEval = {
  availability_pct: number;
  days_valid: number;
  exploitable: boolean;
  rejection: string | null;
};

export type CphReconciliation = {
  observation_start: string;
  observation_end: string;
  stock_initial_l: number | null;
  stock_final_l: number | null;
  livraisons_l: number | null;
  rajouts_l: number | null;
  retraits_l: number | null;
  vols_l: number | null;
  vidanges_l: number | null;
  livraisons_statut: "LIVRAISONS_ENOC_A_CONTROLER" | "LIVRAISONS_ENOC_RACCORDEES";
  observation_status: string | null;
  import_file: string | null;
  conso_theorique_l: number | null;
  jours_conso_calculee: number;
  jours_observation: number;
  conso_stock_l: number | null;
  ecart_l: number | null;
  ecart_pct: number | null;
  statut: CphReconciliationStatus;
  motifs: string[];
};

export type CphSiteRow = {
  site_id: string;
  site_name: string | null;
  country: string | null;
  zone: string | null;
  kind: "INDOOR" | "OUTDOOR" | null;
  kind_source: string | null;
  grid_supply: string | null;
  off_grid: boolean | null;
  dg_count: number | null;
  ge_label: string | null;
  data_issue: string | null;
  start: string;
  end: string;
  days: number;
  runtime_days: number;
  runtime_total_h: number | null;
  runtime_source_main: CphRuntimeSource | null;
  runtime_source_days: Record<string, number>;
  sources: Record<CphRuntimeSource, CphSourceEval>;
  power_source_main: CphPowerSource | null;
  power_source_days: Record<string, number>;
  p_ge_moy_kw: number | null;
  curve: CphCurveInfo | null;
  curve_reason: string | null;
  cph_days: number;
  cph_moy_l_h: number | null;
  conso_days: number;
  conso_theorique_l: number | null;
  conso_partielle_l: number | null;
  cph_status: CphPeriodStatus;
  extrapolated_days: number;
  day_status_counts: Record<string, number>;
  motifs: string[];
  rapprochement_statut: CphReconciliationStatus;
  rapprochement: CphReconciliation | null;
  observations: number;
  /** Premier point bloquant (null = site entièrement rapproché). */
  blocage?: CphBlocage | null;
  runtime_source_availability_pct?: number | null;
  charge_moy_pct?: number | null;
  /** Correspondance plaque → courbe (statut distinct de la qualité de la courbe). */
  correspondance?: CphCorrespondance | null;
  /** Conso estimée (CPH) vs conso mesurée (capteur) sur les jours communs. */
  comparaison?: CphComparaison;
  mapping_status?: CphMatchStatus | null;
  curve_source_status?: CphCurveSourceStatus | null;
  /** Puissance nominale du GE dans l'inventaire (Base GE, kVA). */
  ge_kva?: number | null;
  /** Motif précis quand la conso estimée n'est pas complète (null = complète). */
  motif_cph?: { code: CphMotifCode; detail: string | null; jours: number } | null;
  /** Statuts séparés : un CPH calculé sans relevé de stock reste CPH_CALCULE. */
  statut_cph?: CphStatutCph;
  perimetre?: CphPerimetre;
  /** Site affiché mais absent de Gestion des sites (connu de Snowflake / ENOC / fichiers Ops). */
  hors_referentiel?: boolean;
  statut_rapprochement_calcul?: CphStatutRapprochement;
  facture_avec_ge?: boolean | null;
  /** On-Grid / Off-Grid (Base GE, sinon Snowflake). */
  site_type?: string | null;
  configuration?: "INDOOR" | "OUTDOOR" | null;
  configuration_fichier?: string | null;
  running_days?: number;
  power_method_main?: CphPowerMethod | null;
  power_method_days?: Partial<Record<CphPowerMethod, number>>;
  blocked_days?: Record<string, { jours: number; runtime_h: number | null; mesuree_l: number | null }>;
  diag_codes?: string[];
  ac_statut?: CphAcStatus | null;
  p_ac_aux_kw?: number | null;
  /** Consommation spécifique (L/kWh) : contrôle de plausibilité, jamais bloquant. */
  conso_specifique?: {
    energie_ge_kwh: number | null; estimee_l_kwh: number | null; mesuree_l_kwh: number | null;
    alerte_estimee: boolean | null; alerte_mesuree: boolean | null; plage_l_kwh: [number, number]; alertes: string[];
  };
};

export type CphMatchStatus =
  | "AUTO_VALIDE_COMPATIBLE" | "VALIDE_MANUELLEMENT" | "A_VALIDER" | "MODELE_AMBIGU" | "COURBE_CPH_MANQUANTE"
  | "TYPE_GE_ABSENT" | "SITE_MULTI_GE" | "REJETE";

export type CphCurveSourceStatus = "VALIDE_CONSTRUCTEUR" | "HISTORIQUE_A_VALIDER" | "ARCHIVE" | "DISTRIBUTEUR";

export type CphMotifCode =
  | "RUNTIME_INDISPONIBLE" | "RUNTIME_NON_QUALIFIE" | "PUISSANCE_INDISPONIBLE" | "PUISSANCE_HORS_LIMITE"
  | "PUISSANCE_NOMINALE_ABSENTE" | "RENDEMENT_REDRESSEUR_INVALIDE" | "COURBE_CPH_MANQUANTE" | "MAPPING_GE_A_VALIDER"
  | "MODELE_GE_AMBIGU" | "SITE_MULTI_GE" | "TYPE_GE_ABSENT" | "PERIODE_INCOMPLETE" | "CONFIGURATION_INCONNUE"
  | "SITE_SANS_GE" | "GE_NON_CONFIRME_SNOWFLAKE";

export type CphCorrespondance = {
  statut: CphMatchStatus;
  mapping_status?: CphMatchStatus;
  curve_source_status?: CphCurveSourceStatus | null;
  score: number | null;
  methode: string | null;
  date: string | null;
  valide_par: string | null;
  courbe_id: string | null;
  courbe_statut: string | null;
  mapping_id: number | null;
  motif: string | null;
};

export type CphConsoStatus = "CONSO_ESTIMEE_NON_CALCULEE" | "MESURE_ABSENTE" | "COHERENT" | "ECART_A_JUSTIFIER" | "ECART_A_INVESTIGUER" | "NON_CONCERNE_SANS_GE";

export type CphComparaison = {
  conso_mesuree_l: number | null;
  jours_mesure: number;
  jours_communs: number;
  conso_estimee_communs_l: number | null;
  conso_mesuree_communs_l: number | null;
  ecart_l: number | null;
  ecart_pct: number | null;
  statut: CphConsoStatus;
  motif: string | null;
};

export type CphBlocage = { code: string; etape: "cph" | "rapprochement"; label: string; detail: string | null };

export type CphDay = {
  date: string;
  runtime_h: number | null;
  runtime_source: CphRuntimeSource | null;
  runtime_motifs: string[];
  raw: Record<CphRuntimeSource, number | null>;
  p_ge_kw: number | null;
  power_source: CphPowerSource | null;
  power_detail: string | null;
  p_dc_input_kw: number | null;
  p_ac_aux_kw: number | null;
  curve_id: string | null;
  charge_pct: number | null;
  cph_l_h: number | null;
  conso_l: number | null;
  measured_l?: number | null;
  motif_code?: CphMotifCode | null;
  extrapolated: boolean;
  status: CphDayStatus;
  motifs: string[];
  /** Chaîne de repli puissance du jour : chaque méthode tentée, retenue ou rejetée. */
  power_method?: CphPowerMethod | null;
  power_trace?: Record<CphPowerMethod, CphMethodAttempt> | null;
  power_raw?: { production_kwh: number | null; p_dse_kw: number | null; p_dc_kw: number | null; rendement: number | null; ac_avg_brut: number | null } | null;
  power_rejection_codes?: string[];
  power_cap_kw?: number | null;
  selected_power_kw?: number | null;
  rejection_reasons?: string[];
};

export type CphSiteDetail = CphSiteRow & {
  ac_reference: CphAcReference | null;
  batterie?: string;
  periode?: CphPeriodeInfo;
  reconciliations: CphReconciliation[];
  daily: CphDay[];
};

export type CphSynthesis = {
  /** Sites avec GE confirmé (base de tous les indicateurs CPH). */
  sites: number;
  sites_total?: number;
  sites_sans_ge?: number;
  sites_ge_a_confirmer?: number;
  cph_calcules: number;
  conso_theorique_complete: number;
  cph_non_calcule: number;
  rapprochements_calcules: number;
  ok: number;
  a_justifier: number;
  a_investiguer: number;
  donnees_incompletes: number;
  rapprochement_cph_non_calcule: number;
  blocages?: Array<{ code: string; etape: "cph" | "rapprochement"; label: string; sites: number }>;
  conso?: {
    sites_estimee_complete: number;
    sites_estimee_partielle: number;
    sites_estimee_non_calculee: number;
    total_estimee_complete_l: number | null;
    sites_mesure: number;
    total_mesuree_l: number | null;
    sites_compares: number;
    statuts: Partial<Record<CphConsoStatus, number>>;
  };
  correspondances?: Partial<Record<CphMatchStatus, number>>;
  courbes_appliquees?: Partial<Record<CphCurveSourceStatus, number>>;
  motifs_cph?: Partial<Record<CphMotifCode, number>>;
  alertes_sfc?: { estimee: number; mesuree: number };
  couvertures?: CphCouverture[];
  diagnostic_blocages?: CphDiagnosticBlocage[];
  statuts_cph?: Partial<Record<CphStatutCph, number>>;
  statuts_rapprochement_calcul?: Partial<Record<CphStatutRapprochement, number>>;
  methodes_puissance?: Partial<Record<CphPowerMethod, number>>;
  load_ac_statuts?: Partial<Record<CphAcStatus, number>>;
};

/** KPI de couverture : jamais un « taux de couverture » unique et ambigu. */
export type CphCouverture = {
  code: "conso_mesuree" | "runtime" | "mapping" | "puissance" | "cph" | "rapprochement";
  label: string;
  numerateur: number;
  denominateur: number;
  pct: number | null;
  definition: string;
};

export type CphDiagnosticBlocage = {
  code: string;
  label: string;
  type: "jour" | "site";
  bloquant: boolean;
  sites: number;
  jours: number;
  runtime_h: number | null;
  conso_mesuree_l: number | null;
  volume_potentiel_l: number | null;
  sites_volume_potentiel: number;
  filtre: { diag: string };
};

export type CphPeriodeInfo = { incomplete: boolean; donnees_jusqu_au: string | null; jours_sans_donnees: number };

export type CphMeta = {
  abaque_file: string | null;
  abaque_imported_at: string | null;
  rule_version: string;
  enoc_deliveries_connected: boolean;
  facts_last_date: string | null;
  facts_last_sync: { status: string; at: string | null; error: string | null } | null;
  curves_total: number;
  curves_usable: number;
  mappings_total: number;
  mappings_validated: number;
  max_period_days: number;
  observations_last_import?: { file_name: string; at: string; rows_imported: number; rows_rejected: number } | null;
  mappings_by_status?: Partial<Record<CphMatchStatus, number>>;
  facts_age_days?: number | null;
  facts_stale?: boolean;
  stale_after_days?: number;
  last_sync_failed?: boolean;
  last_sync_error?: string | null;
  can_validate?: boolean;
};

export type CphPeriodResponse = {
  start: string;
  end: string;
  days: number;
  synthesis: CphSynthesis;
  data: CphSiteRow[];
  pagination: Pagination;
  filters: { perimetres?: Partial<Record<CphPerimetre, number>>; runtime_sources: string[]; power_sources: string[]; power_methods?: string[]; zones: string[]; countries: string[] };
  meta: CphMeta;
  periode?: CphPeriodeInfo;
  /** Sites affichés mais absents de Gestion des sites (à importer). */
  sites_hors_referentiel?: number;
};

export type CphFilters = {
  start: string;
  end: string;
  country?: string;
  zone?: string;
  site?: string;
  runtime_source?: string;
  power_source?: string;
  statut?: string;
  cph_status?: string;
  blocage?: string;
  statut_conso?: string;
  correspondance?: string;
  curve_source_status?: string;
  motif_cph?: string;
  dispo_runtime?: string;
  alerte_sfc?: string;
  statut_cph?: string;
  statut_rapprochement_calcul?: string;
  power_method?: string;
  configuration?: string;
  diag?: string;
  perimetre?: string;
  hors_referentiel?: string;
};

export async function getCphPeriod(params: CphFilters & { page?: number; limit?: number }) {
  const { data } = await api.get<CphPeriodResponse>(`${BASE}/cph/`, { params: cleanParams(params) });
  return data;
}

export async function getCphSiteDetail(siteId: string, params: { start: string; end: string }) {
  const { data } = await api.get<CphSiteDetail>(`${BASE}/cph/sites/${encodeURIComponent(siteId)}/`, { params });
  return data;
}

export async function exportCph(kind: "controle" | "anomalies", params: CphFilters) {
  const { data } = await api.get(`${BASE}/cph/export/${kind}/`, { params: cleanParams(params), responseType: "blob" });
  return data as Blob;
}

export type CphObservationImportResult = {
  id: number;
  file_name: string;
  rule_version: string;
  rows_total: number;
  rows_imported: number;
  rows_rejected: number;
  errors: Array<{ line: number; site_id: string | null; error: string }>;
};

export async function importCphObservations(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await api.post<CphObservationImportResult>(`${BASE}/cph/observations/import/`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export type CphReferentielCurve = {
  curve_id: string;
  manufacturer: string;
  model: string;
  variant: string;
  prp_kva: number;
  prp_kw: number;
  power_factor: number | null;
  conso_50_l_h: number;
  conso_75_l_h: number;
  conso_100_l_h: number;
  a: number;
  b: number;
  c: number;
  status: string;
  curve_source_status?: CphCurveSourceStatus;
  is_usable: boolean;
  business_approved: boolean;
  business_approved_by: string | null;
  business_approved_at: string | null;
  source: string;
  source_url: string;
  note: string;
};

export type CphReferentielMapping = {
  id: number;
  inventory_label: string;
  inventory_kva: number | null;
  site_count: number | null;
  abaque_status: string;
  action_required: string;
  candidates: CphReferentielCurve[];
  validated_curve_id: string | null;
  validated_by: string | null;
  validated_at: string | null;
  validation_comment: string;
  match_status?: CphMatchStatus;
  match_score?: number | null;
  match_method?: string;
  match_reasons?: string[];
  matched_at?: string | null;
  history?: Array<{
    old_status: string; new_status: string; old_curve_id: string; new_curve_id: string; score: number | null;
    rule: string; changed_by: string | null; changed_at: string; comment: string;
  }>;
};

export type CphReferentiel = {
  can_validate: boolean;
  curves: CphReferentielCurve[];
  mappings: CphReferentielMapping[];
};

export type CphAbaqueImportResult = {
  file_name: string;
  curves: number;
  status_counts: Record<string, number>;
  mappings: number;
  warnings: string[];
  validations_reset: string[];
};

export async function importCphAbaque(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await api.post<CphAbaqueImportResult>(`${BASE}/cph/abaque/import/`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function getCphReferentiel() {
  const { data } = await api.get<CphReferentiel>(`${BASE}/cph/referentiel/`);
  return data;
}

export async function validateCphMapping(id: number, curveId: string, comment: string) {
  const { data } = await api.post(`${BASE}/cph/mappings/${id}/validate/`, { curve_id: curveId, comment });
  return data;
}

export async function autoMatchCphMappings(resetRemovals = false) {
  const { data } = await api.post<{ counts: Record<string, number> }>(`${BASE}/cph/mappings/auto-match/`, { reset_removals: resetRemovals });
  return data;
}

export async function unvalidateCphMapping(id: number, comment = "") {
  const { data } = await api.post(`${BASE}/cph/mappings/${id}/unvalidate/`, { comment });
  return data;
}

export async function approveCphCurve(curveId: string, comment: string) {
  const { data } = await api.post(`${BASE}/cph/curves/${encodeURIComponent(curveId)}/approve/`, { comment });
  return data;
}

export async function revokeCphCurve(curveId: string) {
  const { data } = await api.post(`${BASE}/cph/curves/${encodeURIComponent(curveId)}/revoke/`);
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Registre unifié de stock carburant (Phase 1) — /fuel-tracking/stock/registre/…
// Stock retenu = relevé VALIDÉ, converti en litres (cuve validée), contrôlé contre
// la capacité. Une valeur absente reste null (jamais 0). Snowflake = information
// technique, jamais retenu.
// ─────────────────────────────────────────────────────────────────────────────

export type StockSource = "ENOC" | "LOLIFORCE" | "SCSS" | "SNOWFLAKE" | "CLOSING";
export type ConversionMethod = "DIRECT_LITERS" | "TANK_CURVE" | "GEOMETRIC_CALCULATION" | "CALIBRATED" | "NONE";
export type ConversionStatus = "VALID" | "GEOMETRIC_ONLY" | "PENDING_TANK_MAPPING" | "INVALID";
export type ObsValidationStatus = "PENDING" | "VALIDATED" | "REJECTED" | "NON_EXPLOITABLE";
export type RegistryStatut = "RETENU" | "INDISPONIBLE" | "AUCUNE_DONNEE";
export type RegistryMessage = { code: string; message: string };

export type RegistryMovementSummary = {
  id: number;
  movement_type: string | null;
  movement_datetime: string | null;
  quantity_l: number | null;
  requested_quantity_l: number | null;
  status: string;
  proof_reference: string | null;
  ticket_reference: string | null;
  source_type: string;
};

export type DisplayStatus = "AUTO_VALIDE" | "VALIDE_MANUELLEMENT" | "A_TRAITER" | "REJETE" | "NON_EXPLOITABLE";
export type TankAssignmentStatus = "VALIDEE" | "PROPOSEE" | "A_CONFIRMER" | "INCOMPLETE" | "PLUSIEURS_CUVES_A_IDENTIFIER" | "REJETEE";
export type IssueDetail = { code: string; anomalie: string; regle: string; action: string; action_type: string };

export type StockRegistryRow = {
  site_id: string;
  site_name: string | null;
  pays: string | null;
  typologie: string | null;
  zone: string | null;
  environnement: string;
  raccordement: string;
  ge: string;
  solaire: string;
  profil_energetique: string;
  conversion_rule: string | null;
  volume_geometric_l: number | null;
  volume_calibrated_l: number | null;
  statut_releve: DisplayStatus | null;
  issue_codes: string[];
  modele_cuve: string | null;
  modele_statut: string | null;
  tank_statuses: TankAssignmentStatus[];
  gardiennage_attendu: string | null;
  stock_l: number | null;
  source: StockSource | null;
  observation_id: number | null;
  observation_datetime: string | null;
  age_hours: number | null;
  level_raw: string | null;
  level_unit: "L" | "CM" | null;
  conversion_method: ConversionMethod | null;
  conversion_status: ConversionStatus | null;
  validation_status: ObsValidationStatus | null;
  capacity_l: number | null;
  fill_pct: number | null;
  statut: RegistryStatut;
  unavailable_reason: string | null;
  alerts: string[];
  pending_count: number;
  tanks_total: number;
  tanks_validated: number;
  last_validated_movement: RegistryMovementSummary | null;
  last_movement: RegistryMovementSummary | null;
  /** Vue compacte : anomalie principale et prochaine action en clair (null = rien à faire / aucun relevé). */
  anomalie?: string | null;
  prochaine_action?: string | null;
  prochaine_action_type?: "OPEN_TANK" | "OPEN_HISTORY" | "VALIDATE_OBS" | "SET_GUARD" | "MAP_ENOC" | null;
};

export type StockRegistryKpis = {
  sites_total: number;
  denominateur: string;
  sites_cuve_validee: number;
  cuves_par_statut: Record<string, number>;
  sites_stock_retenu: number;
  sites_indisponible: number;
  sites_sans_donnee: number;
  releves_a_valider: number;
  sites_conflit: number;
  cuves_validees: number;
  cuves_a_valider: number;
  imports_a_valider: number;
  /** Absent sur un backend antérieur (repli : sites_indisponible). */
  sites_action_requise?: number;
};

export type StockRegistryResponse = {
  data: StockRegistryRow[];
  pagination: Pagination;
  kpis: StockRegistryKpis;
  alert_labels: Record<string, string>;
  statut_labels: Record<string, string>;
  can_validate: boolean;
  regles: { tolerance_capacite_pct: number; comparaison: string; snowflake: string; stock_retenu: string; profil_energetique: string };
};

export type StockRegistryParams = {
  search?: string;
  statut?: RegistryStatut | "";
  alerte?: string;
  source?: string;
  gardiennage?: string;
  action_requise?: boolean;
  tri?: "priorite";
  page?: number;
  limit?: number;
};

export async function getStockRegistry(params: StockRegistryParams) {
  const { data } = await api.get<StockRegistryResponse>(`${BASE}/stock/registre/`, { params: cleanParams(params) });
  return data;
}

export type StockObservation = {
  id: number;
  source_type: StockSource;
  source_event_id: string;
  tank_id: string | null;
  observation_datetime: string;
  level_raw: string | null;
  level_value: number | null;
  level_unit: "L" | "CM" | null;
  level_liters: number | null;
  conversion_method: ConversionMethod;
  conversion_status: ConversionStatus;
  conversion_message: string | null;
  capacity_l: number | null;
  hour_meter: number | null;
  source_user: string | null;
  source_reference: string | null;
  guard_scope_status: string | null;
  comment: string | null;
  proof_reference: string | null;
  validation_status: ObsValidationStatus;
  validation_reason: string | null;
  review_flags: RegistryMessage[];
  validated_by: string | null;
  validated_at: string | null;
  batch_id: number | null;
  statut_releve: DisplayStatus;
  issues: IssueDetail[];
  volume_geometric_l: number | null;
  volume_calibrated_l: number | null;
  declared_liters: number | null;
  level_cm: number | null;
  cm_liters_gap_l: number | null;
  fill_pct: number | null;
  conversion_rule: string | null;
  tank_model_ref: string | null;
};

export type StockMovement = {
  id: number;
  source_type: string;
  source_event_id: string;
  movement_type: string | null;
  movement_datetime: string | null;
  requested_quantity_l: number | null;
  quantity_l: number | null;
  counterpart_site_id: string | null;
  tank_id: string | null;
  level_before_raw: string | null;
  level_after_raw: string | null;
  hour_meter_before: number | null;
  hour_meter_after: number | null;
  supplier: string | null;
  ticket_reference: string | null;
  delivery_note: string | null;
  proof_reference: string | null;
  source_user: string | null;
  source_status: string | null;
  status: "DECLARED" | "CLOSED" | "VALIDATED" | "REJECTED";
  alerts: RegistryMessage[];
  comment: string | null;
  validation_reason: string | null;
  validated_by: string | null;
  validated_at: string | null;
  batch_id: number | null;
  raw_operation_type: string | null;
  source_category: string | null;
  mapping_rule: string | null;
  retained_in_stock: boolean;
};

export type TankShape = "HORIZONTAL_CYLINDER" | "VERTICAL_CYLINDER" | "RECTANGULAR" | "HORIZONTAL_ELLIPTICAL" | "CUSTOM_CURVE";

export type TankFamily = "h-circ" | "h-elli" | "h-oblo" | "v-cyl" | "v-tronc" | "rect";

export type StockTank = {
  id: number;
  site_id: string;
  tank_id: string;
  shape: TankShape | null;
  shape_family: TankFamily | null;
  dimension_1_cm: number | null;
  dimension_2_cm: number | null;
  dimension_3_cm: number | null;
  bottom_profile: string | null;
  bottom_z_cm: number | null;
  top_profile: string | null;
  top_z_cm: number | null;
  length_m: number | null;
  width_m: number | null;
  height_m: number | null;
  diameter_m: number | null;
  capacity_l: number | null;
  capacity_plate_l: number | null;
  capacity_plate_source: string | null;
  geometric_capacity_l: number | null;
  calibration_k: number | null;
  plate_gap_pct: number | null;
  plate_coherent: boolean | null;
  physical_height_cm: number | null;
  calibration_curve: Array<[number, number]> | null;
  calibration_validated: boolean;
  source_type: string;
  source_batch_id: number | null;
  source_file: string | null;
  source_sheet: string | null;
  source_row: number | null;
  proof_reference: string | null;
  serial_number: string | null;
  number_of_tanks_on_site: number | null;
  observed_at: string | null;
  tank_model_id: string | null;
  tank_model_label: string | null;
  model_match_status: "NONE" | "PROPOSED" | "CONFIRMED" | "REJECTED";
  validation_status: TankAssignmentStatus;
  validation_reason: string | null;
  validated_by: string | null;
  validated_at: string | null;
  active: boolean;
  comment: string | null;
};

export type GuardComparison = {
  status: "COHERENT" | "STOCK_CONFLICT" | "NOT_COMPARABLE";
  reason: string | null;
  ecart_l?: number;
  tolerance_l?: number;
  tank_id: string | null;
  loliforce: { id: number; datetime: string; level_l: number | null; raw: string | null };
  scss: { id: number; datetime: string; level_l: number | null; raw: string | null };
};

export type RetainedStock = {
  stock_l: number | null;
  source_type: StockSource | null;
  observation_datetime: string | null;
  age_hours: number | null;
  level_raw: string | null;
  level_unit: string | null;
  conversion_method: ConversionMethod | null;
  validation_status: ObsValidationStatus | null;
  capacity_l: number | null;
  fill_pct: number | null;
  unavailable_reason: string | null;
};

export type StockSiteHistory = {
  site: { site_id: string; name: string | null; installed_typology?: string | null; zone?: string | null };
  retenu: RetainedStock | null;
  observations: StockObservation[];
  mouvements: StockMovement[];
  comparaisons: GuardComparison[];
  cuves: StockTank[];
  gardiennage: Array<{ id: number; provider: string; active_from: string; active_to: string | null; comment: string | null }>;
  snowflake_technique: { stock_l: number | null; capacity_l: number | null; date: string | null; quality_status: string | null; note: string } | null;
  corrections: Array<{
    id: number; entity: string; entity_id: number; action: string; field: string | null;
    old_value: string | null; new_value: string | null; reason: string; author: string | null; created_at: string;
  }>;
  can_validate: boolean;
};

export async function getStockSiteHistory(siteId: string) {
  const { data } = await api.get<StockSiteHistory>(`${BASE}/stock/registre/${encodeURIComponent(siteId)}/`);
  return data;
}

export async function decideStockObservation(id: number, decision: "valider" | "rejeter", reason: string) {
  const { data } = await api.post<StockObservation>(`${BASE}/stock/observations/${id}/${decision}/`, { reason });
  return data;
}

export async function decideStockMovement(id: number, decision: "valider" | "rejeter", reason: string) {
  const { data } = await api.post<StockMovement>(`${BASE}/stock/mouvements/${id}/${decision}/`, { reason });
  return data;
}

export type TankPatch = Partial<Pick<StockTank, "shape_family" | "dimension_1_cm" | "dimension_2_cm" | "dimension_3_cm" | "bottom_profile"
  | "bottom_z_cm" | "top_profile" | "top_z_cm" | "capacity_plate_l" | "capacity_plate_source" | "serial_number" | "number_of_tanks_on_site"
  | "proof_reference" | "comment" | "model_match_status">> & {
  tank_model?: string | null;
  validate?: boolean;
  reason: string;
};

export async function patchStockTank(id: number, patch: TankPatch) {
  const { data } = await api.patch<StockTank & { releves_reconvertis: number }>(`${BASE}/stock/cuves/${id}/`, patch);
  return data;
}

export async function createStockTank(body: TankPatch & { site_id: string; tank_id: string }) {
  const { data } = await api.post<StockTank>(`${BASE}/stock/cuves/`, body);
  return data;
}

export async function createGuardScope(body: { site_id: string; provider: "LOLIFORCE" | "SCSS"; active_from: string; active_to?: string; reason: string }) {
  const { data } = await api.post(`${BASE}/stock/gardiennage/`, body);
  return data;
}

export type ImportSourceType = "ENOC" | "LOLIFORCE" | "SCSS" | "CLOSING" | "HISTORICAL_REFUELING" | "TANK_MODELS";
export type ImportBatchStatus = "RECEIVED" | "PROCESSING" | "VALIDATION_REQUIRED" | "ACCEPTED" | "REJECTED" | "FAILED";

export type StockImportBatch = {
  id: number;
  source_type: ImportSourceType;
  file_name: string;
  file_hash: string;
  file_size: number | null;
  origin: string;
  status: ImportBatchStatus;
  status_message: string | null;
  duplicate_of: number | null;
  relaunch_of: number | null;
  relaunch_reason: string | null;
  rows_total: number;
  rows_accepted: number;
  rows_warning: number;
  rows_rejected: number;
  rows_pending: number;
  rows_duplicate: number;
  summary: Record<string, unknown>;
  received_at: string;
  processed_at: string | null;
  received_by: string | null;
};

export type StockImportListResponse = {
  data: StockImportBatch[];
  pagination: Pagination;
  repertoire: { monte: boolean; sous_dossiers: string[] };
};

export async function getStockImports(params: { page?: number; limit?: number; source_type?: string; statut?: string }) {
  const { data } = await api.get<StockImportListResponse>(`${BASE}/stock/imports/`, { params: cleanParams(params) });
  return data;
}

export async function uploadStockImport(file: File, sourceType: Exclude<ImportSourceType, "ENOC">) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("source_type", sourceType);
  const { data } = await api.post<StockImportBatch>(`${BASE}/stock/imports/`, fd, { headers: { "Content-Type": "multipart/form-data" } });
  return data;
}

export type StockImportRow = {
  id: number;
  sheet_name: string | null;
  row_number: number;
  site_id_raw: string | null;
  site_id_resolved: string | null;
  event_datetime: string | null;
  validation_status: "ACCEPTED" | "WARNING" | "REJECTED" | "PENDING";
  messages: RegistryMessage[];
  raw_payload: Record<string, unknown>;
};

export async function getStockImportRows(id: number, params: { page?: number; limit?: number; statut?: string }) {
  const { data } = await api.get<{ batch: StockImportBatch; data: StockImportRow[]; pagination: Pagination }>(
    `${BASE}/stock/imports/${id}/lignes/`, { params: cleanParams(params) },
  );
  return data;
}

export async function relaunchStockImport(id: number, reason: string) {
  const { data } = await api.post<StockImportBatch>(`${BASE}/stock/imports/${id}/relancer/`, { reason });
  return data;
}

// « À traiter — actions requises »
export type WorkQueueCounter = { key: string; label: string; description: string; count: number };
export type WorkQueueItem = {
  site_id: string;
  date: string | null;
  source: string;
  anomalie: string;
  valeur_brute: string;
  attendu: string;
  regle: string;
  action: string;
  action_type: "OPEN_TANK" | "OPEN_HISTORY" | "VALIDATE_OBS" | "SET_GUARD" | "MAP_ENOC" | "RECONCILE_ENOC";
  ref: { observation_id?: number; tank_id?: number; tank?: string; movement_id?: number; raw_value?: string; enoc_id?: number };
  count: number;
  message: string;
};

export async function getStockWorkQueueCounters() {
  const { data } = await api.get<{ counters: WorkQueueCounter[]; can_validate: boolean }>(`${BASE}/stock/a-traiter/`);
  return data;
}

export async function getStockWorkQueue(categorie: string, params: { page?: number; limit?: number; search?: string }) {
  const { data } = await api.get<{ categorie: string; label: string; data: WorkQueueItem[]; pagination: Pagination; can_validate: boolean }>(
    `${BASE}/stock/a-traiter/`, { params: cleanParams({ categorie, ...params }) },
  );
  return data;
}

// Classification versionnée des types d'opération ENOC
export type EnocTypeRow = {
  raw_value: string;
  count: number;
  statuts: Record<string, number>;
  avec_operation: number;
  suggestion: string | null;
  exemples: string[];
  categorie: string;
  version: number | null;
  configure: boolean;
  versions: number;
  commentaire: string | null;
};

export async function getEnocTypes() {
  const { data } = await api.get<{ data: EnocTypeRow[]; categories: Array<{ key: string; label: string }>; can_validate: boolean; regles: string[] }>(
    `${BASE}/stock/enoc/types/`,
  );
  return data;
}

export async function setEnocType(raw_value: string, category: string, reason: string) {
  const { data } = await api.post(`${BASE}/stock/enoc/types/`, { raw_value, category, reason });
  return data;
}

// Bibliothèque des modèles de cuves (calculateur de Steve)
export type TankModelRow = {
  tank_model_id: string;
  country: string | null;
  source_file: string | null;
  source_sheet: string | null;
  source_row: number | null;
  source_label: string | null;
  shape_code: TankFamily | null;
  shape_label: string | null;
  nominal_capacity_l: number | null;
  dimension_1_cm: number | null;
  dimension_2_cm: number | null;
  dimension_3_cm: number | null;
  bottom_profile: string | null;
  bottom_z_cm: number | null;
  top_profile: string | null;
  geometric_full_l: number | null;
  calibration_k: number | null;
  plate_gap_pct: number | null;
  model_status: "COMPLET" | "A_CONFIRMER" | "INCOMPLET";
  status_reason: string | null;
  geometric_formula_version: string | null;
  sites: number;
};

export async function getTankModels() {
  const { data } = await api.get<{ data: TankModelRow[]; familles: Record<string, string>; profils: Record<string, string>; version_moteur: string }>(
    `${BASE}/stock/modeles-cuves/`,
  );
  return data;
}


// ── ENOC : mouvements qualifiés (contrat canonique, qualification, rapprochement) ──────────────────

export type EnocExecutionState =
  | "DEMANDE" | "APPROUVEE" | "TERMINEE" | "QUANTITE_REELLE_MANQUANTE" | "PREUVE_MANQUANTE"
  | "A_RAPPROCHER" | "ELIGIBLE_STOCK_REEL" | "REJETEE" | "NATURE_A_QUALIFIER";

export type EnocAlert = { code: string; message: string; blocking?: boolean };

export type EnocMovementRow = {
  id: number;
  enoc_reference: string | null;
  enoc_request_id: string | null;
  lien_enoc: string | null;
  site_id: string | null;
  site_id_brut: string | null;
  site_connu: boolean;
  site_name: string | null;
  country: string | null;
  zone: string | null;
  type_brut: string | null;
  type_famille: "TOTAL_CARD" | "PONCTION" | "TRUCK" | "AUTRE";
  statut_brut: string | null;
  qualification: string;
  etat: EnocExecutionState;
  rapprochement: "NON_REQUIS" | "A_RAPPROCHER" | "RAPPROCHE" | "CERTIFIE" | "REJETE";
  impact_stock: boolean;
  impact_conso: boolean;
  motif: string;
  conditions_manquantes: string[];
  alertes: EnocAlert[];
  bloquant: boolean;
  date_reelle: string | null;
  date_prevue: string | null;
  date_demande: string | null;
  date_approbation: string | null;
  date_cloture: string | null;
  quantite_demandee_l: number | null;
  quantite_approuvee_l: number | null;
  quantite_reelle_l: number | null;
  unite: string | null;
  niveau_avant_l: number | null;
  niveau_apres_l: number | null;
  niveau_avant_cm: number | null;
  niveau_apres_cm: number | null;
  compteur_avant_h: number | null;
  compteur_apres_h: number | null;
  technicien: string | null;
  valideur: string | null;
  cloture_par: string | null;
  commentaire: string | null;
  nb_preuves: number;
  preuves: string[];
  fournisseur: string | null;
  bon_livraison: string | null;
  camion: string | null;
  nb_operations: number;
  rapproche_par: string | null;
  rapproche_le: string | null;
  motif_rapprochement: string | null;
  element_rapprochement: string | null;
  synchronise_le: string | null;
};

export type EnocTotal = { label: string; count: number; quantite_reelle_l: number | null; sans_quantite: number };

export type EnocMovementListResponse = {
  data: EnocMovementRow[];
  pagination: Pagination;
  totaux: Record<"demandes" | "declares" | "eligibles" | "certifies" | "a_qualifier" | "rejetes", EnocTotal>;
  facettes: {
    types_bruts: string[];
    statuts_enoc: string[];
    qualifications: Array<{ key: EnocExecutionState; label: string }>;
    classifications: string[];
    anomalies: string[];
    zones: string[];
    pays: string[];
  };
  can_validate: boolean;
  regles: string[];
};

export type EnocMovementParams = {
  type_brut?: string;
  statut_enoc?: string;
  qualification?: string;
  impact?: "" | "OUI" | "NON";
  preuve?: "" | "AVEC" | "SANS";
  a_rapprocher?: boolean;
  anomalie?: string;
  date_debut?: string;
  date_fin?: string;
  pays?: string;
  zone?: string;
  site?: string;
  page?: number;
  limit?: number;
};

export type EnocMovementDetail = EnocMovementRow & {
  sources_champs: Record<string, string>;
  contexte_rapprochement: {
    releves_terrain: Array<{ id: number; source: string; date: string; brut: string | null; litres: number | null; statut: string; position: string }>;
    niveau_enoc_avant_l: number | null;
    niveau_enoc_apres_l: number | null;
    quantite_reelle_l: number | null;
    preuves: string[];
    preuve_fournisseur: boolean;
  };
  brut: { demande: Record<string, unknown> | null; operation: Record<string, unknown> | null; operations: Array<Record<string, unknown>> | null };
  historique: Array<{ date: string; action: string; champ: string | null; ancien: string | null; nouveau: string | null; motif: string; auteur: string | null }>;
  can_validate: boolean;
};

export async function getEnocMovements(params: EnocMovementParams) {
  const { a_rapprocher, ...rest } = params;
  const { data } = await api.get<EnocMovementListResponse>(`${BASE}/stock/enoc/mouvements/`, {
    params: cleanParams({ ...rest, a_rapprocher: a_rapprocher ? "1" : undefined }),
  });
  return data;
}

export async function getEnocMovement(id: number) {
  const { data } = await api.get<EnocMovementDetail>(`${BASE}/stock/enoc/mouvements/${id}/`);
  return data;
}

export async function reconcileEnocMovement(id: number, decision: "rapprocher" | "rejeter", reason: string, evidence: string) {
  const { data } = await api.post<EnocMovementRow>(`${BASE}/stock/enoc/mouvements/${id}/rapprocher/`, { decision, reason, evidence });
  return data;
}

export type StockBalance = {
  site_id: string;
  periode: { debut: string; fin: string };
  periode_effective: { debut: string | null; fin: string | null };
  stock_initial: { litres: number | null; date: string; source: string; methode: string; releve_id: number } | null;
  stock_final: { litres: number | null; date: string; source: string; methode: string; releve_id: number } | null;
  composantes_l: { livraisons: number; transferts_entree: number; transferts_sortie: number; vols: number; vidanges: number };
  mouvements_comptes: Array<{ source: string; ref: string; date: string; type: string; quantite_l: number | null; composante: string; certification: string }>;
  mouvements_inconnus: Array<{ source: string; ref: string; date: string; type: string | null; etat: string; motif: string }>;
  conso_reelle_l: number | null;
  certification: "NON_CALCULABLE" | "INCOHERENT" | "CALCULE_NON_CERTIFIE" | "CERTIFIE";
  motifs: string[];
  alertes: string[];
  formule: string;
  references?: { conso_theorique_cph_l: number | null; conso_instrumentee_snowflake_l: number | null; statut_cph: string | null; motif: string | null };
};

export async function getStockBalance(siteId: string, debut: string, fin: string) {
  const { data } = await api.get<StockBalance>(`${BASE}/stock/registre/${encodeURIComponent(siteId)}/bilan/`, { params: { debut, fin } });
  return data;
}
