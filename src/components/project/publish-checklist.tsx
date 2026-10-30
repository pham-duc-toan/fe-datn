"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, Rocket, XOctagon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";
import { api, ApiError, post } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatNumber, formatVnd } from "@/lib/format";
import { kybStatus, READINESS_LABEL, READINESS_WARNING } from "@/lib/labels";
import type { KybProfile, Project, Readiness } from "@/lib/types";
import { useSetProject } from "./use-project";

/**
 * Checklist publish — ghim ở đầu trang dự án (bên phải khối tên dự án) khi dự án còn nháp, để thấy còn thiếu gì
 * trong lúc sửa ở bất kỳ tab nào. Đủ hết mục mới bấm Publish được; publish khoá tiền ký quỹ từ ví.
 */
export function PublishChecklist({ project: p }: { project: Project }) {
  const qc = useQueryClient();
  const setProject = useSetProject(p.id);
  const readiness = useQuery({
    queryKey: ["readiness", p.id],
    queryFn: () => api<Readiness>(`/projects/${p.id}/readiness`),
    // Video đang chuẩn bị: tự cập nhật checklist tới khi xong.
    refetchInterval: (q) => ((q.state.data?.videoPreparingCount ?? 0) > 0 ? 5000 : false),
  });
  const kyb = useQuery({ queryKey: ["kyb"], queryFn: () => api<KybProfile>("/kyb/me") });
  const [busy, setBusy] = useState(false);
  const r = readiness.data;
  const kybOk = !kyb.data || kyb.data.status === "verified";

  async function publish() {
    setBusy(true);
    try {
      setProject(await post<Project>(`/projects/${p.id}/publish`));
      toast.success("Đã gửi publish — đang ký quỹ");
      pollAfterPublish();
      void qc.invalidateQueries({ queryKey: ["progress", p.id] });
    } catch (e) {
      toast.error(errorMessage(e));
      if (e instanceof ApiError && (e.code === "chua_xac_minh_doanh_nghiep" || e.code === "chua_xac_thuc_email")) {
        toast.info("Nếu bạn vừa được duyệt / vừa xác thực, hãy tải lại trang để làm mới phiên rồi publish lại.");
      }
    } finally {
      setBusy(false);
    }
  }

  // pendingEscrow thường vài giây; hỏi lại tới khi khác (mục 4.8).
  function pollAfterPublish() {
    let n = 0;
    const tick = async () => {
      n++;
      const x = await api<Project>(`/projects/${p.id}`);
      setProject(x);
      if (x.status === "pendingEscrow" && n < 20) setTimeout(tick, 1500);
      else if (x.status === "draft" && x.statusReason) toast.error(x.statusReason);
    };
    setTimeout(tick, 1200);
  }

  const missing = r?.missing.length ?? 0;
  return (
    <div className="flex h-full flex-col gap-2 rounded-lg border bg-card p-3 text-sm shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">Checklist publish</span>
        {r && (missing === 0 && kybOk ? (
          <span className="flex items-center gap-1 text-xs text-emerald-700">
            <CheckCircle2 className="size-3.5" /> Đủ điều kiện
          </span>
        ) : (
          <span className="text-xs text-destructive">Còn thiếu {missing + (kybOk ? 0 : 1)} mục</span>
        ))}
      </div>
      <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
        {!kybOk && kyb.data && (
          <p className="flex items-center gap-1.5">
            <XOctagon className="size-3.5 shrink-0 text-amber-600" /> Xác minh doanh nghiệp: <StatusBadge entry={kybStatus(kyb.data.status)} />
            <Link href="/doanh-nghiep/kyb" className="text-primary underline">
              Khai hồ sơ
            </Link>
          </p>
        )}
        {r?.missing.map((m) => (
          <p key={m} className="flex items-start gap-1.5">
            <XOctagon className="mt-0.5 size-3.5 shrink-0 text-destructive" />
            <span>
              {READINESS_LABEL[m] ?? m}
              {m === "video_dang_chuan_bi" && <span className="text-muted-foreground"> ({formatNumber(r.videoPreparingCount)} video)</span>}
            </span>
          </p>
        ))}
        {r?.warnings.map((w) => (
          <p key={w} className="flex items-start gap-1.5 text-amber-700">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {READINESS_WARNING[w] ?? w}
          </p>
        ))}
        {!r && <p className="text-muted-foreground">Đang kiểm tra…</p>}
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-2">
        <span className="text-xs text-muted-foreground">
          Ký quỹ khi publish: <b className="text-foreground">{r ? formatVnd(r.estimatedCostVnd) : "…"}</b>
        </span>
        <Button size="sm" onClick={() => void publish()} disabled={busy || !r?.ready || !kybOk}>
          {busy ? <Loader2 className="animate-spin" /> : <Rocket />} Publish dự án
        </Button>
      </div>
    </div>
  );
}
