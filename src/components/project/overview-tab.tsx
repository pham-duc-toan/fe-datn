"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, CircleDashed, Flag, Loader2, Pause, Play, Rocket, XOctagon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { KeyValue, StatCard } from "@/components/common/misc";
import { ActionDialog } from "@/components/common/action-dialog";
import { StatusBadge } from "@/components/common/status-badge";
import { api, ApiError, post } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDateTime, formatNumber, formatVnd } from "@/lib/format";
import { FINISH_REASON, kybStatus, phaseOf, projectStatus, READINESS_LABEL, READINESS_WARNING, toolKindsText } from "@/lib/labels";
import { FreeTextNotice, hasFreeText } from "./free-text-notice";
import type { AttemptSummary, KybProfile, Progress as ProgressT, Project, Readiness } from "@/lib/types";

const ESCROW_STATE: Record<string, string> = { active: "đang giữ", closing: "đang chờ trả nốt thưởng", closed: "đã đóng" };
import { useSetProject } from "./use-project";

const CLOSE_REASON: Record<string, string> = {
  chua_dong_bo_tam_dung: "Lệnh tạm dừng chưa tới hệ thống thu bài — thử lại sau vài giây.",
  da_co_bai_nop: "Đã có bài nộp — không huỷ được nữa. Dùng “Kết thúc sớm” để chấm các bài đã nộp và hoàn phần suất thừa.",
};

function CloseCheck({ data }: { data: Record<string, unknown> }) {
  const c = data.closeCheck as { reasons: string[]; inProgressCount?: number; submittedCount?: number } | undefined;
  if (!c) return null;
  return (
    <ul className="mt-1 list-disc pl-5 text-sm">
      {c.reasons.map((r) => (
        <li key={r}>
          {CLOSE_REASON[r] ?? r}
          {r === "da_co_bai_nop" && c.submittedCount ? ` (${c.submittedCount} bài)` : ""}
        </li>
      ))}
    </ul>
  );
}

export function OverviewTab({ project: p, onTab }: { project: Project; onTab: (t: string) => void }) {
  const qc = useQueryClient();
  const setProject = useSetProject(p.id);
  const published = !["draft", "pendingEscrow"].includes(p.status) || p.publishedAt;
  const readiness = useQuery({
    queryKey: ["readiness", p.id],
    queryFn: () => api<Readiness>(`/projects/${p.id}/readiness`),
    enabled: p.status === "draft",
    // Video đang chuẩn bị: tự cập nhật checklist tới khi xong.
    refetchInterval: (q) => ((q.state.data?.videoPreparingCount ?? 0) > 0 ? 5000 : false),
  });
  const kyb = useQuery({ queryKey: ["kyb"], queryFn: () => api<KybProfile>("/kyb/me"), enabled: p.status === "draft" });
  const progress = useQuery({ queryKey: ["progress", p.id], queryFn: () => api<ProgressT>(`/tasks/projects/${p.id}/progress`), enabled: Boolean(published), refetchInterval: 20000 });
  // Bài đạt (kể cả khiếu nại được chấp nhận) — có ngay khi chấm xong, trước khi dự án chốt.
  const attempts = useQuery({
    queryKey: ["project-attempts", p.id],
    queryFn: () => api<AttemptSummary[]>(`/tasks/projects/${p.id}/attempts`),
    enabled: Boolean(published) && ["grading", "completed"].includes(p.status),
  });
  const soDat = (attempts.data ?? []).filter((a) => (a.finalPassed ?? a.passed) === true).length;
  const cost = useQuery({ queryKey: ["cost", p.id], queryFn: () => api<Record<string, number | string>>(`/ledger/projects/${p.id}/cost`), enabled: Boolean(published), retry: false });
  const dist = useQuery({
    queryKey: ["distribution", p.id],
    queryFn: () => api<{ imbalanceWarnings: { code: string; tool: string; label: string; percent: number; count: number; total: number }[]; thresholdPercent: number }>(`/annotations/projects/${p.id}/distribution`),
    enabled: Boolean(published),
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [closeErr, setCloseErr] = useState<ApiError | null>(null);

  async function act(path: string, label: string, body?: unknown) {
    setBusy(path);
    setCloseErr(null);
    try {
      const r = await post<Project>(`/projects/${p.id}/${path}`, body);
      setProject(r);
      toast.success(label);
      if (path === "publish") pollAfterPublish();
      void qc.invalidateQueries({ queryKey: ["progress", p.id] });
    } catch (e) {
      if (e instanceof ApiError && e.code === "chua_the_dong") setCloseErr(e);
      else toast.error(errorMessage(e));
      if (e instanceof ApiError && (e.code === "chua_xac_minh_doanh_nghiep" || e.code === "chua_xac_thuc_email")) {
        toast.info("Nếu bạn vừa được duyệt / vừa xác thực, hãy tải lại trang để làm mới phiên rồi publish lại.");
      }
    } finally {
      setBusy(null);
    }
  }

  // pendingEscrow thường vài giây; hỏi lại tới khi khác (mục 4.8).
  function pollAfterPublish() {
    let n = 0;
    const tick = async () => {
      n++;
      const r = await api<Project>(`/projects/${p.id}`);
      setProject(r);
      if (r.status === "pendingEscrow" && n < 20) setTimeout(tick, 1500);
      else if (r.status === "draft" && r.statusReason) toast.error(r.statusReason);
    };
    setTimeout(tick, 1200);
  }

  const pr = progress.data;
  // Trần người làm (bản chụp cũ không có → số suất).
  const cap = pr ? pr.maxParticipants || pr.slots : 0;
  const done = pr ? Math.round((pr.submitted / Math.max(1, cap)) * 100) : 0;
  const r = readiness.data;

  return (
    <div className="space-y-6">
      {p.status === "draft" && p.statusReason && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Publish chưa thành công</AlertTitle>
          <AlertDescription>
            {p.statusReason}{" "}
            <Link href="/vi?tab=nap-tien" className="underline">
              Nạp thêm tiền
            </Link>
          </AlertDescription>
        </Alert>
      )}
      {p.status === "pendingApproval" && (
        <Alert>
          <CircleDashed />
          <AlertTitle>Đã giữ ký quỹ, chờ admin duyệt</AlertTitle>
          <AlertDescription>Quá thời hạn duyệt không ai xử lý thì dự án tự huỷ và hoàn tiền.</AlertDescription>
        </Alert>
      )}

      {p.status === "draft" && (
        <Card>
          <CardHeader>
            <CardTitle>Checklist publish</CardTitle>
            <CardDescription>Đủ hết mục dưới đây mới publish được. Publish sẽ khoá tiền ký quỹ từ ví.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {kyb.data && kyb.data.status !== "verified" && (
              <div className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
                <span className="flex items-center gap-2">
                  <XOctagon className="size-4 text-amber-600" /> Xác minh doanh nghiệp: <StatusBadge entry={kybStatus(kyb.data.status)} />
                </span>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/doanh-nghiep/kyb">Khai hồ sơ</Link>
                </Button>
              </div>
            )}
            {r && (
              <>
                {r.warnings.map((w) => (
                  <p key={w} className="flex items-center gap-2 text-sm text-amber-700">
                    <AlertTriangle className="size-4" /> {READINESS_WARNING[w] ?? w}
                  </p>
                ))}
                {r.missing.length === 0 ? (
                  <p className="flex items-center gap-2 text-sm text-emerald-700">
                    <CheckCircle2 className="size-4" /> Đã đủ điều kiện.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {r.missing.map((m) => (
                      <li key={m} className="flex items-center gap-2 text-sm">
                        <XOctagon className="size-4 text-destructive" /> {READINESS_LABEL[m] ?? m}
                        {m === "video_dang_chuan_bi" && <span className="text-muted-foreground">({formatNumber(r.videoPreparingCount)} video)</span>}
                      </li>
                    ))}
                  </ul>
                )}
                <KeyValue
                  items={[
                    ["Số câu một bài", `${formatNumber(r.questionCount)} câu thật + ${formatNumber(r.qualityGoldCount)} câu kiểm tra`],
                    ["Câu vàng cho bài test", formatNumber(r.entranceGoldCount)],
                    ["Thưởng / suất", `${formatVnd(p.rewardVnd)} × ${p.slots} suất`],
                    ["Phí nền tảng", `${r.platformFeePercent}% (${formatVnd(r.platformFeePerPassVnd)} / bài đạt)`],
                    ["Cổng link", p.allowLinkGateway ? `${formatVnd(p.gateUnitPriceVnd)} / nhãn khách, ngân sách ${formatVnd(p.gateBudgetVnd)}` : "Không bật"],
                    ["Ký quỹ khi publish", <b key="e">{formatVnd(r.estimatedCostVnd)}</b>],
                  ]}
                />
              </>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void act("publish", "Đã gửi publish — đang ký quỹ")} disabled={busy === "publish" || !r?.ready || (kyb.data && kyb.data.status !== "verified")}>
                {busy === "publish" ? <Loader2 className="animate-spin" /> : <Rocket />} Publish dự án
              </Button>
              <Button variant="outline" onClick={() => onTab("cau-hinh")}>
                Mở cấu hình
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {published && (
        <>
          {hasFreeText(p.toolKinds) && !pr?.gradedAt && <FreeTextNotice audience={pr?.phase === "finished" ? "pending" : "business"} />}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Bài đã nộp" value={pr ? `${pr.submitted}/${cap}` : "—"} hint={pr ? `${done}% trần người làm · ${pr.slots} suất thưởng` : undefined} />
            <StatCard label="Đang làm" value={pr?.inProgress ?? "—"} hint={pr ? `${pr.expired} hết giờ · ${pr.cancelled} bỏ` : undefined} />
            <StatCard
              label="Giai đoạn"
              value={pr ? <StatusBadge entry={phaseOf(pr.phase, hasFreeText(p.toolKinds))} /> : "—"}
              hint={pr?.finishReason ? `đóng thu bài vì ${FINISH_REASON[pr.finishReason] ?? pr.finishReason}` : pr?.estimatedCompletionAt ? `dự kiến đủ suất ${formatDateTime(pr.estimatedCompletionAt)}` : undefined}
            />
            <StatCard
              label="Bài đạt"
              value={pr?.passedCount ?? (pr?.gradedAt ? (attempts.data ? `${soDat}/${pr.submitted}` : "…") : "Chưa chấm")}
              hint={pr?.appealDeadline && !pr.settledAt ? `hạn khiếu nại ${formatDateTime(pr.appealDeadline)} · ${pr.openAppeals} khiếu nại mở` : pr?.settledAt ? `chốt ${formatDateTime(pr.settledAt)}` : undefined}
            />
          </div>
          {pr && <Progress value={done} />}
          {pr?.frozenAt && <p className="text-xs text-muted-foreground">Số liệu chốt ngày {formatDateTime(pr.frozenAt)} (dự án đã đóng lâu, dữ liệu vận hành đã dọn).</p>}
          {(dist.data?.imbalanceWarnings ?? []).map((w, i) => (
            <Alert key={i}>
              <AlertTriangle />
              <AlertDescription>
                {w.code === "lop_ap_dao"
                  ? `Lớp “${w.label}” (công cụ ${w.tool}) chiếm ${w.percent}% (${w.count}/${w.total}) — kiểm tra dữ liệu hoặc hướng dẫn.`
                  : `Lớp “${w.label}” (công cụ ${w.tool}) chưa ai chọn.`}
              </AlertDescription>
            </Alert>
          ))}
          {cost.data && (
            <Card>
              <CardHeader>
                <CardTitle>Chi phí (sổ cái)</CardTitle>
                <CardDescription>Ký quỹ: {ESCROW_STATE[String(cost.data.escrowState)] ?? String(cost.data.escrowState)}</CardDescription>
              </CardHeader>
              <CardContent>
                <KeyValue
                  items={[
                    ["Đã ký quỹ", formatVnd(cost.data.reservedVnd as number)],
                    ["Còn trong ký quỹ", formatVnd(cost.data.balanceVnd as number)],
                    ["Đã trả thưởng", `${formatVnd(cost.data.spentRewardsVnd as number)} (${cost.data.paidAttempts}/${cost.data.slots} suất, gồm phí)`],
                    ["Thưởng / suất", formatVnd(cost.data.rewardPerAttemptVnd as number)],
                    ["Đã chi cổng link", formatVnd(cost.data.spentGateVnd as number)],
                    ["Thưởng đang treo", formatVnd(cost.data.heldVnd as number)],
                    ["Đã hoàn về ví", formatVnd(cost.data.returnedVnd as number)],
                  ]}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}

      {p.status === "grading" && (
        <Alert>
          <CircleDashed />
          <AlertTitle>Đang chấm và chờ hết hạn khiếu nại</AlertTitle>
          <AlertDescription>
            Bài đạt được trả thưởng ngay khi chấm xong. Dự án tự hoàn thành khi hết hạn khiếu nại và không còn khiếu nại mở; phần ký quỹ của các suất không có bài đạt
            hoàn về ví lúc đó.
          </AlertDescription>
        </Alert>
      )}

      {["running", "paused"].includes(p.status) && (
        <Card>
          <CardHeader>
            <CardTitle>Điều khiển dự án</CardTitle>
            <CardDescription>
              Dự án tự đóng thu bài khi đủ suất hoặc tới hạn chót. Kết thúc sớm: chấm ngay các bài đã nộp, huỷ bài đang làm dở, hoàn phần suất thừa sau hạn khiếu nại.
              Huỷ: chỉ khi chưa có bài nộp nào (tạm dừng trước) — hoàn toàn bộ ký quỹ.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {closeErr && (
              <Alert variant="destructive">
                <AlertTitle>Chưa thực hiện được</AlertTitle>
                <AlertDescription>
                  <CloseCheck data={closeErr.data} />
                </AlertDescription>
              </Alert>
            )}
            {p.finishRequestedAt && <p className="text-sm text-muted-foreground">Đã yêu cầu kết thúc lúc {formatDateTime(p.finishRequestedAt)} — hệ thống đang đóng thu bài.</p>}
            <div className="flex flex-wrap gap-2">
              {p.status === "running" ? (
                <Button variant="outline" onClick={() => void act("pause", "Đã tạm dừng")} disabled={Boolean(busy)}>
                  <Pause /> Tạm dừng
                </Button>
              ) : (
                <Button variant="outline" onClick={() => void act("resume", "Đã chạy tiếp")} disabled={Boolean(busy)}>
                  <Play /> Chạy tiếp
                </Button>
              )}
              <ActionDialog
                trigger={
                  <Button disabled={Boolean(busy) || Boolean(p.finishRequestedAt)}>
                    <Flag /> Kết thúc sớm
                  </Button>
                }
                title="Kết thúc sớm dự án?"
                description={`Đóng thu bài ngay: ${pr ? `${pr.submitted} bài đã nộp được chấm, ${pr.inProgress} bài đang làm dở bị huỷ` : "các bài đã nộp được chấm, bài đang làm dở bị huỷ"}. Không mở lại được.`}
                confirmLabel="Kết thúc sớm"
                onConfirm={() => act("finish", "Đã yêu cầu kết thúc — đang chấm")}
              />
              <ActionDialog
                trigger={<Button variant="destructive"><XOctagon /> Huỷ dự án</Button>}
                title="Huỷ dự án?"
                description="Chỉ huỷ được khi đã tạm dừng và chưa có bài nộp nào. Toàn bộ ký quỹ về ví doanh nghiệp."
                destructive
                fields={[{ name: "reason", label: "Lý do", type: "textarea", required: true }]}
                confirmLabel="Huỷ dự án"
                onConfirm={async (v) => {
                  try {
                    setProject(await post<Project>(`/projects/${p.id}/cancel`, { reason: v.reason }));
                    toast.success("Đã huỷ dự án");
                  } catch (e) {
                    if (e instanceof ApiError && e.code === "chua_the_dong") {
                      setCloseErr(e);
                      return;
                    }
                    throw e;
                  }
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Thông tin</CardTitle>
        </CardHeader>
        <CardContent>
          <KeyValue
            items={[
              ["Trạng thái", <StatusBadge key="s" entry={projectStatus(p.status)} />],
              ["Publish lúc", formatDateTime(p.publishedAt)],
              ["Thưởng / suất", formatVnd(p.rewardVnd)],
              ["Số suất", String(p.slots)],
              ["Ngưỡng đạt", `${p.passThresholdPercent}% câu giống đa số + không sai câu kiểm tra`],
              ["Số câu", `${p.questionCount} câu`],
              ["Dạng gán nhãn", toolKindsText(p.toolKinds) || "—"],
              ["Hạn chót", formatDateTime(p.deadline)],
              ["Tạo lúc", formatDateTime(p.createdAt)],
              ["Cập nhật", formatDateTime(p.updatedAt)],
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
