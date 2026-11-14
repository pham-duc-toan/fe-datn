"use client";

import { useState } from "react";
import { FileSearch, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/common/page-header";
import { FilePreview } from "@/components/common/file-preview";
import { UserName } from "@/components/common/user-name";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatNumber } from "@/lib/format";

type Res = { found: boolean; confidence: number; mediaType?: string; viewer: { type: string; userId: string | null; guestSessionId: string | null } | null };

export default function WatermarkPage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Res | null>(null);
  return (
    <>
      <PageHeader title="Truy người làm lộ dữ liệu" description="Tìm tài khoản đã nhận bản dữ liệu bị lộ ra ngoài." />
      <div className="grid max-w-4xl gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tải file âm thanh nghi bị lộ</CardTitle>
            <CardDescription>
              Ảnh và video không cần tải lên: góc dưới bên phải mỗi ảnh / video đã có chữ “nguồn: &lt;mã tài khoản&gt; - &lt;doanh nghiệp&gt; - &lt;trang&gt;” — đọc mã tài khoản
              ngay trên hình. Âm thanh mang dấu ẩn không nghe thấy ở đoạn đầu và đoạn cuối; chịu được nén lại, không chịu được cắt bỏ cả hai đoạn đó.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <FilePreview file={file} className="mt-2" />
            <Button
              disabled={!file || busy}
              onClick={async () => {
                if (!file) return;
                setBusy(true);
                setRes(null);
                try {
                  const fd = new FormData();
                  fd.append("file", file);
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
              <p>Độ tin cậy {formatNumber(res.confidence, 2)}</p>
              {res.viewer?.userId && (
                <p>
                  Tài khoản đã nhận bản này: <UserName id={res.viewer.userId} withAvatar /> <code className="text-xs">{res.viewer.userId}</code>
                </p>
              )}
              {res.viewer?.guestSessionId && <p>Khách vãng lai cổng link — phiên {res.viewer.guestSessionId}</p>}
              {!res.found && <p>Có thể file không có dấu ẩn, đã bị cắt bỏ đoạn đầu và đoạn cuối, hoặc bị biến dạng quá mức (~0,5 là ngẫu nhiên).</p>}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </>
  );
}
