"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/page-header";
import { Field } from "@/components/common/misc";
import { QueryState } from "@/components/common/states";
import { UserName } from "@/components/common/user-name";
import { api, post } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/labels";

type A = { id: string; title: string; body: string; audience: string; sendEmail: boolean; createdBy: string; createdAt: string };

export default function AnnouncementsPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["announcements"], queryFn: () => api<A[]>("/admin/announcements", { query: { limit: 50 } }) });
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("all");
  const [email, setEmail] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <PageHeader title="Thông báo toàn hệ thống" description="Người nhận thấy thông báo loại “hệ thống” sau vài giây. Gửi email thì dùng tiết kiệm." />
      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Soạn thông báo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Tiêu đề">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="Nội dung">
              <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
            </Field>
            <Field label="Gửi tới">
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Mọi người</SelectItem>
                  {["business", "labeler"].map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={email} onCheckedChange={setEmail} /> Gửi thêm email (người không tắt email loại hệ thống)
            </label>
            <Button
              disabled={busy || !title.trim() || !body.trim()}
              onClick={async () => {
                setBusy(true);
                try {
                  await post("/admin/announcements", { title, body, audience, sendEmail: email });
                  toast.success("Đã gửi thông báo");
                  setTitle("");
                  setBody("");
                  await qc.invalidateQueries({ queryKey: ["announcements"] });
                } catch (e) {
                  toast.error(errorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Megaphone />} Gửi
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Đã gửi</CardTitle>
            <CardDescription>Mới nhất trước.</CardDescription>
          </CardHeader>
          <CardContent>
            <QueryState query={list} empty={(d) => d.length === 0}>
              {(d) => (
                <div className="divide-y">
                  {d.map((a) => (
                    <div key={a.id} className="py-2.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-medium">{a.title}</p>
                        <span className="text-xs text-muted-foreground">
                          {a.audience === "all" ? "Mọi người" : ROLE_LABEL[a.audience]} {a.sendEmail && "· có email"} · {formatDateTime(a.createdAt)} · <UserName id={a.createdBy} />
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap text-muted-foreground">{a.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </QueryState>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
