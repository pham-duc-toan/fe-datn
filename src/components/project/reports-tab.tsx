"use client";

import { useSamples } from "@/hooks/use-samples";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QueryState } from "@/components/common/states";
import { StatusBadge } from "@/components/common/status-badge";
import { UserName } from "@/components/common/user-name";
import { api, post } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDateTime, shortId } from "@/lib/format";
import { genericStatus, REPORT_REASON } from "@/lib/labels";
import type { Project, TaskReport } from "@/lib/types";

export function ReportsTab({ project: p }: { project: Project }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState("open");
  const q = useQuery({ queryKey: ["reports", p.id, status], queryFn: () => api<TaskReport[]>(`/tasks/projects/${p.id}/reports`, { query: { status } }) });
  const { samples: info } = useSamples(p.id, (q.data ?? []).map((r) => r.sampleId));
  const resolve = async (r: TaskReport, action: "dismiss" | "exclude") => {
    try {
      await post(`/tasks/reports/${r.id}/resolve`, { action });
      toast.success(action === "dismiss" ? "Đã bỏ qua báo cáo" : "Đã loại mẫu khỏi dự án");
      await qc.invalidateQueries({ queryKey: ["reports", p.id] });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>Câu hỏi bị báo lỗi</CardTitle>
          <CardDescription>Đủ số người báo thì câu tự bị loại khỏi chấm điểm. “Loại câu” bỏ câu khỏi việc so đa số của mọi bài và đóng mọi báo cáo của nó.</CardDescription>
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["open", "dismissed", "excluded", "all"].map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? "Tất cả" : genericStatus(s)[0]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <QueryState query={q} empty={(d) => d.length === 0}>
          {(d) => (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mẫu</TableHead>
                  <TableHead>Người báo</TableHead>
                  <TableHead>Lý do</TableHead>
                  <TableHead>Số báo cáo</TableHead>
                  <TableHead>Lúc</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="max-w-48 truncate" title={info.get(r.sampleId)?.originalName}>
                      {info.get(r.sampleId)?.originalName ?? `Mẫu ${shortId(r.sampleId)}`}
                    </TableCell>
                    <TableCell>
                      <UserName id={r.labelerId} />
                    </TableCell>
                    <TableCell>
                      {REPORT_REASON[r.reason] ?? r.reason}
                      {r.note && <div className="text-xs text-muted-foreground">{r.note}</div>}
                    </TableCell>
                    <TableCell>{r.reportsOnTask}</TableCell>
                    <TableCell>{formatDateTime(r.createdAt)}</TableCell>
                    <TableCell>
                      <StatusBadge entry={genericStatus(r.state)} />
                    </TableCell>
                    <TableCell className="text-right">
                      {r.state === "open" && (
                        <div className="flex justify-end gap-1">
                          <Button size="xs" variant="outline" onClick={() => void resolve(r, "dismiss")}>
                            Câu ổn
                          </Button>
                          <Button size="xs" variant="destructive" onClick={() => void resolve(r, "exclude")}>
                            Loại câu
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}
