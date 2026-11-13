"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, CircleHelp, Clock, CloudDownload, FileArchive, FileUp, Loader2, Pencil, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ImageThumb, ImageViewer } from "@/components/common/image-viewer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Field } from "@/components/common/misc";
import { StatusBadge } from "@/components/common/status-badge";
import { Pager } from "@/components/common/pager";
import { QueryState } from "@/components/common/states";
import { ActionDialog } from "@/components/common/action-dialog";
import { api, del, post, put, uploadForm, uploadToSignedUrl } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatBytes } from "@/lib/format";
import { ingestState, type Tone } from "@/lib/labels";
import type { IngestResult, IngestStatus, Paged, Project, Sample } from "@/lib/types";
import { useUrlPage } from "@/lib/use-url-state";
import { ManualRows } from "./manual-rows";

const ACCEPT: Record<string, string> = {
  image: ".jpg,.jpeg,.png,.webp",
  audio: ".wav,.mp3,.m4a,.ogg,.flac,.aac",
  video: ".mp4,.mov,.webm,.mkv",
};

/** "question" (tuỳ chọn, mọi loại) = câu hỏi riêng của mẫu; bỏ trống thì labeler thấy câu hỏi chung của dự án. */
const ROW_HINT: Record<string, string> = {
  text: '{"text": "Nội dung văn bản", "question": "Câu hỏi riêng (tuỳ chọn)", "name": "tuỳ chọn"}',
  pair: '{"a": "Câu trả lời A", "b": "Câu trả lời B", "question": "Câu hỏi riêng (tuỳ chọn)"}',
  list: '{"items": ["mục 1", "mục 2", "mục 3"], "question": "Câu hỏi riêng (tuỳ chọn)"}',
};

/** Số mẫu mỗi lần đăng ký / mỗi lần gửi dòng JSON (khớp dataset.manifest_inline_max_rows mặc định 1.000, file tối đa 100/lần xin link). */
const FILES_PER_BATCH = 100;
const ROWS_PER_REQUEST = 1000;
const PARALLEL_UPLOADS = 3;

/**
 * Các chặng của MỘT file, theo đúng thứ tự người dùng thấy:
 *   uploading (đẩy lên kho, có %) → registering (đang đăng ký) → queued (đã upload, xếp hàng chờ xử lý)
 *   → processing (đang xử lý file: tải / đọc / đo thông tin) → preparing (video: chuẩn bị bản xem) → done (đã xử lý)
 * hoặc failed ở bất kỳ chặng nào (kèm lý do).
 */
type Stage = "uploading" | "registering" | "queued" | "processing" | "preparing" | "done" | "failed";

type Row = {
  uid: string;
  name: string;
  size: number | null;
  stage: Stage;
  /** 0..1 — chỉ có nghĩa ở chặng uploading. */
  progress: number;
  /** Mã mẫu trên server sau khi đăng ký — để theo dõi tiếp bằng GET samples?ids=. */
  sampleId?: string;
  note?: string;
  /** Nạp từ nguồn ngoài: chặng "xếp hàng" là chờ tải về chứ không phải chờ sau upload. */
  external?: boolean;
};

const STAGE_TONE: Record<Stage, Tone> = {
  uploading: "info",
  registering: "info",
  queued: "warning",
  processing: "info",
  preparing: "info",
  done: "success",
  failed: "danger",
};

function stageLabel(r: Row): string {
  switch (r.stage) {
    case "uploading":
      return `Đang upload ${Math.round(r.progress * 100)}%`;
    case "registering":
      return "Đã upload — đang đăng ký";
    case "queued":
      return r.external ? "Chờ tải về và xử lý" : "Đã upload — chờ xử lý";
    case "processing":
      return "Đang xử lý file";
    case "preparing":
      return "Đang chuẩn bị video";
    case "done":
      return "Đã xử lý";
    case "failed":
      return "Lỗi";
  }
}

const isPending = (r: Row) => r.sampleId !== undefined && (r.stage === "queued" || r.stage === "processing" || r.stage === "preparing");

function stageFromSample(s: Sample): { stage: Stage; note?: string } {
  if (s.ingestState === "failed") return { stage: "failed", note: s.ingestError ?? "Không xử lý được file." };
  if (s.ingestState === "queued") return { stage: "queued" };
  if (s.ingestState === "processing") return { stage: "processing" };
  if (s.mediaState === "failed") return { stage: "failed", note: s.mediaError ?? "Video hỏng, không chuẩn bị được bản xem." };
  if (s.mediaState === "preparing") return { stage: "preparing" };
  return { stage: "done" };
}

function reasonFor(errors: string[], index: number): string {
  return errors.find((e) => e.startsWith(`dòng ${index + 1}:`))?.replace(/^dòng \d+:\s*/, "") ?? "Bị bỏ qua (sai định dạng hoặc đã nạp trước đó).";
}

/** Chạy các việc với tối đa `limit` việc cùng lúc. */
async function runPool(jobs: (() => Promise<void>)[], limit: number) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, jobs.length) }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      await job();
    }
  });
  await Promise.all(workers);
}

export function SampleThumb({ s }: { s: Sample }) {
  if (s.modality === "image" && s.fileUrl)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={s.fileUrl} alt={s.originalName} className="h-28 w-full rounded object-cover" />;
  if (s.modality === "audio" && s.fileUrl) return <audio src={s.fileUrl} controls className="w-full" preload="none" />;
  if (s.modality === "video" && s.fileUrl) return <video src={s.fileUrl} controls className="h-28 w-full rounded bg-black" preload="none" />;
  const c = s.content;
  const text = c?.text ?? (c?.a !== undefined ? `A: ${c.a}\nB: ${c.b}` : c?.items ? c.items.map((x, i) => `${i + 1}. ${x}`).join("\n") : "");
  return <p className="line-clamp-5 h-28 overflow-hidden rounded bg-muted p-2 text-xs whitespace-pre-wrap">{text}</p>;
}

function StageIcon({ stage }: { stage: Stage }) {
  if (stage === "done") return <CheckCircle2 className="size-4 text-emerald-600" />;
  if (stage === "failed") return <AlertCircle className="size-4 text-destructive" />;
  if (stage === "queued") return <Clock className="size-4 text-amber-600" />;
  return <Loader2 className="size-4 animate-spin text-sky-600" />;
}

function UploadRow({ r }: { r: Row }) {
  return (
    <li className="space-y-1 rounded-md border px-3 py-2">
      <div className="flex items-center gap-2">
        <StageIcon stage={r.stage} />
        <span className="min-w-0 flex-1 truncate text-sm" title={r.name}>
          {r.name}
        </span>
        {r.size !== null && <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">{formatBytes(r.size)}</span>}
        <StatusBadge entry={[stageLabel(r), STAGE_TONE[r.stage]]} />
      </div>
      {r.stage === "uploading" && <Progress value={r.progress * 100} className="h-1.5" />}
      {r.note && <p className={r.stage === "failed" ? "text-xs whitespace-pre-wrap text-destructive" : "text-xs text-muted-foreground"}>{r.note}</p>}
    </li>
  );
}

/** Ô mẫu chưa vào bài được (đang chờ / đang xử lý / lỗi): không có link xem, chỉ báo trạng thái. */
/** Câu hỏi labeler thấy ở mẫu này + nút đặt câu hỏi riêng (chỉ khi dự án còn nháp). */
function SampleQuestion({ s, common, editable, onSaved, projectId }: { s: Sample; common?: string; editable: boolean; onSaved: () => void; projectId: string }) {
  const own = s.question?.trim();
  return (
    <div className="flex items-start gap-1">
      <CircleHelp className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
      <p className={`line-clamp-2 min-w-0 flex-1 text-[11px] leading-4 ${own ? "" : "italic text-muted-foreground"}`} title={own || common || undefined}>
        {own || common || "Chưa có câu hỏi chung"}
      </p>
      {editable && (
        <ActionDialog
          trigger={
            <button type="button" className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Đặt câu hỏi riêng cho mẫu">
              <Pencil className="size-3" />
            </button>
          }
          title="Câu hỏi riêng của mẫu"
          description={common ? `Bỏ trống để dùng câu hỏi chung: “${common}”.` : "Bỏ trống để dùng câu hỏi chung của dự án."}
          fields={[{ name: "question", label: "Câu hỏi", type: "textarea", defaultValue: s.question ?? "", placeholder: common || "vd: Có bao nhiêu người trong ảnh?" }]}
          confirmLabel="Lưu"
          successMessage="Đã lưu câu hỏi"
          onConfirm={async (v) => {
            await put(`/projects/${projectId}/samples/${s.id}/question`, { question: String(v.question ?? "").trim() || null });
            onSaved();
          }}
        />
      )}
    </div>
  );
}

export function PendingTile({ s }: { s: Sample }) {
  const entry = ingestState(s.ingestState);
  return (
    <div className="flex h-28 flex-col items-center justify-center gap-2 rounded bg-muted p-2 text-center">
      {s.ingestState === "failed" ? <AlertCircle className="size-5 text-destructive" /> : s.ingestState === "queued" ? <Clock className="size-5 text-amber-600" /> : <Loader2 className="size-5 animate-spin text-sky-600" />}
      <StatusBadge entry={entry} />
      {s.ingestError && (
        <p className="line-clamp-2 text-[10px] text-destructive" title={s.ingestError}>
          {s.ingestError}
        </p>
      )}
    </div>
  );
}

export function DataTab({ project: p }: { project: Project }) {
  const qc = useQueryClient();
  const [viewer, setViewer] = useState<number | null>(null);
  const draft = p.status === "draft";

  const status = useQuery({
    queryKey: ["sample-status", p.id],
    queryFn: () => api<IngestStatus>(`/projects/${p.id}/samples/status`),
    // Còn file đang chờ / đang xử lý (kể cả nhập từ nguồn ngoài, mở lại trang) thì tự cập nhật.
    refetchInterval: (q) => {
      const d = q.state.data;
      return d && (d.queued + d.processing > 0 || d.preparingVideo > 0) ? 2000 : false;
    },
  });
  const [page, setPage] = useUrlPage();
  const samples = useQuery({
    queryKey: ["samples", p.id, page],
    queryFn: () => api<Paged<Sample>>(`/projects/${p.id}/samples`, { query: { page, pageSize: 24 } }),
    refetchInterval: (q) => ((q.state.data?.items ?? []).some((x) => x.ingestState === "queued" || x.ingestState === "processing" || x.mediaState === "preparing") ? 3000 : false),
  });

  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [textResult, setTextResult] = useState<IngestResult | null>(null);
  const [text, setText] = useState("");
  const [urls, setUrls] = useState("");
  const [drive, setDrive] = useState("");
  const [s3, setS3] = useState({ endpoint: "", region: "ap-southeast-1", bucket: "", prefix: "", accessKey: "", secretKey: "" });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["sample-status", p.id] });
    void qc.invalidateQueries({ queryKey: ["samples", p.id] });
    void qc.invalidateQueries({ queryKey: ["readiness", p.id] });
  };

  const patch = (uid: string, fields: Partial<Row>) => setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...fields } : r)));

  // Theo dõi từng file đã đăng ký: hỏi server tiến trình nạp của đúng các mẫu đó cho tới khi xong.
  const rowsRef = useRef<Row[]>([]);
  useEffect(() => {
    rowsRef.current = rows;
  });
  const hasPending = rows.some(isPending);
  useEffect(() => {
    if (!hasPending) return;
    let stopped = false;
    const poll = async () => {
      const ids = rowsRef.current.filter(isPending).map((r) => r.sampleId!);
      if (ids.length === 0) return;
      try {
        const found = new Map<string, Sample>();
        for (let i = 0; i < ids.length; i += 100) {
          const res = await api<Paged<Sample>>(`/projects/${p.id}/samples`, { query: { ids: ids.slice(i, i + 100).join(",") } });
          for (const s of res.items) found.set(s.id, s);
        }
        if (stopped) return;
        setRows((prev) =>
          prev.map((r) => {
            const s = r.sampleId ? found.get(r.sampleId) : undefined;
            return s && isPending(r) ? { ...r, ...stageFromSample(s) } : r;
          }),
        );
        void qc.invalidateQueries({ queryKey: ["sample-status", p.id] });
        void qc.invalidateQueries({ queryKey: ["samples", p.id] });
        void qc.invalidateQueries({ queryKey: ["readiness", p.id] });
      } catch {
        // Mạng chập chờn: lần hỏi sau sẽ thử lại.
      }
    };
    const timer = setInterval(() => void poll(), 1500);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [hasPending, p.id, qc]);

  /** Mẫu server đã nhận → từng dòng chuyển sang theo dõi bằng mã mẫu; dòng bị bỏ qua báo lỗi kèm lý do. */
  function applyAccepted(sent: Row[], res: IngestResult) {
    const byIndex = new Map(res.accepted.map((a) => [a.index, a.sampleId]));
    sent.forEach((row, idx) => {
      const sampleId = byIndex.get(idx);
      if (sampleId) patch(row.uid, { stage: "queued", sampleId, progress: 1 });
      else patch(row.uid, { stage: "failed", note: reasonFor(res.errors, idx) });
    });
  }

  async function uploadFiles(files: File[]) {
    const mine: Row[] = files.map((f) => ({ uid: crypto.randomUUID(), name: f.name, size: f.size, stage: "uploading", progress: 0 }));
    setRows((prev) => [...mine, ...prev]);
    setBusy(true);
    try {
      for (let i = 0; i < files.length; i += FILES_PER_BATCH) {
        const chunk = files.slice(i, i + FILES_PER_BATCH);
        const chunkRows = mine.slice(i, i + FILES_PER_BATCH);
        let slots: { name: string; key: string; uploadUrl: string }[];
        try {
          slots = await post<{ name: string; key: string; uploadUrl: string }[]>(`/projects/${p.id}/uploads`, { files: chunk.map((f) => ({ name: f.name, sizeBytes: f.size })) });
        } catch (e) {
          chunkRows.forEach((r) => patch(r.uid, { stage: "failed", note: errorMessage(e) }));
          continue;
        }

        const keys: (string | null)[] = chunk.map(() => null);
        await runPool(
          chunk.map((f, k) => async () => {
            try {
              await uploadToSignedUrl(slots[k].uploadUrl, f, (fraction) => patch(chunkRows[k].uid, { progress: fraction }));
              keys[k] = slots[k].key;
            } catch (e) {
              patch(chunkRows[k].uid, { stage: "failed", note: errorMessage(e) });
            }
          }),
          PARALLEL_UPLOADS,
        );

        const sent = chunkRows.filter((_, k) => keys[k] !== null);
        if (sent.length === 0) continue;
        sent.forEach((r) => patch(r.uid, { stage: "registering", progress: 1 }));
        try {
          const res = await post<IngestResult>(`/projects/${p.id}/samples`, {
            rows: chunkRows.flatMap((r, k) => (keys[k] !== null ? [{ file: keys[k], name: r.name }] : [])),
          });
          applyAccepted(sent, res);
        } catch (e) {
          sent.forEach((r) => patch(r.uid, { stage: "failed", note: errorMessage(e) }));
        }
      }
    } finally {
      setBusy(false);
      refresh();
    }
  }

  async function uploadZip(f: File) {
    const uid = crypto.randomUUID();
    setRows((prev) => [{ uid, name: f.name, size: f.size, stage: "uploading", progress: 0 }, ...prev]);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await uploadForm<IngestResult>(`/projects/${p.id}/samples/zip`, fd, {
        onProgress: (fraction) => patch(uid, { progress: fraction }),
        // Byte cuối đã rời trình duyệt: server đang giải nén, kiểm tra từng ảnh, bỏ ảnh trùng.
        onUploaded: () => patch(uid, { stage: "processing", progress: 1, note: "Đang giải nén và kiểm tra từng ảnh…" }),
      });
      patch(uid, { stage: "done", note: `${res.ready} ảnh hợp lệ${res.skipped > 0 ? `, bỏ qua ${res.skipped} (sai định dạng hoặc trùng nội dung)` : ""}.` });
    } catch (e) {
      patch(uid, { stage: "failed", note: errorMessage(e) });
    } finally {
      setBusy(false);
      refresh();
    }
  }

  async function importSource(body: unknown) {
    setBusy(true);
    try {
      const res = await post<IngestResult>(`/projects/${p.id}/samples/import`, body);
      setRows((prev) => [
        ...res.accepted.map<Row>((a) => ({ uid: crypto.randomUUID(), name: a.name, size: null, stage: "queued", progress: 1, sampleId: a.sampleId, external: true })),
        ...prev,
      ]);
      toast.success(`Đã nhận ${res.queued} file — hệ thống đang tải về và xử lý`);
      if (res.skipped > 0) toast.warning(`${res.skipped} file bị bỏ qua: ${res.errors.slice(0, 2).join("; ")}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
      refresh();
    }
  }

  /** Gửi các dòng (đã đúng định dạng) — chia nhiều lần nếu hơn 1.000 dòng. Trả true khi gửi xong. */
  async function postRows(parsed: unknown[]): Promise<boolean> {
    setBusy(true);
    try {
      const total: IngestResult = { received: 0, ready: 0, queued: 0, skipped: 0, errors: [], accepted: [] };
      for (let i = 0; i < parsed.length; i += ROWS_PER_REQUEST) {
        const res = await post<IngestResult>(`/projects/${p.id}/samples`, { rows: parsed.slice(i, i + ROWS_PER_REQUEST) });
        total.received += res.received;
        total.ready += res.ready;
        total.skipped += res.skipped;
        total.errors.push(...res.errors.map((e) => (i === 0 ? e : `(đợt ${i / ROWS_PER_REQUEST + 1}) ${e}`)));
      }
      setTextResult(total);
      toast.success(`Đã nạp ${total.ready} mẫu`);
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
      refresh();
    }
  }

  async function submitRows() {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    let parsed: unknown[];
    try {
      parsed = lines.map((l) => JSON.parse(l));
    } catch {
      toast.error("Mỗi dòng phải là một JSON hợp lệ");
      return;
    }
    if (await postRows(parsed)) setText("");
  }

  async function removeFailed() {
    try {
      const r = await del<{ deleted: number }>(`/projects/${p.id}/samples/failed`);
      toast.success(`Đã xoá ${r.deleted} mẫu lỗi`);
      setRows((prev) => prev.filter((x) => x.stage !== "failed" || !x.sampleId));
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  const isFile = ["image", "audio", "video"].includes(p.modality);
  const st = status.data;
  const inProgress = st ? st.queued + st.processing : 0;
  const total = st ? st.queued + st.processing + st.ready + st.failed : 0;
  const showProgress = rows.length > 0 || total > 0;

  return (
    <div className="space-y-6">
      {draft ? (
        <Card>
          <CardHeader>
            <CardTitle>Nạp dữ liệu</CardTitle>
            <CardDescription>Mỗi mẫu thành một câu trong bài của labeler khi dự án chạy. File lỗi hay trùng được báo riêng, không làm hỏng các file còn lại.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue={isFile ? "files" : "manual"}>
              <TabsList className="flex-wrap">
                {isFile && <TabsTrigger value="files">Tải file lên</TabsTrigger>}
                {p.modality === "image" && <TabsTrigger value="zip">File ZIP ảnh</TabsTrigger>}
                {!isFile && <TabsTrigger value="manual">Nhập tay</TabsTrigger>}
                {!isFile && <TabsTrigger value="rows">Dán JSONL (hàng loạt)</TabsTrigger>}
                {isFile && <TabsTrigger value="import">Nhập từ nguồn ngoài</TabsTrigger>}
              </TabsList>
              {isFile && (
                <TabsContent value="files" className="space-y-2 pt-3">
                  <p className="text-sm text-muted-foreground">Mỗi file ≤ 5 GB. Đuôi cho phép: {ACCEPT[p.modality]}. File được đẩy thẳng lên kho; sau đó hệ thống xử lý từng file (đọc, đo thông tin, loại file hỏng / trùng).</p>
                  <label className={busy ? "pointer-events-none opacity-50" : ""}>
                    <input
                      type="file"
                      multiple
                      accept={ACCEPT[p.modality]}
                      className="hidden"
                      onChange={(e) => {
                        const files = e.target.files ? Array.from(e.target.files) : [];
                        e.target.value = "";
                        if (files.length > 0) void uploadFiles(files);
                      }}
                    />
                    <span className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-4 py-6 text-sm hover:bg-muted">
                      <Upload className="size-4" /> Chọn nhiều file
                    </span>
                  </label>
                </TabsContent>
              )}
              {p.modality === "image" && (
                <TabsContent value="zip" className="space-y-2 pt-3">
                  <p className="text-sm text-muted-foreground">Chỉ nhận jpg / png / webp trong ZIP (≤ 200 MB); ảnh trùng nội dung bị bỏ. ZIP được giải nén và kiểm tra ngay khi upload xong.</p>
                  <label className={busy ? "pointer-events-none opacity-50" : ""}>
                    <input
                      type="file"
                      accept=".zip"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) void uploadZip(f);
                      }}
                    />
                    <span className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-4 py-6 text-sm hover:bg-muted">
                      {busy ? <Loader2 className="size-4 animate-spin" /> : <FileArchive className="size-4" />} Chọn file ZIP
                    </span>
                  </label>
                </TabsContent>
              )}
              {!isFile && (
                <TabsContent value="manual" className="space-y-2 pt-3">
                  <p className="text-sm text-muted-foreground">
                    Điền từng mẫu vào ô bên dưới — không cần biết JSON. Có nhiều mẫu sẵn trong file thì dùng tab “Dán JSONL”. Văn bản được nạp ngay, không phải chờ.
                  </p>
                  <ManualRows modality={p.modality} busy={busy} onSubmit={postRows} commonQuestion={p.labelSchema?.question} />
                  {textResult && (
                    <Alert variant={textResult.skipped > 0 ? "destructive" : "default"}>
                      <AlertTitle>
                        Đã nạp {textResult.ready} mẫu{textResult.skipped > 0 ? `, bỏ qua ${textResult.skipped} dòng` : ""}
                      </AlertTitle>
                      {textResult.errors.length > 0 && (
                        <AlertDescription>
                          <ul className="list-disc pl-4">
                            {textResult.errors.map((e, i) => (
                              <li key={i}>{e}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      )}
                    </Alert>
                  )}
                </TabsContent>
              )}
              {!isFile && (
                <TabsContent value="rows" className="space-y-2 pt-3">
                  <p className="text-sm text-muted-foreground">
                    Mỗi dòng một JSON: <code className="text-xs">{ROW_HINT[p.modality]}</code>. Nhiều hơn 1.000 dòng sẽ tự chia thành nhiều lần gửi. Văn bản được nạp ngay, không phải chờ.
                  </p>
                  <Textarea rows={8} className="font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder={ROW_HINT[p.modality]} />
                  <div className="flex gap-2">
                    <Button onClick={() => void submitRows()} disabled={busy || !text.trim()}>
                      {busy ? <Loader2 className="animate-spin" /> : <FileUp />} Nạp {text.split("\n").filter((l) => l.trim()).length} dòng
                    </Button>
                    <label>
                      <input type="file" accept=".jsonl,.json,.txt" className="hidden" onChange={async (e) => e.target.files?.[0] && setText(await e.target.files[0].text())} />
                      <span className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-sm hover:bg-muted">Mở file .jsonl</span>
                    </label>
                  </div>
                  {textResult && (
                    <Alert variant={textResult.skipped > 0 ? "destructive" : "default"}>
                      <AlertTitle>
                        Đã nạp {textResult.ready} mẫu{textResult.skipped > 0 ? `, bỏ qua ${textResult.skipped} dòng` : ""}
                      </AlertTitle>
                      {textResult.errors.length > 0 && (
                        <AlertDescription>
                          <ul className="list-disc pl-4">
                            {textResult.errors.map((e, i) => (
                              <li key={i}>{e}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      )}
                    </Alert>
                  )}
                </TabsContent>
              )}
              {isFile && (
                <TabsContent value="import" className="space-y-4 pt-3">
                  <Tabs defaultValue="urls">
                    <TabsList>
                      <TabsTrigger value="urls">Danh sách URL</TabsTrigger>
                      <TabsTrigger value="s3">Amazon S3</TabsTrigger>
                      <TabsTrigger value="drive">Google Drive</TabsTrigger>
                    </TabsList>
                    <TabsContent value="urls" className="space-y-2 pt-3">
                      <Textarea rows={5} value={urls} onChange={(e) => setUrls(e.target.value)} placeholder="https://.../a.jpg (mỗi dòng một URL công khai)" />
                      <Button disabled={busy || !urls.trim()} onClick={() => void importSource({ source: "urls", urls: urls.split("\n").map((u) => u.trim()).filter(Boolean) })}>
                        <CloudDownload /> Nhập
                      </Button>
                    </TabsContent>
                    <TabsContent value="s3" className="space-y-2 pt-3">
                      <div className="grid gap-2 sm:grid-cols-3">
                        {(["endpoint", "region", "bucket", "prefix", "accessKey", "secretKey"] as const).map((k) => (
                          <Field key={k} label={k}>
                            <Input type={k === "secretKey" ? "password" : "text"} value={s3[k]} onChange={(e) => setS3({ ...s3, [k]: e.target.value })} placeholder={k === "endpoint" ? "trống = AWS" : ""} />
                          </Field>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">Khoá bí mật chỉ dùng một lần để liệt kê file và ký link tải — không được lưu lại.</p>
                      <Button disabled={busy || !s3.bucket} onClick={() => void importSource({ source: "s3", s3: { ...s3, endpoint: s3.endpoint || null } })}>
                        <CloudDownload /> Nhập từ S3
                      </Button>
                    </TabsContent>
                    <TabsContent value="drive" className="space-y-2 pt-3">
                      <Textarea rows={4} value={drive} onChange={(e) => setDrive(e.target.value)} placeholder="https://drive.google.com/file/d/... (mỗi dòng một link chia sẻ công khai)" />
                      <Button disabled={busy || !drive.trim()} onClick={() => void importSource({ source: "gdrive", googleDrive: { links: drive.split("\n").map((u) => u.trim()).filter(Boolean) } })}>
                        <CloudDownload /> Nhập từ Drive
                      </Button>
                    </TabsContent>
                  </Tabs>
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">Dự án đã publish — không nạp thêm dữ liệu được.</p>
      )}

      {showProgress && (
        <Card>
          <CardHeader>
            <CardTitle>Tiến trình xử lý</CardTitle>
            <CardDescription>
              Mỗi file đi qua: đang upload → đã upload, chờ xử lý → đang xử lý file → đã xử lý. Chỉ file đã xử lý mới thành câu hỏi trong bài.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {total > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <StatusBadge entry={["Chờ xử lý " + (st?.queued ?? 0), "warning"]} />
                  <StatusBadge entry={["Đang xử lý " + (st?.processing ?? 0), "info"]} />
                  <StatusBadge entry={["Đã xử lý " + (st?.ready ?? 0), "success"]} />
                  {(st?.failed ?? 0) > 0 && <StatusBadge entry={["Lỗi " + st!.failed, "danger"]} />}
                  {(st?.preparingVideo ?? 0) > 0 && <StatusBadge entry={["Video đang chuẩn bị " + st!.preparingVideo, "info"]} />}
                  {draft && (st?.failed ?? 0) > 0 && (
                    <Button variant="ghost" size="sm" className="ml-auto" onClick={() => void removeFailed()}>
                      <Trash2 /> Xoá mẫu lỗi
                    </Button>
                  )}
                </div>
                <Progress value={total === 0 ? 0 : (((st?.ready ?? 0) + (st?.failed ?? 0)) / total) * 100} />
                <p className="text-xs text-muted-foreground">
                  {inProgress > 0 ? `Còn ${inProgress} file đang xử lý — có thể rời trang, hệ thống vẫn tiếp tục.` : "Đã xử lý xong tất cả file."}
                </p>
              </div>
            )}
            {rows.length > 0 && (
              <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {rows.slice(0, 300).map((r) => (
                  <UploadRow key={r.uid} r={r} />
                ))}
                {rows.length > 300 && <li className="text-center text-xs text-muted-foreground">…và {rows.length - 300} file nữa (xem ở danh sách mẫu bên dưới).</li>}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Mẫu ({samples.data?.total ?? 0})</CardTitle>
          <CardDescription>
            Bản gốc, không có watermark. Mẫu chưa xử lý xong hoặc lỗi hiện kèm trạng thái. Mỗi mẫu hiện câu hỏi labeler sẽ thấy: câu hỏi riêng của mẫu, hoặc
            câu hỏi chung của dự án (chữ nghiêng){draft ? " — bấm biểu tượng bút để đặt câu hỏi riêng cho từng mẫu" : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QueryState query={samples} empty={(d) => d.items.length === 0}>
            {(d) => (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {d.items.map((s) => (
                    <div key={s.id} className="space-y-1 rounded-md border p-1.5">
                      {s.ingestState !== "ready" ? (
                        <PendingTile s={s} />
                      ) : s.modality === "image" && s.fileUrl ? (
                        <ImageThumb
                          src={s.fileUrl}
                          name={s.originalName}
                          className="h-28 w-full"
                          onOpen={() => setViewer(d.items.filter((x) => x.modality === "image" && x.fileUrl).findIndex((x) => x.id === s.id))}
                        />
                      ) : (
                        <SampleThumb s={s} />
                      )}
                      <p className="truncate text-xs" title={s.originalName}>
                        {s.originalName}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {s.metadata.width ? `${s.metadata.width}×${s.metadata.height}` : s.metadata.durationSec ? `${s.metadata.durationSec}s` : ""} {formatBytes(s.sizeBytes)}
                      </p>
                      <SampleQuestion s={s} common={p.labelSchema?.question} editable={draft} onSaved={() => void qc.invalidateQueries({ queryKey: ["samples", p.id] })} projectId={p.id} />
                      {s.ingestState === "ready" && s.mediaState === "preparing" && <p className="text-[10px] text-amber-600">Đang chuẩn bị video…</p>}
                      {s.ingestState === "ready" && s.mediaState === "failed" && (
                        <p className="text-[10px] text-destructive" title={s.mediaError ?? undefined}>
                          Video hỏng, không xử lý được
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <ImageViewer
                  images={d.items.filter((x) => x.modality === "image" && x.fileUrl).map((x) => ({ src: x.fileUrl!, name: x.originalName }))}
                  index={viewer}
                  onIndexChange={setViewer}
                />
                <Pager page={d.page} pageSize={d.pageSize} total={d.total} onChange={setPage} />
              </>
            )}
          </QueryState>
        </CardContent>
      </Card>
    </div>
  );
}
