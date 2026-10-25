"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CloudDownload, FileArchive, FileUp, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ImageThumb, ImageViewer } from "@/components/common/image-viewer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field } from "@/components/common/misc";
import { StatusBadge } from "@/components/common/status-badge";
import { Pager } from "@/components/common/pager";
import { QueryState } from "@/components/common/states";
import { api, post } from "@/lib/api";
import { autoBatchName } from "@/lib/tool-names";
import { uploadToSignedUrl } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatBytes, formatDateTime } from "@/lib/format";
import { datasetStatus } from "@/lib/labels";
import type { Dataset, Paged, Project, Sample } from "@/lib/types";
import { useUrlPage } from "@/lib/use-url-state";

const ACCEPT: Record<string, string> = {
  image: ".jpg,.jpeg,.png,.webp",
  audio: ".wav,.mp3,.m4a,.ogg,.flac,.aac",
  video: ".mp4,.mov,.webm,.mkv",
};

const ROW_HINT: Record<string, string> = {
  text: '{"text": "Nội dung văn bản", "name": "tuỳ chọn"}',
  pair: '{"prompt": "Câu hỏi (tuỳ chọn)", "a": "Câu trả lời A", "b": "Câu trả lời B"}',
  list: '{"prompt": "Câu hỏi (tuỳ chọn)", "items": ["mục 1", "mục 2", "mục 3"]}',
};

export function SampleThumb({ s }: { s: Sample }) {
  if (s.modality === "image" && s.fileUrl)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={s.fileUrl} alt={s.originalName} className="h-28 w-full rounded object-cover" />;
  if (s.modality === "audio" && s.fileUrl) return <audio src={s.fileUrl} controls className="w-full" preload="none" />;
  if (s.modality === "video" && s.fileUrl) return <video src={s.fileUrl} controls className="h-28 w-full rounded bg-black" preload="none" />;
  const c = s.content;
  const text = c?.text ?? (c?.a !== undefined ? `A: ${c.a}\nB: ${c.b}` : c?.items ? c.items.map((x, i) => `${i + 1}. ${x}`).join("\n") : "");
  return <p className="line-clamp-5 h-28 overflow-hidden rounded bg-muted p-2 text-xs whitespace-pre-wrap">{c?.prompt ? `${c.prompt}\n` : ""}{text}</p>;
}

export function DataTab({ project: p }: { project: Project }) {
  const qc = useQueryClient();
  const [viewer, setViewer] = useState<number | null>(null);
  const draft = p.status === "draft";
  const datasets = useQuery({
    queryKey: ["datasets", p.id],
    queryFn: () => api<Dataset[]>(`/projects/${p.id}/datasets`),
    refetchInterval: (q) => ((q.state.data ?? []).some((d) => d.status === "pending" || d.status === "ingesting") ? 2000 : false),
  });
  const [page, setPage] = useUrlPage();
  const samples = useQuery({
    queryKey: ["samples", p.id, page],
    queryFn: () => api<Paged<Sample>>(`/projects/${p.id}/samples`, { query: { page, pageSize: 24 } }),
    refetchInterval: (q) => ((q.state.data?.items ?? []).some((x) => x.mediaState === "preparing") ? 5000 : false),
  });
  // Tên lô tự sinh = tên dự án + ngày giờ nạp — doanh nghiệp không phải đặt.
  const name = autoBatchName(p.name);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [rows, setRows] = useState("");
  const [urls, setUrls] = useState("");
  const [drive, setDrive] = useState("");
  const [s3, setS3] = useState({ endpoint: "", region: "ap-southeast-1", bucket: "", prefix: "", accessKey: "", secretKey: "" });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["datasets", p.id] });
    void qc.invalidateQueries({ queryKey: ["samples", p.id] });
    void qc.invalidateQueries({ queryKey: ["readiness", p.id] });
  };

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function uploadZip(f: File) {
    const fd = new FormData();
    fd.append("name", name);
    fd.append("file", f);
    await run(() => api(`/projects/${p.id}/datasets`, { method: "POST", body: fd }), "Đã nạp ZIP");
  }

  async function uploadFiles(files: File[]) {
    await run(async () => {
      const total = files.length;
      setProgress({ done: 0, total });
      const keys: { file: string; name: string }[] = [];
      for (let i = 0; i < files.length; i += 100) {
        const chunk = files.slice(i, i + 100);
        const slots = await post<{ name: string; key: string; uploadUrl: string }[]>(`/projects/${p.id}/uploads`, { files: chunk.map((f) => ({ name: f.name, sizeBytes: f.size })) });
        for (let k = 0; k < chunk.length; k++) {
          await uploadToSignedUrl(slots[k].uploadUrl, chunk[k]);
          keys.push({ file: slots[k].key, name: chunk[k].name });
          setProgress({ done: keys.length, total });
        }
      }
      for (let i = 0; i < keys.length; i += 1000) {
        await post(`/projects/${p.id}/datasets/manifest`, { name: keys.length > 1000 ? `${name}-${i / 1000 + 1}` : name, rows: keys.slice(i, i + 1000) });
      }
    }, "Đã tải lên — đang nạp mẫu");
  }

  async function submitRows() {
    const lines = rows.split("\n").map((l) => l.trim()).filter(Boolean);
    let parsed: unknown[];
    try {
      parsed = lines.map((l) => JSON.parse(l));
    } catch {
      toast.error("Mỗi dòng phải là một JSON hợp lệ");
      return;
    }
    if (parsed.length > 1000) {
      // Nhiều hơn 1.000 dòng: ghép thành file .jsonl rồi gửi manifestKey (mục 4.6).
      const blob = new Blob([lines.join("\n")], { type: "application/json" });
      await run(async () => {
        const [slot] = await post<{ key: string; uploadUrl: string }[]>(`/projects/${p.id}/uploads`, { files: [{ name: "manifest.jsonl", sizeBytes: blob.size }] });
        await uploadToSignedUrl(slot.uploadUrl, blob);
        await post(`/projects/${p.id}/datasets/manifest`, { name, manifestKey: slot.key });
      }, "Đã gửi manifest");
    } else await run(() => post(`/projects/${p.id}/datasets/manifest`, { name, rows: parsed }), "Đã gửi dữ liệu");
    setRows("");
  }

  const isFile = ["image", "audio", "video"].includes(p.modality);

  return (
    <div className="space-y-6">
      {draft ? (
        <Card>
          <CardHeader>
            <CardTitle>Nạp dữ liệu</CardTitle>
            <CardDescription>Mỗi mẫu thành một câu trong bài của labeler khi dự án chạy. Dòng sai bị bỏ qua, không làm hỏng cả lô.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue={isFile ? "files" : "rows"}>
              <TabsList className="flex-wrap">
                {isFile && <TabsTrigger value="files">Tải file lên</TabsTrigger>}
                {p.modality === "image" && <TabsTrigger value="zip">File ZIP ảnh</TabsTrigger>}
                {!isFile && <TabsTrigger value="rows">Dán JSONL</TabsTrigger>}
                {isFile && <TabsTrigger value="import">Nhập từ nguồn ngoài</TabsTrigger>}
              </TabsList>
              {isFile && (
                <TabsContent value="files" className="space-y-2 pt-3">
                  <p className="text-sm text-muted-foreground">Trình duyệt đẩy thẳng lên kho file (không qua backend), mỗi file ≤ 5 GB. Đuôi cho phép: {ACCEPT[p.modality]}</p>
                  <label className={busy ? "pointer-events-none opacity-50" : ""}>
                    <input type="file" multiple accept={ACCEPT[p.modality]} className="hidden" onChange={(e) => e.target.files && void uploadFiles(Array.from(e.target.files))} />
                    <span className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-4 py-6 text-sm hover:bg-muted">
                      <Upload className="size-4" /> Chọn nhiều file
                    </span>
                  </label>
                  {progress && (
                    <div className="max-w-md space-y-1">
                      <Progress value={(progress.done / progress.total) * 100} />
                      <p className="text-xs text-muted-foreground">
                        {progress.done}/{progress.total} file
                      </p>
                    </div>
                  )}
                </TabsContent>
              )}
              {p.modality === "image" && (
                <TabsContent value="zip" className="space-y-2 pt-3">
                  <p className="text-sm text-muted-foreground">Chỉ nhận jpg / png / webp trong ZIP (≤ 200 MB); ảnh trùng nội dung bị bỏ.</p>
                  <label className={busy ? "pointer-events-none opacity-50" : ""}>
                    <input type="file" accept=".zip" className="hidden" onChange={(e) => e.target.files?.[0] && void uploadZip(e.target.files[0])} />
                    <span className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-4 py-6 text-sm hover:bg-muted">
                      {busy ? <Loader2 className="size-4 animate-spin" /> : <FileArchive className="size-4" />} Chọn file ZIP
                    </span>
                  </label>
                </TabsContent>
              )}
              {!isFile && (
                <TabsContent value="rows" className="space-y-2 pt-3">
                  <p className="text-sm text-muted-foreground">
                    Mỗi dòng một JSON: <code className="text-xs">{ROW_HINT[p.modality]}</code>. Hơn 1.000 dòng sẽ tự ghép thành file .jsonl.
                  </p>
                  <Textarea rows={8} className="font-mono text-xs" value={rows} onChange={(e) => setRows(e.target.value)} placeholder={ROW_HINT[p.modality]} />
                  <div className="flex gap-2">
                    <Button onClick={() => void submitRows()} disabled={busy || !rows.trim()}>
                      {busy ? <Loader2 className="animate-spin" /> : <FileUp />} Nạp {rows.split("\n").filter((l) => l.trim()).length} dòng
                    </Button>
                    <label>
                      <input type="file" accept=".jsonl,.json,.txt" className="hidden" onChange={async (e) => e.target.files?.[0] && setRows(await e.target.files[0].text())} />
                      <span className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-sm hover:bg-muted">Mở file .jsonl</span>
                    </label>
                  </div>
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
                      <Button disabled={busy || !urls.trim()} onClick={() => void run(() => post(`/projects/${p.id}/datasets/import`, { name, source: "urls", urls: urls.split("\n").map((u) => u.trim()).filter(Boolean) }), "Đã gửi lệnh nhập")}>
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
                      <p className="text-xs text-muted-foreground">Khoá bí mật chỉ lưu dạng mã hoá tới khi nhập xong rồi xoá.</p>
                      <Button disabled={busy || !s3.bucket} onClick={() => void run(() => post(`/projects/${p.id}/datasets/import`, { name, source: "s3", s3: { ...s3, endpoint: s3.endpoint || null } }), "Đã gửi lệnh nhập")}>
                        <CloudDownload /> Nhập từ S3
                      </Button>
                    </TabsContent>
                    <TabsContent value="drive" className="space-y-2 pt-3">
                      <Textarea rows={4} value={drive} onChange={(e) => setDrive(e.target.value)} placeholder="https://drive.google.com/file/d/... (mỗi dòng một link chia sẻ công khai)" />
                      <Button disabled={busy || !drive.trim()} onClick={() => void run(() => post(`/projects/${p.id}/datasets/import`, { name, source: "googleDrive", googleDrive: { links: drive.split("\n").map((u) => u.trim()).filter(Boolean) } }), "Đã gửi lệnh nhập")}>
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

      <Card>
        <CardHeader>
          <CardTitle>Các lô dữ liệu</CardTitle>
        </CardHeader>
        <CardContent>
          <QueryState query={datasets} empty={(d) => d.length === 0}>
            {(d) => (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="text-right">Mẫu</TableHead>
                    <TableHead className="text-right">Bỏ qua</TableHead>
                    <TableHead>Tạo lúc</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.map((ds) => (
                    <TableRow key={ds.id}>
                      <TableCell>
                        <div className="font-medium">{ds.name}</div>
                        {ds.errorSummary && <div className="max-w-md text-xs whitespace-pre-wrap text-destructive">{ds.errorSummary}</div>}
                      </TableCell>
                      <TableCell>
                        <StatusBadge entry={datasetStatus(ds.status)} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{ds.sampleCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{ds.skippedCount}</TableCell>
                      <TableCell>{formatDateTime(ds.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </QueryState>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mẫu ({samples.data?.total ?? 0})</CardTitle>
          <CardDescription>Bản gốc (chủ dự án xem không có watermark). Link xem sống 5 phút.</CardDescription>
        </CardHeader>
        <CardContent>
          <QueryState query={samples} empty={(d) => d.items.length === 0}>
            {(d) => (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {d.items.map((s) => (
                    <div key={s.id} className="space-y-1 rounded-md border p-1.5">
                      {s.modality === "image" && s.fileUrl ? (
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
                      {s.mediaState === "preparing" && <p className="text-[10px] text-amber-600">Đang chuẩn bị video…</p>}
                      {s.mediaState === "failed" && (
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
