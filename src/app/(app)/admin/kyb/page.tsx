"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Eye, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageHeader } from "@/components/common/page-header";
import { ActionDialog } from "@/components/common/action-dialog";
import { KeyValue } from "@/components/common/misc";
import { Pager } from "@/components/common/pager";
import { Loading, QueryState } from "@/components/common/states";
import { StatusBadge } from "@/components/common/status-badge";
import { api, post } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { kybStatus, KYB_STATUS } from "@/lib/labels";
import type { KybProfile, Paged } from "@/lib/types";
import { useUrlPage, useUrlState } from "@/lib/use-url-state";

type Row = { profile: KybProfile; email: string; displayName: string; accountStatus: string; licenseUrl: string | null };

function Detail({ id, onDone }: { id: string; onDone: () => void }) {
  const q = useQuery({ queryKey: ["kyb-admin", id], queryFn: () => api<Row>(`/kyb/admin/${id}`) });
  if (q.isPending) return <Loading />;
  if (!q.data) return null;
  const r = q.data;
  const url = r.licenseUrl;
  const isPdf = (r.profile.licenseFileName ?? "").toLowerCase().endsWith(".pdf");
  return (
    <div className="space-y-4 px-4 pb-6">
      <KeyValue
        className="sm:grid-cols-1"
        items={[
          ["Doanh nghiệp", r.profile.companyName],
          ["Mã số thuế", r.profile.taxCode],
          ["Địa chỉ", r.profile.address],
          ["Tài khoản", `${r.displayName} · ${r.email}`],
          ["Trạng thái", <StatusBadge key="s" entry={kybStatus(r.profile.status)} />],
          ["Nộp lúc", formatDateTime(r.profile.submittedAt)],
        ]}
      />
      {url ? (
        isPdf ? (
          <iframe src={url} className="h-[60vh] w-full rounded border" title="Giấy phép" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Giấy phép" className="w-full rounded border" />
        )
      ) : (
        <p className="text-sm text-muted-foreground">Không có giấy phép.</p>
      )}
      {url && (
        <Button variant="outline" size="sm" onClick={() => void q.refetch()}>
          Lấy lại link xem (hết hạn sau 5 phút)
        </Button>
      )}
      {r.profile.status === "submitted" && (
        <div className="flex gap-2">
          <Button
            onClick={async () => {
              try {
                await post(`/kyb/admin/${id}/approve`);
                toast.success("Đã duyệt hồ sơ");
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
            title="Từ chối hồ sơ"
            fields={[{ name: "reason", label: "Lý do", type: "textarea", required: true }]}
            destructive
            onConfirm={async (v) => {
              await post(`/kyb/admin/${id}/reject`, { reason: v.reason });
              onDone();
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function AdminKybPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useUrlState("status", "submitted");
  const [page, setPage] = useUrlPage();
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["kyb-admin-list", status, page], queryFn: () => api<Paged<Row>>("/kyb/admin", { query: { status, page, pageSize: 20 } }) });
  return (
    <>
      <PageHeader
        title="Hồ sơ doanh nghiệp (KYB)"
        description="Đối chiếu giấy phép và mã số thuế. Hồ sơ đã xác minh không sửa được."
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
                      <TableHead className="pl-4">Doanh nghiệp</TableHead>
                      <TableHead>Mã số thuế</TableHead>
                      <TableHead>Tài khoản</TableHead>
                      <TableHead>Nộp lúc</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.items.map((r) => (
                      <TableRow key={r.profile.businessId}>
                        <TableCell className="pl-4 font-medium">{r.profile.companyName || "—"}</TableCell>
                        <TableCell>{r.profile.taxCode}</TableCell>
                        <TableCell className="text-sm">
                          {r.displayName}
                          <div className="text-xs text-muted-foreground">{r.email}</div>
                        </TableCell>
                        <TableCell>{formatDateTime(r.profile.submittedAt)}</TableCell>
                        <TableCell>
                          <StatusBadge entry={kybStatus(r.profile.status)} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="xs" variant="outline" onClick={() => setOpen(r.profile.businessId)}>
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
            <SheetTitle>Chi tiết hồ sơ</SheetTitle>
          </SheetHeader>
          {open && (
            <Detail
              id={open}
              onDone={() => {
                setOpen(null);
                void qc.invalidateQueries({ queryKey: ["kyb-admin-list"] });
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
