"use client";

import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Tag, TagKind } from "@/lib/types";

export const TAG_KIND_LABEL: Record<TagKind, string> = { domain: "Lĩnh vực", language: "Ngôn ngữ" };

/**
 * Danh mục thẻ lĩnh vực / ngôn ngữ (GET /tags, cả thẻ ẩn / đã gộp để hiện tên thẻ gắn từ trước).
 * `name(kind, code)` → tên hiển thị (đi theo thẻ đích nếu đã gộp; không có trong danh mục thì trả lại mã).
 * `options(kind)` → thẻ còn chọn được, theo tên.
 */
export function useTags() {
  const q = useQuery({ queryKey: ["tags"], queryFn: () => api<Tag[]>("/tags"), staleTime: 5 * 60 * 1000 });
  const map = useMemo(() => new Map((q.data ?? []).map((t) => [`${t.kind}:${t.code}`, t])), [q.data]);

  const resolve = useCallback(
    (kind: TagKind, code: string): Tag | undefined => {
      let t = map.get(`${kind}:${code}`);
      for (let i = 0; t?.mergedInto && i < 5; i++) t = map.get(`${kind}:${t.mergedInto}`) ?? t;
      return t;
    },
    [map],
  );
  const name = useCallback((kind: TagKind, code: string) => resolve(kind, code)?.name ?? code, [resolve]);
  const options = useCallback(
    (kind: TagKind) => (q.data ?? []).filter((t) => t.kind === kind && !t.hidden && !t.mergedInto).sort((a, b) => a.name.localeCompare(b.name, "vi")),
    [q.data],
  );

  return { query: q, tags: q.data ?? [], name, resolve, options };
}

/** Lý do gợi ý dự án ("modality", "domain:y-te", "language:vi") → câu đọc được. */
export function useReasonText() {
  const { name } = useTags();
  return useCallback(
    (reasons: string[]) =>
      reasons
        .map((r) => {
          if (r === "modality") return "đúng loại dữ liệu bạn quen làm";
          const [kind, code] = r.split(":");
          if ((kind === "domain" || kind === "language") && code) return name(kind, code);
          return null;
        })
        .filter(Boolean)
        .join(" · "),
    [name],
  );
}
