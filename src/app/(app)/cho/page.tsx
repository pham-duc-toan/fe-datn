"use client";

import { useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loading } from "@/components/common/states";
import { LuotDuAn, TRANG, useFeed, useThe, type The } from "@/components/feed/luot-du-an";
import { api } from "@/lib/api";
import type { FeedCard as Card, Paged, ProjectListItem } from "@/lib/types";
import { useUrlState } from "@/lib/use-url-state";


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
    liked: false,
    tools: [],
    previews: [],
  };
}
