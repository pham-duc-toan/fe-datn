"use client";

import { useState, type ReactNode } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/common/misc";
import { errorMessage } from "@/lib/errors";
import type { Terms } from "@/lib/types";

export type Consent = { acceptContentWarning: boolean; acceptNda: boolean; fullName: string | null };

/**
 * Ô đọc và đồng ý cảnh báo nội dung / ký NDA. Dùng ở trang dự án (POST /projects/{id}/consent) và ở trang
 * nhập mã mời (gửi kèm join-by-code — người cầm mã chưa là thành viên nên không mở được trang dự án).
 */
export function ConsentBox({ terms, onSubmit, submitLabel = "Đồng ý", description }: { terms: Terms; onSubmit: (c: Consent) => Promise<void>; submitLabel?: ReactNode; description?: ReactNode }) {
  const [cw, setCw] = useState(false);
  const [nda, setNda] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Card className="border-amber-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="size-5 text-amber-600" /> Điều khoản của dự án
        </CardTitle>
        <CardDescription>{description ?? "Bạn cần đọc và đồng ý trước khi tham gia. Đồng ý được ghi lại cùng phiên bản văn bản."}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {terms.sensitiveContent && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Cảnh báo nội dung</p>
            <p className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">{terms.contentWarning ?? "Dự án có nội dung nhạy cảm."}</p>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={cw} onCheckedChange={(c) => setCw(c === true)} /> Tôi đã đọc và chấp nhận xem nội dung này
            </label>
          </div>
        )}
        {terms.ndaRequired && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Thoả thuận bảo mật (NDA) — phiên bản {terms.ndaVersion}</p>
            <div className="max-h-60 overflow-y-auto rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">{terms.ndaText}</div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={nda} onCheckedChange={(c) => setNda(c === true)} /> Tôi đồng ý thoả thuận bảo mật
            </label>
            <Field label="Họ tên (chữ ký)">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          </div>
        )}
        <Button
          disabled={busy || (terms.sensitiveContent && !cw) || (terms.ndaRequired && (!nda || !name.trim()))}
          onClick={async () => {
            setBusy(true);
            try {
              await onSubmit({ acceptContentWarning: cw, acceptNda: nda, fullName: name.trim() || null });
            } catch (e) {
              toast.error(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy && <Loader2 className="animate-spin" />} {submitLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
