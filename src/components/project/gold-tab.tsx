"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ImageThumb, ImageViewer } from "@/components/common/image-viewer";
import { useSamples } from "@/hooks/use-samples";
import { describeLabel } from "@/lib/describe";
import { Pager } from "@/components/common/pager";
import { QueryState } from "@/components/common/states";
import { ToneBadge } from "@/components/common/status-badge";
import { Workspace } from "@/components/labeling/workspace";
import { buildPayload, validateLabel } from "@/components/labeling/schema";
import { api, del, post } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { shortId } from "@/lib/format";
import type { GoldItem, LabelData, Paged, Project, Sample } from "@/lib/types";
import { SampleThumb } from "./data-tab";
import { useUrlPage } from "@/lib/use-url-state";

export function GoldTab({ project: p }: { project: Project }) {
  const qc = useQueryClient();
  const editable = p.status === "draft" || p.status === "paused";
  const gold = useQuery({ queryKey: ["gold", p.id], queryFn: () => api<GoldItem[]>(`/projects/${p.id}/gold-items`) });
  const [page, setPage] = useUrlPage();
  const samples = useQuery({ queryKey: ["samples", p.id, "gold", page], queryFn: () => api<Paged<Sample>>(`/projects/${p.id}/samples`, { query: { page, pageSize: 12 } }) });
  const [sample, setSample] = useState<Sample | null>(null);
  const [value, setValue] = useState<LabelData>({});
  const [purpose, setPurpose] = useState<"qualityCheck" | "entranceTest">("qualityCheck");
  const [busy, setBusy] = useState(false);
  const goldIds = new Set((gold.data ?? []).map((g) => g.sampleId));
  const { samples: info } = useSamples(p.id, (gold.data ?? []).map((g) => g.sampleId));
  const [viewer, setViewer] = useState<number | null>(null);
  const goldImages = (gold.data ?? []).flatMap((g) => {
    const i = info.get(g.sampleId);
    return i?.fileUrl && i.modality === "image" ? [{ id: g.sampleId, src: i.fileUrl, name: i.originalName }] : [];
  });
  const schema = p.labelSchema;
  const errs = schema && sample ? validateLabel(schema, value, sample.metadata) : [];

  async function save() {
    if (!schema || !sample) return;
    setBusy(true);
    try {
      await post(`/projects/${p.id}/gold-items`, { items: [{ sampleId: sample.id, purpose, expectedPayload: buildPayload(schema, value) }] });
      toast.success("Đã thêm câu vàng");
      setSample(null);
      setValue({});
      await qc.invalidateQueries({ queryKey: ["gold", p.id] });
      void qc.invalidateQueries({ queryKey: ["readiness", p.id] });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!schema) return <Alert><AlertDescription>Cần đặt tập nhãn trước khi tạo câu vàng.</AlertDescription></Alert>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Câu hỏi vàng ({gold.data?.length ?? 0})</CardTitle>
          <CardDescription>
            Mẫu có sẵn đáp án. “Kiểm tra chất lượng”: chen vào MỌI bài làm (labeler không phân biệt được) — sai một câu là bài không đạt. “Bài test đầu vào”: dùng
            cho bài test trước khi tham gia. Câu vàng không tính vào số câu của bài. Chỉ sửa được khi dự án còn nháp.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QueryState query={gold} empty={(d) => d.length === 0}>
            {(d) => (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mẫu</TableHead>
                    <TableHead>Mục đích</TableHead>
                    <TableHead>Đáp án</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {goldImages.some((x) => x.id === g.sampleId) && (
                            <ImageThumb
                              src={info.get(g.sampleId)!.fileUrl!}
                              name={info.get(g.sampleId)!.originalName}
                              className="size-10 shrink-0"
                              onOpen={() => setViewer(goldImages.findIndex((x) => x.id === g.sampleId))}
                            />
                          )}
                          <span className="max-w-48 truncate" title={info.get(g.sampleId)?.originalName}>
                            {info.get(g.sampleId)?.originalName ?? `Mẫu ${shortId(g.sampleId)}`}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{g.purpose === "entranceTest" ? <ToneBadge tone="info">Bài test</ToneBadge> : <ToneBadge tone="default">Kiểm tra chất lượng</ToneBadge>}</TableCell>
                      <TableCell className="max-w-md">
                        {describeLabel(schema, g.expectedPayload.data, info.get(g.sampleId)?.content).map((l) => (
                          <div key={l.tool} className="text-sm">
                            {(schema?.tools.length ?? 0) > 1 && <span className="text-muted-foreground">{l.tool}: </span>}
                            <span className="font-medium">{l.text}</span>
                          </div>
                        ))}
                      </TableCell>
                      <TableCell>
                        {editable && (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={async () => {
                              try {
                                await del(`/projects/${p.id}/gold-items/${g.id}`);
                                await qc.invalidateQueries({ queryKey: ["gold", p.id] });
                              } catch (e) {
                                toast.error(errorMessage(e));
                              }
                            }}
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </QueryState>
          <ImageViewer images={goldImages} index={viewer} onIndexChange={setViewer} />
        </CardContent>
      </Card>

      {editable && !sample && (
        <Card>
          <CardHeader>
            <CardTitle>Thêm câu vàng — chọn một mẫu</CardTitle>
          </CardHeader>
          <CardContent>
            <QueryState query={samples} empty={(d) => d.items.length === 0}>
              {(d) => (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                    {d.items.map((s) => (
                      <button key={s.id} type="button" disabled={goldIds.has(s.id)} onClick={() => { setSample(s); setValue({}); }} className="space-y-1 rounded-md border p-1.5 text-left hover:border-primary disabled:opacity-40">
                        <SampleThumb s={s} />
                        <p className="truncate text-xs">{goldIds.has(s.id) ? "Đã là câu vàng" : s.originalName}</p>
                      </button>
                    ))}
                  </div>
                  <Pager page={d.page} pageSize={d.pageSize} total={d.total} onChange={setPage} />
                </>
              )}
            </QueryState>
          </CardContent>
        </Card>
      )}

      {sample && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Đáp án cho mẫu {sample.originalName}</CardTitle>
              <CardDescription>Gán nhãn như labeler sẽ làm — đáp án được kiểm như một nhãn thật.</CardDescription>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => setSample(null)}>
              <X />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <Workspace schema={schema} modality={p.modality} fileUrl={sample.fileUrl} content={sample.content} metadata={sample.metadata} value={value} onChange={setValue} seed={sample.id} />
            <RadioGroup value={purpose} onValueChange={(v) => setPurpose(v as typeof purpose)} className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="qualityCheck" /> Kiểm tra chất lượng
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="entranceTest" /> Bài test đầu vào
              </label>
            </RadioGroup>
            {errs.length > 0 && (
              <Alert variant="destructive">
                <AlertDescription>
                  <ul className="list-disc pl-4">{errs.map((e) => <li key={e}>{e}</li>)}</ul>
                </AlertDescription>
              </Alert>
            )}
            <Button onClick={() => void save()} disabled={busy || errs.length > 0}>
              {busy ? <Loader2 className="animate-spin" /> : <Plus />} Lưu câu vàng
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
