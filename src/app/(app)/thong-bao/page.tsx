"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/common/page-header";
import { Pager } from "@/components/common/pager";
import { QueryState } from "@/components/common/states";
import { useOpenNotification } from "@/components/layout/notification-bell";
import { useAuth } from "@/components/providers/auth-provider";
import { useAction } from "@/hooks/use-action";
import { api, post } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { Notification } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useUrlPage, useUrlState } from "@/lib/use-url-state";

export default function NotificationsPage() {
  const { activeRole } = useAuth();
  const [page, setPage] = useUrlPage();
  const [unread, setUnread] = useUrlState("unread", "0");
  const unreadOnly = unread === "1";
  const setUnreadOnly = (v: boolean) => setUnread(v ? "1" : "0");
  const q = useQuery({
    queryKey: ["notifications", "page", page, unreadOnly],
    queryFn: () => api<{ items: Notification[]; page: number; pageSize: number; total: number; unreadCount: number }>("/notifications/me", { query: { page, pageSize: 20, unreadOnly } }),
  });
  const open = useOpenNotification(activeRole);
  const readAll = useAction(() => post("/notifications/me/read-all"), { invalidate: [["notifications"]], success: "Đã đánh dấu đọc hết" });

  return (
    <>
      <PageHeader
        title="Thông báo"
        description="Thông báo mới được đẩy ngay khi bạn đang mở web."
        actions={
          <>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={unreadOnly} onCheckedChange={(v) => { setUnreadOnly(v); setPage(1); }} /> Chỉ chưa đọc
            </label>
            <Button variant="outline" size="sm" onClick={() => readAll.mutate()}>
              <CheckCheck /> Đọc hết
            </Button>
          </>
        }
      />
      <QueryState query={q} empty={(d) => d.items.length === 0}>
        {(d) => (
          <Card className="py-0">
            <CardContent className="divide-y px-0">
              {d.items.map((n) => (
                <button key={n.id} onClick={() => open(n)} className={cn("flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted", !n.readAt && "bg-primary/5")}>
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-medium">{n.title}</p>
                      <span className="text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{n.body}</p>
                  </div>
                </button>
              ))}
              <div className="px-4 pb-3">
                <Pager page={d.page} pageSize={d.pageSize} total={d.total} onChange={setPage} />
              </div>
            </CardContent>
          </Card>
        )}
      </QueryState>
    </>
  );
}
