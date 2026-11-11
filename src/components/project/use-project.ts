"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Project, Readiness } from "@/lib/types";

/** Readiness đang chờ file xử lý xong (nạp mẫu hoặc chuẩn bị video) — các chỗ hiển thị readiness hỏi lại định kỳ tới khi xong. */
export function isProcessingData(r: Readiness | undefined): boolean {
  return Boolean(r) && (r!.missing.includes("du_lieu_dang_xu_ly") || r!.missing.includes("video_dang_chuan_bi") || r!.videoPreparingCount > 0);
}

/** refetchInterval cho query readiness: 2,5 giây khi còn file đang xử lý, ngoài ra không hỏi lại. */
export function readinessRefetch(q: { state: { data: Readiness | undefined } }): number | false {
  return isProcessingData(q.state.data) ? 2500 : false;
}

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
