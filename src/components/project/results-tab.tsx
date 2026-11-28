"use client";

import { Fragment, useMemo, useState, type ComponentProps } from "react";
import dynamic from "next/dynamic";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertCircle, ChevronDown, ChevronRight, Download, FileText, Loader2, Pencil, RefreshCw, Save, Search, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { buildPayload, validateLabel } from "@/components/labeling/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/common/misc";
import { QueryState } from "@/components/common/states";
import { ToneBadge } from "@/components/common/status-badge";
import { Pager } from "@/components/common/pager";
import { ImageThumb, ImageViewer } from "@/components/common/image-viewer";
import { useSamples } from "@/hooks/use-samples";
import { api, del, downloadFile, post, put } from "@/lib/api";
import { describeTool } from "@/lib/describe";
import { errorMessage } from "@/lib/errors";
import { formatBytes, formatDateTime, shortId } from "@/lib/format";
import type { ExportJob, LabelData, LabelSchema, Progress, Project, Sample, SampleContent, SampleMeta } from "@/lib/types";
import { useUrlPage } from "@/lib/use-url-state";

// Workspace dùng konva — chỉ tải khi mở chi tiết một mẫu.
const Workspace = dynamic(() => import("@/components/labeling/workspace").then((m) => m.Workspace), { ssr: false, loading: () => <Loader2 className="m-6 animate-spin text-muted-foreground" /> });

/**
 * Kết quả một công cụ. Công cụ doanh nghiệp đã sửa: method = "owner", ownerEdited = true, final = giá trị doanh nghiệp,
 * consensusFinal / consensusMethod / consensusDisputed = kết quả số đông để đối chiếu.
 */
type ToolResult = {
  kind: string;
  method: string;
  final: unknown;
  disputed: boolean;
  votes?: Record<string, number>;
  scores?: Record<string, number>;
  supports?: number[];
  agrees?: boolean[];
  ownerEdited?: boolean;
  consensusFinal?: unknown;
  consensusMethod?: string;
  consensusDisputed?: boolean;
};
type OwnerEdit = { tools: string[]; note: string | null; editedBy: string; editedAt: string; consensusChanged: boolean };
type SampleResult = {
  sampleId: string;
  storageKey: string | null;
  sampleContent: SampleContent | null;
  sampleQuestion: string | null;
  sampleMetadata?: SampleMeta | null;
  approvedCount: number;
  disputed: boolean;
  consensusStatus: string | null;
  consensusFinal?: LabelData | null;
  tools: Record<string, ToolResult>;
  labels: LabelData[];
  ownerEdit?: OwnerEdit | null;
};
type Results = { sampleCount: number; disputedCount: number; editedCount?: number; labelDistribution: Record<string, Record<string, number>>; samples: SampleResult[] };

const PAGE = 20;

function exportFormats(p: Project): { f: string; label: string }[] {
  const kinds = new Set((p.labelSchema?.tools ?? []).map((t) => t.kind));
  const out = [
    { f: "json", label: "JSON" },
    { f: "csv", label: "CSV" },
  ];
  if (p.modality === "image") {
    if (kinds.has("bbox") || kinds.has("polygon") || kinds.has("mask")) out.push({ f: "coco", label: "COCO" });
    if (kinds.has("bbox")) out.push({ f: "yolo", label: "YOLO" }, { f: "voc", label: "Pascal VOC" });
    if ((p.labelSchema?.tools ?? []).some((t) => t.kind === "bbox" && t.rotatable)) out.push({ f: "yolo-obb", label: "YOLO-OBB" });
    if (kinds.has("polygon")) out.push({ f: "yolo-seg", label: "YOLO-Seg" });
    if (kinds.has("keypoint")) out.push({ f: "coco-keypoints", label: "COCO keypoints" });
  }
  if (p.modality === "text" && kinds.has("span")) out.push({ f: "conll", label: "CoNLL (BIO)" });
  if (p.modality === "video" && kinds.has("track")) out.push({ f: "mot", label: "MOT" });
  return out;
}

const exportPending = (j: ExportJob) => j.status === "queued" || j.status === "processing";

/**
 * Tải kết quả: file tạo NỀN (POST .../exports → 202). Mỗi định dạng giữ lần tạo mới nhất; còn lần đang tạo thì tự hỏi
 * lại 2 giây/lần tới khi xong. Rời trang vẫn tiếp tục — mở lại thấy file đã sẵn sàng.
 */
function ExportCard({ p }: { p: Project }) {
  const qc = useQueryClient();
  const jobs = useQuery({
    queryKey: ["exports", p.id],
    queryFn: () => api<ExportJob[]>(`/annotations/projects/${p.id}/exports`),
    refetchInterval: (q) => ((q.state.data ?? []).some(exportPending) ? 2000 : false),
  });
  const [busy, setBusy] = useState<string | null>(null);

  const latest = new Map<string, ExportJob>();
  for (const j of jobs.data ?? []) if (!latest.has(j.format)) latest.set(j.format, j);

  async function create(format: string) {
    setBusy(format);
    try {
      await post<ExportJob>(`/annotations/projects/${p.id}/exports`, { format });
      await qc.invalidateQueries({ queryKey: ["exports", p.id] });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function download(j: ExportJob) {
    if (!j.downloadPath) return;
    setBusy(j.id);
    try {
      await downloadFile(j.downloadPath, undefined, j.fileName ?? `ket-qua-${p.id}`);
    } catch (e) {
      toast.error(errorMessage(e));
      void qc.invalidateQueries({ queryKey: ["exports", p.id] });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tải kết quả</CardTitle>
        <CardDescription>
          File cho kỹ sư / mô hình học máy: kết quả gộp đa số từ nhãn của các bài đạt, kèm những chỗ bạn đã sửa. Bấm “Tạo file” — hệ thống tạo ở chế độ nền,
          xong thì hiện nút tải về (có thể rời trang trong lúc chờ). Sửa kết quả sau khi đã tạo file thì bấm “Tạo lại” để file có giá trị mới.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y rounded-md border">
          {exportFormats(p).map(({ f, label }) => {
            const j = latest.get(f);
            const pending = j !== undefined && exportPending(j);
            return (
              <li key={f} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <span className="w-32 shrink-0 text-sm font-medium">{label}</span>
                <span className="min-w-0 flex-1 text-xs text-muted-foreground">
                  {!j && "Chưa tạo file"}
                  {pending && (
                    <span className="inline-flex items-center gap-1 text-sky-700">
                      <Loader2 className="size-3 animate-spin" /> {j!.status === "queued" ? "Đang chờ tạo file…" : "Đang tạo file…"}
                    </span>
                  )}
                  {j?.status === "ready" && (
                    <>
                      Đã tạo {j.finishedAt ? formatDateTime(j.finishedAt) : ""} · {j.sampleCount ?? 0} mẫu · {formatBytes(j.sizeBytes)}
                    </>
                  )}
                  {j?.status === "failed" && (
                    <span className="inline-flex items-start gap-1 text-destructive">
                      <AlertCircle className="mt-0.5 size-3 shrink-0" /> {j.error ?? "Không tạo được file."}
                    </span>
                  )}
                </span>
                <span className="flex gap-2">
                  {j?.status === "ready" && (
                    <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void download(j)}>
                      {busy === j.id ? <Loader2 className="animate-spin" /> : <Download />} Tải về
                    </Button>
                  )}
                  {!pending && (
                    <Button size="sm" variant={j ? "ghost" : "outline"} disabled={busy !== null} onClick={() => void create(f)} title={j ? "Tạo lại theo kết quả mới nhất" : undefined}>
                      {busy === f ? <Loader2 className="animate-spin" /> : j ? <RefreshCw /> : <FileText />} {j ? "Tạo lại" : "Tạo file"}
                    </Button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

/** Kết quả gộp của một công cụ, bằng chữ. */
function finalText(schema: LabelSchema | null, toolName: string, r: ToolResult, content: SampleContent | null): string {
  if (r.final === null || r.final === undefined) return r.method === "none" ? "Câu trả lời mở — xem từng người" : "Chưa thống nhất";
  const tool = schema?.tools.find((t) => t.name === toolName);
  return tool ? describeTool(tool, r.final, content) : "—";
}

/** Kết quả số đông của một công cụ (trước khi doanh nghiệp sửa), bằng chữ. */
function consensusText(schema: LabelSchema | null, toolName: string, r: ToolResult, content: SampleContent | null): string {
  if (!r.ownerEdited) return finalText(schema, toolName, r, content);
  return finalText(schema, toolName, { ...r, final: r.consensusFinal ?? null, method: r.consensusMethod ?? "none" }, content);
}

/** Kết quả cuối (đã gồm chỗ doanh nghiệp sửa) để vẽ lại trên workspace (công cụ không có kết quả thì bỏ). */
function finalData(s: SampleResult): LabelData {
  if (s.consensusFinal) return s.consensusFinal;
  const d: LabelData = {};
  for (const [k, r] of Object.entries(s.tools)) if (r.final !== null && r.final !== undefined) d[k] = r.final;
  return d;
}

/** Kết quả số đông, bỏ qua mọi chỗ doanh nghiệp sửa. */
function consensusData(s: SampleResult): LabelData {
  const d: LabelData = {};
  for (const [k, r] of Object.entries(s.tools)) {
    const v = r.ownerEdited ? r.consensusFinal : r.final;
    if (v !== null && v !== undefined) d[k] = v;
  }
  return d;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function ConsensusBadge({ s }: { s: SampleResult }) {
  if (s.disputed) return <ToneBadge tone="danger">Không có đa số</ToneBadge>;
  if (s.ownerEdit) return <ToneBadge tone="info">Đã chốt theo bạn</ToneBadge>;
  if (s.consensusStatus === "agreed") return <ToneBadge tone="success">Thống nhất</ToneBadge>;
  if (s.consensusStatus === "notApplicable") return <ToneBadge tone="muted">Không cần gộp</ToneBadge>;
  return <ToneBadge tone="muted">Chưa đủ nhãn</ToneBadge>;
}

/**
 * Sửa kết quả cuối của MỘT mẫu (PUT .../results/{sampleId}/override). Chỉ những công cụ bạn đã chạm vào (hoặc đã sửa
 * từ trước) được lưu thành "giá trị của bạn"; công cụ còn lại giữ kết quả số đông. Không đổi chấm bài hay tiền thưởng.
 */
function EditResult({ p, s, common, onDone }: { p: Project; s: SampleResult; common: Omit<ComponentProps<typeof Workspace>, "value">; onDone: () => void }) {
  const qc = useQueryClient();
  const schema = p.labelSchema!;
  const consensus = useMemo(() => consensusData(s), [s]);
  const [draft, setDraft] = useState<LabelData>(() => finalData(s));
  const [kept, setKept] = useState<Set<string>>(() => new Set(s.ownerEdit?.tools ?? []));
  const [note, setNote] = useState(s.ownerEdit?.note ?? "");
  const [busy, setBusy] = useState(false);

  function change(v: LabelData) {
    const next = new Set(kept);
    for (const t of schema.tools) if (!same(v[t.name], draft[t.name])) next.add(t.name);
    setKept(next);
    setDraft(v);
  }

  function revert(name: string) {
    const next = new Set(kept);
    next.delete(name);
    setKept(next);
    const d = { ...draft };
    if (consensus[name] === undefined) delete d[name];
    else d[name] = consensus[name];
    setDraft(d);
  }

  const payload = buildPayload(schema, draft);
  const data: LabelData = {};
  for (const name of kept) if (payload[name] !== undefined) data[name] = payload[name];
  const errors = validateLabel(schema, draft, common.metadata ?? {}).filter((e) => [...kept].some((n) => e.startsWith(`${n}:`)));

  async function save() {
    setBusy(true);
    try {
      if (Object.keys(data).length === 0) {
        await del(`/annotations/projects/${p.id}/results/${s.sampleId}/override`);
        toast.success("Mẫu đã trở về kết quả số đông");
      } else {
        await put(`/annotations/projects/${p.id}/results/${s.sampleId}/override`, { data, note: note.trim() || null });
        toast.success("Đã lưu kết quả của bạn");
      }
      await qc.invalidateQueries({ queryKey: ["results", p.id] });
      onDone();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function clearAll() {
    setBusy(true);
    try {
      await del(`/annotations/projects/${p.id}/results/${s.sampleId}/override`);
      toast.success("Mẫu đã trở về kết quả số đông");
      await qc.invalidateQueries({ queryKey: ["results", p.id] });
      onDone();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Alert>
        <Pencil />
        <AlertDescription>
          Sửa trực tiếp trên mẫu. Công cụ bạn sửa sẽ dùng giá trị của bạn khi tạo file kết quả; công cụ không sửa giữ kết quả số đông. Việc sửa không thay đổi
          kết quả chấm bài hay tiền thưởng của người gán nhãn.
        </AlertDescription>
      </Alert>
      <Workspace {...common} readOnly={false} value={draft} onChange={change} />
      <div className="rounded-md border bg-background">
        {schema.tools.map((t) => {
          const r = s.tools[t.name];
          const mine = kept.has(t.name);
          return (
            <div key={t.name} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-2 text-sm last:border-b-0">
              <span className="w-40 shrink-0 font-medium">{t.name}</span>
              <span className="min-w-0 flex-1 text-xs text-muted-foreground">Số đông: {r ? consensusText(schema, t.name, r, s.sampleContent) : "Chưa có"}</span>
              {mine ? <ToneBadge tone="info">Giá trị của bạn</ToneBadge> : <ToneBadge tone="muted">Theo số đông</ToneBadge>}
              {mine && (
                <Button size="xs" variant="ghost" onClick={() => revert(t.name)} disabled={busy}>
                  <Undo2 /> Về số đông
                </Button>
              )}
            </div>
          );
        })}
      </div>
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Ghi chú lý do sửa (không bắt buộc)" className="min-h-16" />
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            <ul className="list-disc pl-4">
              {errors.slice(0, 6).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void save()} disabled={busy || errors.length > 0}>
          {busy ? <Loader2 className="animate-spin" /> : <Save />} Lưu
        </Button>
        <Button variant="outline" onClick={onDone} disabled={busy}>
          Huỷ
        </Button>
        {s.ownerEdit && (
          <Button variant="ghost" className="ml-auto text-destructive" onClick={() => void clearAll()} disabled={busy}>
            <Undo2 /> Bỏ toàn bộ chỗ sửa
          </Button>
        )}
      </div>
    </div>
  );
}

function SampleName({ s, info }: { s: SampleResult; info: Sample | undefined }) {
  const text = s.sampleContent?.text ?? s.sampleQuestion;
  return (
    <div className="min-w-0">
      <div className="truncate font-medium" title={info?.originalName}>
        {info?.originalName ?? `Mẫu ${shortId(s.sampleId)}`}
      </div>
      {text && <div className="line-clamp-2 text-xs text-muted-foreground">{text}</div>}
    </div>
  );
}

function Detail({ p, s, info, canEdit, onMediaError }: { p: Project; s: SampleResult; info: Sample | undefined; canEdit: boolean; onMediaError: () => void }) {
  const [editing, setEditing] = useState(false);
  const schema = p.labelSchema;
  if (!schema) return null;
  const common = {
    schema,
    modality: p.modality,
    fileUrl: info?.fileUrl ?? null,
    content: s.sampleContent ?? info?.content ?? null,
    question: s.sampleQuestion,
    metadata: s.sampleMetadata ?? info?.metadata ?? {},
    readOnly: true,
    seed: s.sampleId,
    onMediaError,
  };
  if (editing) return <div className="py-2"><EditResult p={p} s={s} common={common} onDone={() => setEditing(false)} /></div>;
  return (
    <Tabs defaultValue="gop" className="py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TabsList className="flex-wrap">
          <TabsTrigger value="gop">{s.ownerEdit ? "Kết quả cuối" : "Kết quả gộp"}</TabsTrigger>
          {s.ownerEdit && <TabsTrigger value="so-dong">Số đông</TabsTrigger>}
          {s.labels.map((_, i) => (
            <TabsTrigger key={i} value={`n${i}`}>
              Người gán {i + 1}
            </TabsTrigger>
          ))}
        </TabsList>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil /> {s.ownerEdit ? "Sửa tiếp" : "Sửa kết quả"}
          </Button>
        )}
      </div>
      {s.ownerEdit && (
        <Alert className="mt-3" variant={s.ownerEdit.consensusChanged ? "destructive" : "default"}>
          {s.ownerEdit.consensusChanged ? <AlertCircle /> : <Pencil />}
          <AlertDescription>
            {s.ownerEdit.consensusChanged
              ? "Kết quả số đông của phần bạn sửa đã thay đổi sau lần sửa (có thêm câu trả lời được chấp nhận). Nên xem lại và lưu lại."
              : `Bạn đã sửa ${s.ownerEdit.tools.join(", ")} lúc ${formatDateTime(s.ownerEdit.editedAt)}.`}
            {s.ownerEdit.note && <span className="block text-muted-foreground">Ghi chú: {s.ownerEdit.note}</span>}
          </AlertDescription>
        </Alert>
      )}
      <TabsContent value="gop" className="mt-3">
        <Workspace {...common} value={finalData(s)} />
      </TabsContent>
      {s.ownerEdit && (
        <TabsContent value="so-dong" className="mt-3">
          <Workspace {...common} value={consensusData(s)} />
        </TabsContent>
      )}
      {s.labels.map((l, i) => (
        <TabsContent key={i} value={`n${i}`} className="mt-3">
          <Workspace {...common} value={l} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

export function ResultsTab({ project: p }: { project: Project }) {
  const q = useQuery({ queryKey: ["results", p.id], queryFn: () => api<Results>(`/annotations/projects/${p.id}/results`) });
  // Sửa kết quả: chỉ chủ dự án, sau khi dự án đã chấm xong (backend kiểm lại — chua_cham_xong).
  const progress = useQuery({ queryKey: ["progress", p.id], queryFn: () => api<Progress>(`/tasks/projects/${p.id}/progress`), enabled: p.isOwner });
  const canEdit = p.isOwner && Boolean(progress.data?.gradedAt);
  const [onlyDisputed, setOnlyDisputed] = useState(false);
  const [onlyEdited, setOnlyEdited] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useUrlPage();
  const [open, setOpen] = useState<string | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);

  const filtered = useMemo(
    () => (q.data?.samples ?? []).filter((s) => (!onlyDisputed || s.disputed) && (!onlyEdited || Boolean(s.ownerEdit))),
    [q.data, onlyDisputed, onlyEdited],
  );
  // Tìm theo tên file cần tên của MỌI mẫu — chỉ có cho trang đang xem, nên lọc tên áp trên trang hiện tại.
  const pageRows = filtered.slice((page - 1) * PAGE, page * PAGE);
  const { samples: info, refetch } = useSamples(p.id, pageRows.map((s) => s.sampleId));
  const rows = search.trim() ? pageRows.filter((s) => (info.get(s.sampleId)?.originalName ?? "").toLowerCase().includes(search.trim().toLowerCase())) : pageRows;
  const images = rows.flatMap((s) => {
    const i = info.get(s.sampleId);
    return i?.fileUrl && i.modality === "image" ? [{ id: s.sampleId, src: i.fileUrl, name: i.originalName }] : [];
  });

  return (
    <div className="space-y-6">
      <ExportCard p={p} />
      <QueryState query={q}>
        {(r) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Mẫu có kết quả" value={r.sampleCount} />
              <StatCard label="Mẫu không có đa số" value={r.disputedCount} />
              <StatCard label="Mẫu bạn đã sửa" value={r.editedCount ?? 0} />
              <StatCard label="Công cụ có lớp" value={Object.keys(r.labelDistribution).length} />
            </div>
            {Object.entries(r.labelDistribution).length > 0 && (
              <div className="grid gap-4 lg:grid-cols-2">
                {Object.entries(r.labelDistribution).map(([tool, dist]) => (
                  <Card key={tool}>
                    <CardHeader>
                      <CardTitle className="text-base">Phân bố lớp — {tool}</CardTitle>
                    </CardHeader>
                    <CardContent className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={Object.entries(dist).map(([k, v]) => ({ k, v }))}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="k" fontSize={11} />
                          <YAxis fontSize={11} allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="v" name="Số lần" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Kết quả từng mẫu</CardTitle>
                  <CardDescription>
                    Bấm ảnh để xem lớn, bấm dòng để xem nhãn vẽ trên mẫu và câu trả lời của từng người.
                    {canEdit && " Thấy số đông chưa đúng thì mở mẫu và bấm “Sửa kết quả” — file tạo sau đó dùng giá trị của bạn."}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm tên file trên trang này" className="h-8 w-56 pl-8" />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={onlyDisputed}
                      onCheckedChange={(v) => {
                        setOnlyDisputed(v);
                        setPage(1);
                        setOpen(null);
                      }}
                    />{" "}
                    Chỉ mẫu không có đa số
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={onlyEdited}
                      onCheckedChange={(v) => {
                        setOnlyEdited(v);
                        setPage(1);
                        setOpen(null);
                      }}
                    />{" "}
                    Chỉ mẫu đã sửa
                  </label>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead className="w-20">Mẫu</TableHead>
                      <TableHead>Tên file</TableHead>
                      <TableHead>Kết quả</TableHead>
                      <TableHead className="text-center">Số nhãn</TableHead>
                      <TableHead>Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                          Không có mẫu nào.
                        </TableCell>
                      </TableRow>
                    )}
                    {rows.map((s) => {
                      const i = info.get(s.sampleId);
                      const isOpen = open === s.sampleId;
                      const imgIdx = images.findIndex((x) => x.id === s.sampleId);
                      return (
                        <Fragment key={s.sampleId}>
                          <TableRow className="cursor-pointer" onClick={() => setOpen(isOpen ? null : s.sampleId)}>
                            <TableCell className="text-muted-foreground">{isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</TableCell>
                            <TableCell>
                              {imgIdx >= 0 ? (
                                <ImageThumb src={images[imgIdx].src} name={images[imgIdx].name} onOpen={() => setViewer(imgIdx)} className="size-14" />
                              ) : (
                                <div className="flex size-14 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                                  <FileText className="size-5" />
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="max-w-64">
                              <SampleName s={s} info={i} />
                            </TableCell>
                            <TableCell className="max-w-80 text-sm whitespace-normal">
                              {Object.entries(s.tools).map(([t, tr]) => (
                                <div key={t} className="leading-snug">
                                  {Object.keys(s.tools).length > 1 && <span className="text-muted-foreground">{t}: </span>}
                                  <span className={tr.disputed ? "text-destructive" : "font-medium"}>{finalText(p.labelSchema, t, tr, s.sampleContent)}</span>
                                  {tr.ownerEdited && <span className="ml-1 text-xs text-sky-700">(bạn sửa)</span>}
                                </div>
                              ))}
                            </TableCell>
                            <TableCell className="text-center">{s.approvedCount}</TableCell>
                            <TableCell>
                              <div className="flex flex-col items-start gap-1">
                                <ConsensusBadge s={s} />
                                {s.ownerEdit?.consensusChanged && <ToneBadge tone="warning">Số đông đã đổi — xem lại</ToneBadge>}
                              </div>
                            </TableCell>
                          </TableRow>
                          {isOpen && (
                            <TableRow className="hover:bg-transparent">
                              <TableCell colSpan={6} className="bg-muted/30">
                                <Detail p={p} s={s} info={i} canEdit={canEdit} onMediaError={() => void refetch()} />
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
                <Pager
                  page={page}
                  pageSize={PAGE}
                  total={filtered.length}
                  onChange={(n) => {
                    setPage(n);
                    setOpen(null);
                  }}
                />
              </CardContent>
            </Card>
            <ImageViewer images={images} index={viewer} onIndexChange={setViewer} />
          </>
        )}
      </QueryState>
    </div>
  );
}
