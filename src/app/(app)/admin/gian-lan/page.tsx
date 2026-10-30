"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageHeader } from "@/components/common/page-header";
import { ActionDialog } from "@/components/common/action-dialog";
import { JsonView } from "@/components/common/misc";
import { Pager } from "@/components/common/pager";
import { Loading, QueryState } from "@/components/common/states";
import { StatusBadge } from "@/components/common/status-badge";
import { UserName } from "@/components/common/user-name";
import { api, post } from "@/lib/api";
import { formatDateTime, formatNumber, shortId } from "@/lib/format";
import { FRAUD_TYPE, genericStatus } from "@/lib/labels";
import type { Paged } from "@/lib/types";
import { useUrlPage, useUrlState } from "@/lib/use-url-state";

type Case = { id: string; type: string; projectId: string | null; userIds: string[]; evidence: Record<string, unknown>; status: string; createdAt: string; updatedAt: string; resolvedAt: string | null; note: string | null; blocked: boolean };
type CaseDetail = Case & { users: { userId: string; submissions: number; medianWorkSeconds: number | null; reputation: number | null }[] };

function Detail({ id, onDone }: { id: string; onDone: () => void }) {
  const q = useQuery({ queryKey: ["fraud", id], queryFn: () => api<CaseDetail>(`/quality/admin/fraud-cases/${id}`) });
  if (q.isPending) return <Loading />;
  if (!q.data) return null;
  const c = q.data;
  return (
    <div className="space-y-4 px-4 pb-6">
      <p className="text-sm">
        <b>{FRAUD_TYPE[c.type] ?? c.type}</b> · dự án {c.projectId ? shortId(c.projectId) : "—"} · cập nhật {formatDateTime(c.updatedAt)}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tài khoản</TableHead>
            <TableHead>Lượt nộp</TableHead>
            <TableHead>Trung vị thời gian</TableHead>
            <TableHead>Uy tín</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {c.users.map((u) => (
            <TableRow key={u.userId}>
              <TableCell>
                <UserName id={u.userId} />
              </TableCell>
              <TableCell>{u.submissions}</TableCell>
              <TableCell>{u.medianWorkSeconds !== null ? `${formatNumber(u.medianWorkSeconds, 1)} giây` : "—"}</TableCell>
              <TableCell>{u.reputation ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div>
        <p className="mb-1 text-sm font-medium">Bằng chứng</p>
        <JsonView value={c.evidence} />
      </div>
      {c.status === "open" && (
        <div className="flex gap-2">
          <ActionDialog
            trigger={<Button variant="destructive">Xác nhận gian lận</Button>}
            title="Xác nhận gian lận"
            destructive
            fields={[
              { name: "note", label: "Ghi chú (làm lý do khoá)", type: "textarea", required: true },
              { name: "blockAccounts", label: "Khoá mọi tài khoản trong hồ sơ", type: "checkbox", defaultValue: true },
            ]}
            onConfirm={async (v) => {
              await post(`/quality/admin/fraud-cases/${id}/resolve`, { action: "confirm", note: v.note, blockAccounts: v.blockAccounts === true });
              onDone();
            }}
          />
          <ActionDialog
            trigger={<Button variant="outline">Bỏ qua</Button>}
            title="Bỏ qua hồ sơ"
            description="Hồ sơ cùng đối tượng không mở lại trong 7 ngày."
            fields={[{ name: "note", label: "Ghi chú", type: "textarea", required: true }]}
            onConfirm={async (v) => {
              await post(`/quality/admin/fraud-cases/${id}/resolve`, { action: "dismiss", note: v.note });
              onDone();
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function FraudPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useUrlState("status", "open");
  const [type, setType] = useUrlState("type", "all");
  const [page, setPage] = useUrlPage();
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["fraud-cases", status, type, page], queryFn: () => api<Paged<Case>>("/quality/admin/fraud-cases", { query: { status, type: type === "all" ? undefined : type, page, pageSize: 20 } }) });
  return (
    <>
      <PageHeader
        title="Hồ sơ nghi gian lận"
        description="Hệ thống không tự khoá ai — chỉ mở hồ sơ để admin xem. Ngưỡng phát hiện chỉnh ở Cài đặt."
        actions={
          <>
            <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Mọi loại</SelectItem>
                {Object.entries(FRAUD_TYPE).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["open", "dismissed", "confirmed"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {genericStatus(s)[0]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
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
                      <TableHead className="pl-4">Loại</TableHead>
                      <TableHead>Tài khoản</TableHead>
                      <TableHead>Cập nhật</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.items.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="pl-4 font-medium">{FRAUD_TYPE[c.type] ?? c.type}</TableCell>
                        <TableCell className="text-sm">
                          {c.userIds.slice(0, 3).map((u) => (
                            <span key={u} className="mr-2">
                              <UserName id={u} />
                            </span>
                          ))}
                          {c.userIds.length > 3 && `+${c.userIds.length - 3}`}
                        </TableCell>
                        <TableCell>{formatDateTime(c.updatedAt)}</TableCell>
                        <TableCell>
                          <StatusBadge entry={genericStatus(c.status)} />
                          {c.blocked && <span className="ml-1 text-xs text-destructive">đã khoá</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="xs" variant="outline" onClick={() => setOpen(c.id)}>
                            <Eye /> Xem
                          </Button>
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
      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Hồ sơ gian lận</SheetTitle>
          </SheetHeader>
          {open && (
            <Detail
              id={open}
              onDone={() => {
                setOpen(null);
                void qc.invalidateQueries({ queryKey: ["fraud-cases"] });
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
