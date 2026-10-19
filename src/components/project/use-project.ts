"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Project } from "@/lib/types";

export function useProject(id: string) {
  return useQuery({ queryKey: ["project", id], queryFn: () => api<Project>(`/projects/${id}`), enabled: Boolean(id) });
}

export function useSetProject(id: string) {
  const qc = useQueryClient();
  return (p: Project) => {
    qc.setQueryData(["project", id], p);
    void qc.invalidateQueries({ queryKey: ["readiness", id] });
  };
}
