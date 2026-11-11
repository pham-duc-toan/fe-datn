"use client";

import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ActionDialog } from "@/components/common/action-dialog";
import { del } from "@/lib/api";

/**
 * Xoá HẲN một dự án nháp (kèm mẫu, file đã nạp, câu vàng, thành viên). Chỉ dự án nháp / chưa từng publish — dự án đã publish
 * có tiền ký quỹ và bài làm nên chỉ huỷ / kết thúc được (backend DELETE /projects/{id} từ chối, mã khong_the_xoa_du_an).
 */
export function DeleteProjectButton({ id, name, onDeleted, compact }: { id: string; name: string; onDeleted: () => void; compact?: boolean }) {
  return (
    <ActionDialog
      trigger={
        compact ? (
          <Button size="icon-xs" variant="ghost" aria-label={`Xoá dự án ${name}`} title="Xoá dự án nháp">
            <Trash2 className="text-destructive" />
          </Button>
        ) : (
          <Button variant="destructive">
            <Trash2 /> Xoá dự án
          </Button>
        )
      }
      title="Xoá dự án nháp?"
      description={`Dự án “${name}” cùng toàn bộ dữ liệu đã nạp (mẫu, file, câu kiểm tra, thành viên) bị xoá hẳn và không khôi phục được.`}
      destructive
      confirmLabel="Xoá hẳn"
      onConfirm={async () => {
        await del(`/projects/${id}`);
        toast.success("Đã xoá dự án");
        onDeleted();
      }}
    />
  );
}
