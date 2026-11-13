"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { ExternalLink, Flag, Loader2, Lock, ShieldAlert, ShieldCheck, Tags, Timer, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ActionDialog } from "@/components/common/action-dialog";
import { Workspace } from "@/components/labeling/workspace";
import { buildPayload } from "@/components/labeling/schema";
import { api, ApiError } from "@/lib/api";
import { API_URL } from "@/lib/config";
import { errorMessage } from "@/lib/errors";
import type { LabelData, LabelSchema, Modality, SampleContent, SampleMeta } from "@/lib/types";

type GatePage = {
  code: string;
  requiresPassword: boolean;
  countdownSeconds: number;
  turnstileEnabled: boolean;
  turnstileSiteKey: string;
  /** Trượt chừng này lần (tính theo IP) thì bị chặn. */
  maxFailsBeforeBlock: number;
  blockSeconds: number;
};
/** Kết quả nộp: đạt → link đích; trượt → link KHÁC (link cũ bị khoá với IP này) hoặc bị chặn IP. */
type SubmitResult = {
  passed: boolean;
  redirectUrl: string | null;
  failCount?: number | null;
  failLimit?: number | null;
  blocked?: boolean;
  blockedUntil?: string | null;
  nextLinkUrl?: string | null;
};
/** Màn thông báo sau khi trượt / bị chặn. */
type Failure = { kind: "failed"; failCount: number; failLimit: number; nextLinkUrl: string | null } | { kind: "blocked"; until: string | null } | { kind: "linkLocked" };

function formatDuration(seconds: number): string {
  if (seconds >= 3600) return `${Math.round(seconds / 3600)} giờ`;
  if (seconds >= 60) return `${Math.round(seconds / 60)} phút`;
  return `${seconds} giây`;
}
type Session = {
  sessionId: string;
  answerableAt: string;
  expiresAt: string;
  labelSchema: LabelSchema | null;
  questions: { sampleId: string; modality: Modality; fileUrl: string | null; content: SampleContent | null; question: string | null; metadata: SampleMeta }[];
};

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void }) => string; reset: (id?: string) => void };
  }
}

export default function GatePage() {
  const { code } = useParams<{ code: string }>();
  const [page, setPage] = useState<GatePage | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [answers, setAnswers] = useState<Record<string, LabelData>>({});
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirect, setRedirect] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [tsReady, setTsReady] = useState(false);
  const tsRef = useRef<HTMLDivElement>(null);
  const tsWidget = useRef<string | null>(null);

  /** IP bị chặn / link đã khoá với IP này → màn thông báo riêng thay vì dòng lỗi nhỏ. */
  const handleBlock = useCallback((e: unknown): boolean => {
    if (!(e instanceof ApiError)) return false;
    if (e.code === "ip_bi_chan") {
      setFailure({ kind: "blocked", until: typeof e.data.blockedUntil === "string" ? e.data.blockedUntil : null });
      return true;
    }
    if (e.code === "link_da_truot") {
      setFailure({ kind: "linkLocked" });
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    api<GatePage>(`/g/${encodeURIComponent(code)}`, { auth: false })
      .then(async (p) => {
        setPage(p);
        if (!p.turnstileEnabled) setToken("");
        // Không mật khẩu, không Turnstile: vào thẳng bộ câu.
        if (!p.turnstileEnabled && !p.requiresPassword) {
          try {
            setSession(await api<Session>(`/g/${encodeURIComponent(code)}/sessions`, { method: "POST", auth: false, body: {} }));
          } catch (e) {
            if (!handleBlock(e)) setError(errorMessage(e));
          }
        }
      })
      .catch((e) => setNotFound(errorMessage(e)));
  }, [code, handleBlock]);

  useEffect(() => {
    const h = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(h);
  }, []);

  useEffect(() => {
    if (!page?.turnstileEnabled || !tsReady || !tsRef.current || !window.turnstile || tsWidget.current) return;
    tsWidget.current = window.turnstile.render(tsRef.current, { sitekey: page.turnstileSiteKey, callback: (t) => setToken(t) });
  }, [page, tsReady]);

  const start = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const s = await api<Session>(`/g/${encodeURIComponent(code)}/sessions`, { method: "POST", auth: false, body: { turnstileToken: token || undefined, password: password || undefined } });
      setSession(s);
      setAnswers({});
    } catch (e) {
      if (!handleBlock(e)) setError(errorMessage(e));
      if (e instanceof ApiError && e.code === "turnstile_that_bai") {
        setToken(null);
        window.turnstile?.reset(tsWidget.current ?? undefined);
      }
    } finally {
      setBusy(false);
    }
  }, [code, token, password, handleBlock]);

  async function submit() {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, LabelData> = {};
      if (session.labelSchema) for (const q of session.questions) body[q.sampleId] = buildPayload(session.labelSchema, answers[q.sampleId] ?? {});
      const r = await api<SubmitResult>(`/g/sessions/${session.sessionId}/submit`, { method: "POST", auth: false, body: { answers: body } });
      if (r.passed && r.redirectUrl) setRedirect(r.redirectUrl.startsWith("http") ? r.redirectUrl : API_URL + r.redirectUrl);
      else {
        // Trượt: không làm lại link cũ. Bị chặn IP, hoặc được chuyển sang link khác.
        setSession(null);
        setAnswers({});
        setFailure(
          r.blocked
            ? { kind: "blocked", until: r.blockedUntil ?? null }
            : { kind: "failed", failCount: r.failCount ?? 1, failLimit: r.failLimit ?? page?.maxFailsBeforeBlock ?? 3, nextLinkUrl: r.nextLinkUrl ?? null },
        );
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 410) {
        setSession(null);
        setError("Bộ câu đã hết hạn — tải lại để làm bộ mới.");
      } else if (!handleBlock(e)) setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const waitLeft = session ? Math.max(0, Math.ceil((new Date(session.answerableAt).getTime() - now) / 1000)) : 0;
  const allAnswered = session ? session.questions.every((q) => answers[q.sampleId] && Object.keys(answers[q.sampleId]).length > 0) : false;

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background">
      {page?.turnstileEnabled && <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={() => setTsReady(true)} />}
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6 flex items-center gap-2 font-semibold">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Tags className="size-4" />
          </span>
          Crowd Label
        </div>
        {notFound ? (
          <Card>
            <CardHeader>
              <CardTitle>Link không tồn tại hoặc đã bị gỡ</CardTitle>
              <CardDescription>{notFound}</CardDescription>
            </CardHeader>
          </Card>
        ) : !page ? (
          <div className="flex justify-center py-20">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : failure ? (
          <FailureCard failure={failure} page={page} />
        ) : redirect ? (
          <Card className="text-center">
            <CardHeader>
              <ShieldCheck className="mx-auto size-10 text-emerald-600" />
              <CardTitle>Cảm ơn bạn!</CardTitle>
              <CardDescription>Link chỉ dùng được một lần trong 3 phút.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="lg" onClick={() => (window.location.href = redirect)}>
                <ExternalLink /> Lấy link
              </Button>
            </CardContent>
          </Card>
        ) : !session ? (
          <Card>
            <CardHeader>
              <CardTitle>Trả lời vài câu nhanh để tới link</CardTitle>
              <CardDescription>Câu trả lời của bạn giúp gán nhãn dữ liệu cho AI.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {page.requiresPassword && (
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-sm font-medium">
                    <Lock className="size-4" /> Mật khẩu của link
                  </label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              )}
              <FailWarning page={page} />
              {page.turnstileEnabled && <div ref={tsRef} />}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button size="lg" className="w-full" onClick={() => void start()} disabled={busy || token === null || (page.requiresPassword && !password)}>
                {busy && <Loader2 className="animate-spin" />} Bắt đầu
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {session.questions.length === 0 && <p className="text-center text-sm text-muted-foreground">Không có câu hỏi lúc này — chờ hết đếm ngược để lấy link.</p>}
            {session.questions.length > 0 && <FailWarning page={page} />}
            {session.labelSchema &&
              session.questions.map((q, i) => (
                <Card key={q.sampleId}>
                  <CardHeader>
                    <CardTitle className="text-base">Câu {i + 1}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Workspace
                      stacked
                      schema={session.labelSchema!}
                      modality={q.modality}
                      fileUrl={q.fileUrl}
                      content={q.content}
                      question={q.question}
                      metadata={q.metadata}
                      value={answers[q.sampleId] ?? {}}
                      onChange={(v) => setAnswers((a) => ({ ...a, [q.sampleId]: v }))}
                      seed={q.sampleId}
                    />
                  </CardContent>
                </Card>
              ))}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button size="lg" className="w-full" onClick={() => void submit()} disabled={busy || waitLeft > 0 || (session.questions.length > 0 && !allAnswered)}>
              {busy ? <Loader2 className="animate-spin" /> : waitLeft > 0 ? <Timer /> : null}
              {waitLeft > 0 ? `Chờ ${waitLeft} giây…` : "Gửi câu trả lời"}
            </Button>
          </div>
        )}
        {page && (
          <div className="mt-8 text-center">
            <ActionDialog
              trigger={
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  <Flag /> Báo cáo link vi phạm
                </Button>
              }
              title="Báo cáo link"
              fields={[{ name: "reason", label: "Lý do", type: "textarea", required: true }]}
              successMessage="Đã gửi báo cáo, cảm ơn bạn"
              onConfirm={(v) => api(`/links/r/${encodeURIComponent(code)}/report`, { method: "POST", auth: false, body: { reason: v.reason } })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/** Cảnh báo luôn hiện: trả lời sai bị tính, quá số lần thì chặn IP. */
function FailWarning({ page }: { page: GatePage }) {
  return (
    <Alert>
      <TriangleAlert />
      <AlertTitle>Đọc kỹ trước khi trả lời</AlertTitle>
      <AlertDescription>
        Trong các câu có câu kiểm tra. Trả lời chưa đạt thì link này bị khoá với bạn và bạn phải sang link khác; trượt {page.maxFailsBeforeBlock} lần thì IP của bạn bị chặn {formatDuration(page.blockSeconds)}.
      </AlertDescription>
    </Alert>
  );
}

function FailureCard({ failure, page }: { failure: Failure; page: GatePage }) {
  const [left, setLeft] = useState(5);
  const next = failure.kind === "failed" ? failure.nextLinkUrl : null;

  // Có link khác thì tự chuyển sau vài giây (vẫn có nút bấm ngay).
  useEffect(() => {
    if (!next) return;
    const h = setInterval(() => setLeft((x) => x - 1), 1000);
    return () => clearInterval(h);
  }, [next]);
  useEffect(() => {
    if (next && left <= 0) window.location.href = next;
  }, [left, next]);

  if (failure.kind === "blocked")
    return (
      <Card className="border-destructive/40">
        <CardHeader className="text-center">
          <ShieldAlert className="mx-auto size-10 text-destructive" />
          <CardTitle>IP của bạn tạm thời bị chặn</CardTitle>
          <CardDescription>
            Bạn đã trả lời chưa đạt {page.maxFailsBeforeBlock} lần.{" "}
            {failure.until ? `Thử lại sau ${new Date(failure.until).toLocaleString("vi-VN")}.` : `Thử lại sau ${formatDuration(page.blockSeconds)}.`}
          </CardDescription>
        </CardHeader>
      </Card>
    );

  if (failure.kind === "linkLocked")
    return (
      <Card className="border-amber-300">
        <CardHeader className="text-center">
          <TriangleAlert className="mx-auto size-10 text-amber-600" />
          <CardTitle>Bạn đã trả lời chưa đạt ở link này</CardTitle>
          <CardDescription>Không làm lại được link này. Hãy mở link khác.</CardDescription>
        </CardHeader>
      </Card>
    );

  const remaining = Math.max(0, failure.failLimit - failure.failCount);
  return (
    <Card className="border-amber-300">
      <CardHeader className="text-center">
        <TriangleAlert className="mx-auto size-10 text-amber-600" />
        <CardTitle>Trả lời chưa chính xác</CardTitle>
        <CardDescription>
          Bạn đã trượt {failure.failCount}/{failure.failLimit} lần. Còn {remaining} lần nữa IP của bạn bị chặn {formatDuration(page.blockSeconds)}. Link này đã khoá với bạn.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        {next ? (
          <>
            <p className="mb-3 text-sm text-muted-foreground">Hệ thống chuyển bạn sang link khác sau {Math.max(0, left)} giây…</p>
            <Button size="lg" onClick={() => (window.location.href = next)}>
              <ExternalLink /> Sang link khác ngay
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Hiện chưa có link khác để làm. Hãy mở một link khác hoặc quay lại sau.</p>
        )}
      </CardContent>
    </Card>
  );
}
