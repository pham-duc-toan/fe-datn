"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { AudioLines } from "lucide-react";
import type { FeedPreview } from "@/lib/types";

/**
 * Mẫu xem trước lấp đầy khung sáng của thẻ feed (P1 — hệ thống tự lấy 1 mẫu). Ảnh đã có chữ "nguồn: …" vẽ sẵn; video là
 * danh sách phát HLS CHỈ đoạn của mẫu (chữ watermark vẽ đè ở đây), tự phát không tiếng khi thẻ đang ở giữa màn; âm thanh
 * có watermark chìm. Văn bản / cặp / danh sách hiện như tờ giấy.
 */
export function PreviewMedia({ p, active }: { p: FeedPreview; active: boolean }) {
  if (p.modality === "image" && p.fileUrl) {
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
  const chu = p.snippet ?? c?.text ?? null;
  if (!chu) return null;
  return <p className={`${giay} line-clamp-[10] w-full max-w-xl whitespace-pre-line`}>{chu}</p>;
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
