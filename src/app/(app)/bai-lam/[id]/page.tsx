"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Gavel, Loader2, PlayCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/common/page-header";
import { KeyValue } from "@/components/common/misc";
import { StatusBadge, ToneBadge } from "@/components/common/status-badge";
import { ErrorState, Loading } from "@/components/common/states";
import { Workspace } from "@/components/labeling/workspace";
import { initialData } from "@/components/labeling/schema";
import { useProject } from "@/components/project/use-project";
import { FreeTextNotice, hasFreeText, schemaToolKinds } from "@/components/project/free-text-notice";
import { api, post } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDateTime, formatVnd } from "@/lib/format";
import { appealState, attemptState } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { Attempt, AttemptSummary } from "@/lib/types";

function ResultCard({ s, freeText }: { s: AttemptSummary; freeText: boolean }) {
  if (s.state === "inProgress")
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlayCircle className="size-5 text-primary" /> Bài đang làm
          </CardTitle>
          <CardDescription>
            Đã trả lời {s.answeredCount}/{s.questionCount} câu · nộp trước {formatDateTime(s.expiresAt)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href={`/lam-viec/${s.projectId}`}>Tiếp tục làm bài</Link>
          </Button>
        </CardContent>
      </Card>
    );
  if (s.passed === null)
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-5 text-muted-foreground" /> Chờ chấm
          </CardTitle>
          <CardDescription>
            Bài được chấm một lần khi dự án đóng thu bài (đủ người làm, hết hạn chót hoặc chủ dự án kết thúc sớm). Tiền thưởng trao cho các bài đạt nộp sớm nhất, mỗi suất một bài. Bạn sẽ nhận thông báo kết quả.
          </CardDescription>
        </CardHeader>
        {freeText && (
          <CardContent>
            <FreeTextNotice audience="labeler" />
          </CardContent>
        )}
      </Card>
    );
  const dat = s.finalPassed ?? s.passed;
  // Đạt nhưng các suất thưởng đã trao cho bài nộp trước (bản cũ không có rewarded → coi như được thưởng).
  // Chưa đạt mà rewarded = true: dự án lấp suất còn trống bằng bài giống đa số nhất.
  const lapSuat = !dat && s.rewarded === true;
  const thuong = (dat && s.rewarded !== false) || lapSuat;
  return (
    <Card className={cn(dat || lapSuat ? "border-emerald-300" : "border-destructive/40")}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {dat || lapSuat ? <CheckCircle2 className="size-5 text-emerald-600" /> : <XCircle className="size-5 text-destructive" />}
          {dat ? "Bài đạt" : lapSuat ? "Được thưởng" : "Bài chưa đạt"}
          {lapSuat && <ToneBadge tone="info">lấp suất còn trống</ToneBadge>}
          {s.passed === false && s.finalPassed === true && <ToneBadge tone="success">đạt sau khiếu nại</ToneBadge>}
          {dat && !thuong && <ToneBadge tone="warning">hết suất thưởng</ToneBadge>}
        </CardTitle>
        <CardDescription>
          {lapSuat
            ? `Bài chưa tới ngưỡng đạt, nhưng dự án còn suất trống và bài của bạn nằm trong nhóm giống đa số nhất — đã nhận thưởng ${formatVnd(s.rewardVnd)} vào ví.`
            : thuong
            ? `Đã nhận thưởng ${formatVnd(s.rewardVnd)} vào ví.`
            : dat
              ? "Bài đạt nhưng các suất thưởng đã được trao cho những bài đạt nộp sớm hơn. Kết quả vẫn được tính vào uy tín của bạn."
              : "Không nhận thưởng. Bạn có thể khiếu nại cả bài trong thời hạn."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <KeyValue
          className="sm:grid-cols-1"
          items={[
            ["Giống đa số", s.agreementPercent === null ? "—" : `${s.agreementPercent}% (${s.matchedCount}/${s.comparableCount} câu so được) · cần ≥ ${s.passThresholdPercent}%`],
            ["Câu kiểm tra", s.goldTotal ? `đúng ${s.goldCorrect}/${s.goldTotal}` : "dự án không có câu kiểm tra"],
            ["Đã trả lời", `${s.answeredCount}/${s.questionCount} câu`],
            ["Chấm lúc", formatDateTime(s.gradedAt)],
          ]}
        />
      </CardContent>
    </Card>
  );
}

function AppealCard({ s, onDone }: { s: AttemptSummary; onDone: () => void }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  if (s.appealState !== "none")
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gavel className="size-5" /> Khiếu nại <StatusBadge entry={appealState(s.appealState)} />
          </CardTitle>
          <CardDescription>Gửi lúc {formatDateTime(s.appealedAt)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="rounded-md bg-muted p-3 whitespace-pre-wrap">{s.appealMessage}</p>
          {s.appealNote && (
            <p>
              <b>Quản trị viên:</b> {s.appealNote}
            </p>
          )}
        </CardContent>
      </Card>
    );
  if (!s.canAppeal) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gavel className="size-5" /> Khiếu nại cả bài
        </CardTitle>
        <CardDescription>
          Quản trị viên xem lại cả bài. Chấp nhận thì bài tính là đạt và được trả thưởng. Hạn khiếu nại: {formatDateTime(s.appealDeadline)}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea rows={4} maxLength={1000} placeholder="Vì sao bạn cho rằng bài đúng? Nêu câu cụ thể (vd câu 3: mẫu mờ, có thể hiểu hai cách)." value={msg} onChange={(e) => setMsg(e.target.value)} />
        <Button
          disabled={busy || !msg.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              await post(`/tasks/attempts/${s.attemptId}/appeal`, { message: msg.trim() });
              toast.success("Đã gửi khiếu nại");
              onDone();
            } catch (e) {
              toast.error(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy && <Loader2 className="animate-spin" />} Gửi khiếu nại
        </Button>
      </CardContent>
    </Card>
  );
}

export default function AttemptPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const mine = useQuery({ queryKey: ["my-attempts"], queryFn: () => api<AttemptSummary[]>("/tasks/me/attempts") });
  const detail = useQuery({ queryKey: ["attempt", id], queryFn: () => api<Attempt>(`/tasks/attempts/${id}`) });
  const s = (mine.data ?? []).find((x) => x.attemptId === id) ?? null;
  const project = useProject(s?.projectId ?? detail.data?.projectId ?? "");
  const [idx, setIdx] = useState(0);

  if (mine.isPending || detail.isPending) return <Loading />;
  if (detail.error) return <ErrorState error={detail.error} />;
  const a = detail.data!;
  const q = a.questions[Math.min(idx, a.questions.length - 1)];

  return (
    <>
      <PageHeader
        back={{ href: "/viec-cua-toi", label: "Bài làm của tôi" }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {project.data?.name ?? "Bài làm"} <StatusBadge entry={attemptState(a.state)} />
          </span>
        }
        description={`Bắt đầu ${formatDateTime(a.startedAt)}${a.submittedAt ? ` · nộp ${formatDateTime(a.submittedAt)}` : ""}`}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Câu trả lời của bạn ({a.answeredCount}/{a.questionCount})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {a.questions.map((x, i) => (
                  <button
                    key={x.sampleId}
                    type="button"
                    onClick={() => setIdx(i)}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-md border text-xs tabular-nums",
                      x.answer ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40" : "text-muted-foreground",
                      i === idx && "ring-2 ring-primary",
                    )}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
          {q && (
            <>
              <p className="text-sm font-medium">
                Câu {idx + 1} {q.answer ? "" : "— bỏ trống"}
              </p>
              <Workspace
                key={q.sampleId}
                schema={a.labelSchema}
                modality={q.modality}
                fileUrl={q.fileUrl}
                content={q.content}
                metadata={q.metadata}
                value={initialData(a.labelSchema, q.answer)}
                readOnly
                seed={q.sampleId}
              />
            </>
          )}
        </div>
        <div className="space-y-4">
          {s ? <ResultCard s={s} freeText={hasFreeText(schemaToolKinds(a.labelSchema))} /> : <Loading />}
          {s && <AppealCard s={s} onDone={() => void qc.invalidateQueries({ queryKey: ["my-attempts"] })} />}
        </div>
      </div>
    </>
  );
}
