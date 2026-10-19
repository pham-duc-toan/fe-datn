"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/common/page-header";
import { ActionDialog } from "@/components/common/action-dialog";
import { Loading, QueryState } from "@/components/common/states";
import { StatusBadge, ToneBadge } from "@/components/common/status-badge";
import { UserName } from "@/components/common/user-name";
import { Workspace } from "@/components/labeling/workspace";
import { useProject } from "@/components/project/use-project";
import { api, post } from "@/lib/api";
import { formatDateTime, formatVnd } from "@/lib/format";
import { appealState } from "@/lib/labels";
import type { Annotation, AttemptSummary, LabelData, Paged } from "@/lib/types";

type Results = { samples: { sampleId: string; consensusFinal: LabelData | null; consensusStatus: string | null }[] };

/** So hai nhãn không phụ thuộc thứ tự khoá (chỉ để đánh dấu nhanh — chấm thật do quality-svc). */
function sapXep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sapXep);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sapXep((v as Record<string, unknown>)[k])]));
  return v;
}

/** Từng câu của bài: câu trả lời của labeler cạnh kết quả gộp (đa số các bài đạt). */
function AttemptReview({ a }: { a: AttemptSummary }) {
  const p = useProject(a.projectId);
  const labels = useQuery({
    queryKey: ["attempt-labels", a.attemptId],
    queryFn: () => api<Paged<Annotation>>(`/annotations/projects/${a.projectId}`, { query: { attemptId: a.attemptId, pageSize: 200 } }),
  });
  const results = useQuery({ queryKey: ["results", a.projectId], queryFn: () => api<Results>(`/annotations/projects/${a.projectId}/results`) });
  if (p.isPending || labels.isPending) return <Loading />;
  const schema = p.data?.labelSchema;
  if (!schema) return null;
  const final = new Map((results.data?.samples ?? []).map((s) => [s.sampleId, s]));
  return (
    <div className="space-y-4">
      {(labels.data?.items ?? []).map((l, i) => {
        const f = final.get(l.sampleId);
        const khop = f?.consensusFinal ? JSON.stringify(sapXep(l.payload.data)) === JSON.stringify(sapXep(f.consensusFinal)) : null;
        return (
          <div key={l.id} className="rounded-lg border p-3">
            <p className="mb-2 flex items-center gap-2 text-sm font-medium">
              Câu đã trả lời #{i + 1}
              {khop !== null && <ToneBadge tone={khop ? "success" : "danger"}>{khop ? "Giống đa số" : "Khác đa số"}</ToneBadge>}
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Labeler chọn</p>
                <Workspace schema={schema} modality={p.data!.modality} fileUrl={l.fileUrl} content={l.sampleContent} metadata={l.sampleMetadata} value={l.payload.data} readOnly seed={l.sampleId} stacked />
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Kết quả gộp (đa số các bài đạt)</p>
                {f?.consensusFinal ? (
                  <Workspace schema={schema} modality={p.data!.modality} fileUrl={l.fileUrl} content={l.sampleContent} metadata={l.sampleMetadata} value={f.consensusFinal} readOnly seed={l.sampleId} stacked />
                ) : (
                  <p className="text-sm text-muted-foreground">{f?.consensusStatus === "disputed" ? "Không có đa số (hoà phiếu)." : "Chưa có kết quả gộp cho câu này."}</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {(labels.data?.items ?? []).length === 0 && <p className="text-sm text-muted-foreground">Bài không có câu nào được trả lời.</p>}
    </div>
  );
}

function AppealCard({ a, onDone }: { a: AttemptSummary; onDone: () => void }) {
  const p = useProject(a.projectId);
  const [show, setShow] = useState(false);
  const open = a.appealState === "open";
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            {p.data?.name ?? "Dự án"} <StatusBadge entry={appealState(a.appealState)} />
          </CardTitle>
          <CardDescription>
            Người làm <UserName id={a.labelerId} /> · nộp {formatDateTime(a.submittedAt)} · khiếu nại {formatDateTime(a.appealedAt)}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setShow((s) => !s)}>
            {show ? "Ẩn bài" : "Xem bài"}
          </Button>
          {open && (
            <>
              <ActionDialog
                trigger={<Button size="sm"><Check /> Chấp nhận</Button>}
                title="Chấp nhận khiếu nại"
                description={`Bài tính là đạt: nhãn của bài vào kết quả và labeler được trả ${formatVnd(a.rewardVnd)} (nếu dự án còn suất trong ký quỹ).`}
                fields={[{ name: "note", label: "Ghi chú cho labeler", type: "textarea" }]}
                onConfirm={async (v) => {
                  await post(`/tasks/admin/attempts/${a.attemptId}/appeal/resolve`, { accept: true, note: v.note || null });
                  onDone();
                }}
                successMessage="Đã chấp nhận"
              />
              <ActionDialog
                trigger={<Button size="sm" variant="destructive"><X /> Bác</Button>}
                title="Bác khiếu nại"
                description="Giữ nguyên kết quả chấm. Labeler không khiếu nại lại được."
                destructive
                fields={[{ name: "note", label: "Lý do", type: "textarea", required: true }]}
                onConfirm={async (v) => {
                  await post(`/tasks/admin/attempts/${a.attemptId}/appeal/resolve`, { accept: false, note: v.note || null });
                  onDone();
                }}
                successMessage="Đã bác"
              />
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          <span className="text-muted-foreground">Kết quả chấm:</span> giống đa số {a.agreementPercent ?? "—"}% ({a.matchedCount}/{a.comparableCount} câu so được) — cần ≥ {a.passThresholdPercent}%; câu
          kiểm tra đúng {a.goldCorrect}/{a.goldTotal}; trả lời {a.answeredCount}/{a.questionCount} câu.
        </p>
        <p className="rounded-md bg-muted p-3 whitespace-pre-wrap">
          <span className="text-muted-foreground">Khiếu nại:</span> {a.appealMessage}
        </p>
        {a.appealNote && (
          <p>
            <span className="text-muted-foreground">Ghi chú xử lý:</span> {a.appealNote}
          </p>
        )}
        {show && <AttemptReview a={a} />}
      </CardContent>
    </Card>
  );
}

export default function AdminAppealsPage() {
  const qc = useQueryClient();
  const [state, setState] = useState("open");
  const q = useQuery({ queryKey: ["attempt-appeals", state], queryFn: () => api<AttemptSummary[]>("/tasks/admin/appeals", { query: { state } }) });
  return (
    <>
      <PageHeader title="Khiếu nại bài làm" description="Labeler trượt khiếu nại CẢ BÀI trong thời hạn sau khi dự án chấm xong. Chấp nhận = bài tính là đạt và được trả thưởng." />
      <Tabs value={state} onValueChange={setState} className="mb-4">
        <TabsList>
          <TabsTrigger value="open">Đang chờ</TabsTrigger>
          <TabsTrigger value="accepted">Đã chấp nhận</TabsTrigger>
          <TabsTrigger value="rejected">Đã bác</TabsTrigger>
        </TabsList>
      </Tabs>
      <QueryState query={q} empty={(d) => d.length === 0}>
        {(d) => (
          <div className="space-y-4">
            {d.map((a) => (
              <AppealCard key={a.attemptId} a={a} onDone={() => void qc.invalidateQueries({ queryKey: ["attempt-appeals"] })} />
            ))}
          </div>
        )}
      </QueryState>
    </>
  );
}
