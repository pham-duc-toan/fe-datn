"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, PlayCircle, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConsentBox } from "@/components/project/consent-box";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/common/page-header";
import { QueryState } from "@/components/common/states";
import { StatusBadge, ToneBadge } from "@/components/common/status-badge";
import { ProjectName } from "@/components/labeling/label-view";
import { api, ApiError, del, post } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDateTime, formatVnd } from "@/lib/format";
import { appealState, attemptState, genericStatus, MEMBER_ROLE, projectStatus } from "@/lib/labels";
import type { AttemptSummary, Invitation, JoinRequest, Paged, ProjectListItem, Terms } from "@/lib/types";

function KetQua({ a }: { a: AttemptSummary }) {
  if (a.state !== "submitted") return <span className="text-muted-foreground">—</span>;
  if (a.passed === null) return <ToneBadge tone="muted">Chờ chấm</ToneBadge>;
  const dat = a.finalPassed ?? a.passed;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <ToneBadge tone={dat ? "success" : "danger"}>{dat ? "Đạt" : "Chưa đạt"}</ToneBadge>
      {a.agreementPercent !== null && <span className="text-xs text-muted-foreground">{a.agreementPercent}% / cần {a.passThresholdPercent}%</span>}
      {dat && a.rewarded !== false && <span className="text-xs text-emerald-700">+{formatVnd(a.rewardVnd)}</span>}
      {dat && a.rewarded === false && <span className="text-xs text-amber-700">hết suất thưởng</span>}
    </span>
  );
}

export default function MyWorkPage() {
  const qc = useQueryClient();
  const attempts = useQuery({ queryKey: ["my-attempts"], queryFn: () => api<AttemptSummary[]>("/tasks/me/attempts") });
  const invites = useQuery({ queryKey: ["invitations", "mine"], queryFn: () => api<Invitation[]>("/projects/invitations/mine") });
  const reqs = useQuery({ queryKey: ["join-requests", "mine"], queryFn: () => api<JoinRequest[]>("/projects/join-requests/mine") });
  const projects = useQuery({ queryKey: ["projects", "mine-ids"], queryFn: () => api<Paged<ProjectListItem>>("/projects", { query: { mine: true, pageSize: 100 } }) });
  // Lời mời vào dự án có cảnh báo / NDA: đọc và đồng ý ngay tại đây (dự án riêng tư chưa mở được trang dự án).
  const [consentFor, setConsentFor] = useState<Invitation | null>(null);
  const terms = useQuery({
    queryKey: ["terms", consentFor?.projectId],
    queryFn: () => api<Terms>(`/projects/${consentFor!.projectId}/terms`),
    enabled: Boolean(consentFor),
  });

  const act = async (fn: () => Promise<unknown>, ok: string, keys: string[][]) => {
    try {
      await fn();
      toast.success(ok);
      keys.forEach((k) => void qc.invalidateQueries({ queryKey: k }));
    } catch (e) {
      if (e instanceof ApiError && e.code === "can_dong_y_dieu_khoan") toast.error("Dự án cần bạn đồng ý điều khoản trước — mở trang dự án để đồng ý.");
      else toast.error(errorMessage(e));
    }
  };

  return (
    <>
      <Dialog open={Boolean(consentFor)} onOpenChange={(o) => !o && setConsentFor(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Tham gia “{consentFor?.projectName}”</DialogTitle>
          </DialogHeader>
          {terms.data && consentFor && (
            <ConsentBox
              terms={terms.data}
              submitLabel="Đồng ý và chấp nhận lời mời"
              onSubmit={async (c) => {
                if (!terms.data.myConsentValid) await post(`/projects/${consentFor.projectId}/consent`, c);
                await post(`/projects/invitations/${consentFor.invitationId}/accept`);
                toast.success("Đã vào dự án");
                setConsentFor(null);
                void qc.invalidateQueries({ queryKey: ["invitations", "mine"] });
                void qc.invalidateQueries({ queryKey: ["projects", "mine-ids"] });
              }}
            />
          )}
          {terms.error && <p className="text-sm text-destructive">{errorMessage(terms.error)}</p>}
        </DialogContent>
      </Dialog>
      <PageHeader title="Bài làm của tôi" description="Mỗi dự án bạn làm một bài (cả dự án), nộp một lần, được chấm khi dự án đóng thu bài." />
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Bài làm</CardTitle>
            <CardDescription>Thưởng trả cho cả bài khi đạt: giống đa số từ ngưỡng của dự án trở lên và không sai câu kiểm tra.</CardDescription>
          </CardHeader>
          <CardContent>
            <QueryState query={attempts} empty={(d) => d.length === 0}>
              {(d) => (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dự án</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Đã trả lời</TableHead>
                      <TableHead>Kết quả</TableHead>
                      <TableHead>Khiếu nại</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.map((a) => (
                      <TableRow key={a.attemptId}>
                        <TableCell>
                          <ProjectName id={a.projectId} />
                          <div className="text-xs text-muted-foreground">
                            {a.state === "inProgress" ? `hạn nộp ${formatDateTime(a.expiresAt)}` : a.submittedAt ? `nộp ${formatDateTime(a.submittedAt)}` : formatDateTime(a.startedAt)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge entry={attemptState(a.state)} />
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {a.answeredCount}/{a.questionCount}
                        </TableCell>
                        <TableCell>
                          <KetQua a={a} />
                        </TableCell>
                        <TableCell>{a.appealState !== "none" ? <StatusBadge entry={appealState(a.appealState)} /> : a.canAppeal ? <span className="text-xs">có thể khiếu nại</span> : "—"}</TableCell>
                        <TableCell className="text-right">
                          {a.state === "inProgress" ? (
                            <Button size="sm" asChild>
                              <Link href={`/lam-viec/${a.projectId}`}>
                                Làm tiếp <ArrowRight />
                              </Link>
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" asChild>
                              <Link href={`/bai-lam/${a.attemptId}`}>Chi tiết</Link>
                            </Button>
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

        <Card>
          <CardHeader>
            <CardTitle>Lời mời vào dự án</CardTitle>
          </CardHeader>
          <CardContent>
            <QueryState query={invites} empty={(d) => d.length === 0}>
              {(d) => (
                <div className="divide-y">
                  {d.map((i) => (
                    <div key={i.invitationId} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                      <div>
                        <Link href={`/cho/${i.projectId}`} className="font-medium hover:underline">
                          {i.projectName}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          Vai trò {MEMBER_ROLE[i.role]} · hết hạn {formatDateTime(i.expiresAt)} {i.requiresConsent && "· cần đồng ý điều khoản trước"}
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          onClick={() =>
                            i.requiresConsent
                              ? setConsentFor(i)
                              : void act(() => post(`/projects/invitations/${i.invitationId}/accept`), "Đã vào dự án", [["invitations", "mine"], ["projects", "mine-ids"]])
                          }
                        >
                          <Check /> Chấp nhận
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void act(() => post(`/projects/invitations/${i.invitationId}/decline`), "Đã từ chối", [["invitations", "mine"]])}>
                          <X /> Từ chối
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </QueryState>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dự án đã tham gia</CardTitle>
          </CardHeader>
          <CardContent>
            <QueryState query={projects} empty={(d) => d.items.length === 0}>
              {(d) => (
                <div className="divide-y">
                  {d.items.map((p) => (
                    <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                      <div className="flex items-center gap-2">
                        <Link href={p.isOwner ? `/du-an/${p.id}` : `/cho/${p.id}`} className="font-medium hover:underline">
                          {p.name}
                        </Link>
                        <StatusBadge entry={projectStatus(p.status)} />
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" asChild>
                          <Link href={p.isOwner ? `/du-an/${p.id}` : `/cho/${p.id}`}>
                            <PlayCircle /> Mở dự án
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </QueryState>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Đơn xin tham gia</CardTitle>
          </CardHeader>
          <CardContent>
            <QueryState query={reqs} empty={(d) => d.length === 0}>
              {(d) => (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dự án</TableHead>
                      <TableHead>Gửi lúc</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Link href={`/cho/${r.projectId}`} className="hover:underline">
                            {r.projectName}
                          </Link>
                          {r.rejectReason && <div className="text-xs text-destructive">{r.rejectReason}</div>}
                        </TableCell>
                        <TableCell>{formatDateTime(r.createdAt)}</TableCell>
                        <TableCell>
                          <StatusBadge entry={genericStatus(r.status)} />
                        </TableCell>
                        <TableCell className="text-right">
                          {r.status === "pending" && (
                            <Button size="xs" variant="ghost" onClick={() => void act(() => del(`/projects/${r.projectId}/join-requests/mine`), "Đã rút đơn", [["join-requests", "mine"]])}>
                              Rút đơn
                            </Button>
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
      </div>
    </>
  );
}
