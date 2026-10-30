"use client";

import { useRef } from "react";

/**
 * Ảnh từ link ký sẵn (presigned, sống 5 phút). Ảnh tải lỗi — thường do link hết hạn — thì gọi `onExpired`
 * để lấy link mới, tự động và không hiện gì cho người dùng. Tối đa 3 lần liên tiếp để file hỏng thật
 * không gọi lại mãi; tải được lại thì đếm lại từ đầu.
 */
export function SignedImage({ src, alt, className, onExpired }: { src: string; alt: string; className?: string; onExpired: () => void }) {
  const loi = useRef(0);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      onLoad={() => {
        loi.current = 0;
      }}
      onError={() => {
        if (loi.current >= 3) return;
        loi.current += 1;
        onExpired();
      }}
    />
  );
}
