"use client";

import { useEffect, useMemo } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { SignedImage } from "./signed-image";
import { cn } from "@/lib/utils";

const isPdf = (name: string | null | undefined) => Boolean(name && /\.pdf($|\?)/i.test(name));

/**
 * Xem trước file người dùng tải lên (giấy phép, giấy tờ...): ảnh hiện thành ảnh, PDF nhúng khung xem,
 * âm thanh / video vừa chọn có trình phát.
 * `file` = file vừa chọn trên máy (xem ngay, chưa cần tải lên); không có thì dùng `url` (link ký sẵn của server).
 */
export function FilePreview({
  file,
  url,
  fileName,
  onExpired,
  className,
}: {
  file?: File | null;
  url?: string | null;
  fileName?: string | null;
  onExpired?: () => void;
  className?: string;
}) {
  const localUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (localUrl) URL.revokeObjectURL(localUrl);
  }, [localUrl]);

  const src = localUrl ?? url ?? null;
  if (!src) return null;
  const pdf = file ? file.type === "application/pdf" || isPdf(file.name) : isPdf(fileName);
  const box = cn("overflow-hidden rounded-md border bg-muted", className);

  if (file && file.type.startsWith("audio/")) return <audio controls src={src} className="w-full" />;
  if (file && file.type.startsWith("video/")) return <video controls src={src} className={cn(box, "max-h-96 w-full")} />;
  if (pdf)
    return (
      <div className="space-y-1">
        <iframe src={src} title={fileName ?? "Xem trước PDF"} className={cn(box, "h-96 w-full")} />
        <a href={src} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline">
          <FileText className="size-3.5" /> Mở {fileName ?? "file PDF"} <ExternalLink className="size-3" />
        </a>
      </div>
    );
  return localUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={fileName ?? "Xem trước"} className={cn(box, "max-h-96 w-full object-contain")} />
  ) : (
    <SignedImage src={src} alt={fileName ?? "Xem trước"} className={cn(box, "max-h-96 w-full object-contain")} onExpired={onExpired ?? (() => {})} />
  );
}
