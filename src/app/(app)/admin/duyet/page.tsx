"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/page-header";
import { ActionDialog, type ActionField } from "@/components/common/action-dialog";
import { Pager } from "@/components/common/pager";
import { QueryState } from "@/components/common/states";
import { StatusBadge } from "@/components/common/status-badge";
import { UserName } from "@/components/common/user-name";
import { api, post } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDateTime, formatVnd, timeAgo } from "@/lib/format";
import { APPROVAL_KIND, genericStatus } from "@/lib/labels";
import type { Paged } from "@/lib/types";
import { useUrlPage, useUrlState } from "@/lib/use-url-state";

type Item = { id: string; kind: string; subjectId: string; status: string; title: string | null; requesterId: string | null; amountVnd: number | null; note: string | null; openedAt: string; decidedAt: string | null };

const DETAIL: Record<string, (s: string) => string> = {
  kyb: () => "/admin/kyb",
  identity: () => "/admin/xac-minh",
  project: (s) => `/du-an/${s}`,
  withdrawal: () => "/admin/rut-tien",
  appeal: () => "/admin/khieu-nai",
  link: () => "/admin/link",
  referral: () => "/admin/link?tab=gioi-thieu",
};

const reason: ActionField[] = [{ name: "reason", label: "Lý do", type: "textarea", required: true }];

function Actions({ it, done }: { it: Item; done: () => void }) {
  const s = it.subjectId;
  const ok = (fn: () => Promise<unknown>, msg: string) => async () => {
    try {
      await fn();
      toast.success(msg);
      done();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const approveBtn = (fn: () => Promise<unknown>) => (
    <Button size="xs" onClick={ok(fn, "Đã duyệt — hàng đợi cập nhật sau vài giây")}>
      <Check /> Duyệt
    </Button>
  );
  const rejectBtn = (fn: (r: string) => Promise<unknown>, fields = reason, label = "Từ chối") => (
    <ActionDialog trigger={<Button size="xs" variant="outline"><X /> {label}</Button>} title={label} fields={fields} destructive onConfirm={async (v) => { await fn(String(v.reason ?? v.note ?? "")); done(); }} successMessage="Đã xử lý" />
  );
  switch (it.kind) {
    case "kyb":
      return <>{approveBtn(() => post(`/kyb/admin/${s}/approve`))}{rejectBtn((r) => post(`/kyb/admin/${s}/reject`, { reason: r }))}</>;
    case "identity":
      return <>{approveBtn(() => post(`/users/admin/identity-verifications/${s}/approve`))}{rejectBtn((r) => post(`/users/admin/identity-verifications/${s}/reject`, { reason: r }))}</>;
    case "project":
      return <>{approveBtn(() => post(`/projects/${s}/approve`))}{rejectBtn((r) => post(`/projects/${s}/reject`, { reason: r }))}</>;
    case "withdrawal":
      return <>{approveBtn(() => post(`/ledger/admin/withdrawals/${s}/approve`))}{rejectBtn((r) => post(`/ledger/admin/withdrawals/${s}/reject`, { reason: r }))}</>;
    case "appeal":
      return (
        <>
          <ActionDialog trigger={<Button size="xs"><Check /> Chấp nhận</Button>} title="Chấp nhận khiếu nại bài làm" description="Bài tính là đạt: nhãn vào kết quả, labeler được trả thưởng. Xem kỹ bài ở trang Khiếu nại bài làm." fields={[{ name: "note", label: "Ghi chú", type: "textarea" }]} onConfirm={async (v) => { await post(`/tasks/admin/attempts/${s}/appeal/resolve`, { accept: true, note: v.note || null }); done(); }} />
          <ActionDialog trigger={<Button size="xs" variant="outline"><X /> Bác</Button>} title="Bác khiếu nại bài làm" description="Giữ nguyên kết quả chấm." destructive fields={[{ name: "note", label: "Lý do", type: "textarea", required: true }]} onConfirm={async (v) => { await post(`/tasks/admin/attempts/${s}/appeal/resolve`, { accept: false, note: v.note || null }); done(); }} />
        </>
      );
    case "link":
      return (
        <>
          {rejectBtn((r) => post(`/links/admin/${s}/disable`, { reason: r, withholdRevenue: true }), reason, "Vô hiệu hoá")}
          <Button size="xs" variant="ghost" onClick={ok(() => post(`/links/admin/${s}/dismiss-reports`), "Đã bỏ báo cáo")}>
            Bỏ qua
          </Button>
        </>
      );
    case "referral":
      return <>{approveBtn(() => post(`/links/admin/referrals/${s}/approve`))}{rejectBtn((r) => post(`/links/admin/referrals/${s}/reject`, { reason: r }))}</>;
    default:
      return null;
  }
}

export default function ApprovalsPage() {
  const qc = useQueryClient();
  const [kind, setKind] = useUrlState("kind", "all");
  const [status, setStatus] = useUrlState("status", "pending");
  const [page, setPage] = useUrlPage();
  const q = useQuery({
    queryKey: ["approvals", kind, status, page],
    queryFn: () => api<Paged<Item>>("/admin/approvals", { query: { kind: kind === "all" ? undefined : kind, status, page, pageSize: 30 } }),
    refetchInterval: 15000,
  });
  const done = () => setTimeout(() => void qc.invalidateQueries({ queryKey: ["approvals"] }), 1500);

  return (
    <>
      <PageHeader
        title="Hàng đợi duyệt chung"
        description="Mọi việc chờ admin xử lý. Danh sách cập nhật sau vài giây."
        actions={
          <>
            <Select value={kind} onValueChange={(v) => { setKind(v); setPage(1); }}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Mọi loại</SelectItem>
                {Object.entries(APPROVAL_KIND).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["pending", "waiting", "approved", "rejected", "resolved", "cancelled"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {genericStatus(s)[0]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ActionDialog
              trigger={<Button variant="outline"><RefreshCw /> Dựng lại</Button>}
              title="Dựng lại hàng đợi từ nhật ký audit?"
              onConfirm={() => post("/admin/approvals/rebuild")}
              successMessage="Đã dựng lại"
            />
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
                      <TableHead>Nội dung</TableHead>
                      <TableHead>Người gửi</TableHead>
                      <TableHead className="text-right">Số tiền</TableHead>
                      <TableHead>Mở</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.items.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell className="pl-4 font-medium">{APPROVAL_KIND[it.kind] ?? it.kind}</TableCell>
                        <TableCell className="max-w-xs">
                          <div className="truncate">{it.title ?? "—"}</div>
                          {it.note && <div className="truncate text-xs text-muted-foreground">{it.note}</div>}
                        </TableCell>
                        <TableCell>
                          <UserName id={it.requesterId} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{it.amountVnd !== null ? formatVnd(it.amountVnd) : ""}</TableCell>
                        <TableCell title={formatDateTime(it.openedAt)}>{timeAgo(it.openedAt)}</TableCell>
                        <TableCell>
                          <StatusBadge entry={genericStatus(it.status)} />
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {it.status === "pending" && <Actions it={it} done={done} />}
                            <Button size="icon-xs" variant="ghost" asChild>
                              <Link href={DETAIL[it.kind]?.(it.subjectId) ?? "/admin"} aria-label="Chi tiết">
                                <ExternalLink />
                              </Link>
                            </Button>
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
