"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { WS_URL } from "@/lib/config";
import type { Notification } from "@/lib/types";

/**
 * WebSocket thông báo (mục 17.9): xin vé dùng một lần → mở ws → mỗi khung "notification" thì làm mới
 * chuông + hiện toast. Rớt / vé hỏng (4401) thì xin vé mới và mở lại; polling unread-count thưa làm dự phòng.
 */
export function useRealtimeNotifications(enabled: boolean, onOpenLink: (n: Notification) => void) {
  const qc = useQueryClient();
  const openRef = useRef(onOpenLink);
  useEffect(() => {
    openRef.current = onOpenLink;
  }, [onOpenLink]);

  useEffect(() => {
    if (!enabled) return;
    let ws: WebSocket | null = null;
    let stopped = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let backoff = 1000;

    const refresh = () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    };

    const connect = async () => {
      if (stopped) return;
      try {
        const { ticket } = await api<{ ticket: string }>("/notifications/me/realtime-ticket", { method: "POST", body: {} });
        if (stopped) return;
        ws = new WebSocket(`${WS_URL}/notifications/realtime?ticket=${encodeURIComponent(ticket)}`);
        ws.onopen = () => {
          backoff = 1000;
        };
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data as string) as { kind: string; notification?: Notification };
            if (msg.kind === "notification" && msg.notification) {
              refresh();
              const n = msg.notification;
              toast(n.title, { description: n.body, action: n.link ? { label: "Xem", onClick: () => openRef.current(n) } : undefined });
            }
          } catch {
            /* khung lạ — bỏ qua */
          }
        };
        ws.onclose = (ev) => {
          ws = null;
          if (stopped) return;
          refresh();
          const delay = ev.code === 4401 ? 500 : backoff;
          backoff = Math.min(backoff * 2, 30_000);
          retry = setTimeout(() => void connect(), delay);
        };
      } catch {
        if (stopped) return;
        backoff = Math.min(backoff * 2, 30_000);
        retry = setTimeout(() => void connect(), backoff);
      }
    };

    void connect();
    const poll = setInterval(() => {
      if (!document.hidden) refresh();
    }, 5 * 60_000);

    return () => {
      stopped = true;
      if (retry) clearTimeout(retry);
      clearInterval(poll);
      ws?.close();
    };
  }, [enabled, qc]);
}
