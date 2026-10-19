"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Loader2, Star, Ticket, Trash2, UserPlus, Undo2, Check, X, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, CopyButton } from "@/components/common/misc";
import { ActionDialog } from "@/components/common/action-dialog";
import { StatusBadge, ToneBadge } from "@/components/common/status-badge";
import { QueryState } from "@/components/common/states";
import { UserName } from "@/components/common/user-name";
import { api, del, post, put } from "@/lib/api";
import { errorMessage, messageForCode } from "@/lib/errors";
import { formatDateTime, formatInviteCode } from "@/lib/format";
import { genericStatus, MEMBER_ROLE } from "@/lib/labels";
import type { InviteCode, Invitation, JoinRequest, Member, Project } from "@/lib/types";

type BatchResult = { added: number; invited: number; results: { input: string; userId: string | null; displayName: string | null; status: string; message: string | null }[] };

function Stars({ value, onRate }: { value: number; onRate: (n: number) => void }) {
  return (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onRate(n)} aria-label={`${n} sao`}>
          <Star className={`size-4 ${n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
        </button>
      ))}
    </span>
  );
}

export function MembersTab({ project: p }: { project: Project }) {
  const qc = useQueryClient();
  const id = p.id;
  const members = useQuery({ queryKey: ["members", id], queryFn: () => api<Member[]>(`/projects/${id}/members`) });
  const ratings = useQuery({ queryKey: ["ratings", id], queryFn: () => api<{ labelerId: string; stars: number }[]>(`/projects/${id}/ratings`) });
  const codes = useQuery({ queryKey: ["invite-codes", id], queryFn: () => api<InviteCode[]>(`/projects/${id}/invite-codes`) });
  const [jrStatus, setJrStatus] = useState("pending");
  const requests = useQuery({ queryKey: ["join-requests", id, jrStatus], queryFn: () => api<JoinRequest[]>(`/projects/${id}/join-requests`, { query: { status: jrStatus } }) });
  const invitations = useQuery({ queryKey: ["invitations", id], queryFn: () => api<Invitation[]>(`/projects/${id}/invitations`) });
  const consents = useQuery({ queryKey: ["consents", id], queryFn: () => api<{ userId: string; ndaSignedName: string | null; ndaSignedAt: string | null; contentWarningAcceptedAt: string | null; ndaVersion: number | null }[]>(`/projects/${id}/consents`), enabled: p.consentRequired });
  const [role, setRole] = useState("labeler");
  const [userIds, setUserIds] = useState("");
  const [emails, setEmails] = useState("");
  const [result, setResult] = useState<BatchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const rateMap = new Map((ratings.data ?? []).map((r) => [r.labelerId, r.stars]));

  const inv = (k: string) => qc.invalidateQueries({ queryKey: [k, id] });
  const act = async (fn: () => Promise<unknown>, ok: string, keys: string[]) => {
    try {
      await fn();
      toast.success(ok);
      keys.forEach((k) => void inv(k));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  async function invite() {
    setBusy(true);
    try {
      const r = await post<BatchResult>(`/projects/${id}/members/batch`, {
        role,
        userIds: userIds.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean),
        emails: emails.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean),
      });
      setResult(r);
      void inv("members");
      void inv("invitations");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const joinLink = (code: string) => `${typeof window !== "undefined" ? window.location.origin : ""}/join?code=${code}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Thành viên ({members.data?.length ?? 0})</CardTitle>
          <CardDescription>Chặn labeler thì bài họ đang làm dở bị huỷ ngay.</CardDescription>
        </CardHeader>
        <CardContent>
          <QueryState query={members} empty={(d) => d.length === 0}>
            {(d) => (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Người</TableHead>
                    <TableHead>Vai trò</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Tham gia</TableHead>
                    <TableHead>Đánh giá</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.map((m) => (
                    <TableRow key={m.userId}>
                      <TableCell>
                        <UserName id={m.userId} withAvatar />
                      </TableCell>
                      <TableCell>{MEMBER_ROLE[m.role]}</TableCell>
                      <TableCell>
                        <StatusBadge entry={genericStatus(m.state)} />
                      </TableCell>
                      <TableCell>{formatDateTime(m.joinedAt)}</TableCell>
                      <TableCell>{m.role === "labeler" && <Stars value={rateMap.get(m.userId) ?? 0} onRate={(n) => void act(() => put(`/projects/${id}/ratings/${m.userId}`, { stars: n }), "Đã đánh giá", ["ratings"])} />}</TableCell>
                      <TableCell className="text-right">
                        {m.role !== "owner" && (
                          <div className="flex justify-end gap-1">
                            {m.state === "active" ? (
                              <Button size="xs" variant="outline" onClick={() => void act(() => post(`/projects/${id}/members/${m.userId}/block`), "Đã chặn", ["members"])}>
                                <Ban /> Chặn
                              </Button>
                            ) : (
                              <Button size="xs" variant="outline" onClick={() => void act(() => post(`/projects/${id}/members/${m.userId}/unblock`), "Đã bỏ chặn", ["members"])}>
                                <Undo2 /> Bỏ chặn
                              </Button>
                            )}
                            <Button size="icon-xs" variant="ghost" onClick={() => void act(() => del(`/projects/${id}/members/${m.userId}`), "Đã xoá khỏi dự án", ["members"])}>
                              <Trash2 />
                            </Button>
                          </div>
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Mời thành viên</CardTitle>
            <CardDescription>
              Theo userId: thêm thẳng, kết quả chi tiết. Theo email: luôn gửi lời mời — người nhận tự chấp nhận; không lộ email nào có tài khoản.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Vai trò">
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="labeler">Người gán nhãn</SelectItem>
                  <SelectItem value="reviewer">Người duyệt</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="userId" hint="Mỗi dòng / dấu phẩy một id">
              <Textarea rows={2} value={userIds} onChange={(e) => setUserIds(e.target.value)} />
            </Field>
            <Field label="Email" hint="Tối đa theo hạn mức email / 24 giờ">
              <Textarea rows={2} value={emails} onChange={(e) => setEmails(e.target.value)} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void invite()} disabled={busy || (!userIds.trim() && !emails.trim())}>
                {busy ? <Loader2 className="animate-spin" /> : <UserPlus />} Mời
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    setResult(await post<BatchResult>(`/projects/${id}/members/invite-preferred`));
                    void inv("members");
                  } catch (e) {
                    toast.error(errorMessage(e));
                  }
                }}
              >
                <Users /> Mời cả danh sách ưu tiên
              </Button>
            </div>
            {result && (
              <div className="space-y-1 rounded-md border p-2 text-sm">
                <p className="font-medium">
                  Đã thêm {result.added} · đã mời {result.invited}
                </p>
                {result.results.map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate">{r.displayName ?? r.input}</span>
                    <ToneBadge tone={r.status === "added" ? "success" : r.status === "invited" || r.status === "pending_consent" ? "info" : "warning"}>
                      {r.status === "added" ? "Đã thêm" : r.status === "invited" ? "Đã gửi lời mời" : r.status === "pending_consent" ? "Chờ tự đồng ý" : messageForCode(r.status) ?? r.status}
                    </ToneBadge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Mã mời</CardTitle>
              <CardDescription>Vào được cả dự án riêng tư; không bỏ qua cấp độ / uy tín.</CardDescription>
            </div>
            <ActionDialog
              trigger={<Button size="sm"><Ticket /> Tạo mã</Button>}
              title="Tạo mã mời"
              fields={[
                { name: "maxUses", label: "Số lượt tối đa", type: "number", hint: "Trống = không giới hạn" },
                { name: "expiresInHours", label: "Hết hạn sau (giờ)", type: "number", hint: "Trống = 7 ngày" },
                { name: "note", label: "Ghi chú", placeholder: "Lớp K66" },
              ]}
              confirmLabel="Tạo mã"
              onConfirm={async (v) => {
                await post(`/projects/${id}/invite-codes`, {
                  maxUses: v.maxUses ? Number(v.maxUses) : undefined,
                  expiresInHours: v.expiresInHours ? Number(v.expiresInHours) : undefined,
                  note: v.note || undefined,
                });
                await inv("invite-codes");
              }}
            />
          </CardHeader>
          <CardContent>
            <QueryState query={codes} empty={(d) => d.length === 0}>
              {(d) => (
                <div className="space-y-2">
                  {d.map((c) => (
                    <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
                      <code className="font-mono font-semibold">{formatInviteCode(c.code)}</code>
                      <StatusBadge entry={genericStatus(c.status)} />
                      <span className="text-xs text-muted-foreground">
                        {c.usedCount}/{c.maxUses ?? "∞"} lượt · hết hạn {formatDateTime(c.expiresAt)} {c.note && `· ${c.note}`}
                      </span>
                      <div className="ml-auto flex gap-1">
                        <CopyButton value={joinLink(c.code)} size="xs" label="Link" />
                        {c.status === "active" && (
                          <Button size="icon-xs" variant="ghost" onClick={() => void act(() => del(`/projects/${id}/invite-codes/${c.id}`), "Đã thu hồi", ["invite-codes"])}>
                            <Trash2 />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </QueryState>
          </CardContent>
        </Card>
      </div>

      {(p.visibility === "approval" || (requests.data ?? []).length > 0) && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Đơn xin tham gia</CardTitle>
              <CardDescription>Cấp độ / uy tín là số hiện tại. Duyệt kiểm lại điều kiện.</CardDescription>
            </div>
            <Select value={jrStatus} onValueChange={setJrStatus}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["pending", "approved", "rejected", "cancelled"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {genericStatus(s)[0]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <QueryState query={requests} empty={(d) => d.length === 0}>
              {(d) => (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Người gửi</TableHead>
                      <TableHead>Cấp / uy tín</TableHead>
                      <TableHead>Điểm test</TableHead>
                      <TableHead>Lời nhắn</TableHead>
                      <TableHead>Gửi lúc</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.displayName ?? <UserName id={r.userId} />}</TableCell>
                        <TableCell>
                          {r.level ?? "—"} / {r.reputation ?? "—"}
                        </TableCell>
                        <TableCell>{r.scorePercent !== null ? `${r.scorePercent}%` : "—"}</TableCell>
                        <TableCell className="max-w-xs text-sm">{r.message ?? r.rejectReason ?? ""}</TableCell>
                        <TableCell>{formatDateTime(r.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          {r.status === "pending" && (
                            <div className="flex justify-end gap-1">
                              <Button size="xs" onClick={() => void act(() => post(`/projects/${id}/join-requests/${r.id}/approve`), "Đã duyệt", ["join-requests", "members"])}>
                                <Check /> Duyệt
                              </Button>
                              <ActionDialog
                                trigger={<Button size="xs" variant="outline"><X /> Từ chối</Button>}
                                title="Từ chối đơn"
                                fields={[{ name: "reason", label: "Lý do", type: "textarea" }]}
                                onConfirm={async (v) => {
                                  await post(`/projects/${id}/join-requests/${r.id}/reject`, { reason: v.reason || undefined });
                                  await inv("join-requests");
                                }}
                              />
                            </div>
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
      )}

      <Card>
        <CardHeader>
          <CardTitle>Lời mời đã gửi</CardTitle>
          <CardDescription>Lời mời theo email không hiện người nhận tới khi họ chấp nhận.</CardDescription>
        </CardHeader>
        <CardContent>
          <QueryState query={invitations} empty={(d) => d.length === 0}>
            {(d) => (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Gửi tới</TableHead>
                    <TableHead>Vai trò</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Hết hạn</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.map((i) => (
                    <TableRow key={i.invitationId}>
                      <TableCell>{i.byEmail ? i.email : <UserName id={i.userId} />}</TableCell>
                      <TableCell>{MEMBER_ROLE[i.role]}</TableCell>
                      <TableCell>
                        <StatusBadge entry={genericStatus(i.status)} />
                      </TableCell>
                      <TableCell>{formatDateTime(i.expiresAt)}</TableCell>
                      <TableCell className="text-right">
                        {i.status === "pending" && (
                          <Button size="xs" variant="ghost" onClick={() => void act(() => del(`/projects/${id}/invitations/${i.invitationId}`), "Đã thu hồi lời mời", ["invitations"])}>
                            Thu hồi
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

      {p.consentRequired && (
        <Card>
          <CardHeader>
            <CardTitle>Đồng ý điều khoản / NDA</CardTitle>
          </CardHeader>
          <CardContent>
            <QueryState query={consents} empty={(d) => d.length === 0}>
              {(d) => (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Người</TableHead>
                      <TableHead>Đồng ý cảnh báo</TableHead>
                      <TableHead>Ký NDA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.map((c) => (
                      <TableRow key={c.userId}>
                        <TableCell>
                          <UserName id={c.userId} />
                        </TableCell>
                        <TableCell>{formatDateTime(c.contentWarningAcceptedAt)}</TableCell>
                        <TableCell>{c.ndaSignedAt ? `${c.ndaSignedName ?? ""} · v${c.ndaVersion} · ${formatDateTime(c.ndaSignedAt)}` : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </QueryState>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
