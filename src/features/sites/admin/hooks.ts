import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createGridTargetRule,
  createSite,
  deleteGridTargetRule,
  deleteSite,
  fetchGridTargetRules,
  fetchSites,
  importGridTargetRulesExcel,
  importSitesExcel,
  patchGridTargetRule,
  updateGridTargetRule,
  updateSite,
} from "./api";

export function useSites() {
  return useQuery({
    queryKey: ["sites"],
    queryFn: () => fetchSites(),
  });
}

export function useCreateSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSite,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sites"] }),
  });
}

export function useUpdateSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => updateSite(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sites"] }),
  });
}

export function useDeleteSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteSite,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sites"] }),
  });
}

export function useImportSites() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: importSitesExcel,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sites"] }),
  });
}

export function useGridTargetRules() {
  return useQuery({
    queryKey: ["grid-target-rules"],
    queryFn: () => fetchGridTargetRules(),
  });
}

export function useCreateGridTargetRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createGridTargetRule,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["grid-target-rules"] }),
  });
}

export function useUpdateGridTargetRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) =>
      updateGridTargetRule(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["grid-target-rules"] }),
  });
}

export function usePatchGridTargetRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) =>
      patchGridTargetRule(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["grid-target-rules"] }),
  });
}

export function useDeleteGridTargetRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteGridTargetRule,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["grid-target-rules"] }),
  });
}

export function useImportGridTargetRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: importGridTargetRulesExcel,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["grid-target-rules"] }),
  });
}