"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Empty, Loading } from "@/components/common/states";
import { FeedCard } from "@/components/feed/feed-card";
import { api } from "@/lib/api";
import { ghiHienThe, khongQuanTam } from "@/lib/reco-events";
import type { FeedCard as Card, FeedPage, Paged, ProjectListItem } from "@/lib/types";
import { useUrlState } from "@/lib/use-url-state";

const TRANG = 10;
/** Còn chừng này thẻ chưa xem thì tải trang kế. */
const TAI_TRUOC = 3;

type The = { c: Card; requestId: string | null; sessionId: string | null };

/**
 * Chợ dự án (F3, kiến trúc 3.39): hai tab CÙNG một kiểu lướt TikTok, chỉ khác dữ liệu — "Dành cho bạn" (bộ gợi ý xếp
 * theo khả năng kiếm tiền + sở thích) và "Mới nhất" (dự án làm được ngay, mới mở trước).
 */
export default function MarketplacePage() {
  const [tab, setTab] = useUrlState("tab", "goi-y");
  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Chợ dự án</h1>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="goi-y">Dành cho bạn</TabsTrigger>
            <TabsTrigger value="moi">Mới nhất</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {tab === "moi" ? <MoiNhat key="moi" /> : <DanhChoBan key="goi-y" onFallback={() => setTab("moi")} />}
    </>
  );
}

function useFeed(order: "for_you" | "newest") {
  return useInfiniteQuery({
    queryKey: ["feed", order],
    queryFn: ({ pageParam }) =>
      api<FeedPage>("/projects/feed", { query: { pageSize: TRANG, cursor: pageParam ?? undefined, order: order === "newest" ? "newest" : undefined } }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.items.length > 0 ? last.nextCursor : null),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

/** Ghép các trang thành danh sách thẻ, lọc trùng id (lớp chặn cuối) và thẻ vừa ẩn. */
function useThe(pages: FeedPage[] | undefined, an: Set<string>): The[] {
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

/** Tab "Dành cho bạn" — bộ gợi ý. Lỗi → mời chuyển sang Mới nhất. */
function DanhChoBan({ onFallback }: { onFallback: () => void }) {
  const [an, setAn] = useState<Set<string>>(() => new Set());
  const q = useFeed("for_you");
  const the = useThe(q.data?.pages, an);

  if (q.isLoading) return <Loading label="Đang xếp dự án cho bạn…" />;
  if (q.isError && the.length === 0) {
    return (
      <Alert>
        <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
          <span>Bộ gợi ý đang bận. Bạn vẫn xem được danh sách dự án mới nhất.</span>
          <span className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => void q.refetch()}>
              <RefreshCw /> Thử lại
            </Button>
            <Button size="sm" onClick={onFallback}>Xem mới nhất</Button>
          </span>
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <LuotDuAn
      the={the}
      hasNextPage={q.hasNextPage}
      isFetchingNextPage={q.isFetchingNextPage}
      fetchNextPage={() => void q.fetchNextPage()}
      onHide={(id) => setAn((s) => new Set(s).add(id))}
      onRefresh={() => {
        setAn(new Set());
        void q.refetch();
      }}
      cuoi={
        <Button variant="ghost" size="sm" onClick={onFallback}>
          Xem tất cả dự án mới nhất
        </Button>
      }
    />
  );
}

/**
 * Tab "Mới nhất" — cùng kiểu thẻ, dữ liệu từ bộ gợi ý ở chế độ newest (có mẫu + câu hỏi). Bộ gợi ý lỗi → dự phòng bằng
 * danh sách chợ của project-svc (thẻ không có mẫu / câu hỏi) để labeler vẫn tìm được việc.
 */
function MoiNhat() {
  const [an, setAn] = useState<Set<string>>(() => new Set());
  const q = useFeed("newest");
  const loi = q.isError && (q.data?.pages.length ?? 0) === 0;
  const duPhong = useInfiniteQuery({
    queryKey: ["market-feed"],
    queryFn: ({ pageParam }) => api<Paged<ProjectListItem>>("/projects/market", { query: { page: pageParam, pageSize: TRANG } }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : null),
    enabled: loi,
  });
  const theGoc = useThe(q.data?.pages, an);
  const theDuPhong = useMemo<The[]>(() => {
    const ds: The[] = [];
    const daCo = new Set<string>();
    for (const pg of duPhong.data?.pages ?? []) {
      for (const x of pg.items) {
        if (daCo.has(x.id) || an.has(x.id)) continue;
        daCo.add(x.id);
        ds.push({ c: tuMarket(x, ds.length), requestId: null, sessionId: null });
      }
    }
    return ds;
  }, [duPhong.data, an]);

  const nguon = loi ? duPhong : q;
  const the = loi ? theDuPhong : theGoc;
  if (q.isLoading || (loi && duPhong.isLoading)) return <Loading label="Đang tải dự án mới nhất…" />;
  if (loi && duPhong.isError) {
    return (
      <Alert>
        <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
          <span>Chưa tải được danh sách dự án. Thử lại sau ít phút.</span>
          <Button size="sm" variant="outline" onClick={() => void q.refetch()}>
            <RefreshCw /> Thử lại
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <LuotDuAn
      the={the}
      hasNextPage={nguon.hasNextPage}
      isFetchingNextPage={nguon.isFetchingNextPage}
      fetchNextPage={() => void nguon.fetchNextPage()}
      onHide={loi ? undefined : (id) => setAn((s) => new Set(s).add(id))}
      onRefresh={() => {
        setAn(new Set());
        void nguon.refetch();
      }}
    />
  );
}

/** Thẻ dự phòng từ danh sách chợ (project-svc) — không có mẫu xem trước / câu hỏi / ước tính thời gian. */
function tuMarket(x: ProjectListItem, viTri: number): Card {
  return {
    id: x.id,
    name: x.name,
    description: "",
    modality: x.modality,
    rewardVnd: x.rewardVnd,
    slots: x.slots,
    questionCount: x.questionCount,
    estimatedMinutes: Math.max(1, Math.round((x.questionCount * 20) / 60)),
    deadline: x.deadline,
    toolKinds: x.toolKinds,
    domains: x.domains,
    languages: x.languages,
    requireEntranceTest: x.requireEntranceTest,
    sensitiveContent: x.sensitiveContent,
    consentRequired: x.consentRequired,
    requireVerifiedIdentity: x.requireVerifiedIdentity,
    isPrivate: x.visibility === "private",
    isNew: false,
    explore: false,
    position: viTri,
    reasons: [],
    tools: [],
    previews: [],
  };
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
function LuotDuAn({
  the,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  onHide,
  onRefresh,
  cuoi,
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
              onNotInterested={onHide ? () => void boQua(x) : undefined}
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
        <span className="text-xs tabular-nums text-muted-foreground">
          {Math.min(dangXem + 1, the.length)}/{the.length}
          {hasNextPage ? "+" : ""}
        </span>
        <Button variant="outline" size="icon" className="rounded-full" onClick={() => toi(dangXem + 1)} disabled={dangXem >= tong - 1} aria-label="Dự án kế (↓)" title="Dự án kế (↓)">
          <ChevronDown />
        </Button>
      </div>
    </div>
  );
}
