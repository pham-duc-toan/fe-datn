"use client";

import { Fragment, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronDown, ChevronRight, Download, FileText, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { api, downloadFile } from "@/lib/api";
import { describeTool } from "@/lib/describe";
import { errorMessage } from "@/lib/errors";
import { shortId } from "@/lib/format";
import type { LabelData, LabelSchema, Project, Sample, SampleContent, SampleMeta } from "@/lib/types";
import { useUrlPage } from "@/lib/use-url-state";

// Workspace dùng konva — chỉ tải khi mở chi tiết một mẫu.
const Workspace = dynamic(() => import("@/components/labeling/workspace").then((m) => m.Workspace), { ssr: false, loading: () => <Loader2 className="m-6 animate-spin text-muted-foreground" /> });

type ToolResult = { kind: string; method: string; final: unknown; disputed: boolean; votes?: Record<string, number>; scores?: Record<string, number>; supports?: number[]; agrees?: boolean[] };
type SampleResult = {
  sampleId: string;
  storageKey: string | null;
  sampleContent: SampleContent | null;
  sampleMetadata?: SampleMeta | null;
  approvedCount: number;
  disputed: boolean;
  consensusStatus: string | null;
  consensusFinal?: LabelData | null;
  tools: Record<string, ToolResult>;
  labels: LabelData[];
};
type Results = { sampleCount: number; disputedCount: number; labelDistribution: Record<string, Record<string, number>>; samples: SampleResult[] };

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

/** Kết quả gộp của một công cụ, bằng chữ. */
function finalText(schema: LabelSchema | null, toolName: string, r: ToolResult, content: SampleContent | null): string {
  if (r.final === null || r.final === undefined) return r.method === "none" ? "Câu trả lời mở — xem từng người" : "Chưa thống nhất";
  const tool = schema?.tools.find((t) => t.name === toolName);
  return tool ? describeTool(tool, r.final, content) : "—";
}

/** Dữ liệu kết quả gộp để vẽ lại trên workspace (công cụ không gộp được thì bỏ). */
function finalData(s: SampleResult): LabelData {
  if (s.consensusFinal) return s.consensusFinal;
  const d: LabelData = {};
  for (const [k, r] of Object.entries(s.tools)) if (r.final !== null && r.final !== undefined) d[k] = r.final;
  return d;
}

function ConsensusBadge({ s }: { s: SampleResult }) {
  if (s.disputed) return <ToneBadge tone="danger">Không có đa số</ToneBadge>;
  if (s.consensusStatus === "agreed") return <ToneBadge tone="success">Thống nhất</ToneBadge>;
  if (s.consensusStatus === "notApplicable") return <ToneBadge tone="muted">Không cần gộp</ToneBadge>;
  return <ToneBadge tone="muted">Chưa đủ nhãn</ToneBadge>;
}

function SampleName({ s, info }: { s: SampleResult; info: Sample | undefined }) {
  const text = s.sampleContent?.text ?? s.sampleContent?.prompt;
  return (
    <div className="min-w-0">
      <div className="truncate font-medium" title={info?.originalName}>
        {info?.originalName ?? `Mẫu ${shortId(s.sampleId)}`}
      </div>
      {text && <div className="line-clamp-2 text-xs text-muted-foreground">{text}</div>}
    </div>
  );
}

function Detail({ p, s, info, onMediaError }: { p: Project; s: SampleResult; info: Sample | undefined; onMediaError: () => void }) {
  const schema = p.labelSchema;
  if (!schema) return null;
  const common = {
    schema,
    modality: p.modality,
    fileUrl: info?.fileUrl ?? null,
    content: s.sampleContent ?? info?.content ?? null,
    metadata: s.sampleMetadata ?? info?.metadata ?? {},
    readOnly: true,
    seed: s.sampleId,
    onMediaError,
  };
  return (
    <Tabs defaultValue="gop" className="py-2">
      <TabsList className="flex-wrap">
        <TabsTrigger value="gop">Kết quả gộp</TabsTrigger>
        {s.labels.map((_, i) => (
          <TabsTrigger key={i} value={`n${i}`}>
            Người gán {i + 1}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="gop" className="mt-3">
        <Workspace {...common} value={finalData(s)} />
      </TabsContent>
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
  const [onlyDisputed, setOnlyDisputed] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useUrlPage();
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);

  const filtered = useMemo(() => (q.data?.samples ?? []).filter((s) => !onlyDisputed || s.disputed), [q.data, onlyDisputed]);
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
      <Card>
        <CardHeader>
          <CardTitle>Tải kết quả</CardTitle>
          <CardDescription>File cho kỹ sư / mô hình học máy: kết quả gộp đa số từ nhãn của các bài đạt.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {exportFormats(p).map(({ f, label }) => (
            <Button
              key={f}
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={async () => {
                setBusy(f);
                try {
                  await downloadFile(`/annotations/projects/${p.id}/export`, { format: f }, `ket-qua-${p.id}.${f === "csv" ? "csv" : f === "json" || f.startsWith("coco") ? "json" : "zip"}`);
                } catch (e) {
                  toast.error(errorMessage(e));
                } finally {
                  setBusy(null);
                }
              }}
            >
              {busy === f ? <Loader2 className="animate-spin" /> : <Download />} {label}
            </Button>
          ))}
        </CardContent>
      </Card>
      <QueryState query={q}>
        {(r) => (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Mẫu có kết quả" value={r.sampleCount} />
              <StatCard label="Mẫu không có đa số" value={r.disputedCount} />
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
                  <CardDescription>Bấm ảnh để xem lớn, bấm dòng để xem nhãn vẽ trên mẫu và câu trả lời của từng người.</CardDescription>
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
                                </div>
                              ))}
                            </TableCell>
                            <TableCell className="text-center">{s.approvedCount}</TableCell>
                            <TableCell>
                              <ConsensusBadge s={s} />
                            </TableCell>
                          </TableRow>
                          {isOpen && (
                            <TableRow className="hover:bg-transparent">
                              <TableCell colSpan={6} className="bg-muted/30">
                                <Detail p={p} s={s} info={i} onMediaError={() => void refetch()} />
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
