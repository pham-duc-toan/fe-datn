"use client";

import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/common/page-header";
import { ActionDialog } from "@/components/common/action-dialog";
import { Pager } from "@/components/common/pager";
import { QueryState } from "@/components/common/states";
import { StatusBadge } from "@/components/common/status-badge";
import { UserName } from "@/components/common/user-name";
import { api, del, post } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { linkStatus } from "@/lib/labels";
import type { Paged, ShortLink } from "@/lib/types";
import { useUrlPage } from "@/lib/use-url-state";

type Review = { link: ShortLink; ownerId: string; reportCount: number; recentReasons: string[] };
type Domain = { domain: string; reason: string; createdAt: string; disabledLinkCount: number };
type Flag = { referrerId: string; referredId: string; reasons: string; createdAt: string };
const FLAG_REASON: Record<string, string> = { trung_ip_nguoi_gioi_thieu: "Trùng IP người giới thiệu", nhieu_tai_khoan_cung_ip: "Nhiều tài khoản cùng IP", dot_bien: "Tăng đột biến" };

export default function AdminLinksPage() {
  const qc = useQueryClient();
  const params = useSearchParams();
  const [page, setPage] = useUrlPage();
  const queue = useQuery({ queryKey: ["link-review", page], queryFn: () => api<Paged<Review>>("/links/admin/review-queue", { query: { page, pageSize: 20 } }) });
  const domains = useQuery({ queryKey: ["blocked-domains"], queryFn: () => api<Domain[]>("/links/admin/blocked-domains") });
  const flagged = useQuery({ queryKey: ["flagged-referrals"], queryFn: () => api<Flag[]>("/links/admin/referrals/flagged") });
  const inv = (k: string) => void qc.invalidateQueries({ queryKey: [k] });

  return (
    <>
      <PageHeader title="Kiểm duyệt link" description="Link bị báo cáo, tên miền bị chặn, giới thiệu nghi lạm dụng." />
      <Tabs defaultValue={params.get("tab") ?? "bao-cao"}>
        <TabsList>
          <TabsTrigger value="bao-cao">Link bị báo cáo</TabsTrigger>
          <TabsTrigger value="ten-mien">Tên miền bị chặn</TabsTrigger>
          <TabsTrigger value="gioi-thieu">Giới thiệu nghi lạm dụng</TabsTrigger>
        </TabsList>
        <TabsContent value="bao-cao" className="mt-4">
          <Card className="py-0">
            <CardContent className="px-0">
              <QueryState query={queue} empty={(d) => d.items.length === 0}>
                {(d) => (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-4">Link</TableHead>
                          <TableHead>Chủ link</TableHead>
                          <TableHead>Báo cáo</TableHead>
                          <TableHead>Trạng thái</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {d.items.map((r) => (
                          <TableRow key={r.link.id}>
                            <TableCell className="max-w-sm pl-4">
                              <div className="font-mono text-sm">/g/{r.link.code}</div>
                              <div className="truncate text-xs text-muted-foreground">{r.link.destinationUrl}</div>
                            </TableCell>
                            <TableCell>
                              <UserName id={r.ownerId} />
                            </TableCell>
                            <TableCell className="text-sm">
                              {r.reportCount} — {r.recentReasons.slice(0, 2).join("; ")}
                            </TableCell>
                            <TableCell>
                              <StatusBadge entry={linkStatus(r.link.status)} />
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-1">
                                <ActionDialog
                                  trigger={<Button size="xs" variant="destructive">Vô hiệu hoá</Button>}
                                  title="Vô hiệu hoá link"
                                  destructive
                                  fields={[
                                    { name: "reason", label: "Lý do", type: "textarea", required: true },
                                    { name: "withholdRevenue", label: "Giữ lại doanh thu đang treo của link", type: "checkbox", defaultValue: true },
                                  ]}
                                  onConfirm={async (v) => {
                                    await post(`/links/admin/${r.link.id}/disable`, { reason: v.reason, withholdRevenue: v.withholdRevenue === true });
                                    inv("link-review");
                                  }}
                                />
                                <Button
                                  size="xs"
                                  variant="outline"
                                  onClick={async () => {
                                    try {
                                      await post(`/links/admin/${r.link.id}/dismiss-reports`);
                                      inv("link-review");
                                    } catch (e) {
                                      toast.error(errorMessage(e));
                                    }
                                  }}
                                >
                                  Bỏ qua
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
        </TabsContent>
        <TabsContent value="ten-mien" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>Tên miền bị chặn</CardTitle>
                <CardDescription>Chặn cả tên miền con và vô hiệu hoá ngay mọi link đang chạy tới đó (giữ doanh thu).</CardDescription>
              </div>
              <ActionDialog
                trigger={<Button size="sm"><Plus /> Chặn tên miền</Button>}
                title="Chặn tên miền"
                fields={[
                  { name: "domain", label: "Tên miền", required: true, placeholder: "casino.com" },
                  { name: "reason", label: "Lý do", required: true },
                ]}
                onConfirm={async (v) => {
                  const r = await post<Domain>("/links/admin/blocked-domains", { domain: v.domain, reason: v.reason });
                  toast.success(`Đã chặn — vô hiệu hoá ${r.disabledLinkCount} link`);
                  inv("blocked-domains");
                }}
              />
            </CardHeader>
            <CardContent>
              <QueryState query={domains} empty={(d) => d.length === 0}>
                {(d) => (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tên miền</TableHead>
                        <TableHead>Lý do</TableHead>
                        <TableHead>Lúc</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {d.map((x) => (
                        <TableRow key={x.domain}>
                          <TableCell className="font-mono">{x.domain}</TableCell>
                          <TableCell>{x.reason}</TableCell>
                          <TableCell>{formatDateTime(x.createdAt)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              onClick={async () => {
                                try {
                                  await del(`/links/admin/blocked-domains/${encodeURIComponent(x.domain)}`);
                                  inv("blocked-domains");
                                } catch (e) {
                                  toast.error(errorMessage(e));
                                }
                              }}
                            >
                              <Trash2 />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </QueryState>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="gioi-thieu" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Giới thiệu bị gắn cờ</CardTitle>
              <CardDescription>Người dùng vẫn nhập mã thành công, nhưng hoa hồng chỉ tính sau khi admin chấp nhận.</CardDescription>
            </CardHeader>
            <CardContent>
              <QueryState query={flagged} empty={(d) => d.length === 0}>
                {(d) => (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Người giới thiệu</TableHead>
                        <TableHead>Người được mời</TableHead>
                        <TableHead>Dấu hiệu</TableHead>
                        <TableHead>Lúc</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {d.map((f) => (
                        <TableRow key={f.referredId}>
                          <TableCell>
                            <UserName id={f.referrerId} />
                          </TableCell>
                          <TableCell>
                            <UserName id={f.referredId} />
                          </TableCell>
                          <TableCell className="text-sm">
                            {f.reasons
                              .split(/[,;\s]+/)
                              .filter(Boolean)
                              .map((r) => FLAG_REASON[r] ?? r)
                              .join(", ")}
                          </TableCell>
                          <TableCell>{formatDateTime(f.createdAt)}</TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button
                                size="xs"
                                onClick={async () => {
                                  try {
                                    await post(`/links/admin/referrals/${f.referredId}/approve`);
                                    inv("flagged-referrals");
                                  } catch (e) {
                                    toast.error(errorMessage(e));
                                  }
                                }}
                              >
                                <Check /> Chấp nhận
                              </Button>
                              <ActionDialog trigger={<Button size="xs" variant="outline"><X /> Từ chối</Button>} title="Từ chối giới thiệu" fields={[{ name: "reason", label: "Lý do", required: true }]} onConfirm={async (v) => { await post(`/links/admin/referrals/${f.referredId}/reject`, { reason: v.reason }); inv("flagged-referrals"); }} />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </QueryState>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
