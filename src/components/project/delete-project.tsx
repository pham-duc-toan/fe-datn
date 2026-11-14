"use client";

import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ActionDialog } from "@/components/common/action-dialog";
import { del } from "@/lib/api";
import type { ProjectStatus } from "@/lib/types";

/** Doanh nghiệp xoá được dự án nháp và dự án đã kết thúc (hoàn thành / đã huỷ); dự án đang chạy phải huỷ / kết thúc trước. */
export const canDeleteProject = (status: ProjectStatus) => status === "draft" || status === "completed" || status === "cancelled";

/**
 * "Xoá dự án" phía doanh nghiệp — cùng một nút, cùng DELETE /projects/{id}:
 *   - dự án nháp (hoặc đã huỷ mà chưa từng publish): backend xoá hẳn kèm mẫu, file, câu kiểm tra, thành viên;
 *   - dự án đã kết thúc: backend chỉ ẩn khỏi doanh nghiệp (kiến trúc 3.36) — ký quỹ, bài làm, nhãn, hoá đơn của các bên
 *     vẫn giữ. Với doanh nghiệp, dự án biến mất như khi xoá.
 */
export function DeleteProjectButton({
  id,
  name,
  status,
  onDeleted,
  compact,
}: {
  id: string;
  name: string;
  status: ProjectStatus;
  onDeleted: () => void;
  compact?: boolean;
}) {
  const draft = status === "draft";
  return (
    <ActionDialog
      trigger={
        compact ? (
          <Button size="icon-xs" variant="ghost" aria-label={`Xoá dự án ${name}`} title="Xoá dự án">
            <Trash2 className="text-destructive" />
          </Button>
        ) : (
          <Button variant="destructive">
            <Trash2 /> Xoá dự án
          </Button>
        )
      }
      title={draft ? "Xoá dự án nháp?" : "Xoá dự án?"}
      description={
        draft
          ? `Dự án “${name}” cùng toàn bộ dữ liệu đã nạp (mẫu, file, câu kiểm tra, thành viên) bị xoá hẳn và không khôi phục được.`
          : `Dự án “${name}” bị xoá khỏi tài khoản của bạn và không mở lại được. Lịch sử thanh toán và hoá đơn của dự án vẫn được giữ.`
      }
      destructive
      confirmLabel={draft ? "Xoá hẳn" : "Xoá dự án"}
      onConfirm={async () => {
        await del(`/projects/${id}`);
        toast.success("Đã xoá dự án");
        onDeleted();
      }}
    />
  );
}
