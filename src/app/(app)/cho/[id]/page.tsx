"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Eye, FileCheck2, Loader2, LogOut, PlayCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FreeTextNotice, hasFreeText } from "@/components/project/free-text-notice";
import { ConsentBox } from "@/components/project/consent-box";
import { PageHeader } from "@/components/common/page-header";
import { KeyValue, Markdown } from "@/components/common/misc";
import { ActionDialog } from "@/components/common/action-dialog";
import { StatusBadge } from "@/components/common/status-badge";
import { ErrorState, Loading } from "@/components/common/states";
import { useProject } from "@/components/project/use-project";
import { useTags } from "@/hooks/use-tags";
import { api, ApiError, del, post } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDateTime, formatVnd } from "@/lib/format";
import { attemptState, genericStatus, MODALITY_LABEL, phaseOf, projectStatus, TOOL_LABEL, toolKindsText, VISIBILITY_LABEL } from "@/lib/labels";
import type { JoinRequest, LevelInfo, Paged, ProjectListItem, Slots, Terms } from "@/lib/types";

export default function LabelerProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const q = useProject(id);
  const mine = useQuery({ queryKey: ["projects", "mine-ids"], queryFn: () => api<Paged<ProjectListItem>>("/projects", { query: { mine: true, pageSize: 100 } }) });
  const level = useQuery({ queryKey: ["level"], queryFn: () => api<LevelInfo>("/me/level") });
  const terms = useQuery({ queryKey: ["terms", id], queryFn: () => api<Terms>(`/projects/${id}/terms`), enabled: Boolean(q.data?.consentRequired) });
  const myReq = useQuery({ queryKey: ["join-requests", "mine"], queryFn: () => api<JoinRequest[]>("/projects/join-requests/mine") });
  // Suất còn lại + bài của tôi (task-svc). Dự án chưa chạy thì chưa có — bỏ qua lỗi.
  const slots = useQuery({ queryKey: ["slots", id], queryFn: () => api<Slots>(`/tasks/projects/${id}/slots`), retry: false });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const { name: tagName } = useTags();

  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorState error={q.error} />;
  const p = q.data!;
  const isMember = (mine.data?.items ?? []).some((x) => x.id === id);
  const req = (myReq.data ?? []).find((r) => r.projectId === id && (r.status === "pending" || r.status === "rejected"));
  const lv = level.data;
  const lowLevel = p.minLevel !== null && lv && lv.level < p.minLevel;
  const lowRep = p.minReputation !== null && lv && (lv.reputation ?? 0) < p.minReputation;
  const needConsent = p.consentRequired && terms.data && !terms.data.myConsentValid;

  async function join() {
    setBusy(true);
    try {
      await post(`/projects/${id}/join`);
      toast.success("Đã tham gia dự án");
      await qc.invalidateQueries({ queryKey: ["projects", "mine-ids"] });
    } catch (e) {
      if (e instanceof ApiError && e.code === "can_lam_test") router.push(`/cho/${id}/bai-test`);
      else toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        back={{ href: "/cho", label: "Chợ dự án" }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {p.name} <StatusBadge entry={projectStatus(p.status)} />
          </span>
        }
        description={`${MODALITY_LABEL[p.modality]} · ${VISIBILITY_LABEL[p.visibility]}`}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {p.description && (
            <Card>
              <CardContent className="text-sm whitespace-pre-wrap">{p.description}</CardContent>
            </Card>
          )}
          {needConsent && terms.data && (
            <ConsentBox
              terms={terms.data}
              onSubmit={async (c) => {
                await post(`/projects/${id}/consent`, c);
                toast.success("Đã ghi nhận đồng ý");
                void qc.invalidateQueries({ queryKey: ["terms", id] });
              }}
            />
          )}
          <Card>
            <CardHeader>
              <CardTitle>Hướng dẫn</CardTitle>
            </CardHeader>
            <CardContent>
              {p.guideline?.markdown ? <Markdown>{p.guideline.markdown}</Markdown> : <p className="text-sm text-muted-foreground">Chưa có hướng dẫn.</p>}
              {(p.guideline?.examples ?? []).length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium">Ví dụ</p>
                  {p.guideline!.examples.map((ex, i) => (
                    <div key={i} className={`rounded-md border p-2 text-sm ${ex.isCorrect ? "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/30" : "border-red-200 bg-red-50/50 dark:bg-red-950/30"}`}>
                      <b>{ex.isCorrect ? "Đúng" : "Sai"}:</b> {ex.label} {ex.explanation && `— ${ex.explanation}`}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Bạn sẽ làm gì</CardTitle>
              <CardDescription>
                Một bài gồm {p.questionCount} câu (mỗi câu một mẫu, kèm vài câu kiểm tra). Làm như bài kiểm tra: được quay lại sửa, bỏ qua câu
                khó để làm sau — cuối cùng nộp cả bài một lần.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm">
                {(p.labelSchema?.tools ?? []).map((t) => (
                  <li key={t.name}>
                    <b>{t.name}</b> — {TOOL_LABEL[t.kind]}
                    {t.classes && <span className="text-muted-foreground"> ({t.classes.join(", ")})</span>}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl text-primary">{formatVnd(p.rewardVnd)}</CardTitle>
              <CardDescription>thưởng cho cả bài khi đạt — trả sau khi dự án chấm xong</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <KeyValue
                className="sm:grid-cols-1"
                items={[
                  ["Số câu", `${p.questionCount} câu`],
                  ["Dạng gán nhãn", toolKindsText(p.toolKinds) || "—"],
                  ["Điều kiện đạt", `Giống đa số ≥ ${p.passThresholdPercent}% và không sai câu kiểm tra`],
                  [
                    "Suất thưởng",
                    p.fillSlotsMinPercent == null
                      ? `${p.slots} bài đạt nộp sớm nhất được thưởng`
                      : `${p.slots} bài đạt nộp sớm nhất được thưởng; còn suất trống thì trao cho bài giống đa số nhất (từ ${p.fillSlotsMinPercent}%, đúng hết câu kiểm tra)`,
                  ],
                  ["Chủ đề", p.domains.map((c) => tagName("domain", c)).concat(p.languages.map((c) => tagName("language", c))).join(" · ") || "—"],
                  ["Chỗ làm bài", slots.data ? `còn ${slots.data.available} / ${slots.data.maxParticipants || p.slots} (${slots.data.submitted} đã nộp)` : "—"],
                  ["Hạn chót", formatDateTime(p.deadline)],
                  ["Cấp độ tối thiểu", p.minLevel ?? "Không"],
                  ["Uy tín tối thiểu", p.minReputation ?? "Không"],
                  ["Bài test đầu vào", p.requireEntranceTest ? `${p.entranceQuestionCount} câu, đạt ${p.entrancePassPercent}%` : "Không"],
                ]}
              />
              {slots.data && slots.data.phase !== "open" && (
                <p className="text-sm text-muted-foreground">
                  <StatusBadge entry={phaseOf(slots.data.phase, hasFreeText(p.toolKinds))} />
                </p>
              )}
              {hasFreeText(p.toolKinds) && <FreeTextNotice audience={slots.data?.phase === "finished" ? "pending" : "labeler"} />}
              {(lowLevel || lowRep) && (
                <Alert variant="destructive">
                  <AlertTriangle />
                  <AlertDescription>
                    Bạn chưa đủ điều kiện: cấp {lv?.level}, uy tín {lv?.reputation ?? "chưa có"}.
                  </AlertDescription>
                </Alert>
              )}
              {p.requireVerifiedIdentity && (
                <p className="text-xs text-muted-foreground">
                  Dự án yêu cầu <Link href="/tai-khoan/xac-minh" className="text-primary underline">xác minh danh tính</Link>
                  {p.sensitiveContent ? " và đủ tuổi" : ""}.
                </p>
              )}
              {isMember ? (
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-sm text-emerald-700">
                    <CheckCircle2 className="size-4" /> Bạn là thành viên dự án
                  </p>
                  {(() => {
                    const mine = slots.data?.mine ?? null;
                    if (mine && mine.state === "inProgress")
                      return (
                        <Button className="w-full" asChild>
                          <Link href={`/lam-viec/${id}`}>
                            <PlayCircle /> Tiếp tục làm bài ({mine.answeredCount}/{mine.questionCount} câu)
                          </Link>
                        </Button>
                      );
                    if (mine && mine.state === "submitted")
                      return (
                        <div className="space-y-2">
                          <p className="text-sm">
                            Bạn đã nộp bài <StatusBadge entry={attemptState(mine.state)} />
                          </p>
                          <Button className="w-full" variant="outline" asChild>
                            <Link href={`/bai-lam/${mine.attemptId}`}>
                              <Eye /> Xem bài & kết quả
                            </Link>
                          </Button>
                        </div>
                      );
                    const open = p.status === "running" && (slots.data?.phase ?? "open") === "open" && (slots.data?.available ?? 1) > 0;
                    if (!open)
                      return (
                        <Button className="w-full" disabled>
                          <PlayCircle /> {slots.data && slots.data.available <= 0 ? "Đã đủ người làm" : "Dự án không nhận bài"}
                        </Button>
                      );
                    return (
                      <Button className="w-full" asChild>
                        <Link href={`/lam-viec/${id}`}>
                          <PlayCircle /> Bắt đầu làm bài
                        </Link>
                      </Button>
                    );
                  })()}
                  <ActionDialog
                    trigger={<Button className="w-full" variant="ghost"><LogOut /> Rời dự án</Button>}
                    title="Rời dự án?"
                    description="Không bị phạt. Bài đang làm dở (chưa nộp) sẽ bị huỷ; bài đã nộp vẫn được chấm."
                    confirmLabel="Rời dự án"
                    destructive
                    onConfirm={async () => {
                      await post(`/projects/${id}/leave`);
                      toast.success("Đã rời dự án");
                      await qc.invalidateQueries({ queryKey: ["projects", "mine-ids"] });
                    }}
                  />
                </div>
              ) : needConsent ? (
                <p className="text-sm text-muted-foreground">Đồng ý điều khoản ở bên trái trước khi tham gia.</p>
              ) : p.requireEntranceTest ? (
                <Button className="w-full" asChild disabled={Boolean(lowLevel || lowRep)}>
                  <Link href={`/cho/${id}/bai-test`}>
                    <FileCheck2 /> Làm bài test đầu vào
                  </Link>
                </Button>
              ) : p.visibility === "approval" ? (
                req?.status === "pending" ? (
                  <div className="space-y-2 text-sm">
                    <p>
                      Đơn đang chờ duyệt <StatusBadge entry={genericStatus("pending")} />
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await del(`/projects/${id}/join-requests/mine`);
                          await qc.invalidateQueries({ queryKey: ["join-requests", "mine"] });
                        } catch (e) {
                          toast.error(errorMessage(e));
                        }
                      }}
                    >
                      Rút đơn
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {req?.status === "rejected" && (
                      <p className="text-sm text-destructive">
                        Đơn trước bị từ chối{req.rejectReason ? `: ${req.rejectReason}` : ""}. {req.canRequestAgainAt && `Gửi lại sau ${formatDateTime(req.canRequestAgainAt)}.`}
                      </p>
                    )}
                    <Textarea rows={3} maxLength={500} placeholder="Lời nhắn cho chủ dự án (tuỳ chọn)" value={message} onChange={(e) => setMessage(e.target.value)} />
                    <Button
                      className="w-full"
                      disabled={busy || Boolean(lowLevel || lowRep)}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await post(`/projects/${id}/join-requests`, { message: message.trim() || null });
                          toast.success("Đã gửi đơn");
                          await qc.invalidateQueries({ queryKey: ["join-requests", "mine"] });
                        } catch (e) {
                          toast.error(errorMessage(e));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <Send /> Xin tham gia
                    </Button>
                  </div>
                )
              ) : (
                <Button className="w-full" onClick={() => void join()} disabled={busy || Boolean(lowLevel || lowRep) || p.status !== "running"}>
                  {busy && <Loader2 className="animate-spin" />} Tham gia dự án
                </Button>
              )}
            </CardContent>
          </Card>
          {terms.data?.myConsentValid && (
            <p className="text-xs text-muted-foreground">
              Đã đồng ý điều khoản {terms.data.myNdaSignedAt ? `· ký NDA ${formatDateTime(terms.data.myNdaSignedAt)}` : ""}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
