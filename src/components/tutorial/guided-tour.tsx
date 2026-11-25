"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, ChevronRight, Minimize2, Maximize2, MousePointerClick, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GuideStep, TourCtx } from "./tool-lessons";

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 6;
const CARD_W = 330;
const CARD_H = 200;

/**
 * Tour kiểu game có THỰC HÀNH: làm tối mọi thứ trừ "lỗ" quanh phần tử đang chỉ — trong lỗ vẫn bấm / kéo / gõ được
 * bình thường. Bước có `done` thì chờ người dùng làm xong (tự sang bước sau), bước không có thì bấm "Tiếp".
 * Khác SpotlightTour (chỉ xem, chặn thao tác). Không bắt phím (Enter / Esc / Backspace là phím của công cụ vẽ).
 * z-index 45: dưới menu thả xuống của Radix (z-50) để chọn được trong Select ở bước thực hành.
 */
export function GuidedTour({ root, steps, ctx, onClose }: { root: HTMLElement | null; steps: GuideStep[]; ctx: TourCtx; onClose: (finished: boolean) => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [thuGon, setThuGon] = useState(false);
  const step = steps[Math.min(i, steps.length - 1)];
  const xong = step?.done ? step.done(ctx) : false;
  const cuoi = i >= steps.length - 1;

  // Đo lại liên tục: nội dung trong lỗ đổi cỡ khi người dùng thao tác (danh sách dài ra, ô lớp hiện ra…).
  // Bước có nhiều vùng (vd chọn lớp bên phải + bôi đen văn bản bên trái) → lỗ là khung bao tất cả.
  useEffect(() => {
    const ds = step?.target === null || step?.target === undefined ? [] : Array.isArray(step.target) ? step.target : [step.target];
    if (ds.length === 0 || !root) {
      const r0 = requestAnimationFrame(() => setRect(null));
      return () => cancelAnimationFrame(r0);
    }
    root.querySelector<HTMLElement>(ds[0])?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const doLai = () => {
      const els = ds.map((s) => root.querySelector<HTMLElement>(s)).filter((e): e is HTMLElement => e !== null);
      if (els.length === 0) return setRect(null);
      const rs = els.map((e) => e.getBoundingClientRect());
      const x0 = Math.min(...rs.map((q) => q.left));
      const y0 = Math.min(...rs.map((q) => q.top));
      const r = { left: x0, top: y0, width: Math.max(...rs.map((q) => q.right)) - x0, height: Math.max(...rs.map((q) => q.bottom)) - y0 };
      setRect((cu) =>
        cu && Math.abs(cu.top - (r.top - PAD)) < 0.5 && Math.abs(cu.left - (r.left - PAD)) < 0.5 && Math.abs(cu.width - (r.width + PAD * 2)) < 0.5 && Math.abs(cu.height - (r.height + PAD * 2)) < 0.5
          ? cu
          : { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 },
      );
    };
    const r0 = requestAnimationFrame(doLai);
    const h = setInterval(doLai, 250);
    window.addEventListener("resize", doLai);
    window.addEventListener("scroll", doLai, true);
    return () => {
      cancelAnimationFrame(r0);
      clearInterval(h);
      window.removeEventListener("resize", doLai);
      window.removeEventListener("scroll", doLai, true);
    };
  }, [step, root]);

  // Làm xong bước thực hành → khen một nhịp rồi tự sang bước sau.
  const daChuyen = useRef(-1);
  useEffect(() => {
    if (!xong || daChuyen.current === i) return;
    daChuyen.current = i;
    const h = setTimeout(() => {
      if (cuoi) onClose(true);
      else setI((x) => x + 1);
    }, 700);
    return () => clearTimeout(h);
  }, [xong, i, cuoi, onClose]);

  if (!step) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(CARD_W, vw - 24);
  // Thẻ chú thích: dưới lỗ → trên lỗ → bên phải → bên trái; lỗ quá to thì góc dưới trái (thu gọn được).
  let top = vh / 2 - CARD_H / 2;
  let left = (vw - w) / 2;
  if (rect) {
    const duoi = rect.top + rect.height + 12;
    const tren = rect.top - CARD_H - 12;
    const phai = rect.left + rect.width + 12;
    const trai = rect.left - w - 12;
    const doc = Math.min(Math.max(12, rect.top), vh - CARD_H - 12);
    if (duoi + CARD_H < vh) [top, left] = [duoi, Math.min(Math.max(12, rect.left), vw - w - 12)];
    else if (tren > 12) [top, left] = [tren, Math.min(Math.max(12, rect.left), vw - w - 12)];
    else if (phai + w < vw) [top, left] = [doc, phai];
    else if (trai > 12) [top, left] = [doc, trai];
    else [top, left] = [vh - CARD_H - 12, 12];
  }

  const che = "absolute bg-black/55 transition-all duration-200";
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[45]" role="dialog" aria-label={step.title}>
      {rect ? (
        <>
          {/* Bốn tấm che quanh lỗ: chặn bấm ra ngoài, trong lỗ thao tác bình thường. */}
          <div className={cn(che, "pointer-events-auto left-0 top-0 w-full")} style={{ height: Math.max(0, rect.top) }} />
          <div className={cn(che, "pointer-events-auto left-0 w-full")} style={{ top: rect.top + rect.height, bottom: 0 }} />
          <div className={cn(che, "pointer-events-auto left-0")} style={{ top: rect.top, height: rect.height, width: Math.max(0, rect.left) }} />
          <div className={cn(che, "pointer-events-auto right-0")} style={{ top: rect.top, height: rect.height, left: rect.left + rect.width }} />
          <div
            className={cn("absolute rounded-lg ring-2 transition-all duration-200", xong ? "ring-emerald-500" : step.done ? "animate-pulse ring-amber-400" : "ring-amber-400")}
            style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
          />
        </>
      ) : (
        <div className="pointer-events-auto absolute inset-0 bg-black/55" />
      )}

      {thuGon ? (
        <button
          type="button"
          onClick={() => setThuGon(false)}
          className="pointer-events-auto absolute bottom-4 left-4 flex items-center gap-2 rounded-full border bg-popover px-3 py-2 text-sm font-medium shadow-xl"
        >
          <Maximize2 className="size-4" /> {i + 1}/{steps.length} · {step.title}
        </button>
      ) : (
        <div className="pointer-events-auto absolute rounded-lg border bg-popover p-4 text-popover-foreground shadow-xl transition-all duration-200" style={{ top, left, width: w }}>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
            {i + 1}/{steps.length}
            {step.done && !xong && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                <MousePointerClick className="size-3" /> Đến lượt bạn
              </span>
            )}
            {xong && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                <Check className="size-3" /> Làm tốt lắm!
              </span>
            )}
            <div className="ml-auto flex gap-0.5">
              <Button variant="ghost" size="icon-xs" onClick={() => setThuGon(true)} aria-label="Thu gọn hướng dẫn" title="Thu gọn (thẻ che mất chỗ cần làm)">
                <Minimize2 />
              </Button>
              <Button variant="ghost" size="icon-xs" onClick={() => onClose(false)} aria-label="Tắt hướng dẫn" title="Tắt hướng dẫn, tự làm bài tập">
                <X />
              </Button>
            </div>
          </div>
          <h3 className="font-semibold">{step.title}</h3>
          <p className="mt-1 text-sm leading-6">{step.body}</p>
          <div className="mt-3 flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={i === 0} onClick={() => setI((x) => x - 1)} aria-label="Bước trước">
              <ChevronLeft />
            </Button>
            <div className="ml-auto">
              {step.done ? (
                <Button size="sm" variant="ghost" onClick={() => (cuoi ? onClose(true) : setI((x) => x + 1))} title="Bỏ qua bước này">
                  Bỏ qua bước
                </Button>
              ) : (
                <Button size="sm" onClick={() => (cuoi ? onClose(true) : setI((x) => x + 1))}>
                  {cuoi ? "Xong" : "Tiếp"} {!cuoi && <ChevronRight />}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
