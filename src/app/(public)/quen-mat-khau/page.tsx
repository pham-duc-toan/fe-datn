"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common/misc";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { toast } from "sonner";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">Quên mật khẩu</CardTitle>
        <CardDescription>Nhập email đã đăng ký, chúng tôi gửi link đặt lại mật khẩu (có hiệu lực 30 phút).</CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <p className="rounded-md bg-muted p-3 text-sm">Nếu email có tài khoản, bạn sẽ nhận được link đặt lại mật khẩu trong vài phút.</p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api("/auth/forgot-password", { method: "POST", auth: false, body: { email: email.trim() } });
                setSent(true);
              } catch (err) {
                toast.error(errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Email">
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} Gửi link
            </Button>
          </form>
        )}
        <p className="mt-4 text-center text-sm">
          <Link href="/dang-nhap" className="text-primary hover:underline">
            Quay lại đăng nhập
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
