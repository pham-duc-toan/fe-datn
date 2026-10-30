"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, post } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatVnd } from "@/lib/format";
import { depositStatus, PROVIDER_LABEL } from "@/lib/labels";
import type { Deposit } from "@/lib/types";

function toGuid(s: string | null): string | null {
  if (!s) return null;
  const h = s.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(h)) return null;
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * Return URL của VNPay / MoMo (mục 17.3). KHÔNG tin tham số trên URL: chỉ lấy mã lệnh rồi
 * gọi /sync để backend hỏi ngược cổng bằng API server-to-server.
 */
export default function DepositResultPage() {
  const params = useSearchParams();
  const qc = useQueryClient();
  const id =
    toGuid(params.get("intent")) ??
    toGuid(params.get("vnp_TxnRef")) ??
    toGuid(params.get("orderId")) ??
    toGuid(typeof window !== "undefined" ? sessionStorage.getItem("crowd.depositIntent") : null);
  const [dep, setDep] = useState<Deposit | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let stop = false;
    let tries = 0;
    const tick = async () => {
      try {
        const d = tries === 0 ? await post<Deposit>(`/payments/deposits/${id}/sync`) : await api<Deposit>(`/payments/deposits/${id}`);
        if (stop) return;
        setDep(d);
        tries++;
        if (d.status === "succeeded") {
          sessionStorage.removeItem("crowd.depositIntent");
          setTimeout(() => qc.invalidateQueries({ queryKey: ["balance"] }), 1500);
          return;
        }
        if (["failed", "rejected", "expired"].includes(d.status) || tries > 40) return;
        setTimeout(tick, 2500);
      } catch (e) {
        if (!stop) setError(errorMessage(e));
      }
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [id, qc]);

  const shownError = id ? error : "Không xác định được lệnh nạp.";
  const done = dep?.status === "succeeded";
  const bad = dep && ["failed", "rejected", "expired"].includes(dep.status);
  return (
    <div className="flex justify-center py-10">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          {done ? <CheckCircle2 className="mx-auto size-10 text-emerald-600" /> : bad || shownError ? <XCircle className="mx-auto size-10 text-destructive" /> : <Loader2 className="mx-auto size-10 animate-spin text-muted-foreground" />}
          <CardTitle className="text-xl">{done ? "Nạp tiền thành công" : bad ? depositStatus(dep!.status)[0] : shownError ? "Có lỗi" : "Đang xác nhận với cổng thanh toán…"}</CardTitle>
          <CardDescription>{dep ? `${formatVnd(dep.amountVnd)} · ${PROVIDER_LABEL[dep.provider] ?? dep.provider}` : shownError}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/vi">Về ví</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
