"use client";

import Link from "next/link";
import { CalendarClock, FileCheck2, Hourglass, ListOrdered, Lock, ShieldAlert, Target, UserCheck, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToneBadge } from "@/components/common/status-badge";
import { useTags } from "@/hooks/use-tags";
import { formatDate, formatVnd } from "@/lib/format";
import { MODALITY_LABEL, toolKindsText, VISIBILITY_LABEL } from "@/lib/labels";
import type { ProjectListItem } from "@/lib/types";

/** Thẻ dự án ở chợ. `linked = false`: bản xem trước cho người tạo dự án (không bấm được). */
export function MarketCard({ p, linked = true }: { p: ProjectListItem; linked?: boolean }) {
  const { name } = useTags();
  return (
    <Wrap href={linked ? `/cho/${p.id}` : null}>
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
          {p.domains.length + p.languages.length > 0 && (
            <p className="text-xs text-muted-foreground">{p.domains.map((c) => name("domain", c)).concat(p.languages.map((c) => name("language", c))).join(" · ")}</p>
          )}
        </CardContent>
      </Card>
    </Wrap>
  );
}

function Wrap({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (!href) return <div className="block">{children}</div>;
  return (
    <Link href={href} className="block">
      {children}
    </Link>
  );
}
