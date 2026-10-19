"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field } from "@/components/common/misc";
import { useAuth } from "@/components/providers/auth-provider";
import { errorMessage } from "@/lib/errors";
import { ApiError, post } from "@/lib/api";
import type { TwoFactorChallenge } from "@/lib/types";

export default function LoginPage() {
  const { login, verifyTwoFactor } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState<TwoFactorChallenge | null>(null);
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function afterLogin() {
    // Đăng ký từ link giới thiệu: nhập mã sau khi đăng nhập (mục 12.1).
    const ref = sessionStorage.getItem("crowd.ref");
    if (ref) {
      sessionStorage.removeItem("crowd.ref");
      try {
        await post("/links/referrals/claim", { code: ref });
      } catch {
        /* mã sai / quá hạn — bỏ qua, người dùng vẫn vào được */
      }
    }
    router.replace(next && next.startsWith("/") ? next : "/tong-quan");
  }

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const ch = await login(email.trim(), password);
      if (ch) setChallenge(ch);
      else await afterLogin();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!challenge) return;
    setBusy(true);
    setError(null);
    try {
      await verifyTwoFactor(challenge.challengeToken, useRecovery ? null : code.trim(), useRecovery ? code.trim() : null);
      await afterLogin();
    } catch (err) {
      if (err instanceof ApiError && err.code === "het_luot_2fa") {
        setChallenge(null);
        setCode("");
      }
      const left = err instanceof ApiError && typeof err.data.attemptsLeft === "number" ? ` Còn ${err.data.attemptsLeft} lần thử.` : "";
      setError(errorMessage(err) + left);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">{challenge ? "Xác thực hai lớp" : "Đăng nhập"}</CardTitle>
        <CardDescription>{challenge ? "Nhập mã 6 số trong ứng dụng xác thực của bạn." : "Chào mừng quay lại Crowd Label."}</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!challenge ? (
          <form onSubmit={onLogin} className="space-y-4">
            <Field label="Email">
              <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Mật khẩu">
              <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} Đăng nhập
            </Button>
            <div className="flex justify-between text-sm">
              <Link href="/quen-mat-khau" className="text-primary hover:underline">
                Quên mật khẩu?
              </Link>
              <Link href="/dang-ky" className="text-primary hover:underline">
                Tạo tài khoản
              </Link>
            </div>
          </form>
        ) : (
          <form onSubmit={onVerify} className="space-y-4">
            <Field label={useRecovery ? "Mã dự phòng" : "Mã xác thực"}>
              <Input
                autoFocus
                inputMode={useRecovery ? "text" : "numeric"}
                maxLength={useRecovery ? 20 : 6}
                placeholder={useRecovery ? "ABCD-EFGH" : "123456"}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </Field>
            <Button type="submit" className="w-full" disabled={busy || !code.trim()}>
              {busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Xác nhận
            </Button>
            <div className="flex justify-between text-sm">
              <button type="button" className="text-primary hover:underline" onClick={() => setUseRecovery((v) => !v)}>
                {useRecovery ? "Dùng mã trong ứng dụng" : "Mất điện thoại? Dùng mã dự phòng"}
              </button>
              <button type="button" className="text-muted-foreground hover:underline" onClick={() => setChallenge(null)}>
                Quay lại
              </button>
            </div>
          </form>
        )}
        <p className="mt-6 rounded-md bg-muted p-3 text-xs text-muted-foreground">
          Tài khoản demo (mật khẩu <code>Matkhau@123</code>): admin@crowd.local · doanhnghiep1@crowd.local · labeler1@crowd.local · reviewer1@crowd.local
        </p>
      </CardContent>
    </Card>
  );
}
