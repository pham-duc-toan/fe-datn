"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field } from "@/components/common/misc";
import { useAuth } from "@/components/providers/auth-provider";
import { api, post } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import type { Role } from "@/lib/types";
import { suggestUsername, usernameError } from "@/lib/tool-names";

const ROLE_OPTIONS: { value: Role; label: string; hint: string }[] = [
  { value: "labeler", label: "Người gán nhãn", hint: "Làm bài gán nhãn theo dự án, chia sẻ link rút gọn để kiếm thu nhập" },
  { value: "business", label: "Doanh nghiệp", hint: "Tạo dự án, thuê gán nhãn" },
];

export default function RegisterPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { login } = useAuth();
  const invitedEmail = params.get("email");
  const ref = params.get("ref");
  const invitation = params.get("invitation");
  const [email, setEmail] = useState(invitedEmail ?? "");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  // Username không trùng — dùng để được mời vào dự án và đăng nhập thay email. Gợi ý từ email tới khi tự sửa.
  const [username, setUsername] = useState("");
  const [usernameTouched, setUsernameTouched] = useState(false);
  const shownUsername = usernameTouched ? username : suggestUsername(email);
  const usernameErr = shownUsername ? usernameError(shownUsername) : null;
  const [roles, setRoles] = useState<Role[]>(["labeler"]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (ref) sessionStorage.setItem("crowd.ref", ref);
  }, [ref]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await api("/auth/register", { method: "POST", auth: false, body: { email: email.trim(), username: shownUsername.trim().replace(/^@/, ""), password, displayName: name.trim(), roles } });
      // Đăng nhập luôn để nhập mã giới thiệu; lời mời dự án tự gắn khi xác thực email (mục 17.5).
      const ch = await login(email.trim(), password);
      if (!ch) {
        const saved = sessionStorage.getItem("crowd.ref");
        if (saved) {
          sessionStorage.removeItem("crowd.ref");
          try {
            await post("/links/referrals/claim", { code: saved });
          } catch {
            /* bỏ qua */
          }
        }
      }
      setDone(true);
    } catch (err) {
      const ae = err as { data?: { errors?: Record<string, string[]> } };
      if (ae?.data?.errors) setFieldErrors(ae.data.errors);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <MailCheck className="mx-auto size-10 text-primary" />
          <CardTitle className="text-xl">Đăng ký thành công</CardTitle>
          <CardDescription>
            Chúng tôi đã gửi email xác thực tới <b>{email}</b>. Bạn vẫn dùng được ngay; cần xác thực email để rút tiền và publish dự án.
            {invitation && " Sau khi xác thực, lời mời vào dự án sẽ tự gắn vào tài khoản."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => router.replace("/tong-quan")}>
            Vào ứng dụng
          </Button>
        </CardContent>
      </Card>
    );

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">Tạo tài khoản</CardTitle>
        <CardDescription>{invitation ? "Bạn được mời vào một dự án — đăng ký đúng email được mời để nhận lời mời." : "Miễn phí, chọn một hoặc nhiều vai trò."}</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email" required hint={fieldErrors.email?.join(" ")}>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} readOnly={Boolean(invitedEmail)} />
          </Field>
          <Field
            label="Username"
            required
            error={fieldErrors.username?.join(" ") || (usernameTouched && usernameErr) || undefined}
            hint="Tên đăng nhập không trùng (3–30 ký tự: a-z, 0-9, dấu chấm, gạch dưới). Doanh nghiệp mời bạn vào dự án bằng tên này."
          >
            <Input
              required
              maxLength={31}
              value={shownUsername}
              placeholder="nguyenvana"
              onChange={(e) => {
                setUsernameTouched(true);
                setUsername(e.target.value.toLowerCase());
              }}
            />
          </Field>
          <Field label="Tên hiển thị" required hint={fieldErrors.displayName?.join(" ")}>
            <Input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Mật khẩu" required hint={fieldErrors.password?.join(" ") || "8–128 ký tự"}>
            <Input type="password" required minLength={8} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <div className="space-y-2">
            <span className="text-sm font-medium">Vai trò</span>
            {ROLE_OPTIONS.map((r) => (
              <label key={r.value} className="flex items-start gap-2 rounded-md border p-2.5 text-sm">
                <Checkbox
                  checked={roles.includes(r.value)}
                  onCheckedChange={(c) => setRoles((cur) => (c === true ? Array.from(new Set(cur.concat([r.value]))) : cur.filter((x) => x !== r.value)))}
                />
                <span>
                  <span className="font-medium">{r.label}</span>
                  <span className="block text-xs text-muted-foreground">{r.hint}</span>
                </span>
              </label>
            ))}
          </div>
          {ref && <p className="text-xs text-muted-foreground">Mã giới thiệu: <b>{ref}</b> — sẽ được áp dụng sau khi đăng ký.</p>}
          <Button type="submit" className="w-full" disabled={busy || roles.length === 0 || Boolean(usernameErr) || !shownUsername}>
            {busy && <Loader2 className="animate-spin" />} Đăng ký
          </Button>
          <p className="text-center text-sm">
            Đã có tài khoản?{" "}
            <Link href="/dang-nhap" className="text-primary hover:underline">
              Đăng nhập
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
