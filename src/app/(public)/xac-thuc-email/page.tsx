"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { readTokens } from "@/lib/tokens";
import { useAuth } from "@/components/providers/auth-provider";

export default function VerifyEmailPage() {
  const token = useSearchParams().get("token") ?? "";
  // status bắt đầu là "loading" ở cả server lẫn client → href giống nhau lúc hydrate (không đọc localStorage khi render).
  const { forceRefresh, status } = useAuth();
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [error, setError] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      if (!token) {
        setState("error");
        setError("Link không có mã xác thực.");
        return;
      }
      try {
        await api("/auth/verify-email", { method: "POST", auth: false, body: { token } });
        // Lấy access token mới mang email_verified = true (mục 2.4).
        if (readTokens()) await forceRefresh();
        setState("ok");
      } catch (e) {
        setState("error");
        setError(errorMessage(e));
      }
    })();
  }, [token, forceRefresh]);

  return (
    <Card className="w-full max-w-md text-center">
      <CardHeader>
        {state === "loading" && <Loader2 className="mx-auto size-10 animate-spin text-muted-foreground" />}
        {state === "ok" && <CheckCircle2 className="mx-auto size-10 text-emerald-600" />}
        {state === "error" && <XCircle className="mx-auto size-10 text-destructive" />}
        <CardTitle className="text-xl">{state === "ok" ? "Email đã được xác thực" : state === "error" ? "Không xác thực được" : "Đang xác thực…"}</CardTitle>
        <CardDescription>{state === "ok" ? "Bạn đã rút tiền / publish dự án được." : state === "error" ? `${error} Đăng nhập rồi bấm “Gửi lại email” trên thanh nhắc.` : ""}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild className="w-full">
          <Link href={status === "authed" ? "/tong-quan" : "/dang-nhap"}>Tiếp tục</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
