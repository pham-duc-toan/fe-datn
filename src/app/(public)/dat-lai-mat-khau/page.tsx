"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field } from "@/components/common/misc";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";

export default function ResetPage() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">Đặt lại mật khẩu</CardTitle>
        <CardDescription>Đặt lại xong, mọi thiết bị khác sẽ bị đăng xuất.</CardDescription>
      </CardHeader>
      <CardContent>
        {!token && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>Link không có mã đặt lại. Hãy mở đúng link trong email.</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              {error}{" "}
              <Link href="/quen-mat-khau" className="underline">
                Gửi lại link
              </Link>
            </AlertDescription>
          </Alert>
        )}
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (pw !== pw2) {
              setError("Hai mật khẩu không khớp.");
              return;
            }
            setBusy(true);
            setError(null);
            try {
              await api("/auth/reset-password", { method: "POST", auth: false, body: { token, newPassword: pw } });
              toast.success("Đã đặt lại mật khẩu. Hãy đăng nhập.");
              router.replace("/dang-nhap");
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Mật khẩu mới" hint="8–128 ký tự">
            <Input type="password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} />
          </Field>
          <Field label="Nhập lại mật khẩu">
            <Input type="password" required minLength={8} value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </Field>
          <Button type="submit" className="w-full" disabled={busy || !token}>
            {busy && <Loader2 className="animate-spin" />} Đặt lại mật khẩu
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
