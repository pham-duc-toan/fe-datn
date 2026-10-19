"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
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
import { errorMessage } from "@/lib/errors";
import { formatDateTime, formatVnd } from "@/lib/format";
import { withdrawalState, WITHDRAWAL_STATE } from "@/lib/labels";
import type { Paged, Withdrawal } from "@/lib/types";
import { useUrlPage, useUrlState } from "@/lib/use-url-state";

export default function AdminWithdrawalsPage() {
  const qc = useQueryClient();
  const [state, setState] = useUrlState("state", "pendingApproval");
  const [page, setPage] = useUrlPage();
  const q = useQuery({ queryKey: ["admin-withdrawals", state, page], queryFn: () => api<Paged<Withdrawal>>("/ledger/admin/withdrawals", { query: { state, page, pageSize: 20 } }) });
  const done = () => void qc.invalidateQueries({ queryKey: ["admin-withdrawals"] });
  return (
    <>
      <PageHeader
        title="Duyệt rút tiền"
        description="Lệnh vượt ngưỡng tự duyệt vào đây; tiền của labeler đã bị giữ. Từ chối thì tiền hoàn lại ví."
        actions={
          <Select value={state} onValueChange={(v) => { setState(v); setPage(1); }}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(WITHDRAWAL_STATE).map(([k, v]) => (
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
                      <TableHead className="pl-4">Người rút</TableHead>
                      <TableHead className="text-right">Số tiền</TableHead>
                      <TableHead className="text-right">Thuế</TableHead>
                      <TableHead className="text-right">Thực nhận</TableHead>
                      <TableHead>Tài khoản nhận</TableHead>
                      <TableHead>Tạo lúc</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.items.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell className="pl-4">
                          <UserName id={w.labelerId} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatVnd(w.amountVnd)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatVnd(w.taxVnd)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatVnd(w.netVnd)}</TableCell>
                        <TableCell className="max-w-48 truncate text-sm">{w.bankAccount}</TableCell>
                        <TableCell>{formatDateTime(w.createdAt)}</TableCell>
                        <TableCell>
                          <StatusBadge entry={withdrawalState(w.state)} />
                          {w.failureReason && <div className="text-xs text-destructive">{w.failureReason}</div>}
                        </TableCell>
                        <TableCell>
                          {w.state === "pendingApproval" && (
                            <div className="flex justify-end gap-1">
                              <Button
                                size="xs"
                                onClick={async () => {
                                  try {
                                    await post(`/ledger/admin/withdrawals/${w.id}/approve`);
                                    toast.success("Đã duyệt — đang chuyển khoản");
                                    done();
                                  } catch (e) {
                                    toast.error(errorMessage(e));
                                    done();
                                  }
                                }}
                              >
                                <Check /> Duyệt
                              </Button>
                              <ActionDialog trigger={<Button size="xs" variant="outline"><X /> Từ chối</Button>} title="Từ chối lệnh rút" destructive fields={[{ name: "reason", label: "Lý do", type: "textarea", required: true }]} onConfirm={async (v) => { await post(`/ledger/admin/withdrawals/${w.id}/reject`, { reason: v.reason }); done(); }} />
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
