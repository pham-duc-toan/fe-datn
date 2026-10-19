"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Archive, Brain, CheckCircle2, Eraser, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/common/page-header";
import { ActionDialog } from "@/components/common/action-dialog";
import { Field, JsonView } from "@/components/common/misc";
import { QueryState } from "@/components/common/states";
import { api, post } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";

type Ops = { reachable: boolean; checkedAt: string | null; threshold: number; deadLetterQueues: { queue: string; messages: number; overThreshold: boolean }[] };

export default function OpsPage() {
  const ops = useQuery({ queryKey: ["ops-queues"], queryFn: () => api<Ops>("/admin/ops/queues"), refetchInterval: 30000 });
  const [projectId, setProjectId] = useState("");
  const [out, setOut] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    try {
      setOut(await fn());
      toast.success(ok);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader title="Vận hành" description="Hàng đợi lỗi, tác vụ chất lượng và dọn dữ liệu dự án đã đóng." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Hàng đợi lỗi (DLQ)</CardTitle>
              <CardDescription>
                {ops.data?.reachable === false ? "Không đọc được RabbitMQ management API." : `Kiểm lúc ${formatDateTime(ops.data?.checkedAt)} · vượt ${ops.data?.threshold ?? "—"} tin thì gửi email cảnh báo`}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => void ops.refetch()}>
              <RefreshCw /> Làm mới
            </Button>
          </CardHeader>
          <CardContent>
            <QueryState query={ops}>
              {(o) =>
                o.deadLetterQueues.every((q) => q.messages === 0) ? (
                  <p className="flex items-center gap-2 text-sm text-emerald-600">
                    <CheckCircle2 className="size-4" /> {o.deadLetterQueues.length} DLQ đều rỗng.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Hàng đợi</TableHead>
                        <TableHead className="text-right">Số tin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {o.deadLetterQueues
                        .filter((q) => q.messages > 0)
                        .map((q) => (
                          <TableRow key={q.queue}>
                            <TableCell className="font-mono text-xs">{q.queue}</TableCell>
                            <TableCell className={`text-right tabular-nums ${q.overThreshold ? "font-semibold text-destructive" : ""}`}>{q.messages}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                )
              }
            </QueryState>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Dawid–Skene</CardTitle>
            <CardDescription>Ước lượng lại kỹ năng labeler ngay. Bình thường chạy theo lô (mặc định 15 phút).</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button disabled={busy !== null} onClick={() => void run("ds", () => post("/quality/admin/dawid-skene/run"), "Đã chạy Dawid–Skene")}>
              {busy === "ds" ? <Loader2 className="animate-spin" /> : <Brain />} Chạy (dự án có nhãn mới)
            </Button>
            <ActionDialog
              trigger={<Button variant="outline">Tính lại mọi dự án</Button>}
              title="Tính lại mọi dự án?"
              description="Chậm (~1 giây / dự án) — chỉ dùng sau khi đổi quality.ds_min_labels."
              onConfirm={async () => setOut(await post("/quality/admin/dawid-skene/run?full=true"))}
              successMessage="Đã chạy toàn bộ"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Dọn dự án đã đóng</CardTitle>
            <CardDescription>Hệ thống tự dọn sau hạn giữ; ở đây dọn ngay một dự án hoàn thành / huỷ. Nhãn đã duyệt, kết quả, tiền, uy tín không bị xoá.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="projectId">
              <Input value={projectId} onChange={(e) => setProjectId(e.target.value.trim())} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <ActionDialog
                trigger={<Button variant="outline" disabled={!projectId}><Eraser /> Dọn dữ liệu bài làm</Button>}
                title="Dọn câu hỏi / câu trả lời / báo lỗi của dự án?"
                onConfirm={async () => setOut(await post(`/tasks/admin/projects/${projectId}/purge`))}
                successMessage="Đã dọn"
              />
              <ActionDialog
                trigger={<Button variant="outline" disabled={!projectId}><Archive /> Lưu trữ số liệu chất lượng</Button>}
                title="Lưu trữ số liệu chất lượng?"
                description="Nhãn thô ở quality-svc bị dọn; báo cáo giữ dạng bản chụp."
                onConfirm={async () => setOut(await post(`/quality/admin/projects/${projectId}/archive`))}
                successMessage="Đã lưu trữ"
              />
            </div>
          </CardContent>
        </Card>
        {out !== null && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Kết quả</CardTitle>
            </CardHeader>
            <CardContent>
              <JsonView value={out} />
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
