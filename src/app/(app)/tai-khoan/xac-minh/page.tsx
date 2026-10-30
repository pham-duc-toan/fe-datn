"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ImageOff, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/common/page-header";
import { Field, KeyValue } from "@/components/common/misc";
import { StatusBadge } from "@/components/common/status-badge";
import { Loading } from "@/components/common/states";
import { SignedImage } from "@/components/common/signed-image";
import { useAuth } from "@/components/providers/auth-provider";
import { api, post, put, uploadToSignedUrl } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDate, formatDateTime } from "@/lib/format";
import { kybStatus } from "@/lib/labels";
import type { IdentityVerification } from "@/lib/types";

export default function IdentityPage() {
  const { forceRefresh } = useAuth();
  const q = useQuery({ queryKey: ["identity"], queryFn: () => api<IdentityVerification>("/me/identity-verification") });

  useEffect(() => {
    // Vừa được duyệt: làm mới token để có claim identity_verified / adult (mục 17.2).
    if (q.data?.status === "verified") void forceRefresh();
  }, [q.data?.status, forceRefresh]);

  if (q.isPending) return <Loading />;
  return <IdentityForm key={`${q.data!.status}-${q.data!.submittedAt}`} v={q.data!} />;
}

function IdentityForm({ v }: { v: IdentityVerification }) {
  const qc = useQueryClient();
  const [fullName, setFullName] = useState(v.fullName ?? "");
  const [dob, setDob] = useState(v.dateOfBirth ?? "");
  const [idNumber, setIdNumber] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  // Ảnh vừa chọn (xem ngay trên máy, trước khi tải xong); tải xong thì dùng link xem của server.
  const [local, setLocal] = useState<{ front?: string; back?: string }>({});
  const locked = v.status === "submitted" || v.status === "verified";
  useEffect(() => () => Object.values(local).forEach((u) => u && URL.revokeObjectURL(u)), [local]);

  async function run(key: string, fn: () => Promise<unknown>, ok?: string) {
    setBusy(key);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["identity"] });
      if (ok) toast.success(ok);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const upload = (side: "front" | "back") => async (f: File) => {
    setLocal((old) => ({ ...old, [side]: URL.createObjectURL(f) }));
    return run(side, async () => {
      const slot = await post<{ uploadUrl: string }>("/me/identity-verification/upload-url", { side, fileName: f.name, sizeBytes: f.size });
      await uploadToSignedUrl(slot.uploadUrl, f);
    }, side === "front" ? "Đã tải mặt trước" : "Đã tải mặt sau");
  };

  return (
    <>
      <PageHeader title="Xác minh danh tính" description="Một số dự án (nội dung nhạy cảm, dữ liệu cần bảo mật) chỉ nhận người đã xác minh và đủ tuổi." />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Thông tin giấy tờ <StatusBadge entry={kybStatus(v.status)} />
            </CardTitle>
            <CardDescription>Số giấy tờ được mã hoá; chỉ hiện 4 số cuối. Mỗi giấy tờ chỉ xác minh được cho một tài khoản.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {v.status === "rejected" && v.rejectReason && (
              <Alert variant="destructive">
                <AlertDescription>Bị từ chối: {v.rejectReason}. Sửa lại và nộp lần nữa.</AlertDescription>
              </Alert>
            )}
            {v.status === "verified" && (
              <Alert>
                <CheckCircle2 />
                <AlertDescription>Đã xác minh {formatDateTime(v.reviewedAt)}{v.adult ? " · đủ tuổi" : " · chưa đủ tuổi"}.</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Họ và tên" required>
                <Input value={fullName} disabled={locked} onChange={(e) => setFullName(e.target.value)} />
              </Field>
              <Field label="Ngày sinh" required>
                <Input type="date" value={dob} disabled={locked} onChange={(e) => setDob(e.target.value)} />
              </Field>
              <Field label="Số CCCD / hộ chiếu" hint={v.idNumberLast4 ? `Đã lưu: ****${v.idNumberLast4}` : undefined}>
                <Input value={idNumber} disabled={locked} placeholder={v.idNumberLast4 ? "Nhập lại để thay đổi" : ""} onChange={(e) => setIdNumber(e.target.value)} />
              </Field>
            </div>
            {!locked && (
              <Button
                disabled={busy === "save"}
                onClick={() => void run("save", () => put("/me/identity-verification", { fullName, dateOfBirth: dob || null, idNumber: idNumber || undefined }), "Đã lưu thông tin")}
              >
                {busy === "save" && <Loader2 className="animate-spin" />} Lưu thông tin
              </Button>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {(["front", "back"] as const).map((side) => {
                const server = side === "front" ? v.frontUrl : v.backUrl;
                const src = local[side] ?? server ?? null;
                const has = side === "front" ? v.hasFront : v.hasBack;
                return (
                <div key={side} className="rounded-md border border-dashed p-4 text-center">
                  <p className="mb-2 text-sm font-medium">{side === "front" ? "Mặt trước" : "Mặt sau"}</p>
                  <div className="mb-3 flex aspect-[1.6] items-center justify-center overflow-hidden rounded bg-muted">
                    {src ? (
                      local[side] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={src} alt={side === "front" ? "Mặt trước giấy tờ" : "Mặt sau giấy tờ"} className="h-full w-full object-contain" />
                      ) : (
                        <SignedImage src={src} alt={side === "front" ? "Mặt trước giấy tờ" : "Mặt sau giấy tờ"} className="h-full w-full object-contain" onExpired={() => void qc.invalidateQueries({ queryKey: ["identity"] })} />
                      )
                    ) : (
                      <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
                        <ImageOff className="size-5" /> {has ? "Đã tải lên" : "Chưa có ảnh"}
                      </span>
                    )}
                  </div>
                  <label className={locked ? "pointer-events-none opacity-50" : ""}>
                    <input type="file" accept="image/*" className="hidden" disabled={locked} onChange={(e) => e.target.files?.[0] && void upload(side)(e.target.files[0])} />
                    <span className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
                      {busy === side ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} {has ? "Đổi ảnh" : "Chọn ảnh"}
                    </span>
                  </label>
                </div>
                );
              })}
            </div>
            {!locked && (
              <Button disabled={busy === "submit" || !v.hasFront || !v.hasBack} onClick={() => void run("submit", () => post("/me/identity-verification/submit"), "Đã nộp hồ sơ, chờ admin duyệt")}>
                {busy === "submit" && <Loader2 className="animate-spin" />} Nộp xác minh
              </Button>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Trạng thái</CardTitle>
          </CardHeader>
          <CardContent>
            <KeyValue
              className="sm:grid-cols-1"
              items={[
                ["Trạng thái", <StatusBadge key="s" entry={kybStatus(v.status)} />],
                ["Họ tên", v.fullName || "—"],
                ["Ngày sinh", formatDate(v.dateOfBirth)],
                ["Số giấy tờ", v.idNumberLast4 ? `****${v.idNumberLast4}` : "—"],
                ["Nộp lúc", formatDateTime(v.submittedAt)],
                ["Duyệt lúc", formatDateTime(v.reviewedAt)],
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
