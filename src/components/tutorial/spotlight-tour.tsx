"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Một điểm dừng của tour: phần tử có thuộc tính `data-tour="<target>"`. */
export type TourStep = { target: string; title: string; body: string };

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 6;
const CARD_W = 340;

function tim(target: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
}

/**
 * Tour làm nổi từng vùng của trang (lớp phủ tối, "lỗ" sáng quanh phần tử + thẻ chú thích) — như phần giới thiệu
 * giao diện trong game. Chặn thao tác với trang khi đang chạy; Esc = bỏ qua, ← / → = lùi / tiếp.
 * Điểm dừng nào không tìm thấy phần tử (vd. màn hình hẹp ẩn mất) thì tự bỏ.
 */
export function SpotlightTour({ steps, onClose, finishLabel = "Bắt đầu làm bài" }: { steps: TourStep[]; onClose: (finished: boolean) => void; finishLabel?: string }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  // Điểm dừng có phần tử thật trên trang. Phải đo SAU khi trang được dựng (tour có thể mở cùng lúc trang đổi từ màn
  // luyện tập sang trang làm bài, lúc render DOM chưa có phần tử nào) nên đo ở khung hình kế tiếp; null = chưa đo.
  const [conThat, setConThat] = useState<TourStep[] | null>(null);
  const coThat = conThat ?? [];
  const step = coThat[i];

  useEffect(() => {
    const r = requestAnimationFrame(() => setConThat(steps.filter((s) => tim(s.target) !== null)));
    return () => cancelAnimationFrame(r);
  }, [steps]);

  const doLai = useCallback(() => {
    if (!step) return;
    const el = tim(step.target);
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
  }, [step]);

  useLayoutEffect(() => {
    if (!step) return;
    tim(step.target)?.scrollIntoView({ block: "center", behavior: "smooth" });
    // Đo ở khung hình kế tiếp; cuộn mượt xong mới đúng vị trí nên đo lại vài lần.
    const r0 = requestAnimationFrame(doLai);
    const t1 = setTimeout(doLai, 250);
    const t2 = setTimeout(doLai, 600);
    window.addEventListener("resize", doLai);
    window.addEventListener("scroll", doLai, true);
    return () => {
      cancelAnimationFrame(r0);
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", doLai);
      window.removeEventListener("scroll", doLai, true);
    };
  }, [step, doLai]);

  const cuoi = i >= coThat.length - 1;
  const tiep = useCallback(() => {
    if (cuoi) onClose(true);
    else setI((x) => x + 1);
  }, [cuoi, onClose]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(false);
      else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        tiep();
      } else if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [tiep, onClose]);

  useEffect(() => {
    // Không còn điểm dừng nào hiển thị được → coi như xong.
    if (conThat !== null && conThat.length === 0) onClose(true);
  }, [conThat, onClose]);

  if (!step) return null;

  // Thẻ chú thích: dưới phần tử nếu còn chỗ, không thì phía trên; luôn nằm trong màn hình.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(CARD_W, vw - 24);
  let top = rect ? rect.top + rect.height + 12 : vh / 2 - 80;
  if (rect && top + 190 > vh) top = Math.max(12, rect.top - 190 - 12);
  const left = rect ? Math.min(Math.max(12, rect.left), vw - w - 12) : (vw - w) / 2;

  return createPortal(
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={step.title}>
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-amber-400 transition-all duration-300"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.6)" }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/60" />
      )}
      <div className="absolute rounded-lg border bg-popover p-4 text-popover-foreground shadow-xl transition-all duration-300" style={{ top, left, width: w }}>
        <div className="mb-1 text-xs text-muted-foreground tabular-nums">
          {i + 1}/{coThat.length}
        </div>
        <h3 className="font-semibold">{step.title}</h3>
        <p className="mt-1 text-sm leading-6">{step.body}</p>
        <div className="mt-3 flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => onClose(false)}>
            <SkipForward /> Bỏ qua
          </Button>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" disabled={i === 0} onClick={() => setI((x) => x - 1)}>
              <ChevronLeft />
            </Button>
            <Button size="sm" onClick={tiep}>
              {cuoi ? finishLabel : "Tiếp"} {!cuoi && <ChevronRight />}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
