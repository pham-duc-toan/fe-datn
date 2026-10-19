"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/common/page-header";
import { CopyButton, StatCard } from "@/components/common/misc";
import { UserName } from "@/components/common/user-name";
import { api, post } from "@/lib/api";
import { errorMessage } from "@/lib/errors";

export default function ReferralPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["referral"], queryFn: () => api<{ code: string; referredCount: number; referredBy: string | null }>("/links/referrals/me") });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const link = q.data ? `${typeof window !== "undefined" ? window.location.origin : ""}/dang-ky?ref=${q.data.code}` : "";
  return (
    <>
      <PageHeader title="Giới thiệu bạn bè" description="Bạn nhận 10% doanh thu cổng link của người được mời (lấy từ phần nền tảng), sau khi họ tự kiếm đủ ngưỡng." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="size-5" /> Mã của bạn
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <code className="rounded bg-muted px-3 py-1.5 font-mono text-lg">{q.data?.code ?? "…"}</code>
              {q.data && <CopyButton value={q.data.code} />}
            </div>
            {link && (
              <div className="flex items-center gap-2 text-sm">
                <span className="truncate text-muted-foreground">{link}</span>
                <CopyButton value={link} label="Link mời" size="xs" />
              </div>
            )}
            <StatCard label="Đã giới thiệu" value={q.data?.referredCount ?? 0} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Nhập mã người giới thiệu</CardTitle>
            <CardDescription>Chỉ tài khoản mới (trong 7 ngày kể từ đăng ký) nhập được.</CardDescription>
          </CardHeader>
          <CardContent>
            {q.data?.referredBy ? (
              <p className="text-sm">
                Bạn được giới thiệu bởi <UserName id={q.data.referredBy} />.
              </p>
            ) : (
              <form
                className="flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  try {
                    await post("/links/referrals/claim", { code: code.trim() });
                    toast.success("Đã nhập mã giới thiệu");
                    await qc.invalidateQueries({ queryKey: ["referral"] });
                  } catch (err) {
                    toast.error(errorMessage(err));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ab3dE9xY" />
                <Button type="submit" disabled={busy || !code.trim()}>
                  {busy && <Loader2 className="animate-spin" />} Áp dụng
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
