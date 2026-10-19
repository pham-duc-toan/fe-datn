"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { ExternalLink, Flag, Loader2, Lock, ShieldCheck, Tags, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ActionDialog } from "@/components/common/action-dialog";
import { Workspace } from "@/components/labeling/workspace";
import { buildPayload } from "@/components/labeling/schema";
import { api, ApiError } from "@/lib/api";
import { API_URL } from "@/lib/config";
import { errorMessage } from "@/lib/errors";
import type { LabelData, LabelSchema, Modality, SampleContent, SampleMeta } from "@/lib/types";

type GatePage = { code: string; requiresPassword: boolean; countdownSeconds: number; turnstileEnabled: boolean; turnstileSiteKey: string };
type Session = {
  sessionId: string;
  answerableAt: string;
  expiresAt: string;
  labelSchema: LabelSchema | null;
  questions: { sampleId: string; modality: Modality; fileUrl: string | null; content: SampleContent | null; metadata: SampleMeta }[];
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
  const [tsReady, setTsReady] = useState(false);
  const tsRef = useRef<HTMLDivElement>(null);
  const tsWidget = useRef<string | null>(null);

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
            setError(errorMessage(e));
          }
        }
      })
      .catch((e) => setNotFound(errorMessage(e)));
  }, [code]);

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
      setError(errorMessage(e));
      if (e instanceof ApiError && e.code === "turnstile_that_bai") {
        setToken(null);
        window.turnstile?.reset(tsWidget.current ?? undefined);
      }
    } finally {
      setBusy(false);
    }
  }, [code, token, password]);

  async function submit() {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, LabelData> = {};
      if (session.labelSchema) for (const q of session.questions) body[q.sampleId] = buildPayload(session.labelSchema, answers[q.sampleId] ?? {});
      const r = await api<{ passed: boolean; redirectUrl: string | null; newSession: Session | null }>(`/g/sessions/${session.sessionId}/submit`, { method: "POST", auth: false, body: { answers: body } });
      if (r.passed && r.redirectUrl) setRedirect(r.redirectUrl.startsWith("http") ? r.redirectUrl : API_URL + r.redirectUrl);
      else if (r.newSession) {
        toast.error("Trả lời chưa chính xác, thử lại với bộ câu mới.");
        setSession(r.newSession);
        setAnswers({});
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 410) {
        setSession(null);
        setError("Bộ câu đã hết hạn — tải lại để làm bộ mới.");
      } else setError(errorMessage(e));
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
