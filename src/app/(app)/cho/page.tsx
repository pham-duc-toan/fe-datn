"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, FileCheck2, Hourglass, ListOrdered, Lock, ShieldAlert, Sparkles, Target, UserCheck, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/page-header";
import { Pager } from "@/components/common/pager";
import { QueryState } from "@/components/common/states";
import { ToneBadge } from "@/components/common/status-badge";
import { api } from "@/lib/api";
import { formatDate, formatVnd } from "@/lib/format";
import { MODALITY_LABEL, toolKindsText, VISIBILITY_LABEL } from "@/lib/labels";
import type { Modality, Paged, ProjectListItem, ToolKind } from "@/lib/types";
import { useUrlPage, useUrlState } from "@/lib/use-url-state";

type Rec = {
  id: string; name: string; modality: Modality; rewardVnd: number; questionCount: number; toolKinds: ToolKind[];
  deadline: string | null; requireEntranceTest: boolean; sensitiveContent: boolean; score: number; reasons: string[];
};

function ProjectCard({ p }: { p: ProjectListItem }) {
  return (
    <Link href={`/cho/${p.id}`} className="block">
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle className="line-clamp-2 text-base">{p.name}</CardTitle>
          <CardDescription>{MODALITY_LABEL[p.modality]} · {VISIBILITY_LABEL[p.visibility]}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="text-2xl font-semibold text-primary">{formatVnd(p.rewardVnd)}</div>
            <p className="text-xs text-muted-foreground">thưởng khi làm hết {p.questionCount} câu và đạt</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <span className="flex items-center gap-1" title="Số câu của bài"><ListOrdered className="size-3.5 text-muted-foreground" /> {p.questionCount} câu</span>
            <span className="flex items-center gap-1" title="Số suất thưởng: số bài đạt nộp sớm nhất được thưởng"><Users className="size-3.5 text-muted-foreground" /> {p.slots} suất</span>
            <span className="flex items-center gap-1" title="Tỉ lệ câu giống đa số tối thiểu"><Target className="size-3.5 text-muted-foreground" /> đạt ≥ {p.passThresholdPercent}%</span>
          </div>
          {p.toolKinds.length > 0 && <p className="text-xs text-muted-foreground">Dạng gán nhãn: {toolKindsText(p.toolKinds)}</p>}
          {p.toolKinds.includes("freeText") && (
            <p className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
              <Hourglass className="size-3.5" /> Có câu trả lời mở — kết quả và tiền công có muộn hơn khi dự án kết thúc
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {p.isOwner && <ToneBadge tone="info">Dự án của bạn</ToneBadge>}
            {p.requireEntranceTest && (
              <ToneBadge tone="warning">
                <FileCheck2 className="size-3" /> Bài test
              </ToneBadge>
            )}
            {p.visibility === "approval" && <ToneBadge tone="muted"><Lock className="size-3" /> Cần duyệt đơn</ToneBadge>}
            {p.sensitiveContent && (
              <ToneBadge tone="danger">
                <ShieldAlert className="size-3" /> Nhạy cảm
              </ToneBadge>
            )}
            {p.requireVerifiedIdentity && (
              <ToneBadge tone="default">
                <UserCheck className="size-3" /> Cần xác minh
              </ToneBadge>
            )}
            {p.deadline && (
              <ToneBadge tone="muted">
                <CalendarClock className="size-3" /> {formatDate(p.deadline)}
              </ToneBadge>
            )}
          </div>
          {p.domains.length > 0 && <p className="text-xs text-muted-foreground">{p.domains.join(" · ")}</p>}
        </CardContent>
      </Card>
    </Link>
  );
}

export default function MarketplacePage() {
  const [page, setPage] = useUrlPage();
  const [modality, setModality] = useUrlState("modality", "all");
  const q = useQuery({
    queryKey: ["market", page, modality],
    queryFn: () => api<Paged<ProjectListItem>>("/projects", { query: { status: "running", page, pageSize: 18, modality: modality === "all" ? undefined : modality } }),
  });
  const rec = useQuery({ queryKey: ["recommended", 6], queryFn: () => api<Rec[]>("/projects/recommended", { query: { limit: 6 } }) });

  return (
    <>
      <PageHeader
        title="Chợ dự án"
        description="Dự án công khai đang chạy và dự án bạn đã tham gia."
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
                <p className="mt-0.5 text-xs text-muted-foreground">{r.reasons.join(", ")}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
      <QueryState query={q} empty={(d) => d.items.length === 0}>
        {(d) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {d.items.map((p) => (
                <ProjectCard key={p.id} p={p} />
              ))}
            </div>
            <Pager page={d.page} pageSize={d.pageSize} total={d.total} onChange={setPage} />
          </>
        )}
      </QueryState>
    </>
  );
}
