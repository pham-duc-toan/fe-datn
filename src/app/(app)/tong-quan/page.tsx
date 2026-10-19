"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Briefcase, Building2, Coins, PlusCircle, Star, Store, Timer, Trophy, Wallet, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/misc";
import { StatusBadge } from "@/components/common/status-badge";
import { Loading } from "@/components/common/states";
import { useAuth } from "@/components/providers/auth-provider";
import { api } from "@/lib/api";
import { daysAgo, formatDateTime, formatVnd } from "@/lib/format";
import { kybStatus, MODALITY_LABEL, projectStatus } from "@/lib/labels";
import type { AttemptSummary, Balance, KybProfile, LevelInfo, Paged, ProjectListItem } from "@/lib/types";
import { ProjectName } from "@/components/labeling/label-view";

function BusinessHome() {
  const bal = useQuery({ queryKey: ["balance"], queryFn: () => api<Balance>("/ledger/me/balance") });
  const kyb = useQuery({ queryKey: ["kyb"], queryFn: () => api<KybProfile>("/kyb/me") });
  const projects = useQuery({ queryKey: ["projects", "mine", 1], queryFn: () => api<Paged<ProjectListItem>>("/projects", { query: { mine: true, page: 1, pageSize: 6 } }) });
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Số dư khả dụng" value={formatVnd(bal.data?.businessAvailableVnd)} icon={<Wallet className="size-4" />} />
        <StatCard label="Đang ký quỹ" value={formatVnd(bal.data?.escrowVnd)} icon={<Coins className="size-4" />} />
        <StatCard label="Dự án" value={projects.data?.total ?? "—"} icon={<Briefcase className="size-4" />} />
        <StatCard label="Xác minh doanh nghiệp" value={kyb.data ? <StatusBadge entry={kybStatus(kyb.data.status)} /> : "—"} icon={<Building2 className="size-4" />} />
      </div>
      {kyb.data && kyb.data.status !== "verified" && (
        <Card className="border-amber-200 bg-amber-50/60 dark:bg-amber-950/30">
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">Doanh nghiệp chưa được xác minh</p>
              <p className="text-sm text-muted-foreground">Bạn vẫn tạo dự án, nạp dữ liệu, nạp tiền được — chỉ publish cần KYB đã duyệt.</p>
            </div>
            <Button asChild>
              <Link href="/doanh-nghiep/kyb">Khai hồ sơ</Link>
            </Button>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Dự án gần đây</CardTitle>
            <CardDescription>Dự án của bạn và dự án bạn là thành viên.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/du-an">Tất cả</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/du-an/moi">
                <PlusCircle /> Tạo dự án
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {projects.isPending ? (
            <Loading />
          ) : (projects.data?.items ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có dự án nào.</p>
          ) : (
            <div className="divide-y">
              {projects.data!.items.map((p) => (
                <Link key={p.id} href={p.isOwner ? `/du-an/${p.id}` : `/cho/${p.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-muted/50">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {MODALITY_LABEL[p.modality]} · {formatVnd(p.rewardVnd)} / suất · {p.slots} suất · {p.questionCount} câu
                    </p>
                  </div>
                  <StatusBadge entry={projectStatus(p.status)} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LabelerHome() {
  const level = useQuery({ queryKey: ["level"], queryFn: () => api<LevelInfo>("/me/level") });
  const bal = useQuery({ queryKey: ["balance"], queryFn: () => api<Balance>("/ledger/me/balance") });
  const attempts = useQuery({ queryKey: ["my-attempts"], queryFn: () => api<AttemptSummary[]>("/tasks/me/attempts") });
  const rec = useQuery({
    queryKey: ["recommended"],
    queryFn: () => api<{ id: string; name: string; modality: string; rewardVnd: number; questionCount: number; score: number; reasons: string[] }[]>("/projects/recommended", { query: { limit: 5 } }),
  });
  const dangLam = (attempts.data ?? []).filter((a) => a.state === "inProgress");
  const lv = level.data;
  const pct = lv?.nextLevel ? Math.min(100, Math.round((lv.approvedCount / lv.nextLevel.minApproved) * 100)) : 100;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Cấp độ" value={lv ? `Cấp ${lv.level}` : "—"} hint={lv ? `${lv.approvedCount} câu trong các bài đạt` : undefined} icon={<Trophy className="size-4" />} />
        <StatCard label="Uy tín" value={lv?.reputation ?? "Chưa có"} icon={<Star className="size-4" />} />
        <StatCard label="Rút được ngay" value={formatVnd(bal.data?.availableVnd)} icon={<Wallet className="size-4" />} />
        <StatCard label="Đang treo" value={formatVnd(bal.data?.pendingVnd)} hint="Doanh thu link chờ hết thời gian treo" icon={<Timer className="size-4" />} />
      </div>
      {lv?.nextLevel && (
        <Card>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Tới cấp {lv.nextLevel.level}</span>
              <span className="text-muted-foreground">
                {lv.approvedCount}/{lv.nextLevel.minApproved} câu · uy tín ≥ {lv.nextLevel.minReputation}
              </span>
            </div>
            <Progress value={pct} />
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bài đang làm</CardTitle>
            <CardDescription>Làm hết các câu rồi nộp cả bài trước hạn.</CardDescription>
          </CardHeader>
          <CardContent>
            {dangLam.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Không có bài đang làm. Xem <Link href="/viec-cua-toi" className="text-primary underline">bài làm của tôi</Link>.
              </p>
            ) : (
              <div className="divide-y">
                {dangLam.map((a) => (
                  <div key={a.attemptId} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="min-w-0 truncate">
                      <ProjectName id={a.projectId} /> · {a.answeredCount}/{a.questionCount} câu · hạn {formatDateTime(a.expiresAt)}
                    </span>
                    <Button size="sm" asChild>
                      <Link href={`/lam-viec/${a.projectId}`}>
                        Làm tiếp <ArrowRight />
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Gợi ý cho bạn</CardTitle>
              <CardDescription>Theo hồ sơ kỹ năng.</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/cho">
                <Store /> Chợ dự án
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {(rec.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Chưa có gợi ý. Cập nhật <Link href="/tai-khoan/ho-so" className="text-primary underline">kỹ năng</Link> để nhận gợi ý tốt hơn.
              </p>
            ) : (
              <div className="divide-y">
                {rec.data!.map((p) => (
                  <Link key={p.id} href={`/cho/${p.id}`} className="flex items-center justify-between py-2 text-sm hover:bg-muted/50">
                    <span className="truncate">{p.name}</span>
                    <span className="text-muted-foreground">{formatVnd(p.rewardVnd)} · {p.questionCount} câu</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LinkHome() {
  const bal = useQuery({ queryKey: ["balance"], queryFn: () => api<Balance>("/ledger/me/balance") });
  const daily = useQuery({
    queryKey: ["gate-daily", 7],
    queryFn: () => api<{ date: string; views: number; paidClicks: number; estimatedRevenueVnd: number }[]>("/gate/stats/me/daily", { query: { from: daysAgo(6) } }),
  });
  const sum = (k: "views" | "paidClicks" | "estimatedRevenueVnd") => (daily.data ?? []).reduce((a, d) => a + d[k], 0);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Lượt xem 7 ngày" value={sum("views")} />
        <StatCard label="Lượt vượt tính tiền" value={sum("paidClicks")} />
        <StatCard label="Doanh thu ước tính" value={formatVnd(sum("estimatedRevenueVnd"))} />
        <StatCard label="Rút được ngay" value={formatVnd(bal.data?.availableVnd)} />
      </div>
      <div className="flex gap-2">
        <Button asChild>
          <Link href="/link">
            <Link2 /> Quản lý link
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/link/thong-ke">Xem thống kê</Link>
        </Button>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { activeRole, me } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (activeRole === "admin") router.replace("/admin");
  }, [activeRole, router]);
  return (
    <>
      <PageHeader title={`Xin chào, ${me?.name ?? ""}`} description="Tổng quan tài khoản của bạn." />
      {activeRole === "business" && <BusinessHome />}
      {activeRole === "labeler" && <LabelerHome />}
      {(activeRole === "labeler" || activeRole === "sharer") && (
        <section className={activeRole === "sharer" ? undefined : "mt-8"}>
          {activeRole !== "sharer" && <h2 className="mb-3 text-base font-semibold">Kiếm tiền từ link</h2>}
          <LinkHome />
        </section>
      )}
    </>
  );
}
