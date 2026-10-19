"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { ChevronLeft, ChevronRight, ExternalLink, Minus, Plus, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewerImage = { src: string; name: string };

const MIN = 1;
const MAX = 6;

/**
 * Trình xem ảnh toàn màn hình (kiểu bấm vào ảnh trên Facebook): nền tối, ảnh vừa màn hình,
 * cuộn chuột / nút +− / nhấp đúp để phóng, kéo để di khi đã phóng, ← → chuyển ảnh, Esc đóng.
 * index = null là đóng.
 */
export function ImageViewer({ images, index, onIndexChange }: { images: ViewerImage[]; index: number | null; onIndexChange: (i: number | null) => void }) {
  const open = index !== null && images[index] !== undefined;
  const cur = open ? images[index!] : null;
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const many = images.length > 1;

  const go = (d: number) => {
    if (index === null || !many) return;
    setView({ scale: 1, x: 0, y: 0 });
    onIndexChange((index + d + images.length) % images.length);
  };
  const zoom = (f: number) =>
    setView((v) => {
      const scale = Math.min(MAX, Math.max(MIN, v.scale * f));
      return scale === 1 ? { scale: 1, x: 0, y: 0 } : { ...v, scale };
    });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "+" || e.key === "=") zoom(1.4);
      else if (e.key === "-") zoom(1 / 1.4);
      else if (e.key === "0") setView({ scale: 1, x: 0, y: 0 });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function onPointerDown(e: ReactPointerEvent) {
    if (view.scale === 1) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y };
  }
  function onPointerMove(e: ReactPointerEvent) {
    const d = drag.current;
    if (!d) return;
    setView((v) => ({ ...v, x: d.x + (e.clientX - d.px), y: d.y + (e.clientY - d.py) }));
  }

  const btn = "flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-40";

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setView({ scale: 1, x: 0, y: 0 });
          onIndexChange(null);
        }
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/90 data-open:animate-in data-open:fade-in-0" />
        <DialogPrimitive.Content className="fixed inset-0 z-50 flex flex-col outline-none" aria-describedby={undefined}>
          <DialogPrimitive.Title className="sr-only">{cur?.name ?? "Xem ảnh"}</DialogPrimitive.Title>
          <div className="flex items-center gap-2 px-4 py-3 text-sm text-white">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{cur?.name}</div>
              {many && index !== null && <div className="text-xs text-white/60">{index + 1} / {images.length}</div>}
            </div>
            <button type="button" className={btn} onClick={() => zoom(1 / 1.4)} disabled={view.scale <= MIN} title="Thu nhỏ (−)">
              <Minus className="size-4" />
            </button>
            <span className="w-12 text-center text-xs tabular-nums text-white/80">{Math.round(view.scale * 100)}%</span>
            <button type="button" className={btn} onClick={() => zoom(1.4)} disabled={view.scale >= MAX} title="Phóng to (+)">
              <Plus className="size-4" />
            </button>
            <button type="button" className={btn} onClick={() => setView({ scale: 1, x: 0, y: 0 })} disabled={view.scale === 1} title="Vừa màn hình (0)">
              <RotateCcw className="size-4" />
            </button>
            {cur && (
              <a href={cur.src} target="_blank" rel="noreferrer" className={btn} title="Mở ảnh gốc ở tab mới">
                <ExternalLink className="size-4" />
              </a>
            )}
            <DialogPrimitive.Close className={btn} title="Đóng (Esc)">
              <X className="size-5" />
            </DialogPrimitive.Close>
          </div>
          <div
            className={cn("relative flex flex-1 touch-none items-center justify-center overflow-hidden select-none", view.scale > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in")}
            onWheel={(e) => zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15)}
            onDoubleClick={() => (view.scale > 1 ? setView({ scale: 1, x: 0, y: 0 }) : setView({ scale: 2.5, x: 0, y: 0 }))}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => (drag.current = null)}
            onClick={(e) => {
              // Bấm ra nền tối (ngoài ảnh) khi chưa phóng = đóng, như trình xem ảnh mạng xã hội.
              if (e.target === e.currentTarget && view.scale === 1) onIndexChange(null);
            }}
          >
            {cur && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={cur.src}
                src={cur.src}
                alt={cur.name}
                draggable={false}
                className="max-h-[calc(100vh-7rem)] max-w-[calc(100vw-2rem)] object-contain transition-transform duration-75"
                style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
              />
            )}
            {many && (
              <>
                <button type="button" className={cn(btn, "absolute top-1/2 left-4 -translate-y-1/2")} onClick={() => go(-1)} title="Ảnh trước (←)">
                  <ChevronLeft className="size-5" />
                </button>
                <button type="button" className={cn(btn, "absolute top-1/2 right-4 -translate-y-1/2")} onClick={() => go(1)} title="Ảnh sau (→)">
                  <ChevronRight className="size-5" />
                </button>
              </>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Ảnh thu nhỏ bấm được để mở trình xem. */
export function ImageThumb({ src, name, onOpen, className, children }: { src: string; name: string; onOpen: () => void; className?: string; children?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className={cn("group relative block overflow-hidden rounded-md border bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", className)}
      title={`Xem ảnh lớn — ${name}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={name} loading="lazy" className="size-full object-cover transition-transform group-hover:scale-105" />
      {children}
    </button>
  );
}
