"use client";

import { useState } from "react";
import { Check, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useTags } from "@/hooks/use-tags";
import { cn } from "@/lib/utils";
import type { TagKind } from "@/lib/types";

/**
 * Chọn thẻ lĩnh vực / ngôn ngữ từ danh mục admin quản lý — bấm để chọn / bỏ, không gõ tự do.
 * Thẻ đã gắn mà nay bị ẩn / gộp vẫn hiện (bấm × để bỏ). Nhiều hơn 15 thẻ thì có ô lọc.
 */
export function TagPicker({
  kind,
  value,
  onChange,
  max = 10,
  disabled,
}: {
  kind: TagKind;
  value: string[];
  onChange: (v: string[]) => void;
  max?: number;
  disabled?: boolean;
}) {
  const { query, options, name, resolve } = useTags();
  const [filter, setFilter] = useState("");
  const opts = options(kind);
  const conDung = new Set(opts.map((t) => t.code));
  // Thẻ đã gộp: hiện như thẻ đích (lưu lại sẽ ra mã đích).
  const chon = [...new Set(value.map((c) => resolve(kind, c)?.code ?? c))];
  const khac = chon.filter((c) => !conDung.has(c));
  const f = filter.trim().toLowerCase();
  const hien = f ? opts.filter((t) => t.name.toLowerCase().includes(f) || t.code.includes(f)) : opts;
  const full = chon.length >= max;

  const toggle = (code: string) => {
    if (disabled) return;
    if (chon.includes(code)) onChange(chon.filter((c) => c !== code));
    else if (!full) onChange(chon.concat([code]));
  };

  if (query.isPending) return <p className="text-sm text-muted-foreground">Đang tải danh mục thẻ…</p>;
  return (
    <div className="space-y-2">
      {opts.length > 15 && (
        <div className="relative max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Lọc thẻ…" className="h-8 pl-7" />
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {khac.map((c) => (
          <span key={c} className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed px-2.5 text-xs text-muted-foreground" title="Thẻ này không còn trong danh mục chọn">
            {name(kind, c)}
            {!disabled && (
              <button type="button" aria-label={`Bỏ ${name(kind, c)}`} onClick={() => toggle(c)} className="hover:text-foreground">
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
        {hien.map((t) => {
          const on = chon.includes(t.code);
          return (
            <button
              key={t.code}
              type="button"
              aria-pressed={on}
              disabled={disabled || (!on && full)}
              onClick={() => toggle(t.code)}
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                on ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary hover:text-primary",
              )}
            >
              {on && <Check className="size-3" />} {t.name}
            </button>
          );
        })}
        {hien.length === 0 && <span className="text-xs text-muted-foreground">{opts.length === 0 ? "Danh mục chưa có thẻ nào." : "Không có thẻ khớp."}</span>}
      </div>
      <p className="text-xs text-muted-foreground">
        Đã chọn {chon.length}/{max}
        {full && " — bỏ bớt để chọn thẻ khác"}
      </p>
    </div>
  );
}
