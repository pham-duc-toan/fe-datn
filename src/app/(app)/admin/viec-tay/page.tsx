"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/page-header";
import { ActionDialog } from "@/components/common/action-dialog";
import { Pager } from "@/components/common/pager";
import { QueryState } from "@/components/common/states";
import { StatusBadge } from "@/components/common/status-badge";
import { UserName } from "@/components/common/user-name";
import { api, post } from "@/lib/api";
import { formatDateTime, formatVnd, timeAgo } from "@/lib/format";
import { genericStatus } from "@/lib/labels";
import type { Paged } from "@/lib/types";
import { useUrlPage, useUrlState } from "@/lib/use-url-state";

/** Một việc hệ thống không tự làm được (vd không trả được thưởng vì dự án không còn ký quỹ). */
type ViecTay = {
  actionId: string;
  kind: string;
  title: string;
  detail: string;
  projectId: string | null;
  userId: string | null;
  amountVnd: number | null;
  status: string;
  note: string | null;
  openedAt: string;
  resolvedAt: string | null;
};

const STATUS: Record<string, string> = { pending: "Đang chờ", resolved: "Đã xử lý", all: "Tất cả" };

export default function ManualActionsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useUrlState("status", "pending");
  const [page, setPage] = useUrlPage();
  const q = useQuery({
    queryKey: ["manual-actions", status, page],
    queryFn: () => api<Paged<ViecTay>>("/admin/manual-actions", { query: { status, page, pageSize: 30 } }),
    refetchInterval: 15000,
  });
  const done = () => void qc.invalidateQueries({ queryKey: ["manual-actions"] });

  return (
    <>
      <PageHeader
        title="Việc cần xử lý tay"
        description="Những việc hệ thống không tự làm được, ví dụ không trả được thưởng vì dự án không còn tiền ký quỹ. Xử lý xong (chuyển tiền tay, đối soát...) thì ghi lại đã làm gì."
        actions={
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <Card className="py-0">
        <CardContent className="px-0">
          <QueryState query={q} empty={(d) => d.items.length === 0}>
            {(d) => (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Việc cần làm</TableHead>
                      <TableHead>Người liên quan</TableHead>
                      <TableHead className="text-right">Số tiền</TableHead>
                      <TableHead>Phát sinh</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.items.map((it) => (
                      <TableRow key={it.actionId}>
                        <TableCell className="max-w-md whitespace-normal pl-4">
                          <div className="font-medium">{it.title}</div>
                          <div className="text-xs text-muted-foreground">{it.detail}</div>
                          {it.note && it.status !== "pending" && <div className="mt-1 text-xs">Đã xử lý: {it.note}</div>}
                        </TableCell>
                        <TableCell>
                          <UserName id={it.userId} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{it.amountVnd !== null ? formatVnd(it.amountVnd) : ""}</TableCell>
                        <TableCell title={formatDateTime(it.openedAt)}>{timeAgo(it.openedAt)}</TableCell>
                        <TableCell>
                          <StatusBadge entry={genericStatus(it.status)} />
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {it.status === "pending" && (
                              <ActionDialog
                                trigger={<Button size="xs"><Check /> Đã xử lý</Button>}
                                title="Đánh dấu đã xử lý"
                                description="Hệ thống không tự làm việc này. Hãy xử lý xong rồi ghi lại đã làm gì."
                                fields={[{ name: "note", label: "Đã làm gì", type: "textarea", required: true, placeholder: "vd: Đã chuyển tay 50.000 đ cho người làm" }]}
                                onConfirm={async (v) => {
                                  await post(`/admin/manual-actions/${it.actionId}/resolve`, { note: String(v.note ?? "") });
                                  done();
                                }}
                                successMessage="Đã ghi nhận"
                              />
                            )}
                            {it.projectId && (
                              <Button size="icon-xs" variant="ghost" asChild>
                                <Link href={`/admin/du-an/${it.projectId}`} aria-label="Xem dự án">
                                  <ExternalLink />
                                </Link>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="px-4 pb-3">
                  <Pager page={d.page} pageSize={d.pageSize} total={d.total} onChange={setPage} />
                </div>
              </>
            )}
          </QueryState>
        </CardContent>
      </Card>
    </>
  );
}
