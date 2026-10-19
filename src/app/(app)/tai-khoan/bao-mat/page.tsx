"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { KeyRound, Loader2, LogOut, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/common/page-header";
import { CopyButton, Field } from "@/components/common/misc";
import { ActionDialog } from "@/components/common/action-dialog";
import { ToneBadge } from "@/components/common/status-badge";
import { useAuth } from "@/components/providers/auth-provider";
import { api, post } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import type { TokenResponse } from "@/lib/types";

type TwoFa = { enabled: boolean; enabledAt: string | null; recoveryCodesLeft: number };

function RecoveryCodes({ codes }: { codes: string[] }) {
  return (
    <Alert>
      <KeyRound />
      <AlertTitle>Lưu 10 mã dự phòng này — chỉ hiện một lần</AlertTitle>
      <AlertDescription>
        <div className="my-2 grid grid-cols-2 gap-1 font-mono text-sm sm:grid-cols-5">
          {codes.map((c) => (
            <span key={c} className="rounded bg-muted px-2 py-1">
              {c}
            </span>
          ))}
        </div>
        <CopyButton value={codes.join("\n")} label="Sao chép tất cả" />
      </AlertDescription>
    </Alert>
  );
}

export default function SecurityPage() {
  const { applyTokens, logout } = useAuth();
  const qc = useQueryClient();
  const tfa = useQuery({ queryKey: ["2fa"], queryFn: () => api<TwoFa>("/me/2fa") });
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const t = await post<TokenResponse>("/me/password", { currentPassword: cur, newPassword: next });
      // Đổi mật khẩu trả cặp token mới — thay ngay, token cũ bị chặn (mục 2.5).
      await applyTokens(t);
      setCur("");
      setNext("");
      toast.success("Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const refresh2fa = () => qc.invalidateQueries({ queryKey: ["2fa"] });

  return (
    <>
      <PageHeader title="Bảo mật" description="Mật khẩu, xác thực hai lớp và phiên đăng nhập." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Đổi mật khẩu</CardTitle>
            <CardDescription>Mọi thiết bị khác sẽ bị đăng xuất.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={changePassword} className="space-y-3">
              <Field label="Mật khẩu hiện tại">
                <Input type="password" required value={cur} onChange={(e) => setCur(e.target.value)} />
              </Field>
              <Field label="Mật khẩu mới" hint="8–128 ký tự">
                <Input type="password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} />
              </Field>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="animate-spin" />} Đổi mật khẩu
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Xác thực hai lớp (2FA) {tfa.data && (tfa.data.enabled ? <ToneBadge tone="success">Đang bật</ToneBadge> : <ToneBadge tone="muted">Đang tắt</ToneBadge>)}
            </CardTitle>
            <CardDescription>Dùng ứng dụng như Google Authenticator, Microsoft Authenticator.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {codes && <RecoveryCodes codes={codes} />}
            {tfa.data?.enabled ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Bật từ {formatDateTime(tfa.data.enabledAt)} · còn {tfa.data.recoveryCodesLeft} mã dự phòng.
                </p>
                <div className="flex flex-wrap gap-2">
                  <ActionDialog
                    trigger={<Button variant="outline"><KeyRound /> Tạo bộ mã dự phòng mới</Button>}
                    title="Tạo bộ mã dự phòng mới"
                    description="Bộ cũ sẽ hết hiệu lực."
                    fields={[{ name: "code", label: "Mã 6 số trong ứng dụng", required: true }]}
                    onConfirm={async (v) => {
                      const r = await post<{ recoveryCodes: string[] }>("/me/2fa/recovery-codes", { code: v.code });
                      setCodes(r.recoveryCodes);
                      await refresh2fa();
                    }}
                  />
                  <ActionDialog
                    trigger={<Button variant="destructive"><ShieldOff /> Tắt 2FA</Button>}
                    title="Tắt xác thực hai lớp"
                    destructive
                    fields={[
                      { name: "password", label: "Mật khẩu", type: "password", required: true },
                      { name: "code", label: "Mã 6 số hoặc mã dự phòng", required: true },
                    ]}
                    confirmLabel="Tắt 2FA"
                    successMessage="Đã tắt 2FA"
                    onConfirm={async (v) => {
                      const c = String(v.code).trim();
                      await post("/me/2fa/disable", { password: v.password, ...(c.length === 6 && /^\d+$/.test(c) ? { code: c } : { recoveryCode: c }) });
                      setCodes(null);
                      await refresh2fa();
                    }}
                  />
                </div>
              </>
            ) : setup ? (
              <div className="space-y-3">
                <div className="flex flex-col items-center gap-2 rounded-md border p-4">
                  <QRCodeSVG value={setup.otpauthUri} size={168} />
                  <p className="text-xs text-muted-foreground">Hoặc nhập khoá: <code className="font-mono">{setup.secret}</code></p>
                </div>
                <Field label="Nhập mã 6 số để bật">
                  <Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
                </Field>
                <Button
                  disabled={code.length !== 6}
                  onClick={async () => {
                    try {
                      const r = await post<{ recoveryCodes: string[] }>("/me/2fa/enable", { code });
                      setCodes(r.recoveryCodes);
                      setSetup(null);
                      setCode("");
                      await refresh2fa();
                      toast.success("Đã bật 2FA");
                    } catch (e) {
                      toast.error(errorMessage(e));
                    }
                  }}
                >
                  <ShieldCheck /> Bật 2FA
                </Button>
              </div>
            ) : (
              <Button
                onClick={async () => {
                  try {
                    setSetup(await post<{ secret: string; otpauthUri: string }>("/me/2fa/setup"));
                  } catch (e) {
                    toast.error(errorMessage(e));
                  }
                }}
              >
                <ShieldCheck /> Thiết lập 2FA
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Phiên đăng nhập</CardTitle>
            <CardDescription>Đăng xuất khỏi mọi thiết bị, kể cả thiết bị này.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActionDialog
              trigger={<Button variant="destructive"><LogOut /> Đăng xuất mọi nơi</Button>}
              title="Đăng xuất khỏi mọi thiết bị?"
              description="Mọi phiên đăng nhập sẽ bị thu hồi ngay."
              destructive
              confirmLabel="Đăng xuất mọi nơi"
              onConfirm={async () => {
                await post("/me/logout-all");
                await logout();
              }}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
