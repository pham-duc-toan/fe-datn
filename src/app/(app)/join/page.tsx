"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/common/page-header";
import { post } from "@/lib/api";
import { errorMessage } from "@/lib/errors";

export default function JoinByCodePage() {
  const params = useSearchParams();
  const router = useRouter();
  const [code, setCode] = useState(params.get("code") ?? "");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <PageHeader title="Tham gia bằng mã mời" description="Mã mời do chủ dự án chia sẻ — vào được cả dự án riêng tư." />
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="size-5" /> Nhập mã
          </CardTitle>
          <CardDescription>Gõ chữ thường, có gạch hay khoảng trắng đều được.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const r = await post<{ projectId: string; projectName: string }>("/projects/join-by-code", { code: code.trim() });
                toast.success(`Đã vào dự án ${r.projectName}`);
                router.push(`/cho/${r.projectId}`);
              } catch (err) {
                toast.error(errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="K7QX-3MWP-A9TR-HC2N" className="font-mono uppercase" />
            <Button type="submit" disabled={busy || !code.trim()}>
              {busy && <Loader2 className="animate-spin" />} Tham gia
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
