"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { AudioLines, Quote } from "lucide-react";
import type { FeedPreview } from "@/lib/types";

/**
 * Mẫu xem trước lấp đầy khung sáng của thẻ feed (P1 — hệ thống tự lấy 1 mẫu). Ảnh đã có chữ "nguồn: …" vẽ sẵn; video là
 * danh sách phát HLS CHỈ đoạn của mẫu (chữ watermark vẽ đè ở đây), tự phát không tiếng khi thẻ đang ở giữa màn; âm thanh
 * có watermark chìm. Văn bản / cặp / danh sách hiện như tờ giấy.
 */
export function PreviewMedia({ p, active }: { p: FeedPreview; active: boolean }) {
  if (laTheChu(p)) return <TheChu p={p} />;
  if (p.modality === "image" && p.fileUrl) {
    // Bản DÙNG CHUNG: chữ "nguồn: doanh nghiệp - domain" đã in sẵn trong ảnh (3.40) — không vẽ thêm gì.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={p.fileUrl} alt="Mẫu xem trước" className="h-full w-full object-contain" loading="lazy" draggable={false} />;
  }
  if (p.modality === "audio" && p.fileUrl) {
    return (
      <div className="flex w-full max-w-md flex-col items-center gap-4 px-4">
        <AudioLines className="size-14 text-muted-foreground" />
        <audio src={p.fileUrl} controls preload="none" className="w-full" />
      </div>
    );
  }
  if (p.modality === "video" && p.fileUrl) {
    return <HlsVideo src={p.fileUrl} watermarkText={p.watermarkText} active={active} />;
  }
  const c = p.content;
  const giay = "max-h-full overflow-hidden rounded-lg border bg-background p-3 text-sm leading-relaxed shadow-sm";
  if (p.modality === "pair" && c) {
    return (
      <div className="grid max-h-full w-full max-w-2xl gap-2 px-2 @md:grid-cols-2">
        <p className={`${giay} line-clamp-[7]`}>
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">A</span>
          {c.a}
        </p>
        <p className={`${giay} line-clamp-[7]`}>
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">B</span>
          {c.b}
        </p>
      </div>
    );
  }
  if (p.modality === "list" && c?.items) {
    return (
      <ol className={`${giay} w-full max-w-xl list-decimal space-y-1 pl-8`}>
        {c.items.slice(0, 8).map((x, i) => (
          <li key={i} className="line-clamp-1">
            {x}
          </li>
        ))}
        {c.items.length > 8 && <li className="list-none text-xs text-muted-foreground">… và {c.items.length - 8} mục nữa</li>}
      </ol>
    );
  }
  return null;
}

/** Nội dung chữ của mẫu văn bản (ưu tiên bản đầy đủ ≤ 4 KB, không có thì đoạn trích). */
function chuCuaMau(p: FeedPreview): string {
  return (p.content?.text ?? p.snippet ?? "").trim();
}

/** Mẫu văn bản có chữ → vẽ kiểu bài viết chữ trên Facebook (phủ kín khung xem trước, không có "tờ giấy" bên trong). */
export function laTheChu(p: FeedPreview): boolean {
  return p.modality === "text" && chuCuaMau(p).length > 0;
}

/** Một style chung cho mọi thẻ văn bản: nền xám than đậm + chữ trắng (không đổi màu theo bài cho đỡ rối mắt). */
const NEN_CHU = "from-slate-700 to-zinc-900";

/**
 * Cỡ chữ theo độ dài: càng ngắn chữ càng to, càng dài càng nhỏ (điện thoại nhỏ hơn máy tính một bậc). Ngắn thì đậm và
 * căn giữa như câu trích; dài thì căn trái cho dễ đọc.
 */
function kieuChu(doDai: number): { co: string; dam: boolean; giua: boolean } {
  if (doDai <= 30) return { co: "text-3xl @md:text-5xl", dam: true, giua: true };
  if (doDai <= 80) return { co: "text-2xl @md:text-4xl", dam: true, giua: true };
  if (doDai <= 160) return { co: "text-xl @md:text-3xl", dam: true, giua: true };
  if (doDai <= 300) return { co: "text-base @md:text-2xl", dam: false, giua: true };
  if (doDai <= 600) return { co: "text-sm @md:text-xl", dam: false, giua: false };
  return { co: "text-sm @md:text-lg", dam: false, giua: false };
}

function TheChu({ p }: { p: FeedPreview }) {
  const chu = chuCuaMau(p);
  const k = kieuChu(chu.length);
  return (
    <div className={`absolute inset-0 overflow-hidden bg-gradient-to-br ${NEN_CHU} text-white`}>
      <Quote aria-hidden className="absolute top-3 left-3 size-12 text-white/15 @md:size-16" />
      {/* m-auto: ngắn thì nằm giữa, dài hơn khung thì bắt đầu từ trên và cuộn được. pr lớn ở khung hẹp để chừa chỗ hàng nút dọc. */}
      <div className="no-scrollbar flex h-full flex-col overflow-y-auto px-6 py-14 pr-16 @md:px-10 @3xl:pr-10">
        <p
          className={`m-auto w-full whitespace-pre-line break-words leading-snug ${k.co} ${k.dam ? "font-semibold" : "font-normal"} ${k.giua ? "text-center" : "text-left"}`}
        >
          {chu}
        </p>
      </div>
      {/* Mờ dần ở đáy: báo hiệu đoạn dài cuộn được (đoạn ngắn nằm giữa nên không bị ảnh hưởng). */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/30 to-transparent" />
    </div>
  );
}

/** Video chỉ nạp danh sách phát khi thẻ lần đầu ra giữa màn; ra khỏi màn thì dừng. */
function HlsVideo({ src, watermarkText, active }: { src: string; watermarkText: string | null; active: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [daNap, setDaNap] = useState(active);
  // Lần đầu ra giữa màn thì bắt đầu nạp (chỉnh state ngay lúc render, không qua effect).
  if (active && !daNap) setDaNap(true);

  useEffect(() => {
    const v = ref.current;
    if (!v || !daNap) return;
    if (src.includes(".m3u8") && Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(v);
      return () => hls.destroy();
    }
    v.src = src;
  }, [src, daNap]);

  useEffect(() => {
    const v = ref.current;
    if (!v || !daNap) return;
    if (active) {
      v.muted = true;
      void v.play().catch(() => {
        // Trình duyệt chặn tự phát — người dùng bấm play.
      });
    } else {
      v.pause();
    }
  }, [active, daNap]);

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <video ref={ref} controls loop playsInline preload="none" className="max-h-full w-full rounded-md object-contain" />
      {watermarkText && (
        <span className="pointer-events-none absolute right-3 bottom-12 rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-white/80">{watermarkText}</span>
      )}
    </div>
  );
}
