// src/services/gridOutages.ts
import { api } from "@/services/api";

export interface GridOutageDaily {
  id: number;
  country: string;
  site_id: string;
  param_name: string;
  param_value: number;
  measure: string;
  date: string;
}

export interface GridOutageAlarm {
  id: number;
  client: string;
  site_id: string;
  alarm_name: string;
  alarm_severity: string;
  status: string;
  date_start: string;
  date_end: string | null;
  ticket_id: string | null;
}

// Import Daily file (file 1)
export async function importGridOutageDaily(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const { data } = await api.post("/grid-outages/daily/import/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  // attendu: { created, updated }
  return data as { created: number; updated: number };
}

// Import Alarms file (file 2)
export async function importGridOutageAlarms(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const { data } = await api.post("/grid-outages/alarms/import/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data as { created: number; updated: number };
}
