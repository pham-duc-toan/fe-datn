"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/common/states";
import { FeedCard } from "@/components/feed/feed-card";
import { api } from "@/lib/api";
import { ghiHienThe, guiNgay, khongQuanTam } from "@/lib/reco-events";
import type { FeedCard as Card, FeedPage } from "@/lib/types";

export const TRANG = 10;
/** Còn chừng này thẻ chưa xem thì tải trang kế. */
const TAI_TRUOC = 3;

export type The = { c: Card; requestId: string | null; sessionId: string | null };

/**
 * Một nguồn thẻ của bộ gợi ý: for_you (xếp theo gợi ý), newest (mới mở trước), liked (dự án đã thích). Trang ĐẦU (lướt mới)
 * gửi hết hàng đợi hành vi trước — bộ gợi ý biết dự án vừa lướt qua để đẩy xuống (3.40).
 */
export function useFeed(order: "for_you" | "newest" | "liked") {
  return useInfiniteQuery({
    queryKey: ["feed", order],
    queryFn: async ({ pageParam }) => {
      if (!pageParam) await guiNgay();
      return api<FeedPage>("/projects/feed", { query: { pageSize: TRANG, cursor: pageParam ?? undefined, order: order === "for_you" ? undefined : order } });
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.items.length > 0 ? last.nextCursor : null),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

/** Ghép các trang thành danh sách thẻ, lọc trùng id (lớp chặn cuối) và thẻ vừa ẩn. */
export function useThe(pages: FeedPage[] | undefined, an: Set<string>): The[] {
  return useMemo(() => {
    const ds: The[] = [];
    const daCo = new Set<string>();
    for (const pg of pages ?? []) {
      for (const c of pg.items) {
        if (daCo.has(c.id) || an.has(c.id)) continue;
        daCo.add(c.id);
        ds.push({ c, requestId: pg.requestId, sessionId: pg.sessionId });
      }
    }
    return ds;
  }, [pages, an]);
}


/** Chiều cao còn lại của màn tính từ đỉnh phần tử tới đáy (trừ lề dưới của khung trang). */
function useChieuCaoConLai<T extends HTMLElement>(ref: React.RefObject<T | null>, leDuoi: number, daHienKhung: boolean) {
  const [cao, setCao] = useState<number | null>(null);
  useLayoutEffect(() => {
    const tinh = () => {
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const h = (window.visualViewport?.height ?? window.innerHeight) - top - leDuoi;
      setCao(Math.max(460, Math.round(h)));
    };
    tinh();
    window.addEventListener("resize", tinh);
    window.visualViewport?.addEventListener("resize", tinh);
    return () => {
      window.removeEventListener("resize", tinh);
      window.visualViewport?.removeEventListener("resize", tinh);
    };
  }, [ref, leDuoi, daHienKhung]);
  return cao;
}

/**
 * Lướt kiểu TikTok — dùng chung cho mọi tab: mỗi dự án một màn, vuốt / cuộn / phím ↑ ↓ (J K) sang dự án kế. Thẻ ra giữa
 * màn ≥ 60 % thì ghi lượt hiện (một lần mỗi dự án; thẻ dự phòng không có phiên thì không ghi). Còn {TAI_TRUOC} thẻ thì
 * tải trang kế.
 */
export function LuotDuAn({
  the,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  onHide,
  onRefresh,
  cuoi,
  anKhiBoThich,
  trong,
}: {
  the: The[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  /** Ẩn thẻ ở trang này ("Không quan tâm"); không truyền = không có nút. */
  onHide?: (id: string) => void;
  onRefresh: () => void;
  /** Nút thêm ở màn cuối. */
  cuoi?: ReactNode;
  /** Trang "Dự án đã thích": bỏ thích thì thẻ biến khỏi danh sách. */
  anKhiBoThich?: boolean;
  /** Nội dung khi không có thẻ nào (mặc định: "Chưa có dự án phù hợp"). */
  trong?: ReactNode;
}) {
  const [dangXem, setDangXem] = useState(0);
  const khung = useRef<HTMLDivElement>(null);
  const daHien = useRef<Set<string>>(new Set());
  const cao = useChieuCaoConLai(khung, 24, the.length > 0);

  // Thẻ nào đang ở giữa màn → đánh dấu đang xem + ghi lượt hiện.
  useEffect(() => {
    const root = khung.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting || e.intersectionRatio < 0.6) continue;
          const i = Number((e.target as HTMLElement).dataset.i);
          setDangXem(i);
          const x = the[i];
          if (x && x.requestId && x.sessionId && !daHien.current.has(x.c.id)) {
            daHien.current.add(x.c.id);
            ghiHienThe(x.c.id, x.c.position, x.requestId, x.sessionId);
          }
        }
      },
      { root, threshold: [0.6] },
    );
    root.querySelectorAll<HTMLElement>("[data-i]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [the, cao]);

  useEffect(() => {
    if (the.length > 0 && dangXem >= the.length - TAI_TRUOC && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [dangXem, the.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const toi = useCallback((i: number) => {
    const el = khung.current;
    if (!el) return;
    const tong = el.querySelectorAll("[data-slide]").length;
    const j = Math.max(0, Math.min(i, tong - 1));
    el.scrollTo({ top: j * el.clientHeight, behavior: "smooth" });
  }, []);

  // Phím ↑ ↓ / J K / PageUp PageDown — bỏ qua khi đang gõ hoặc đang mở hộp thoại.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (document.querySelector("[role=dialog]")) return;
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === "j") {
        e.preventDefault();
        toi(dangXem + 1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp" || e.key === "k") {
        e.preventDefault();
        toi(dangXem - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dangXem, toi]);

  const boQua = async (x: The) => {
    // Thẻ sau trượt lên đúng chỗ — giống "lướt qua".
    onHide?.(x.c.id);
    if (!x.requestId || !x.sessionId) return;
    try {
      await khongQuanTam(x.c.id, x.c.position, x.requestId, x.sessionId);
      toast.success("Đã ẩn dự án này. Gợi ý sau sẽ ít loại này hơn.");
    } catch {
      // Ẩn ở trang này vẫn giữ; bộ gợi ý không nhận được thì lần sau có thể hiện lại.
    }
  };

  const lamMoi = () => {
    daHien.current = new Set();
    setDangXem(0);
    khung.current?.scrollTo({ top: 0 });
    onRefresh();
  };

  if (the.length === 0 && !hasNextPage) {
    if (trong) return <>{trong}</>;
    return (
      <Empty title="Chưa có dự án phù hợp với bạn">
        Dự án mới mở sẽ hiện ở đây. Lên cấp, tăng uy tín hoặc{" "}
        <Link href="/tai-khoan/xac-minh" className="text-primary underline">xác minh danh tính</Link> để làm được nhiều dự án hơn.
      </Empty>
    );
  }

  const tong = the.length + 1;
  return (
    <div className="relative mx-auto flex max-w-5xl gap-3">
      <div
        ref={khung}
        style={{ height: cao ?? undefined }}
        className="no-scrollbar h-[calc(100dvh-9rem)] min-w-0 flex-1 snap-y snap-mandatory overflow-y-auto overscroll-contain"
      >
        {the.map((x, i) => (
          <div key={x.c.id} data-slide data-i={i} className="h-full snap-start snap-always pb-3">
            <FeedCard
              p={x.c}
              requestId={x.requestId}
              sessionId={x.sessionId}
              active={i === dangXem}
              onNotInterested={onHide && !anKhiBoThich ? () => void boQua(x) : undefined}
              onLikedChange={anKhiBoThich ? (v) => (v ? undefined : onHide?.(x.c.id)) : undefined}
            />
          </div>
        ))}
        <div data-slide className="flex h-full snap-start snap-always items-center justify-center pb-3 text-sm text-muted-foreground">
          {isFetchingNextPage || hasNextPage ? (
            <Loader2 className="size-6 animate-spin" />
          ) : (
            <span className="flex flex-col items-center gap-3 text-center">
              Bạn đã xem hết dự án lúc này.
              <Button variant="outline" onClick={lamMoi}>
                <RefreshCw /> Làm mới
              </Button>
              {cuoi}
            </span>
          )}
        </div>
      </div>

      {/* Nút lên / xuống cho chuột (màn rộng). */}
      <div className="hidden flex-col items-center justify-center gap-2 lg:flex">
        <Button variant="outline" size="icon" className="rounded-full" onClick={() => toi(dangXem - 1)} disabled={dangXem === 0} aria-label="Dự án trước (↑)" title="Dự án trước (↑)">
          <ChevronUp />
        </Button>
        <Button variant="outline" size="icon" className="rounded-full" onClick={() => toi(dangXem + 1)} disabled={dangXem >= tong - 1} aria-label="Dự án kế (↓)" title="Dự án kế (↓)">
          <ChevronDown />
        </Button>
      </div>
    </div>
  );
}
