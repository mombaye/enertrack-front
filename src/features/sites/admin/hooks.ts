import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSite,
  deleteSite,
  fetchSites,
  importSitesExcel,
  patchSite,
  updateSite,
} from "./api";

export function useSites(params?: Record<string, any>) {
  return useQuery({
    queryKey: ["admin-sites", params],
    queryFn: () => fetchSites(params),
  });
}

export function useCreateSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSite,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-sites"] }),
  });
}

export function useUpdateSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => updateSite(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-sites"] }),
  });
}

export function usePatchSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => patchSite(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-sites"] }),
  });
}

export function useDeleteSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteSite,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-sites"] }),
  });
}

export function useImportSites() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: importSitesExcel,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-sites"] }),
  });
}