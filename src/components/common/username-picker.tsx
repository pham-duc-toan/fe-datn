"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { api } from "@/lib/api";
import type { PublicProfile } from "@/lib/types";
import { cn } from "@/lib/utils";

const clean = (s: string) => s.trim().replace(/^@/, "").toLowerCase();

/** Gợi ý username labeler theo chữ đang gõ (GET /users/suggest, username bắt đầu bằng chữ đã gõ). */
function useSuggest(text: string) {
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(clean(text)), 200);
    return () => clearTimeout(t);
  }, [text]);
  return useQuery({
    queryKey: ["user-suggest", q],
    queryFn: () => api<PublicProfile[]>("/users/suggest", { query: { q, limit: 8 } }),
    enabled: q.length > 0,
    staleTime: 30_000,
  });
}

function SuggestList({ items, active, onPick, loading }: { items: PublicProfile[]; active: number; onPick: (u: PublicProfile) => void; loading: boolean }) {
  return (
    <div className="absolute top-full right-0 left-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover p-1 text-sm shadow-md">
      {loading && items.length === 0 && (
        <p className="flex items-center gap-2 px-2 py-1.5 text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Đang tìm…
        </p>
      )}
      {!loading && items.length === 0 && <p className="px-2 py-1.5 text-muted-foreground">Không có labeler nào khớp.</p>}
      {items.map((u, i) => (
        <button
          key={u.userId}
          type="button"
          // mousedown để chọn trước khi ô nhập mất focus (blur đóng danh sách).
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(u);
          }}
          className={cn("flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-accent", i === active && "bg-accent")}
        >
          <Avatar className="size-6">
            {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt="" />}
            <AvatarFallback className="text-[10px]">{u.displayName.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium">@{u.username}</span> <span className="text-muted-foreground">{u.displayName}</span>
          </span>
          <span className="text-xs text-muted-foreground">cấp {u.level}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Ô nhập username có gợi ý khi gõ. `multiple`: chọn nhiều người (hiện thành thẻ, Enter / dấu phẩy để thêm chữ
 * đang gõ); không thì là một ô chữ bình thường, chọn gợi ý thì điền vào.
 */
export function UsernamePicker({
  value,
  onChange,
  multiple = false,
  placeholder = "Gõ username, vd: an",
  id,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  multiple?: boolean;
  placeholder?: string;
  id?: string;
}) {
  const [text, setText] = useState(multiple ? "" : value[0] ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const s = useSuggest(text);
  const items = (s.data ?? []).filter((u) => !multiple || !value.includes(u.username));
  const show = open && clean(text).length > 0;

  const add = (name: string) => {
    const n = clean(name);
    if (!n) return;
    if (multiple) {
      if (!value.includes(n)) onChange(value.concat([n]));
      setText("");
    } else {
      setText(n);
      onChange([n]);
      setOpen(false);
    }
    setActive(-1);
  };

  return (
    <div className="relative">
      <div className={cn(multiple && "flex min-h-9 flex-wrap items-center gap-1 rounded-md border px-1.5 py-1 focus-within:ring-[3px] focus-within:ring-ring/50")} onClick={() => inputRef.current?.focus()}>
        {multiple &&
          value.map((u) => (
            <span key={u} className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-xs">
              @{u}
              <button type="button" aria-label={`Bỏ ${u}`} onClick={() => onChange(value.filter((x) => x !== u))}>
                <X className="size-3" />
              </button>
            </span>
          ))}
        <Input
          ref={inputRef}
          id={id}
          autoComplete="off"
          className={cn(multiple && "h-7 min-w-32 flex-1 border-0 px-1 shadow-none focus-visible:ring-0")}
          placeholder={multiple && value.length ? "" : placeholder}
          value={text}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            // Gõ xong mà không chọn gợi ý vẫn giữ chữ đã gõ.
            if (multiple) add(text);
          }}
          onChange={(e) => {
            const v = e.target.value;
            if (multiple && /[,\s;]$/.test(v)) {
              add(v.slice(0, -1));
              return;
            }
            setText(v);
            setOpen(true);
            setActive(-1);
            if (!multiple) onChange(clean(v) ? [clean(v)] : []);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && items.length) {
              e.preventDefault();
              setActive((a) => (a + 1) % items.length);
            } else if (e.key === "ArrowUp" && items.length) {
              e.preventDefault();
              setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
            } else if (e.key === "Enter" && (active >= 0 || multiple)) {
              e.preventDefault();
              add(active >= 0 && items[active] ? items[active].username : text);
            } else if (e.key === "Escape") {
              setOpen(false);
            } else if (e.key === "Backspace" && multiple && !text && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
        />
      </div>
      {show && <SuggestList items={items} active={active} onPick={(u) => add(u.username)} loading={s.isFetching} />}
    </div>
  );
}
