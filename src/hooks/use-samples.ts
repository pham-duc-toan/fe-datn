"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Paged, Sample } from "@/lib/types";

/**
 * Tên file gốc + link xem file của các mẫu đang hiện (GET /projects/{id}/samples?ids=, tối đa 100).
 * Chỉ chủ dự án / người quản lý gọi được; lỗi (vd reviewer không có quyền) thì trả map rỗng để giao diện
 * tự lùi về mã mẫu. Link xem file sống 5 phút: refetch khi cửa sổ được focus lại.
 */
export function useSamples(projectId: string, ids: string[]) {
  const uniq = [...new Set(ids)].sort().slice(0, 100);
  const q = useQuery({
    queryKey: ["samples-by-id", projectId, uniq.join(",")],
    enabled: uniq.length > 0,
    staleTime: 4 * 60 * 1000,
    queryFn: async () => {
      try {
        const r = await api<Paged<Sample>>(`/projects/${projectId}/samples`, { query: { ids: uniq.join(",") } });
        return r.items;
      } catch {
        return [] as Sample[];
      }
    },
  });
  const map = new Map<string, Sample>();
  for (const s of q.data ?? []) map.set(s.id, s);
  return { samples: map, refetch: q.refetch, loading: q.isLoading };
}
