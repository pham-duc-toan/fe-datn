"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/page-header";
import { Pager } from "@/components/common/pager";
import { Empty, QueryState } from "@/components/common/states";
import { MarketCard } from "@/components/project/market-card";
import { useReasonText } from "@/hooks/use-tags";
import { api } from "@/lib/api";
import { formatVnd } from "@/lib/format";
import { MODALITY_LABEL, toolKindsText } from "@/lib/labels";
import type { Modality, Paged, ProjectListItem, ToolKind } from "@/lib/types";
import { useUrlPage, useUrlState } from "@/lib/use-url-state";

type Rec = {
  id: string; name: string; modality: Modality; rewardVnd: number; questionCount: number; toolKinds: ToolKind[];
  deadline: string | null; requireEntranceTest: boolean; sensitiveContent: boolean; score: number; reasons: string[];
};

export default function MarketplacePage() {
  const [page, setPage] = useUrlPage();
  const [modality, setModality] = useUrlState("modality", "all");
  const q = useQuery({
    queryKey: ["market", page, modality],
    // Chỉ dự án bạn làm được ngay: còn nhận bài, còn chỗ, chưa nộp, đủ cấp độ / uy tín / xác minh.
    queryFn: () => api<Paged<ProjectListItem>>("/projects/market", { query: { page, pageSize: 18, modality: modality === "all" ? undefined : modality } }),
  });
  const rec = useQuery({ queryKey: ["recommended", 6], queryFn: () => api<Rec[]>("/projects/recommended", { query: { limit: 6 } }) });
  const reasonText = useReasonText();

  return (
    <>
      <PageHeader
        title="Chợ dự án"
        description="Những dự án bạn đủ điều kiện và làm được ngay. Dự án đã nộp bài xem ở Bài làm của tôi."
        actions={
          <Select value={modality} onValueChange={(v) => { setModality(v); setPage(1); }}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Mọi loại dữ liệu</SelectItem>
              {Object.entries(MODALITY_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      {(rec.data ?? []).length > 0 && (
        <div className="mb-8 space-y-3">
          <h2 className="flex items-center gap-2 font-semibold">
            <Sparkles className="size-4 text-primary" /> Hợp với kỹ năng của bạn
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rec.data!.map((r) => (
              <Link key={r.id} href={`/cho/${r.id}`} className="rounded-lg border bg-card p-3 hover:border-primary">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{r.name}</span>
                  <span className="text-sm text-primary">{formatVnd(r.rewardVnd)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {MODALITY_LABEL[r.modality]} · {r.questionCount} câu · {toolKindsText(r.toolKinds)}
                </p>
                {r.reasons.length > 0 && <p className="mt-0.5 text-xs text-muted-foreground">Hợp vì: {reasonText(r.reasons)}</p>}
              </Link>
            ))}
          </div>
        </div>
      )}
      <QueryState query={q}>
        {(d) =>
          d.items.length === 0 ? (
            <Empty title="Chưa có dự án phù hợp với bạn">
              Dự án mới mở sẽ hiện ở đây. Lên cấp, tăng uy tín hoặc{" "}
              <Link href="/tai-khoan/xac-minh" className="text-primary underline">
                xác minh danh tính
              </Link>{" "}
              để làm được nhiều dự án hơn.
            </Empty>
          ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {d.items.map((p) => (
                <MarketCard key={p.id} p={p} />
              ))}
            </div>
            <Pager page={d.page} pageSize={d.pageSize} total={d.total} onChange={setPage} />
          </>
          )
        }
      </QueryState>
    </>
  );
}
