"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Eye, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/common/page-header";
import { ActionDialog } from "@/components/common/action-dialog";
import { KeyValue } from "@/components/common/misc";
import { Pager } from "@/components/common/pager";
import { Loading, QueryState } from "@/components/common/states";
import { StatusBadge } from "@/components/common/status-badge";
import { UserName } from "@/components/common/user-name";
import { api, post } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDate, formatDateTime } from "@/lib/format";
import { kybStatus, KYB_STATUS } from "@/lib/labels";
import type { IdentityVerification, Paged } from "@/lib/types";
import { useUrlPage, useUrlState } from "@/lib/use-url-state";

type AdminRow = { verification: IdentityVerification; email: string; displayName: string; age: number | null; frontUrl: string | null; backUrl: string | null; duplicateOfUserId: string | null };

function Detail({ id, onDone }: { id: string; onDone: () => void }) {
  // Mỗi lần mở chi tiết, backend ghi một dòng audit "đã xem giấy tờ" (S-07).
  const q = useQuery({ queryKey: ["idv-admin", id], queryFn: () => api<AdminRow>(`/users/admin/identity-verifications/${id}`), staleTime: 0, refetchInterval: 4 * 60 * 1000 });
  if (q.isPending) return <Loading />;
  if (!q.data) return null;
  const r = q.data;
  const v = r.verification;
  return (
    <div className="space-y-4 px-4 pb-6">
      {r.duplicateOfUserId && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>
            Số giấy tờ trùng với tài khoản đã xác minh <UserName id={r.duplicateOfUserId} /> — mỗi giấy tờ chỉ cho một tài khoản.
          </AlertDescription>
        </Alert>
      )}
      <KeyValue
        className="sm:grid-cols-1"
        items={[
          ["Họ tên", v.fullName],
          ["Ngày sinh", `${formatDate(v.dateOfBirth)}${r.age !== null ? ` (${r.age} tuổi)` : ""}`],
          ["Số giấy tờ", v.idNumberLast4 ? `****${v.idNumberLast4}` : "—"],
          ["Tài khoản", `${r.displayName} · ${r.email}`],
          ["Trạng thái", <StatusBadge key="s" entry={kybStatus(v.status)} />],
          ["Nộp lúc", formatDateTime(v.submittedAt)],
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {[["Mặt trước", r.frontUrl], ["Mặt sau", r.backUrl]].map(([label, url]) => (
          <div key={label} className="space-y-1">
            <p className="text-sm font-medium">{label}</p>
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={label ?? ""} className="w-full rounded border" onError={() => void q.refetch()} />
            ) : (
              <p className="text-sm text-muted-foreground">Không có ảnh</p>
            )}
          </div>
        ))}
      </div>
      {v.status === "submitted" && (
        <div className="flex gap-2">
          <Button
            onClick={async () => {
              try {
                await post(`/users/admin/identity-verifications/${id}/approve`);
                toast.success("Đã xác minh");
                onDone();
              } catch (e) {
                toast.error(errorMessage(e));
              }
            }}
          >
            <Check /> Duyệt
          </Button>
          <ActionDialog
            trigger={<Button variant="destructive"><X /> Từ chối</Button>}
            title="Từ chối xác minh"
            fields={[{ name: "reason", label: "Lý do", type: "textarea", required: true }]}
            destructive
            onConfirm={async (vv) => {
              await post(`/users/admin/identity-verifications/${id}/reject`, { reason: vv.reason });
              onDone();
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function AdminIdentityPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useUrlState("status", "submitted");
  const [page, setPage] = useUrlPage();
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["idv-list", status, page], queryFn: () => api<Paged<AdminRow>>("/users/admin/identity-verifications", { query: { status, page, pageSize: 20 } }) });
  return (
    <>
      <PageHeader
        title="Xác minh danh tính"
        description="Mỗi lần mở ảnh giấy tờ đều được ghi nhật ký audit (ai xem, của ai, lúc nào)."
        actions={
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(KYB_STATUS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v[0]}
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
                      <TableHead className="pl-4">Người</TableHead>
                      <TableHead>Họ tên khai</TableHead>
                      <TableHead>Tuổi</TableHead>
                      <TableHead>Nộp lúc</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.items.map((r) => (
                      <TableRow key={r.verification.userId}>
                        <TableCell className="pl-4 text-sm">
                          {r.displayName}
                          <div className="text-xs text-muted-foreground">{r.email}</div>
                        </TableCell>
                        <TableCell>{r.verification.fullName}</TableCell>
                        <TableCell>{r.age ?? "—"}</TableCell>
                        <TableCell>{formatDateTime(r.verification.submittedAt)}</TableCell>
                        <TableCell>
                          <StatusBadge entry={kybStatus(r.verification.status)} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="xs" variant="outline" onClick={() => setOpen(r.verification.userId)}>
                            <Eye /> Xem giấy tờ
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
            <SheetTitle>Giấy tờ xác minh</SheetTitle>
          </SheetHeader>
          {open && (
            <Detail
              id={open}
              onDone={() => {
                setOpen(null);
                void qc.invalidateQueries({ queryKey: ["idv-list"] });
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
