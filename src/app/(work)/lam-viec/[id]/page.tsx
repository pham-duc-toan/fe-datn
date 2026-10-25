"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BookOpen, ChevronLeft, ChevronRight, Eraser, Eye, Flag, FlagTriangleRight, Loader2, LogOut, Send, ShieldAlert, SkipForward, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PageHeader } from "@/components/common/page-header";
import { Markdown } from "@/components/common/misc";
import { ActionDialog } from "@/components/common/action-dialog";
import { ErrorState, Loading } from "@/components/common/states";
import { Workspace } from "@/components/labeling/workspace";
import { buildPayload, initialData, isBlank, validateLabel } from "@/components/labeling/schema";
import { useProject } from "@/components/project/use-project";
import { hasFreeText, schemaToolKinds } from "@/components/project/free-text-notice";
import { ApiError, api, post, put } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { deviceId } from "@/lib/device";
import { formatVnd } from "@/lib/format";
import { REPORT_REASON } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { Attempt, InvalidAnswer, LabelData, SaveAnswerResponse, SubmitAttemptResponse } from "@/lib/types";

/** Đếm ngược tới hạn nộp của bài. */
function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const h = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(h);
  }, []);
  const left = Math.max(0, Math.floor((new Date(to).getTime() - now) / 1000));
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  return (
    <span className={cn("flex items-center gap-1.5 font-mono text-sm tabular-nums", left < 600 ? "font-semibold text-destructive" : "text-muted-foreground")} title="Thời gian còn lại để nộp bài">
      <Timer className="size-4" /> {h > 0 ? `${h}:${String(m).padStart(2, "0")}` : m}:{String(left % 60).padStart(2, "0")}
    </span>
  );
}

type Answers = Record<string, LabelData>;

/** Câu đã có câu trả lời (đã lưu trên server, hoặc vừa sửa mà còn nội dung). */
function answeredSet(a: Attempt, local: Answers, touched: Set<string>): Set<string> {
  const s = new Set<string>();
  for (const q of a.questions) {
    if (touched.has(q.sampleId)) {
      if (!isBlank(a.labelSchema, local[q.sampleId] ?? {})) s.add(q.sampleId);
    } else if (q.answer) s.add(q.sampleId);
  }
  return s;
}

const FLAG_KEY = (aid: string) => `crowd:attempt-flags:${aid}`;

export default function ExamPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const project = useProject(id);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [invalid, setInvalid] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef<{ sampleId: string; timer: ReturnType<typeof setTimeout> } | null>(null);

  // Chặn gọi "bắt đầu" hai lần cùng lúc (effect chạy lại / bấm thử lại khi đang tải).
  const loading = useRef(false);
  const load = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    setError(null);
    try {
      // 403 ngay sau khi tham gia: bản sao thành viên ở task-svc chưa tới — thử lại 2 lần (mục 8).
      let a: Attempt | null = null;
      for (let i = 0; i < 3; i++) {
        try {
          a = await post<Attempt>(`/tasks/projects/${id}/attempt`, {}, { headers: { "X-Device-Id": deviceId() } });
          break;
        } catch (e) {
          if (e instanceof ApiError && e.status === 403 && ["khong_phai_thanh_vien", "du_an_chua_san_sang"].includes(e.code) && i < 2) {
            await new Promise((r) => setTimeout(r, 1200));
            continue;
          }
          throw e;
        }
      }
      if (!a) return;
      setAttempt(a);
      setAnswers(Object.fromEntries(a.questions.map((q) => [q.sampleId, initialData(a.labelSchema, q.answer)])));
      setTouched(new Set());
      setReveal(!a.sensitiveContent);
      try {
        const raw = localStorage.getItem(FLAG_KEY(a.attemptId));
        setFlags(new Set(raw ? (JSON.parse(raw) as string[]) : []));
      } catch {
        setFlags(new Set());
      }
      const firstBlank = a.questions.findIndex((q) => !q.answer);
      setIdx(firstBlank >= 0 ? firstBlank : 0);
    } catch (e) {
      setError(e);
    } finally {
      loading.current = false;
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const save = useCallback(
    async (sampleId: string) => {
      if (!attempt) return;
      const data = buildPayload(attempt.labelSchema, answers[sampleId] ?? {});
      setSaving(true);
      try {
        const r = await put<SaveAnswerResponse>(`/tasks/attempts/${attempt.attemptId}/answers/${sampleId}`, {
          data: Object.keys(data).length === 0 ? null : data,
        });
        setSavedAt(r.savedAt ?? new Date().toISOString());
        setInvalid((m) => {
          if (!(sampleId in m)) return m;
          const n = { ...m };
          delete n[sampleId];
          return n;
        });
      } catch (e) {
        toast.error(errorMessage(e));
      } finally {
        setSaving(false);
      }
    },
    [attempt, answers],
  );

  /** Lưu ngay câu đang chờ (khi chuyển câu / nộp bài). */
  const flush = useCallback(async () => {
    const p = pending.current;
    if (!p) return;
    clearTimeout(p.timer);
    pending.current = null;
    await save(p.sampleId);
  }, [save]);

  // Tự lưu 1,2 giây sau lần sửa cuối của câu đang làm.
  const latestSave = useRef(save);
  useEffect(() => {
    latestSave.current = save;
  }, [save]);

  function change(sampleId: string, v: LabelData) {
    setAnswers((m) => ({ ...m, [sampleId]: v }));
    setTouched((s) => (s.has(sampleId) ? s : new Set(s).add(sampleId)));
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = {
      sampleId,
      timer: setTimeout(() => {
        pending.current = null;
        void latestSave.current(sampleId);
      }, 1200),
    };
  }

  async function go(i: number) {
    await flush();
    setIdx(i);
    if (attempt?.sensitiveContent) setReveal(false);
  }

  function toggleFlag(sampleId: string) {
    if (!attempt) return;
    setFlags((s) => {
      const n = new Set(s);
      if (n.has(sampleId)) n.delete(sampleId);
      else n.add(sampleId);
      try {
        localStorage.setItem(FLAG_KEY(attempt.attemptId), JSON.stringify([...n]));
      } catch {
        /* trình duyệt chặn lưu trữ — chỉ mất đánh dấu */
      }
      return n;
    });
  }

  const answered = useMemo(() => (attempt ? answeredSet(attempt, answers, touched) : new Set<string>()), [attempt, answers, touched]);

  async function submit() {
    if (!attempt) return;
    await flush();
    setBusy(true);
    try {
      await post<SubmitAttemptResponse>(`/tasks/attempts/${attempt.attemptId}/submit`, {}, { headers: { "X-Device-Id": deviceId() } });
      try {
        localStorage.removeItem(FLAG_KEY(attempt.attemptId));
      } catch {
        /* bỏ qua */
      }
      toast.success("Đã nộp bài — kết quả có sau khi dự án chấm xong");
      router.push(`/bai-lam/${attempt.attemptId}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === "bai_chua_hop_le" && Array.isArray(e.data.invalidAnswers)) {
        const list = e.data.invalidAnswers as InvalidAnswer[];
        setInvalid(Object.fromEntries(list.map((x) => [x.sampleId, x.message])));
        toast.error(`${list.length} câu chưa hợp lệ — sửa rồi nộp lại`);
        const first = list.length ? attempt.questions.findIndex((x) => x.sampleId === list[0].sampleId) : -1;
        if (first >= 0) setIdx(first);
      } else toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const onMediaError = useCallback(() => {
    // Link xem file sống ngắn: tải lại bài để lấy link mới, GIỮ câu trả lời đang sửa trên máy.
    if (!attempt) return;
    void (async () => {
      try {
        const a = await api<Attempt>(`/tasks/attempts/${attempt.attemptId}`);
        setAttempt((cur) => (cur ? { ...cur, questions: cur.questions.map((q, i) => ({ ...q, fileUrl: a.questions[i]?.fileUrl ?? q.fileUrl })) } : cur));
      } catch {
        /* giữ nguyên */
      }
    })();
  }, [attempt]);

  const p = project.data;
  const back = { href: `/cho/${id}`, label: p?.name ?? "Dự án" };

  if (error) {
    const code = error instanceof ApiError ? error.code : null;
    return (
      <>
        <PageHeader back={back} title={p?.name ?? "Làm bài"} />
        <div className="space-y-3">
          <ErrorState error={error} onRetry={() => void load()} />
          {code === "khong_phai_thanh_vien" && (
            <p className="text-center text-sm">
              <Link href={`/cho/${id}`} className="text-primary underline">Tham gia dự án</Link> trước khi làm bài.
            </p>
          )}
          {code === "da_nop_bai" && (
            <p className="text-center text-sm">
              Bạn đã nộp bài cho dự án này — xem ở <Link href="/viec-cua-toi" className="text-primary underline">Bài làm của tôi</Link>.
            </p>
          )}
        </div>
      </>
    );
  }
  if (!attempt) return <Loading label="Đang mở bài làm…" />;

  const q = attempt.questions[idx];
  const value = answers[q.sampleId] ?? {};
  const hints = touched.has(q.sampleId) ? validateLabel(attempt.labelSchema, value, q.metadata) : [];
  const blank = attempt.questions.length - answered.size;
  const coCauMo = attempt.questions.length > 0 && hasFreeText(schemaToolKinds(attempt.labelSchema));
  const nextBlank = () => {
    for (let k = 1; k <= attempt.questions.length; k++) {
      const j = (idx + k) % attempt.questions.length;
      if (!answered.has(attempt.questions[j].sampleId)) return j;
    }
    return null;
  };

  return (
    <>
      <PageHeader
        back={back}
        title={p?.name ?? "Làm bài"}
        description={`Thưởng ${formatVnd(attempt.rewardVnd)} nếu đạt · giống đa số ≥ ${attempt.passThresholdPercent}% và không sai câu kiểm tra`}
        actions={
          <>
            <Countdown to={attempt.expiresAt} />
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <BookOpen /> Hướng dẫn
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
                <SheetHeader>
                  <SheetTitle>Hướng dẫn gán nhãn</SheetTitle>
                </SheetHeader>
                <div className="px-4 pb-6">{p?.guideline?.markdown ? <Markdown>{p.guideline.markdown}</Markdown> : <p className="text-sm text-muted-foreground">Chưa có hướng dẫn.</p>}</div>
              </SheetContent>
            </Sheet>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Bảng câu hỏi: nhảy tới câu bất kỳ, thấy ngay câu nào còn trống / cần xem lại / chưa hợp lệ. */}
        <Card className="h-fit lg:sticky lg:top-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Đã trả lời {answered.size}/{attempt.questions.length}
            </CardTitle>
            <CardDescription className="text-xs">Bấm số để chuyển câu. Bài chỉ nộp một lần cho cả dự án.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-6 gap-1.5 lg:grid-cols-5">
              {attempt.questions.map((x, i) => {
                const done = answered.has(x.sampleId);
                return (
                  <button
                    key={x.sampleId}
                    type="button"
                    onClick={() => void go(i)}
                    title={invalid[x.sampleId] ?? (done ? "Đã trả lời" : "Chưa trả lời")}
                    className={cn(
                      "relative flex h-8 items-center justify-center rounded-md border text-xs font-medium tabular-nums transition-colors",
                      done ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" : "bg-background text-muted-foreground",
                      invalid[x.sampleId] && "border-destructive bg-destructive/10 text-destructive",
                      i === idx && "ring-2 ring-primary",
                    )}
                  >
                    {i + 1}
                    {flags.has(x.sampleId) && <span className="absolute -top-1 -right-1 size-2 rounded-full bg-amber-500" />}
                  </button>
                );
              })}
            </div>
            <div className="space-y-1 text-[11px] text-muted-foreground">
              <p><span className="mr-1 inline-block size-2.5 rounded-sm border border-emerald-300 bg-emerald-50 align-middle" /> đã trả lời</p>
              <p><span className="mr-1 inline-block size-2.5 rounded-full bg-amber-500 align-middle" /> đánh dấu xem lại</p>
              <p><span className="mr-1 inline-block size-2.5 rounded-sm border border-destructive bg-destructive/10 align-middle" /> chưa hợp lệ</p>
            </div>
            <p className="text-xs text-muted-foreground">{saving ? "Đang lưu…" : savedAt ? `Đã lưu lúc ${new Date(savedAt).toLocaleTimeString("vi-VN")}` : "Câu trả lời tự lưu sau mỗi thay đổi"}</p>
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">Câu {idx + 1} / {attempt.questions.length}</h2>
            {answered.has(q.sampleId) ? <span className="text-xs text-emerald-700">đã trả lời</span> : <span className="text-xs text-muted-foreground">chưa trả lời</span>}
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => toggleFlag(q.sampleId)}>
              <FlagTriangleRight className={cn(flags.has(q.sampleId) && "text-amber-500")} /> {flags.has(q.sampleId) ? "Bỏ đánh dấu" : "Đánh dấu xem lại"}
            </Button>
          </div>

          {attempt.sensitiveContent && !reveal ? (
            <Card className="border-amber-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="size-5 text-amber-600" /> Nội dung nhạy cảm
                </CardTitle>
                <CardDescription>{p?.contentWarning ?? "Mẫu này có thể chứa nội dung gây khó chịu."}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setReveal(true)}>
                  <Eye /> Hiện mẫu
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Workspace
              key={q.sampleId}
              schema={attempt.labelSchema}
              modality={q.modality}
              fileUrl={q.fileUrl}
              content={q.content}
              metadata={q.metadata}
              value={value}
              onChange={(v) => change(q.sampleId, v)}
              seed={q.sampleId}
              onMediaError={onMediaError}
            />
          )}

          {invalid[q.sampleId] && (
            <Alert variant="destructive">
              <AlertTitle>Câu này chưa hợp lệ</AlertTitle>
              <AlertDescription>{invalid[q.sampleId]}</AlertDescription>
            </Alert>
          )}
          {hints.length > 0 && !invalid[q.sampleId] && (
            <Alert>
              <AlertTitle>Cần hoàn thiện trước khi nộp</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4">{hints.map((e) => <li key={e}>{e}</li>)}</ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
            <Button variant="outline" disabled={idx === 0} onClick={() => void go(idx - 1)}>
              <ChevronLeft /> Câu trước
            </Button>
            <Button variant="outline" disabled={idx === attempt.questions.length - 1} onClick={() => void go(idx + 1)}>
              Câu sau <ChevronRight />
            </Button>
            <Button
              variant="ghost"
              disabled={nextBlank() === null}
              onClick={() => {
                const j = nextBlank();
                if (j !== null) void go(j);
              }}
            >
              <SkipForward /> Tới câu chưa làm
            </Button>
            <Button
              variant="ghost"
              disabled={!answered.has(q.sampleId)}
              onClick={() => change(q.sampleId, {})}
              title="Bỏ trống câu này"
            >
              <Eraser /> Xoá câu trả lời
            </Button>
            <ActionDialog
              trigger={<Button variant="ghost"><Flag /> Báo lỗi câu</Button>}
              title="Báo lỗi câu hỏi"
              description="Không bị trừ uy tín. Câu bị báo sai nhiều sẽ được loại khỏi chấm điểm."
              fields={[
                { name: "reason", label: "Lý do", type: "select", required: true, defaultValue: "broken", options: Object.entries(REPORT_REASON).map(([value, label]) => ({ value, label })) },
                { name: "note", label: "Ghi chú (bắt buộc nếu chọn Lý do khác)", type: "textarea" },
              ]}
              onConfirm={async (v) => {
                await post(`/tasks/attempts/${attempt.attemptId}/reports`, { sampleId: q.sampleId, reason: v.reason, note: v.note || null });
                toast.success("Đã báo lỗi câu này");
              }}
            />
            <div className="ml-auto flex flex-wrap gap-2">
              <ActionDialog
                trigger={<Button variant="ghost"><LogOut /> Bỏ bài</Button>}
                title="Bỏ bài làm?"
                description="Bài và mọi câu trả lời bị huỷ, suất trả lại cho người khác. Bạn có thể bắt đầu bài mới nếu dự án còn suất."
                confirmLabel="Bỏ bài"
                destructive
                onConfirm={async () => {
                  await post(`/tasks/attempts/${attempt.attemptId}/abandon`);
                  router.push(`/cho/${id}`);
                }}
              />
              <ActionDialog
                trigger={
                  <Button disabled={busy}>
                    {busy ? <Loader2 className="animate-spin" /> : <Send />} Nộp bài
                  </Button>
                }
                title="Nộp cả bài?"
                description={
                  (blank > 0
                    ? `Bạn đã trả lời ${answered.size}/${attempt.questions.length} câu. ${blank} câu bỏ trống sẽ tính là không giống đa số (câu kiểm tra bỏ trống tính là sai). Sau khi nộp không sửa được nữa.`
                    : `Bạn đã trả lời đủ ${attempt.questions.length} câu. Sau khi nộp không sửa được nữa.`) +
                  (coCauMo ? " Bài có câu trả lời mở: khi dự án kết thúc, hệ thống cần thêm thời gian phân tích ngữ nghĩa nên kết quả và tiền công có muộn hơn." : "")
                }
                confirmLabel="Nộp bài"
                onConfirm={submit}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
