"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/page-header";
import { Loading } from "@/components/common/states";
import { api, put } from "@/lib/api";
import { errorMessage } from "@/lib/errors";

type Pref = { type: string; label: string; mandatory: boolean; emailEnabled: boolean };

export default function NotificationSettingsPage() {
  const qc = useQueryClient();
  const prefs = useQuery({ queryKey: ["prefs"], queryFn: () => api<Pref[]>("/notifications/me/preferences") });
  const lang = useQuery({ queryKey: ["lang"], queryFn: () => api<{ language: string | null }>("/notifications/me/language") });

  async function toggle(p: Pref, on: boolean) {
    try {
      const r = await put<Pref[]>("/notifications/me/preferences", { items: [{ type: p.type, emailEnabled: on }] });
      qc.setQueryData(["prefs"], r);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <>
      <PageHeader title="Cài đặt thông báo" description="Thông báo trong ứng dụng luôn có; ở đây chọn loại nào gửi thêm email." />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Gửi email theo loại</CardTitle>
            <CardDescription>Loại bắt buộc (bảo mật, rút tiền, KYB…) không tắt được.</CardDescription>
          </CardHeader>
          <CardContent>
            {prefs.isPending ? (
              <Loading />
            ) : (
              <div className="divide-y">
                {(prefs.data ?? []).map((p) => (
                  <label key={p.type} className="flex items-center justify-between gap-3 py-2.5">
                    <span>
                      <span className="text-sm">{p.label}</span>
                      {p.mandatory && <span className="ml-2 text-xs text-muted-foreground">(bắt buộc)</span>}
                    </span>
                    <Switch checked={p.mandatory || p.emailEnabled} disabled={p.mandatory} onCheckedChange={(v) => void toggle(p, v)} />
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ngôn ngữ thông báo</CardTitle>
            <CardDescription>Áp cho thông báo và email tạo sau khi đổi.</CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={lang.data?.language ?? "vi"}
              onValueChange={async (v) => {
                try {
                  await put("/notifications/me/language", { language: v });
                  qc.setQueryData(["lang"], { language: v });
                  toast.success("Đã đổi ngôn ngữ thông báo");
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vi">Tiếng Việt</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
