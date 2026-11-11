"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertOctagon, AlertTriangle, CheckCircle2, ClipboardCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/common/page-header";
import { Field, StatCard } from "@/components/common/misc";
import { ToneBadge } from "@/components/common/status-badge";
import { api } from "@/lib/api";
import { daysAgo, formatDateTime, formatNumber, formatVnd, isoDay } from "@/lib/format";
import { APPROVAL_KIND } from "@/lib/labels";

type Overview = {
  auditSince: string | null;
  newUsers: number;
  businessesVerified: number;
  projectsPublished: number;
  attemptsSubmitted: number;
  projectsGraded: number;
  projectsCompleted: number;
  depositsVnd: number;
  labelerPayoutsVnd: number;
  withdrawalsVnd: number;
  appealsOpened: number;
  accountsBlocked: number;
  fraudCasesConfirmed: number;
  daily: { date: string; newUsers: number; attemptsSubmitted: number; projectsGraded: number; depositsVnd: number }[];
};

type SystemHealth = { status: "ok" | "co_loi" | "khong_ro"; failedCount: number; affectedAreas: number; checkedAt: string | null; techTeamNotified: boolean };

/**
 * Tình trạng hệ thống: chỉ đếm lỗi KỸ THUẬT (hệ thống không tự xử lý được) — admin không cần làm gì ngoài báo đội
 * kỹ thuật. Việc nghiệp vụ cần admin xử lý tay nằm ở Hàng đợi duyệt.
 */
function HealthCard({ h }: { h: SystemHealth | undefined }) {
  if (!h) return null;
  const luc = h.checkedAt ? `Kiểm tra lúc ${formatDateTime(h.checkedAt)}.` : "";
  return (
    <Card className={h.status === "co_loi" ? "border-amber-300 dark:border-amber-700" : undefined}>
      <CardHeader>
        <CardTitle>Tình trạng hệ thống</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 text-sm">
        {h.status === "ok" && (
          <p className="flex items-center gap-1.5 text-emerald-600">
            <CheckCircle2 className="size-4" /> Mọi thứ hoạt động bình thường
          </p>
        )}
        {h.status === "co_loi" && (
          <>
            <p className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-4" /> Có {formatNumber(h.failedCount)} việc hệ thống không tự xử lý được
            </p>
            <p className="text-muted-foreground">
              {h.techTeamNotified ? "Đội kỹ thuật đã được báo qua email." : "Hãy báo đội kỹ thuật để kiểm tra."} Bạn không cần thao tác gì ở đây; việc cần bạn xử lý nằm ở Hàng đợi duyệt.
            </p>
          </>
        )}
        {h.status === "khong_ro" && <p className="text-muted-foreground">Chưa kiểm tra được tình trạng hệ thống — thử lại sau ít phút.</p>}
        {luc && <p className="text-xs text-muted-foreground">{luc}</p>}
      </CardContent>
    </Card>
  );
}

export default function AdminHome() {
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(isoDay(new Date()));
  const ov = useQuery({ queryKey: ["admin-overview", from, to], queryFn: () => api<Overview>("/admin/stats/overview", { query: { from, to } }) });
  const rec = useQuery({ queryKey: ["reconciliation"], queryFn: () => api<{ healthy: boolean; entryCount: number; unbalancedEntries: string[]; balanceMismatches: string[]; negativeAccounts: string[]; brokenChain: number[] }>("/ledger/admin/reconciliation") });
  const sum = useQuery({ queryKey: ["approvals-summary"], queryFn: () => api<{ totalPending: number; kinds: { kind: string; pending: number; oldestWaitingHours: number | null }[] }>("/admin/approvals/summary"), refetchInterval: 30000 });
  const health = useQuery({ queryKey: ["system-health"], queryFn: () => api<SystemHealth>("/admin/system-health"), refetchInterval: 60000 });
  const o = ov.data;

  return (
    <>
      <PageHeader
        title="Quản trị hệ thống"
        description={o?.auditSince ? `Số liệu từ ${formatDateTime(o.auditSince)}.` : undefined}
        actions={
          <div className="flex items-end gap-2">
            <Field label="Từ">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="Đến">
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
        }
      />
      {rec.data && !rec.data.healthy && (
        <Alert variant="destructive" className="mb-6">
          <AlertOctagon />
          <AlertTitle>Sổ cái không cân — sự cố nghiêm trọng về tiền</AlertTitle>
          <AlertDescription>
            {rec.data.unbalancedEntries.length} bút toán lệch · {rec.data.balanceMismatches.length} số dư lệch · {rec.data.negativeAccounts.length} tài khoản âm · {rec.data.brokenChain.length} mắt xích hỏng
          </AlertDescription>
        </Alert>
      )}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Người dùng mới" value={formatNumber(o?.newUsers)} />
        <StatCard label="Dự án publish" value={formatNumber(o?.projectsPublished)} hint={`${formatNumber(o?.businessesVerified)} doanh nghiệp được xác minh`} />
        <StatCard label="Bài làm đã nộp" value={formatNumber(o?.attemptsSubmitted)} hint={`${formatNumber(o?.projectsGraded)} dự án chấm xong · ${formatNumber(o?.projectsCompleted)} hoàn thành`} />
        <StatCard
          label="Đối soát sổ cái"
          value={rec.data ? rec.data.healthy ? <span className="flex items-center gap-1.5 text-emerald-600"><CheckCircle2 className="size-5" /> Cân</span> : <span className="text-destructive">Lệch</span> : "—"}
          hint={rec.data ? `${formatNumber(rec.data.entryCount)} bút toán` : undefined}
        />
        <StatCard label="Tiền nạp" value={formatVnd(o?.depositsVnd)} />
        <StatCard label="Trả người làm" value={formatVnd(o?.labelerPayoutsVnd)} hint="Thưởng bài đạt + doanh thu link + hoa hồng" />
        <StatCard label="Khiếu nại bài làm" value={formatNumber(o?.appealsOpened)} />
        <StatCard label="Rút tiền" value={formatVnd(o?.withdrawalsVnd)} hint={`${o?.accountsBlocked ?? 0} khoá · ${o?.fraudCasesConfirmed ?? 0} gian lận`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Hoạt động theo ngày</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={(o?.daily ?? []).map((d) => ({ ...d, day: d.date.slice(5) }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="attemptsSubmitted" name="Bài nộp" stroke="var(--chart-1)" dot={false} />
                <Line type="monotone" dataKey="projectsGraded" name="Dự án chấm xong" stroke="var(--chart-2)" dot={false} />
                <Line type="monotone" dataKey="newUsers" name="Người dùng mới" stroke="var(--chart-4)" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <div className="space-y-6">
          <HealthCard h={health.data} />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Chờ duyệt <ToneBadge tone={sum.data?.totalPending ? "warning" : "success"}>{sum.data?.totalPending ?? 0}</ToneBadge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              {(sum.data?.kinds ?? []).map((k) => (
                <Link key={k.kind} href={`/admin/duyet?kind=${k.kind}`} className="flex items-center justify-between rounded px-1 py-0.5 hover:bg-muted">
                  <span>{APPROVAL_KIND[k.kind] ?? k.kind}</span>
                  <span className="text-muted-foreground">
                    {k.pending}
                    {k.oldestWaitingHours ? ` · lâu nhất ${Math.round(k.oldestWaitingHours)} giờ` : ""}
                  </span>
                </Link>
              ))}
              <Link href="/admin/duyet" className="mt-2 inline-flex items-center gap-1 text-primary hover:underline">
                <ClipboardCheck className="size-4" /> Mở hàng đợi
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
