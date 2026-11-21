"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronLeft, ChevronRight, Eye, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FeedCard } from "@/components/feed/feed-card";
import { Workspace } from "@/components/labeling/workspace";
import { DEMO_SAMPLES } from "@/components/tutorial/demo-samples";
import { api, ApiError } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatVnd } from "@/lib/format";
import type { FeedCard as Card, FeedPreview, LabelData, LabelSchema, Project, TrialAttempt, TrialCheck, Visibility } from "@/lib/types";
import { toolsMissingQuestion } from "@/lib/types";

/** Cấu hình ĐANG SOẠN (chưa cần lưu) — thẻ chợ phản ánh ngay khi người tạo gõ. */
export type PreviewDraft = {
  name: string;
  description: string;
  visibility: Visibility;
  schema: LabelSchema;
  rewardVnd: number;
  slots: number;
  passThresholdPercent: number;
  deadline: string | null;
  allowProfessional: boolean;
  requireEntranceTest: boolean;
  sensitiveContent: boolean;
  requireVerifiedIdentity: boolean;
  ndaRequired: boolean;
  domains: string[];
  languages: string[];
  escrowVnd: number;
};

/**
 * "Xem như labeler" bằng DỮ LIỆU THẬT (Q2, kiến trúc 3.39):
 *   - Bài xem thử: mẫu thật của dự án + câu kiểm tra xen vào, đúng như bài labeler nhận (cấu hình đã lưu). Làm thử rồi
 *     "Chấm câu kiểm tra" — chấm ngay bằng cùng luật lúc nộp bài thật. Không ghi gì, không tính người làm.
 *   - Thẻ ở chợ: đúng thẻ feed labeler thấy, kèm mẫu xem trước đã chọn.
 * Chưa có mẫu / chưa có công cụ thì dùng mẫu minh hoạ theo loại dữ liệu.
 */
export function LabelerPreview({ project: p, draft: d }: { project: Project; draft: PreviewDraft }) {
  const [mo, setMo] = useState(false);
  return (
    <Sheet open={mo} onOpenChange={setMo}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" data-tour="cfg-xem-truoc">
          <Eye /> Xem như labeler
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Labeler sẽ thấy</SheetTitle>
          <SheetDescription>Bài xem thử dùng mẫu thật và cấu hình đã lưu. Làm thử không ghi gì, không tính vào người làm.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">{mo && <NoiDung p={p} d={d} />}</div>
      </SheetContent>
    </Sheet>
  );
}

function NoiDung({ p, d }: { p: Project; d: PreviewDraft }) {
  const trial = useQuery({
    queryKey: ["trial", p.id],
    queryFn: () => api<TrialAttempt>(`/projects/${p.id}/trial`),
    retry: false,
    staleTime: 60_000,
  });
  // Mẫu xem trước của thẻ chợ = mẫu hệ thống tự lấy (trial.previewSampleId — đã có link xem / nội dung trong bài xem
  // thử). Chỉ hiện khi doanh nghiệp bật và dự án (theo cấu hình đang sửa) không NDA / nhạy cảm / riêng tư.
  const choXemTruoc = p.previewEnabled && !d.ndaRequired && !d.sensitiveContent && d.visibility !== "private";
  const previews: FeedPreview[] = useMemo(() => {
    const id = trial.data?.previewSampleId;
    if (!choXemTruoc || !id) return [];
    return (trial.data?.questions ?? [])
      .filter((q) => q.sampleId === id)
      .map((q) => ({
        sampleId: q.sampleId,
        modality: q.modality,
        fileUrl: q.fileUrl,
        // Thẻ chợ thật không vẽ chữ người xem (bản xem trước dùng chung đã in chữ doanh nghiệp + domain).
        watermarkText: null,
        content: q.content,
        snippet: q.content?.text ?? null,
        question: q.question,
        metadata: q.metadata,
      }));
  }, [trial.data, choXemTruoc]);

  const phut = Math.max(1, Math.round(((trial.data?.realQuestionCount ?? p.questionCount) * 20) / 60));
  const card: Card = {
    id: p.id,
    name: d.name.trim() || "(chưa đặt tên)",
    description: d.description,
    modality: p.modality,
    rewardVnd: d.rewardVnd,
    slots: d.slots,
    questionCount: trial.data?.realQuestionCount ?? p.questionCount,
    estimatedMinutes: phut,
    deadline: d.deadline,
    toolKinds: Array.from(new Set(d.schema.tools.map((t) => t.kind))),
    domains: d.domains,
    languages: d.languages,
    requireEntranceTest: d.requireEntranceTest,
    sensitiveContent: d.sensitiveContent,
    consentRequired: d.sensitiveContent || d.ndaRequired,
    requireVerifiedIdentity: d.requireVerifiedIdentity,
    isPrivate: d.visibility === "private",
    isNew: true,
    explore: false,
    position: 0,
    reasons: ["moi"],
    liked: false,
    tools: d.schema.tools.map((t) => ({ name: t.name, kind: t.kind, question: t.question?.trim() || null, classes: t.classes ?? [] })),
    previews,
  };
  const thieuCauHoi = toolsMissingQuestion(d.schema);

  return (
    <Tabs defaultValue="bai">
      <TabsList>
        <TabsTrigger value="bai">Bài xem thử</TabsTrigger>
        <TabsTrigger value="cho">Thẻ ở chợ dự án</TabsTrigger>
      </TabsList>
      <TabsContent value="bai" className="mt-3 space-y-3">
        {thieuCauHoi.length > 0 && (
          <Alert variant="destructive">
            <AlertDescription>
              Còn {thieuCauHoi.length} công cụ chưa có câu hỏi — labeler sẽ không biết dùng công cụ đó để trả lời gì. Dự án chưa publish được cho tới khi đặt đủ.
            </AlertDescription>
          </Alert>
        )}
        {trial.isLoading && <p className="text-sm text-muted-foreground">Đang dựng bài xem thử…</p>}
        {trial.data ? <BaiXemThu p={p} t={trial.data} /> : trial.isError && <MauMinhHoa p={p} d={d} loi={trial.error} />}
      </TabsContent>
      <TabsContent value="cho" className="mt-3 space-y-3">
        {d.visibility === "private" && (
          <Alert>
            <AlertDescription>Dự án riêng tư không hiện ở chợ — chỉ người được mời / có mã mời thấy thẻ này.</AlertDescription>
          </Alert>
        )}
        {!d.allowProfessional && (
          <Alert>
            <AlertDescription>Chưa bật kênh chuyên nghiệp — dự án không hiện ở chợ dự án.</AlertDescription>
          </Alert>
        )}
        {/* Đúng một màn của feed: khung hẹp ~ điện thoại, khung rộng ~ máy tính. */}
        <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Trên điện thoại</p>
            <div className="h-[40rem] rounded-[2rem] border-8 border-zinc-900 bg-background p-2 dark:border-zinc-700">
              <FeedCard p={card} requestId={null} sessionId={null} preview onNotInterested={() => undefined} />
            </div>
          </div>
          <div className="hidden space-y-1 lg:block">
            <p className="text-xs font-medium text-muted-foreground">Trên máy tính</p>
            <div className="h-[40rem] rounded-xl border bg-background p-3">
              <FeedCard p={card} requestId={null} sessionId={null} preview onNotInterested={() => undefined} />
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Labeler chỉ thấy số suất, tiền thưởng, hạn chót và thời gian ước tính — không thấy có bao nhiêu người đang làm.
          {previews.length === 0 && " Thẻ chưa có mẫu xem trước — bật “Cho labeler xem trước 1 mẫu” ở thẻ Bảo vệ nội dung & NDA (không áp dụng cho dự án NDA / nhạy cảm / riêng tư), hoặc nạp mẫu cho dự án."}
        </p>
        <p className="text-xs text-muted-foreground">Ký quỹ giữ lúc publish (labeler không thấy): {formatVnd(d.escrowVnd)}.</p>
      </TabsContent>
    </Tabs>
  );
}

function BaiXemThu({ p, t }: { p: Project; t: TrialAttempt }) {
  const [i, setI] = useState(0);
  const [traLoi, setTraLoi] = useState<Record<string, LabelData>>({});
  const [kq, setKq] = useState<TrialCheck | null>(null);
  const [dangCham, setDangCham] = useState(false);
  const q = t.questions[i];
  if (!q) return null;

  const cham = async () => {
    setDangCham(true);
    try {
      const body = { answers: t.questions.map((x) => ({ sampleId: x.sampleId, data: traLoi[x.sampleId] ?? null })) };
      setKq(await api<TrialCheck>(`/projects/${p.id}/trial/check`, { method: "POST", body }));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setDangCham(false);
    }
  };
  const ketQuaCau = kq?.gold.find((g) => g.sampleId === q.sampleId);
  const saiDinhDang = kq?.invalidAnswers.find((x) => x.sampleId === q.sampleId);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Bài thật có {t.realQuestionCount} câu; bản xem thử lấy {t.questionCount} câu (có câu kiểm tra xen vào như bài thật — labeler không biết câu nào). Đầu
        trang làm bài: “Thưởng {formatVnd(t.rewardVnd)} nếu đạt · giống đa số ≥ {t.passThresholdPercent}% và không sai câu kiểm tra”.
      </p>
      <div className="flex items-center justify-between text-sm">
        <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => setI(i - 1)}>
          <ChevronLeft /> Câu trước
        </Button>
        <span className="text-muted-foreground">
          Câu {i + 1}/{t.questions.length}
        </span>
        <Button size="sm" variant="ghost" disabled={i >= t.questions.length - 1} onClick={() => setI(i + 1)}>
          Câu sau <ChevronRight />
        </Button>
      </div>
      <div className="rounded-lg border border-dashed p-3">
        <Workspace
          key={q.sampleId}
          schema={t.labelSchema}
          modality={q.modality}
          fileUrl={q.fileUrl}
          watermarkText={q.watermarkText}
          content={q.content}
          question={q.question}
          metadata={q.metadata}
          value={traLoi[q.sampleId] ?? {}}
          onChange={(v) => setTraLoi((s) => ({ ...s, [q.sampleId]: v }))}
          seed={"xem-thu-" + q.sampleId}
          stacked
        />
      </div>
      {ketQuaCau && (
        <Alert variant={ketQuaCau.correct ? "default" : "destructive"}>
          <AlertDescription className="flex items-center gap-2">
            {ketQuaCau.correct ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
            Câu kiểm tra: {ketQuaCau.correct ? "trả lời đúng." : ketQuaCau.answered ? "trả lời sai — đáp án bạn đặt khác." : "bỏ trống (tính là sai)."}
          </AlertDescription>
        </Alert>
      )}
      {saiDinhDang && (
        <Alert variant="destructive">
          <AlertDescription>Câu này sai định dạng: {saiDinhDang.message}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => void cham()} disabled={dangCham}>
          Chấm câu kiểm tra
        </Button>
        {kq && (
          <span className="text-sm">
            {kq.goldTotal === 0
              ? "Bài xem thử không có câu kiểm tra — thêm ở tab Câu vàng."
              : `Đúng ${kq.goldCorrect}/${kq.goldTotal} câu kiểm tra · ${kq.wouldFailGold ? "bài thật sẽ TRƯỢT" : "không trượt vì câu kiểm tra"}`}
          </span>
        )}
      </div>
    </div>
  );
}

/** Chưa có mẫu / chưa lưu tập nhãn: một câu minh hoạ theo loại dữ liệu (gán thử được). */
function MauMinhHoa({ p, d, loi }: { p: Project; d: PreviewDraft; loi: unknown }) {
  const [value, setValue] = useState<LabelData>({});
  const demo = DEMO_SAMPLES[p.modality];
  const ma = loi instanceof ApiError ? loi.code : "";
  return (
    <>
      <Alert>
        <AlertDescription>
          {ma === "chua_co_mau"
            ? "Chưa có mẫu nào — bên dưới là mẫu minh hoạ. Nạp mẫu ở tab Dữ liệu để xem bài bằng dữ liệu thật."
            : ma === "chua_co_tap_nhan"
              ? "Lưu thẻ “Công cụ gán nhãn” trước để xem bài bằng dữ liệu thật. Bên dưới là mẫu minh hoạ."
              : "Chưa dựng được bài xem thử — bên dưới là mẫu minh hoạ."}
        </AlertDescription>
      </Alert>
      {d.schema.tools.length === 0 ? (
        <p className="text-sm text-muted-foreground">Thêm ít nhất một công cụ ở thẻ “Công cụ gán nhãn” để xem trước.</p>
      ) : (
        <div className="rounded-lg border border-dashed p-3">
          <Workspace
            schema={d.schema}
            modality={p.modality}
            fileUrl={demo.fileUrl}
            content={demo.content}
            question={null}
            metadata={demo.metadata}
            value={value}
            onChange={setValue}
            seed="xem-truoc"
            stacked
          />
        </div>
      )}
    </>
  );
}
