"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, KeyRound, Search, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/page-header";
import { ActionDialog } from "@/components/common/action-dialog";
import { CopyButton } from "@/components/common/misc";
import { Pager } from "@/components/common/pager";
import { QueryState } from "@/components/common/states";
import { StatusBadge } from "@/components/common/status-badge";
import { api, post } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { genericStatus, kybStatus, ROLE_LABEL } from "@/lib/labels";
import type { Paged } from "@/lib/types";
import { useUrlPage, useUrlState } from "@/lib/use-url-state";

type U = { userId: string; email: string; username?: string; displayName: string; roles: string[]; status: string; blockedAt: string | null; blockedReason: string | null; kybStatus: string | null; createdAt: string };

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [term, setTerm] = useUrlState("q", "");
  const [search, setSearch] = useState(term);
  const [role, setRole] = useUrlState("role", "all");
  const [status, setStatus] = useUrlState("status", "all");
  const [page, setPage] = useUrlPage();
  const q = useQuery({
    queryKey: ["admin-users", term, role, status, page],
    queryFn: () => api<Paged<U>>("/users/admin", { query: { search: term || undefined, role: role === "all" ? undefined : role, status: status === "all" ? undefined : status, page, pageSize: 20 } }),
  });
  const done = () => void qc.invalidateQueries({ queryKey: ["admin-users"] });
  return (
    <>
      <PageHeader title="Người dùng" description="Khoá có hiệu lực ngay: đăng nhập bị chặn, phiên đang dùng bị thu hồi, người bị khoá nhận email có lý do." />
      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setTerm(search.trim());
          setPage(1);
        }}
      >
        <Input className="w-72" placeholder="Tìm email hoặc tên" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button type="submit" variant="outline">
          <Search /> Tìm
        </Button>
        <Select value={role} onValueChange={(v) => { setRole(v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Mọi vai trò</SelectItem>
            {Object.entries(ROLE_LABEL).map(([k, v]) => (
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
            <SelectItem value="all">Mọi trạng thái</SelectItem>
            <SelectItem value="active">Hoạt động</SelectItem>
            <SelectItem value="blocked">Bị khoá</SelectItem>
          </SelectContent>
        </Select>
      </form>
      <Card className="py-0">
        <CardContent className="px-0">
          <QueryState query={q} empty={(d) => d.items.length === 0}>
            {(d) => (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Tài khoản</TableHead>
                      <TableHead>Vai trò</TableHead>
                      <TableHead>KYB</TableHead>
                      <TableHead>Tạo lúc</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.items.map((u) => (
                      <TableRow key={u.userId}>
                        <TableCell className="pl-4">
                          <div className="font-medium">{u.displayName} {u.username && <span className="text-xs font-normal text-muted-foreground">@{u.username}</span>}</div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            {u.email} <CopyButton value={u.userId} />
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{u.roles.map((r) => ROLE_LABEL[r] ?? r).join(", ")}</TableCell>
                        <TableCell>{u.kybStatus ? <StatusBadge entry={kybStatus(u.kybStatus)} /> : "—"}</TableCell>
                        <TableCell>{formatDateTime(u.createdAt)}</TableCell>
                        <TableCell>
                          <StatusBadge entry={genericStatus(u.status)} />
                          {u.blockedReason && <div className="max-w-40 truncate text-xs text-muted-foreground">{u.blockedReason}</div>}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {u.status === "active" ? (
                              <ActionDialog trigger={<Button size="xs" variant="outline"><Ban /> Khoá</Button>} title={`Khoá ${u.displayName}?`} destructive fields={[{ name: "reason", label: "Lý do", type: "textarea", required: true }]} onConfirm={async (v) => { await post(`/users/admin/${u.userId}/block`, { reason: v.reason }); done(); }} successMessage="Đã khoá tài khoản" />
                            ) : (
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={async () => {
                                  try {
                                    await post(`/users/admin/${u.userId}/unblock`);
                                    toast.success("Đã mở khoá");
                                    done();
                                  } catch (e) {
                                    toast.error(errorMessage(e));
                                  }
                                }}
                              >
                                <Undo2 /> Mở khoá
                              </Button>
                            )}
                            <ActionDialog trigger={<Button size="icon-xs" variant="ghost" aria-label="Đặt lại 2FA"><KeyRound /></Button>} title="Đặt lại xác thực hai lớp?" description="Dùng khi người dùng mất cả điện thoại lẫn mã dự phòng. Người dùng nhận email thông báo." onConfirm={() => post(`/users/admin/${u.userId}/2fa/reset`)} successMessage="Đã đặt lại 2FA" />
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
