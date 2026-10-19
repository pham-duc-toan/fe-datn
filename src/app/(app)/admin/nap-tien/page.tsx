"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/page-header";
import { ActionDialog } from "@/components/common/action-dialog";
import { CopyButton } from "@/components/common/misc";
import { Pager } from "@/components/common/pager";
import { QueryState } from "@/components/common/states";
import { StatusBadge } from "@/components/common/status-badge";
import { UserName } from "@/components/common/user-name";
import { api, post } from "@/lib/api";
import { formatDateTime, formatVnd } from "@/lib/format";
import { depositStatus, DEPOSIT_STATUS, PROVIDER_LABEL } from "@/lib/labels";
import type { Deposit, Paged } from "@/lib/types";
import { useUrlPage, useUrlState } from "@/lib/use-url-state";

export default function AdminDepositsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useUrlState("status", "awaitingApproval");
  const [page, setPage] = useUrlPage();
  const q = useQuery({ queryKey: ["admin-deposits", status, page], queryFn: () => api<Paged<Deposit>>("/payments/admin/deposits", { query: { status, page, pageSize: 20 } }) });
  const done = () => void qc.invalidateQueries({ queryKey: ["admin-deposits"] });
  return (
    <>
      <PageHeader
        title="Đối chiếu nạp chuyển khoản"
        description="Tìm giao dịch trong sao kê theo nội dung chuyển khoản và số tiền, nhập mã giao dịch ngân hàng khi duyệt (một mã chỉ cho một lệnh)."
        actions={
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DEPOSIT_STATUS).map(([k, v]) => (
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
                      <TableHead className="pl-4">Doanh nghiệp</TableHead>
                      <TableHead className="text-right">Số tiền</TableHead>
                      <TableHead>Nội dung CK</TableHead>
                      <TableHead>Kênh</TableHead>
                      <TableHead>Báo chuyển</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.items.map((x) => (
                      <TableRow key={x.intentId}>
                        <TableCell className="pl-4">
                          <UserName id={x.businessId} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatVnd(x.amountVnd)}</TableCell>
                        <TableCell>
                          {x.transferCode && (
                            <span className="flex items-center gap-1">
                              <code className="text-xs">{x.transferCode}</code> <CopyButton value={x.transferCode} />
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{PROVIDER_LABEL[x.provider] ?? x.provider}</TableCell>
                        <TableCell>{formatDateTime(x.transferredAt)}</TableCell>
                        <TableCell>
                          <StatusBadge entry={depositStatus(x.status)} />
                        </TableCell>
                        <TableCell>
                          {(x.status === "awaitingApproval" || x.status === "pending") && x.provider === "manual_transfer" && (
                            <div className="flex justify-end gap-1">
                              <ActionDialog trigger={<Button size="xs"><Check /> Duyệt</Button>} title="Xác nhận đã nhận tiền" fields={[{ name: "bankTxnRef", label: "Mã giao dịch ngân hàng", placeholder: "FT26100812345", hint: "Nên có — chống duyệt trùng" }]} onConfirm={async (v) => { await post(`/payments/admin/deposits/${x.intentId}/approve`, { bankTxnRef: v.bankTxnRef || null }); done(); }} successMessage="Đã cộng tiền vào ví doanh nghiệp" />
                              <ActionDialog trigger={<Button size="xs" variant="outline"><X /> Từ chối</Button>} title="Từ chối lệnh nạp" destructive fields={[{ name: "reason", label: "Lý do", type: "textarea", required: true }]} onConfirm={async (v) => { await post(`/payments/admin/deposits/${x.intentId}/reject`, { reason: v.reason }); done(); }} />
                            </div>
                          )}
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
