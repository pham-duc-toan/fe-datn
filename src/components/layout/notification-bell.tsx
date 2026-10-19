"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api, post } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { mapNotificationLink } from "@/lib/nav";
import type { Notification, Role } from "@/lib/types";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";

export function useOpenNotification(role: Role | null) {
  const router = useRouter();
  const read = useAction((id: string) => post(`/notifications/me/${id}/read`), { invalidate: [["notifications"]], silentError: true });
  return (n: Notification) => {
    if (!n.readAt) read.mutate(n.id);
    const href = mapNotificationLink(n.link, role) ?? "/thong-bao";
    router.push(href);
  };
}

export function NotificationBell({ role }: { role: Role | null }) {
  const count = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => api<{ count: number }>("/notifications/me/unread-count"),
  });
  const latest = useQuery({
    queryKey: ["notifications", "latest"],
    queryFn: () => api<{ items: Notification[] }>("/notifications/me", { query: { page: 1, pageSize: 8 } }),
  });
  const open = useOpenNotification(role);
  const readAll = useAction(() => post("/notifications/me/read-all"), { invalidate: [["notifications"]] });
  const unread = count.data?.count ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Thông báo">
          <Bell />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex min-w-4 h-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Thông báo</span>
          <Button variant="ghost" size="xs" onClick={() => readAll.mutate()} disabled={unread === 0}>
            <CheckCheck /> Đọc hết
          </Button>
        </div>
        <ScrollArea className="max-h-96">
          {(latest.data?.items ?? []).length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Chưa có thông báo</p>}
          {(latest.data?.items ?? []).map((n) => (
            <button
              key={n.id}
              onClick={() => open(n)}
              className={cn("block w-full border-b px-3 py-2.5 text-left last:border-0 hover:bg-muted", !n.readAt && "bg-primary/5")}
            >
              <div className="flex items-start gap-2">
                {!n.readAt && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</p>
                </div>
              </div>
            </button>
          ))}
        </ScrollArea>
        <div className="border-t p-2 text-center">
          <Link href="/thong-bao" className="text-sm text-primary hover:underline">
            Xem tất cả
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
