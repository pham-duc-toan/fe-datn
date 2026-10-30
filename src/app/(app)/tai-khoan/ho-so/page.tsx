"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/common/page-header";
import { Field } from "@/components/common/misc";
import { TagPicker } from "@/components/common/tag-picker";
import { Loading } from "@/components/common/states";
import { api, post, put, uploadToSignedUrl } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { MODALITY_LABEL, ROLE_LABEL } from "@/lib/labels";
import type { Modality, Profile } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { usernameError } from "@/lib/tool-names";

export default function ProfilePage() {
  const q = useQuery({ queryKey: ["profile"], queryFn: () => api<Profile>("/me/profile") });
  if (q.isPending) return <Loading />;
  return <ProfileForm p={q.data!} />;
}

function ProfileForm({ p }: { p: Profile }) {
  const qc = useQueryClient();
  const [name, setName] = useState(p.displayName);
  const [username, setUsername] = useState(p.username ?? "");
  const usernameErr = username !== p.username ? usernameError(username) : null;
  const [bio, setBio] = useState(p.bio ?? "");
  const [domains, setDomains] = useState<string[]>(p.skills.domains ?? []);
  const [languages, setLanguages] = useState<string[]>(p.skills.languages ?? []);
  const [mods, setMods] = useState<string[]>(p.skills.modalities ?? []);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function run(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    try {
      const r = await fn();
      if (r && typeof r === "object" && "userId" in r) qc.setQueryData(["profile"], r);
      toast.success(ok);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function uploadAvatar(f: File) {
    await run(
      "avatar",
      async () => {
        const slot = await post<{ key: string; uploadUrl: string }>("/me/avatar/upload-url", { fileName: f.name, sizeBytes: f.size });
        await uploadToSignedUrl(slot.uploadUrl, f);
        return put<Profile>("/me/avatar", { key: slot.key });
      },
      "Đã cập nhật ảnh đại diện",
    );
  }

  return (
    <>
      <PageHeader title="Hồ sơ cá nhân" description="Tên và ảnh hiện với chủ dự án, trên bảng xếp hạng. Email không bao giờ được công khai." />
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 text-center">
            <Avatar className="size-24">
              {p.avatarUrl && <AvatarImage src={p.avatarUrl} alt="" />}
              <AvatarFallback className="text-2xl">{p.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => e.target.files?.[0] && void uploadAvatar(e.target.files[0])} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={busy === "avatar"}>
              {busy === "avatar" ? <Loader2 className="animate-spin" /> : <Camera />} Đổi ảnh (≤ 2 MB)
            </Button>
            <div className="text-sm">
              <p className="font-medium">{p.email}</p>
              <p className="text-muted-foreground">{p.emailVerified ? "Email đã xác thực" : "Email chưa xác thực"}</p>
              <p className="text-muted-foreground">{p.roles.map((r) => ROLE_LABEL[r]).join(" · ")}</p>
              <p className="text-muted-foreground">Tham gia {formatDate(p.createdAt)}</p>
            </div>
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Thông tin</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field
                label="Username"
                error={usernameErr ?? undefined}
                hint="Tên đăng nhập không trùng — doanh nghiệp mời bạn vào dự án bằng tên này. Đăng nhập được bằng email hoặc username."
              >
                <Input value={username} maxLength={31} onChange={(e) => setUsername(e.target.value.toLowerCase())} />
              </Field>
              <Field label="Tên hiển thị" hint="1–100 ký tự">
                <Input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Giới thiệu" hint={`${bio.length}/500`}>
                <Textarea rows={3} maxLength={500} value={bio} onChange={(e) => setBio(e.target.value)} />
              </Field>
              <Button onClick={() => void run("info", () => put<Profile>("/me/profile", { displayName: name, bio: bio || null, username: username.replace(/^@/, "") }), "Đã lưu hồ sơ")} disabled={busy === "info" || Boolean(usernameErr)}>
                {busy === "info" && <Loader2 className="animate-spin" />} Lưu
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Hồ sơ kỹ năng</CardTitle>
              <CardDescription>Dự án được gợi ý theo số thẻ lĩnh vực / ngôn ngữ trùng với dự án và loại dữ liệu bạn quen làm.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Lĩnh vực am hiểu">
                <TagPicker kind="domain" value={domains} onChange={setDomains} max={20} />
              </Field>
              <Field label="Ngôn ngữ thành thạo">
                <TagPicker kind="language" value={languages} onChange={setLanguages} max={20} />
              </Field>
              <div className="space-y-2">
                <span className="text-sm font-medium">Loại dữ liệu quen làm</span>
                <div className="flex flex-wrap gap-3">
                  {(Object.keys(MODALITY_LABEL) as Modality[]).map((m) => (
                    <label key={m} className="flex items-center gap-1.5 text-sm">
                      <Checkbox checked={mods.includes(m)} onCheckedChange={(c) => setMods((cur) => (c === true ? cur.concat([m]) : cur.filter((x) => x !== m)))} />
                      {MODALITY_LABEL[m]}
                    </label>
                  ))}
                </div>
              </div>
              <Button
                onClick={() => void run("skills", () => put<Profile>("/me/skills", { domains, languages, modalities: mods }), "Đã lưu kỹ năng")}
                disabled={busy === "skills"}
              >
                {busy === "skills" && <Loader2 className="animate-spin" />} Lưu kỹ năng
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
