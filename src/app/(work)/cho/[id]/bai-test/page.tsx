"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, Send, Timer, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/common/page-header";
import { Workspace } from "@/components/labeling/workspace";
import { buildPayload, validateLabel } from "@/components/labeling/schema";
import { api, post } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import type { LabelData, LabelSchema, SampleContent, SampleMeta } from "@/lib/types";
import { useProject } from "@/components/project/use-project";

type Attempt = { attemptId: string; expiresAt: string; labelSchema: LabelSchema; questions: { sampleId: string; fileUrl: string | null; content: SampleContent | null; metadata: SampleMeta }[] };
type Result = { scorePercent: number; passPercent: number; passed: boolean; joinedProject: boolean; joinRequestId: string | null; attemptsLeft: number };

function useCountdown(to: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!to) return;
    const h = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(h);
  }, [to]);
  return to ? Math.max(0, Math.floor((new Date(to).getTime() - now) / 1000)) : 0;
}

export default function EntranceTestPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const project = useProject(id);
  const history = useQuery({ queryKey: ["attempts", id], queryFn: () => api<{ attemptId: string; startedAt: string; submittedAt: string | null; scorePercent: number | null; passed: boolean | null }[]>(`/projects/${id}/entrance-test/attempts`) });
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, LabelData>>({});
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const left = useCountdown(attempt?.expiresAt ?? null);

  async function start() {
    setBusy(true);
    try {
      const a = await post<Attempt>(`/projects/${id}/entrance-test/attempts`);
      setAttempt({ ...a, labelSchema: { ...a.labelSchema, modality: a.labelSchema.modality ?? project.data!.modality } });
      setAnswers({});
      setIdx(0);
      setResult(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!attempt) return;
    setBusy(true);
    try {
      const r = await post<Result>(`/projects/${id}/entrance-test/attempts/${attempt.attemptId}/submit`, {
        answers: attempt.questions.map((q) => ({ sampleId: q.sampleId, payload: buildPayload(attempt.labelSchema, answers[q.sampleId] ?? {}) })),
      });
      setResult(r);
      setAttempt(null);
      void qc.invalidateQueries({ queryKey: ["attempts", id] });
      void qc.invalidateQueries({ queryKey: ["projects", "mine-ids"] });
    } catch (e) {
      // Sai định dạng → bài CHƯA bị tính đã nộp; sửa rồi nộp lại (mục 5.2).
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const modality = project.data?.modality ?? "image";
  const q = attempt?.questions[idx];
  const allErrors = attempt ? attempt.questions.flatMap((qq, i) => validateLabel(attempt.labelSchema, answers[qq.sampleId] ?? {}, qq.metadata).map((e) => `Câu ${i + 1} — ${e}`)) : [];

  return (
    <>
      <PageHeader back={{ href: `/cho/${id}`, label: project.data?.name ?? "Dự án" }} title="Bài test đầu vào" description="Server chấm theo đáp án có sẵn và không bao giờ trả đáp án. Mỗi lần làm 30 phút, tối đa 3 lần." />
      {result && (
        <Alert className="mb-6" variant={result.passed ? "default" : "destructive"}>
          {result.passed ? <CheckCircle2 /> : <XCircle />}
          <AlertDescription>
            Điểm {result.scorePercent}% (cần {result.passPercent}%).{" "}
            {result.passed
              ? result.joinedProject
                ? "Bạn đã thành thành viên dự án."
                : "Đã tạo đơn xin tham gia kèm điểm — chờ chủ dự án duyệt."
              : `Chưa đạt. Còn ${result.attemptsLeft} lần làm.`}{" "}
            {result.joinedProject && (
              <Link href={`/lam-viec/${id}`} className="underline">
                Bắt đầu làm
              </Link>
            )}
          </AlertDescription>
        </Alert>
      )}
      {!attempt ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Sẵn sàng?</CardTitle>
              <CardDescription>Đọc kỹ hướng dẫn của dự án trước khi bắt đầu. Bắt đầu sẽ tính một lần làm.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => void start()} disabled={busy || project.isPending}>
                {busy && <Loader2 className="animate-spin" />} Bắt đầu làm bài
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Các lần đã làm</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bắt đầu</TableHead>
                    <TableHead>Nộp</TableHead>
                    <TableHead>Điểm</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(history.data ?? []).map((h) => (
                    <TableRow key={h.attemptId}>
                      <TableCell>{formatDateTime(h.startedAt)}</TableCell>
                      <TableCell>{formatDateTime(h.submittedAt)}</TableCell>
                      <TableCell>{h.scorePercent !== null ? `${h.scorePercent}% ${h.passed ? "✓" : "✗"}` : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : (
        q && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button size="icon-sm" variant="outline" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
                  <ChevronLeft />
                </Button>
                <span className="text-sm font-medium">
                  Câu {idx + 1} / {attempt.questions.length}
                </span>
                <Button size="icon-sm" variant="outline" disabled={idx === attempt.questions.length - 1} onClick={() => setIdx(idx + 1)}>
                  <ChevronRight />
                </Button>
                <div className="ml-2 flex gap-1">
                  {attempt.questions.map((qq, i) => (
                    <button
                      key={qq.sampleId}
                      onClick={() => setIdx(i)}
                      className={`size-6 rounded text-xs ${i === idx ? "bg-primary text-primary-foreground" : answers[qq.sampleId] && Object.keys(answers[qq.sampleId]).length ? "bg-emerald-100 text-emerald-700" : "bg-muted"}`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>
              <span className={`flex items-center gap-1.5 font-mono text-sm ${left < 120 ? "text-destructive" : ""}`}>
                <Timer className="size-4" /> {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
              </span>
            </div>
            <Workspace
              key={q.sampleId}
              schema={attempt.labelSchema}
              modality={modality}
              fileUrl={q.fileUrl}
              content={q.content}
              metadata={q.metadata}
              value={answers[q.sampleId] ?? {}}
              onChange={(v) => setAnswers((a) => ({ ...a, [q.sampleId]: v }))}
              seed={q.sampleId}
            />
            {allErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertDescription>
                  <ul className="list-disc pl-4">{allErrors.slice(0, 8).map((e) => <li key={e}>{e}</li>)}</ul>
                </AlertDescription>
              </Alert>
            )}
            <Button onClick={() => void submit()} disabled={busy || allErrors.length > 0 || left === 0}>
              {busy ? <Loader2 className="animate-spin" /> : <Send />} Nộp bài
            </Button>
          </div>
        )
      )}
    </>
  );
}
