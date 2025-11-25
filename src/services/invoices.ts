import { api } from "@/services/api";
import type { Invoice } from "@/types/invoice";

export async function fetchInvoices({ startDate, endDate }: { startDate?: string; endDate?: string }) {
  const params: Record<string, string> = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  const { data } = await api.get("/invoices/between/", { params });
  return data as Invoice[];
}

export async function fetchInvoiceStats({ startDate, endDate }: { startDate?: string; endDate?: string }) {
  const params: Record<string, string> = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  const { data } = await api.get("/invoices/stats/", { params });
  return data as any[];
}

// @/services/invoices.ts
export async function fetchInvoicesKPI() {
  const { data } = await api.get("/invoices/kpi-stats/");
  return data;
}


export async function importInvoicesExcel(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post("/invoices/import/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}


export async function importInvoicesExcelAsync(file: File): Promise<{ task_id: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const { data } = await api.post("/invoices/import_async/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return data; // { task_id: string }
}

export async function fetchImportStatus(taskId: string) {
  const { data } = await api.get(`/invoices/import-status/${taskId}/`);
  return data; // { status, result? }
}
