"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/common/page-header";
import { ConsentBox, type Consent } from "@/components/project/consent-box";
import { post } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import type { Terms } from "@/lib/types";

type Preview = { projectId: string; projectName: string; terms: Terms };

export default function JoinByCodePage() {
  const params = useSearchParams();
  const router = useRouter();
  const [code, setCode] = useState(params.get("code") ?? "");
  const [busy, setBusy] = useState(false);
  // Dự án có cảnh báo nội dung / NDA mà mình chưa đồng ý: hiện ô đồng ý, đồng ý xong mới vào (gửi kèm mã).
  const [preview, setPreview] = useState<Preview | null>(null);

  async function join(consent: Consent | null) {
    const r = await post<{ projectId: string; projectName: string }>("/projects/join-by-code", { code: code.trim(), consent });
    toast.success(`Đã vào dự án ${r.projectName}`);
    router.push(`/cho/${r.projectId}`);
  }

  return (
    <>
      <PageHeader title="Tham gia bằng mã mời" description="Mã mời do chủ dự án chia sẻ — vào được cả dự án riêng tư." />
      <div className="max-w-xl space-y-4">
        <Card>
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
                  const p = await post<Preview>("/projects/join-by-code/preview", { code: code.trim() });
                  if (p.terms.consentRequired && !p.terms.myConsentValid) setPreview(p);
                  else await join(null);
                } catch (err) {
                  toast.error(errorMessage(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setPreview(null);
                }}
                placeholder="K7QX-3MWP-A9TR-HC2N"
                className="font-mono uppercase"
              />
              <Button type="submit" disabled={busy || !code.trim()}>
                {busy && <Loader2 className="animate-spin" />} Tham gia
              </Button>
            </form>
          </CardContent>
        </Card>
        {preview && (
          <ConsentBox
            terms={preview.terms}
            description={`Dự án “${preview.projectName}” yêu cầu đọc và đồng ý điều khoản trước khi tham gia. Đồng ý được ghi lại cùng phiên bản văn bản.`}
            submitLabel="Đồng ý và tham gia"
            onSubmit={join}
          />
        )}
      </div>
    </>
  );
}
