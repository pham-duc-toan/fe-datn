"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, FileUp, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/common/page-header";
import { Field } from "@/components/common/misc";
import { StatusBadge } from "@/components/common/status-badge";
import { Loading } from "@/components/common/states";
import { useAuth } from "@/components/providers/auth-provider";
import { api, post, put, uploadToSignedUrl } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { kybStatus } from "@/lib/labels";
import { FilePreview } from "@/components/common/file-preview";
import type { KybProfile } from "@/lib/types";

export default function KybPage() {
  const { forceRefresh, claims } = useAuth();
  const q = useQuery({ queryKey: ["kyb"], queryFn: () => api<KybProfile>("/kyb/me") });

  // Đã được duyệt mà token còn cờ cũ → làm mới để publish được ngay (mục 2.3, 13.2).
  useEffect(() => {
    if (q.data?.status === "verified" && claims.kyb_verified !== true && claims.kyb_verified !== "true") void forceRefresh();
  }, [q.data?.status, claims.kyb_verified, forceRefresh]);

  if (q.isPending) return <Loading />;
  return <KybForm key={`${q.data!.status}-${q.data!.submittedAt}`} k={q.data!} />;
}

function KybForm({ k }: { k: KybProfile }) {
  const qc = useQueryClient();
  const [company, setCompany] = useState(k.companyName);
  const [tax, setTax] = useState(k.taxCode);
  const [address, setAddress] = useState(k.address);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = k.status === "submitted" || k.status === "verified";

  async function save(submitAfter: boolean) {
    setBusy(true);
    try {
      let p = await put<KybProfile>("/kyb/me", { companyName: company.trim(), taxCode: tax.trim(), address: address.trim() });
      if (file) {
        const slot = await post<{ uploadUrl: string }>("/kyb/me/license", { fileName: file.name, sizeBytes: file.size });
        setProgress(0);
        await uploadToSignedUrl(slot.uploadUrl, file, setProgress);
        setFile(null);
      }
      if (submitAfter) p = await post<KybProfile>("/kyb/me/submit");
      qc.setQueryData(["kyb"], p);
      await qc.invalidateQueries({ queryKey: ["kyb"] });
      toast.success(submitAfter ? "Đã nộp hồ sơ, chờ admin duyệt" : "Đã lưu hồ sơ");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Hồ sơ doanh nghiệp (KYB)"
        description="Cần được admin xác minh mới publish được dự án. Tạo dự án, nạp dữ liệu, nạp tiền vẫn làm được trước."
        actions={<StatusBadge entry={kybStatus(k.status)} />}
      />
      <div className="max-w-2xl space-y-4">
        {k.status === "verified" && (
          <Alert>
            <BadgeCheck />
            <AlertTitle>Doanh nghiệp đã được xác minh</AlertTitle>
            <AlertDescription>Duyệt lúc {formatDateTime(k.reviewedAt)}. Hồ sơ đã xác minh không sửa được.</AlertDescription>
          </Alert>
        )}
        {k.status === "submitted" && (
          <Alert>
            <AlertTitle>Đang chờ duyệt</AlertTitle>
            <AlertDescription>Nộp lúc {formatDateTime(k.submittedAt)}. Kết quả sẽ tới qua thông báo và email.</AlertDescription>
          </Alert>
        )}
        {k.status === "rejected" && (
          <Alert variant="destructive">
            <AlertTitle>Hồ sơ bị từ chối</AlertTitle>
            <AlertDescription>{k.rejectReason} — sửa lại rồi nộp lần nữa.</AlertDescription>
          </Alert>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Thông tin doanh nghiệp</CardTitle>
            <CardDescription>Thông tin này được in trên hoá đơn VAT phí nền tảng.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Tên doanh nghiệp" required>
              <Input value={company} disabled={locked} onChange={(e) => setCompany(e.target.value)} placeholder="Công ty TNHH ABC" />
            </Field>
            <Field label="Mã số thuế" required hint="10 chữ số, chi nhánh dạng 0123456789-001">
              <Input value={tax} disabled={locked} onChange={(e) => setTax(e.target.value)} />
            </Field>
            <Field label="Địa chỉ" required>
              <Input value={address} disabled={locked} onChange={(e) => setAddress(e.target.value)} />
            </Field>
            <Field label="Giấy phép kinh doanh" hint={`.pdf / .png / .jpg, ≤ 10 MB.${k.hasLicense ? ` Đã có: ${k.licenseFileName ?? "giấy phép"}` : ""}`}>
              <label className={locked ? "pointer-events-none opacity-50" : ""}>
                <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" disabled={locked} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <span className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
                  <FileUp className="size-4" /> {file ? file.name : k.hasLicense ? "Thay giấy phép" : "Chọn file"}
                </span>
              </label>
              {progress !== null && <p className="text-xs text-muted-foreground">Đang tải lên {Math.round(progress * 100)}%</p>}
              <FilePreview file={file} url={k.licenseUrl} fileName={file ? file.name : k.licenseFileName} onExpired={() => void qc.invalidateQueries({ queryKey: ["kyb"] })} className="mt-2" />
            </Field>
            {!locked && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => void save(false)} disabled={busy}>
                  {busy && <Loader2 className="animate-spin" />} Lưu nháp
                </Button>
                <Button onClick={() => void save(true)} disabled={busy || (!k.hasLicense && !file)}>
                  {busy ? <Loader2 className="animate-spin" /> : <Send />} Nộp hồ sơ
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
