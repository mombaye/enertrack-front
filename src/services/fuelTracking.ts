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
export type CphPowerSource = "PRODUCTION_GE" | "DC_REDRESSEUR" | "INDOOR_DC_PLUS_AC_HISTORIQUE";
export type CphPeriodStatus = "COMPLET" | "PARTIEL" | "NON_CALCULE";
export type CphReconciliationStatus = "OK" | "A_JUSTIFIER" | "A_INVESTIGUER" | "DONNEES_INCOMPLETES" | "CPH_NON_CALCULE";
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
};

export type CphMatchStatus =
  | "AUTO_VALIDE_COMPATIBLE" | "VALIDE_MANUELLEMENT" | "A_VALIDER" | "COURBE_CPH_MANQUANTE"
  | "MODELE_AMBIGU" | "SITE_MULTI_GE" | "GE_INCONNU";

export type CphCorrespondance = {
  statut: CphMatchStatus;
  score: number | null;
  methode: string | null;
  date: string | null;
  valide_par: string | null;
  courbe_id: string | null;
  courbe_statut: string | null;
  mapping_id: number | null;
  motif: string | null;
};

export type CphConsoStatus = "CONSO_ESTIMEE_NON_CALCULEE" | "MESURE_ABSENTE" | "COHERENT" | "ECART_A_JUSTIFIER" | "ECART_A_INVESTIGUER";

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
  extrapolated: boolean;
  status: CphDayStatus;
  motifs: string[];
};

export type CphSiteDetail = CphSiteRow & {
  ac_reference: { p_ac_aux_kw: number | null; reference_dates: string[]; reason: string | null } | null;
  reconciliations: CphReconciliation[];
  daily: CphDay[];
};

export type CphSynthesis = {
  sites: number;
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
  courbes_appliquees?: Record<string, number>;
};

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
  can_validate?: boolean;
};

export type CphPeriodResponse = {
  start: string;
  end: string;
  days: number;
  synthesis: CphSynthesis;
  data: CphSiteRow[];
  pagination: Pagination;
  filters: { runtime_sources: string[]; power_sources: string[]; zones: string[]; countries: string[] };
  meta: CphMeta;
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

export async function unvalidateCphMapping(id: number) {
  const { data } = await api.post(`${BASE}/cph/mappings/${id}/unvalidate/`);
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
