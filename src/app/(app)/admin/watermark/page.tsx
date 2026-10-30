"use client";

import { useState } from "react";
import { FileSearch, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/common/page-header";
import { Field } from "@/components/common/misc";
import { FilePreview } from "@/components/common/file-preview";
import { UserName } from "@/components/common/user-name";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatNumber } from "@/lib/format";

type Res = { found: boolean; confidence: number; mediaType?: string; viewer: { type: string; userId: string | null; guestSessionId: string | null } | null };

export default function WatermarkPage() {
  const [file, setFile] = useState<File | null>(null);
  const [w, setW] = useState("");
  const [h, setH] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Res | null>(null);
  return (
    <>
      <PageHeader title="Truy người làm lộ dữ liệu" description="Giải watermark chìm trong ảnh / âm thanh / video bị lộ để biết tài khoản nào đã nhận bản đó." />
      <div className="grid max-w-4xl gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tải file nghi bị lộ</CardTitle>
            <CardDescription>Chịu được nén JPEG, đổi độ sáng; không chịu được cắt xén. Ảnh bị thu nhỏ: nhập kích thước gốc của mẫu.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input type="file" accept="image/*,audio/*,video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <FilePreview file={file} className="mt-2" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Rộng gốc (px)">
                <Input type="number" value={w} onChange={(e) => setW(e.target.value)} />
              </Field>
              <Field label="Cao gốc (px)">
                <Input type="number" value={h} onChange={(e) => setH(e.target.value)} />
              </Field>
            </div>
            <Button
              disabled={!file || busy}
              onClick={async () => {
                if (!file) return;
                setBusy(true);
                setRes(null);
                try {
                  const fd = new FormData();
                  fd.append("file", file);
                  if (w) fd.append("width", w);
                  if (h) fd.append("height", h);
                  setRes(await api<Res>("/media/admin/watermark/decode", { method: "POST", body: fd }));
                } catch (e) {
                  toast.error(errorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? <Loader2 className="animate-spin" /> : <FileSearch />} Giải mã
            </Button>
          </CardContent>
        </Card>
        {res && (
          <Alert variant={res.found ? "default" : "destructive"}>
            <AlertTitle>{res.found ? "Tìm thấy watermark" : "Không tìm thấy watermark"}</AlertTitle>
            <AlertDescription className="space-y-1">
              <p>Độ tin cậy {formatNumber(res.confidence, 2)} {res.mediaType && `· ${res.mediaType}`}</p>
              {res.viewer?.userId && (
                <p>
                  Tài khoản đã nhận bản này: <UserName id={res.viewer.userId} withAvatar /> <code className="text-xs">{res.viewer.userId}</code>
                </p>
              )}
              {res.viewer?.guestSessionId && <p>Khách vãng lai cổng link — phiên {res.viewer.guestSessionId}</p>}
              {!res.found && <p>Có thể file không có watermark, bị cắt xén hoặc biến dạng quá mức (~0,5 là ngẫu nhiên).</p>}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </>
  );
}
