"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Trạng thái giữ trên query string (?page=2&status=open): tải lại trang, gửi link, bấm Back đều giữ đúng trang.
 * Giá trị bằng mặc định thì bỏ khỏi URL cho gọn.
 *
 * Nhiều setter gọi liền nhau (vd đổi bộ lọc rồi `setPage(1)`) được GỘP thành một lần `router.replace` —
 * gọi riêng từng lần thì lần sau đọc URL cũ và ghi đè thay đổi của lần trước.
 */
type Router = ReturnType<typeof useRouter>;

let choGhi: Record<string, string | null> | null = null;

function ghiUrl(router: Router, pathname: string, thayDoi: Record<string, string | null>) {
  if (choGhi === null) {
    choGhi = {};
    queueMicrotask(() => {
      const p = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(choGhi ?? {})) {
        if (v === null) p.delete(k);
        else p.set(k, v);
      }
      choGhi = null;
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }
  Object.assign(choGhi, thayDoi);
}

export function useUrlState(key: string, macDinh: string): [string, (v: string) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const value = params.get(key) ?? macDinh;
  const set = useCallback(
    (v: string) => ghiUrl(router, pathname, { [key]: v === macDinh ? null : v }),
    [router, pathname, key, macDinh],
  );
  return [value, set];
}

/** Số trang (≥ 1). Giá trị hỏng trên URL (?page=abc, ?page=-3) coi như trang 1. */
export function useUrlPage(key = "page"): [number, (p: number) => void] {
  const [raw, setRaw] = useUrlState(key, "1");
  const n = Number.parseInt(raw, 10);
  const page = Number.isFinite(n) && n >= 1 ? n : 1;
  const set = useCallback((p: number) => setRaw(String(Math.max(1, Math.floor(p)))), [setRaw]);
  return [page, set];
}
