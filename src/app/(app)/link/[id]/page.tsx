"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/common/page-header";
import { CopyButton, Field, KeyValue } from "@/components/common/misc";
import { ActionDialog } from "@/components/common/action-dialog";
import { StatusBadge } from "@/components/common/status-badge";
import { ErrorState, Loading } from "@/components/common/states";
import { api, del, put } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { linkStatus } from "@/lib/labels";
import type { ShortLink } from "@/lib/types";

export default function LinkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["link", id],
    queryFn: () => api<ShortLink>(`/links/${id}`),
    refetchInterval: (s) => (s.state.data?.status === "pendingScan" ? 2000 : false),
  });
  const [changePw, setChangePw] = useState(false);
  const [pw, setPw] = useState("");
  const [exp, setExp] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorState error={q.error} />;
  const l = q.data!;
  const expValue = exp ?? (l.expiresAt ? l.expiresAt.slice(0, 16) : "");

  return (
    <>
      <PageHeader back={{ href: "/link", label: "Link của tôi" }} title={<span className="font-mono">/g/{l.code}</span>} actions={<StatusBadge entry={linkStatus(l.status)} />} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Thông tin</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <KeyValue
              className="sm:grid-cols-1"
              items={[
                ["Link chia sẻ", <span key="s" className="flex items-center gap-2"><code className="text-xs">{l.shortUrl}</code> <CopyButton value={l.shortUrl} /></span>],
                ["Link đích", <span key="d" className="break-all text-xs">{l.destinationUrl}</span>],
                ["Tên miền", l.domain],
                ["Mật khẩu", l.hasPassword ? "Có" : "Không"],
                ["Hết hạn", formatDateTime(l.expiresAt)],
                ["Tạo lúc", formatDateTime(l.createdAt)],
                ["Lý do trạng thái", l.statusReason ?? "—"],
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sửa link</CardTitle>
            <CardDescription>Link đích không sửa được — muốn đổi thì tạo link mới.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={changePw} onCheckedChange={(c) => setChangePw(c === true)} /> Đổi mật khẩu
            </label>
            {changePw && (
              <Field label="Mật khẩu mới" hint="Để trống = bỏ mật khẩu">
                <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
              </Field>
            )}
            <Field label="Hết hạn">
              <Input type="datetime-local" value={expValue} onChange={(e) => setExp(e.target.value)} />
            </Field>
            <div className="flex gap-2">
              <Button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await put<ShortLink>(`/links/${id}`, { changePassword: changePw, password: changePw ? pw || null : null, expiresAt: expValue ? new Date(expValue).toISOString() : null, campaignId: l.campaignId });
                    qc.setQueryData(["link", id], r);
                    toast.success("Đã lưu");
                  } catch (e) {
                    toast.error(errorMessage(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? <Loader2 className="animate-spin" /> : <Save />} Lưu
              </Button>
              <ActionDialog
                trigger={<Button variant="destructive"><Trash2 /> Xoá link</Button>}
                title="Xoá link?"
                description="Link ngừng chạy ngay."
                destructive
                onConfirm={async () => {
                  await del(`/links/${id}`);
                  await qc.invalidateQueries({ queryKey: ["links"] });
                  router.push("/link");
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
