import { api } from "@/services/api";

const BASE = "/fuel-tracking";

export type FuelAnomalyCode =
  | "DELIVERY_GT_ORDER"
  | "CONSO_WITHOUT_GE_HOURS"
  | "GE_HOURS_WITHOUT_CONSO"
  | "ABNORMAL_GE_HOURS"
  | "HIGH_MONITORING_UNAVAILABILITY";

export type FuelStatusCode =
  | "ALL"
  | "OK"
  | "WARNING"
  | "NOK"
  | "EFMS_ONLY"
  | "ENOC_ONLY"
  | "NO_BASE"
  | "NO_DATA";

export type FuelEfmsMonthly = {
  id: number;
  month_year: string;
  year: number;
  month: number;
  country: string;
  site_id: string;
  site_name: string | null;

  fuel_order_l: string | number;
  fuel_deli_l: string | number;
  fuel_conso_l: string | number;

  ge_working_hours: string | number;
  abnormal_ge_working_hours: string | number;
  monitoring_unavailability_hours: string | number;
  monitoring_unavailability_percent: string | number;

  cph_l_per_hour: string | number | null;
  anomaly_flags: FuelAnomalyCode[];

  synced_at: string;
  updated_at: string;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export type FuelEfmsMonthlyResponse = {
  data: FuelEfmsMonthly[];
  pagination: Pagination;
};

export type FuelDashboard = {
  filters: {
    country: string;
    year?: string | null;
    month?: string | null;
    month_year?: string | null;
    site?: string | null;
    anomaly?: string | null;
  };
  kpis: {
    total_rows: number;
    active_sites: number;
    sites_with_conso: number;
    sites_with_ge_hours: number;
    total_order_l: number;
    total_deli_l: number;
    total_conso_l: number;
    total_ge_hours: number;
    total_abnormal_ge_hours: number;
    total_monitoring_unavailability_hours: number;
    cph_global: number | null;
  };
  anomalies: Record<FuelAnomalyCode, number>;
  top_conso: FuelEfmsMonthly[];
  top_cph: FuelEfmsMonthly[];
  top_ge_hours: FuelEfmsMonthly[];
  monthly_evolution: {
    month_year: string;
    year: number;
    month: number;
    fuel_order_l: number;
    fuel_deli_l: number;
    fuel_conso_l: number;
    ge_working_hours: number;
    cph_global: number | null;
  }[];
};

export type FuelMonthlyParams = {
  country?: string;
  month_year?: string;
  year?: number;
  month?: number;
  site?: string;
  anomaly?: FuelAnomalyCode | "";
  only_active?: boolean;
  page?: number;
  limit?: number;
};

export type FuelSyncRun = {
  id: number;
  country: string;
  month_from: string | null;
  month_to: string | null;
  status: "RUNNING" | "SUCCESS" | "FAILED";
  rows_fetched: number;
  rows_created: number;
  rows_updated: number;
  started_at: string;
  finished_at: string | null;
  error_message: string | null;
};

export type FuelEnocSyncRun = {
  id: number;
  start_date: string | null;
  end_date: string | null;
  updated_since: string | null;
  status: "RUNNING" | "SUCCESS" | "FAILED";
  rows_fetched: number;
  rows_created: number;
  rows_updated: number;
  started_at: string;
  finished_at: string | null;
  error_message: string | null;
};


export type FuelEnocSiteContext = {
  source?: "ENOC_SITE";
  site_id?: string | null;
  site_name?: string | null;
  zone?: string | null;
  ville?: string | null;
  region?: string | null;

  batch_operational?: string | null;
  batch?: string | null;
  scope_initial?: string | null;

  typo_simple?: string | null;
  new_typo?: string | null;
  typology_contractual?: string | null;
  priority?: string | null;
  category?: string | null;

  load?: number | null;
  new_load?: number | null;
  new_load_contract_v2?: number | null;

  modernised_date?: string | null;
  ongrid_offgrid?: string | null;
  indoor_outdoor_after_passive?: string | null;

  installation_new_ge?: string | null;
  nb_ge?: number | string | null;
  ge1_power_kva?: number | null;
  ge2_power_kva?: number | null;
  fuel_tank_capacity_liters?: number | null;
  generator_change?: string | null;

  rms_installed?: string | null;

  solar_power_kw?: number | null;
  solar_nominal_power_wc?: number | null;
  pv_count?: number | string | null;

  battery_capacity_ah?: number | null;
  battery_manufacturer?: string | null;
  battery_status?: string | null;

  latitude?: number | null;
  longitude?: number | null;
};



export type FuelMonthlyRow = {
  key: string;
  month_year: string;
  site_id: string | null;
  site_name: string | null;
  zone: string | null;
  zone_label: string | null;
  ville: string | null;

  site_ref: FuelSiteRef | null;
  enoc_site_ref: FuelEnocSiteContext | null;
  ge_ref: FuelGeContext | null;
  ge_snapshot: Record<string, any> | null;

  source: "EFMS_ENOC" | "EFMS_ONLY" | "ENOC_ONLY" | "NONE";
  
  efms: {
    fuel_order_l: number;
    fuel_deli_l: number;
    fuel_conso_l: number;
    ge_working_hours: number;
    abnormal_ge_working_hours: number;
    monitoring_unavailability_hours: number;
    monitoring_unavailability_percent: number;
    cph_l_per_hour: number;
    anomaly_flags: string[];
    rh_hours: number | null;
    rh_source: string | null;
    avec_dse: boolean | null;
    rh_initial_hours: number | null;
    rh_initial_source: string | null;
    rh_delta_hours: number | null;
    synced_at: string | null;
  };
  enoc: {
    movements_count: number;
    quantity_added_liters: number;
    refueling_liters: number;
    ajout_in_liters: number;
    prelevement_out_liters: number;
    operation_types: string[];
    last_operation_date: string | null;
    last_request_code: string | null;
    target_status: string | null;
    monthly_target_liters: number | null;

    site_context: FuelEnocSiteContext | null;
    ge_context: FuelGeContext | null;
    ge_snapshot: Record<string, any> | null;
  };
  stock: {
    ouv_rms: number | null;
    clot_rms: number | null;
    delta_rms: number | null;
    ouv_reel: number | null;
    clot_reel: number | null;
    reel: number | null;
  };
  gaps: {
    deli_vs_enoc_l: number | null;
    deli_vs_enoc_pct: number | null;
    conso_vs_enoc_l: number | null;
    conso_vs_enoc_pct: number | null;
    status: {
      code: Exclude<FuelStatusCode, "ALL">;
      label: string;
      tone: "green" | "orange" | "red" | "blue" | "violet" | "slate";
    };
  };
};

export type FuelMonthlyResponse = {
  filters: {
    month: string;
    country: string;
    site: string | null;
    zone: string | null;
    status: FuelStatusCode;
  };
  kpis: {
    total_sites: number;
    efms_sites: number;
    enoc_sites: number;
    fuel_order_l: number;
    fuel_deli_l: number;
    fuel_conso_l: number;
    enoc_quantity_added_liters: number;
    movements_count: number;
    ok: number;
    warning: number;
    nok: number;
    efms_only: number;
    enoc_only: number;
    gap_deli_vs_enoc_l: number;
    gap_conso_vs_enoc_l: number;
  };
  data: FuelMonthlyRow[];
  pagination: Pagination;
};

export type FuelEnocMovement = {
  id: number;
  source_system: string;
  source_id: string;
  request_id: string | null;
  request_code: string | null;
  status: string;

  site_id: string | null;
  site_name: string | null;
  zone: string | null;
  ville: string | null;

  operation_type: string | null;
  operation_date: string | null;

  requested_quantity_liters: string | number;
  approved_quantity_liters: string | number;
  quantity_added_liters: string | number;

  level_before: string | number | null;
  level_before_unit: string | null;
  level_after: string | number | null;
  level_after_unit: string | null;

  hour_meter_before: string | number | null;
  hour_meter_after: string | number | null;

  monthly_target_liters: string | number;
  monthly_total_after_liters: string | number;
  target_percent_after: string | number;
  target_status: string | null;
  is_target_exceeded: boolean;
  raw_payload: Record<string, any>;
  ge_snapshot: Record<string, any>;
  ponction: Record<string, any> | null;

  technician_name: string | null;
  technician_phone: string | null;
  team: string | null;
  teammate: string | null;
  rm: string | null;

  created_by: string | null;
  validated_by: string | null;
  done_by: string | null;

  created_at_source: string | null;
  validated_at_source: string | null;
  done_at_source: string | null;
  source_created_at: string | null;
  source_updated_at: string | null;

  import_source: string | null;
  import_key: string | null;

  delivery_note_number: string | null;
  delivery_note_quantity_liters: string | number | null;
  supplier: string | null;
  gauging_method: string | null;
  rms_level_before: string | number | null;
  rms_level_after: string | number | null;

  comment: string | null;
  synced_at: string | null;
  updated_at: string;
};

export type FuelJournalResponse = {
  summary: {
    total_movements: number;
    total_quantity_added_liters: number;
  };
  data: FuelEnocMovement[];
  pagination: Pagination;
};

export type FuelSyncRunsResponse = {
  efms: FuelSyncRun[];
  enoc: FuelEnocSyncRun[];
};

export type FuelSourceStatusResponse = {
  country: string;
  efms: {
    available: boolean;
    latest_month: string | null;
    latest_month_rows: number;
    latest_month_sites: number;
    total_rows: number;
    total_sites: number;
  };
  enoc: {
    available: boolean;
    latest_operation_date: string | null;
    total_movements: number;
    total_sites: number;
  };
  requested_month: {
    month: string;
    has_efms: boolean;
    has_enoc: boolean;
    efms_rows: number;
    enoc_movements: number;
    status: "EFMS_ENOC" | "EFMS_ONLY" | "ENOC_ONLY" | "NO_DATA";
  } | null;
};


export type FuelSiteRef = {
  site_id: string;
  name: string | null;

  zone: string | null;
  zone_label: string | null;

  country: string | null;
  country_label: string | null;

  modernized: boolean | null;
  ordered_typology: string | null;
  installed_typology: string | null;
  billing_typology: string | null;

  contract_number: string | null;
  meter_number: string | null;

  analysis_load: number | null;
  load_band: string | null;

  site_type: string | null;
  ordered_site_type: string | null;
  installed_site_type: string | null;

  configuration: string | null;
  target_mapping_key: string | null;
  transformer_capacity: number | null;

  indoor_billed_outdoor: boolean | null;
  not_yet_solarized: boolean | null;
  solarization_date: string | null;

  energy_desk_comment: string | null;
  load_comment_category: string | null;

  invoice_payment: string | null;
  grid_fee: boolean | null;
  batch_operational: string | null;

  scope_status: string | null;
  meter_status: string | null;
};




export type FuelGeCurveMatch = {
  matched: boolean;
  confidence?: string | null;
  reason?: string | null;
  brand_matched?: string | null;
  prp_kva_matched?: number | null;
  candidate_models?: string[];
  coef_a?: number | null;
  coef_b?: number | null;
  coef_c?: number | null;
  conso_100_l_h?: number | null;
  conso_75_l_h?: number | null;
  conso_50_l_h?: number | null;
};

export type FuelGeAsset = {
  source?: "ENOC_GE_ASSET";
  ge_id?: string | null;
  serial?: string | null;
  brand?: string | null;
  model?: string | null;
  type?: string | null;
  status?: string | null;
  fixed_mobile?: string | boolean | null;
  location_type?: string | null;
  site_id?: string | null;
  site_name?: string | null;
  region?: string | null;
  power_kva?: number | null;
  tank_capacity_liters?: number | null;
  tank_connected?: boolean | string | null;
  tank_shape?: string | null;
  controller?: string | null;
  updated_at?: string | null;
  fuel_curve?: FuelGeCurveMatch | null;
};

export type FuelGeContext = {
  source?: "ENOC_GE_ASSETS";
  assets_count?: number;
  assets?: FuelGeAsset[];
  primary_asset?: FuelGeAsset | null;
};


function cleanParams(params: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== ""
    )
  );
}

export async function getFuelDashboard(params: FuelMonthlyParams) {
  const { data } = await api.get<FuelDashboard>(`${BASE}/efms/dashboard/`, {
    params: cleanParams(params),
  });
  return data;
}

export async function getFuelMonthlyRows(params: FuelMonthlyParams) {
  const { data } = await api.get<FuelEfmsMonthlyResponse>(`${BASE}/efms/monthly/`, {
    params: cleanParams(params),
  });
  return data;
}

export async function getFuelMonthlyTracking(params: {
  month: string;
  country?: string;
  site?: string;
  zone?: string;
  status?: FuelStatusCode;
  page?: number;
  limit?: number;
}) {
  const { data } = await api.get<FuelMonthlyResponse>(`${BASE}/tracking/monthly/`, {
    params: cleanParams(params),
  });
  return data;
}

export async function getFuelEnocJournal(params: {
  month?: string;
  site?: string;
  zone?: string;
  operation_type?: string;
  page?: number;
  limit?: number;
}) {
  const { data } = await api.get<FuelJournalResponse>(`${BASE}/journal/enoc/`, {
    params: cleanParams(params),
  });
  return data;
}

export async function getFuelSourceStatus(params?: {
  country?: string;
  month?: string;
}) {
  const { data } = await api.get<FuelSourceStatusResponse>(`${BASE}/source-status/`, {
    params: cleanParams(params ?? {}),
  });
  return data;
}

export async function getFuelSyncRuns() {
  const { data } = await api.get<FuelSyncRunsResponse>(`${BASE}/sync-runs/`);
  return data;
}