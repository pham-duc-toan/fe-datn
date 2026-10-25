"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PublicProfile } from "@/lib/types";
import { shortId } from "@/lib/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/* Gom các userId cần hiện trong cùng một lượt render thành MỘT lần gọi /users/public?ids= (mục 11, 15.2). */
let pending: { id: string; resolve: (p: PublicProfile | null) => void; reject: (e: unknown) => void }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  const batch = pending;
  pending = [];
  timer = null;
  const ids = Array.from(new Set(batch.map((b) => b.id)));
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    api<PublicProfile[]>("/users/public", { query: { ids: chunk.join(",") } })
      .then((list) => {
        const map = new Map(list.map((p) => [p.userId, p]));
        batch.filter((b) => chunk.includes(b.id)).forEach((b) => b.resolve(map.get(b.id) ?? null));
      })
      .catch((e) => batch.filter((b) => chunk.includes(b.id)).forEach((b) => b.reject(e)));
  }
}

function loadProfile(id: string): Promise<PublicProfile | null> {
  return new Promise((resolve, reject) => {
    pending.push({ id, resolve, reject });
    if (!timer) timer = setTimeout(flush, 15);
  });
}

export function usePublicProfile(id: string | null | undefined) {
  return useQuery({
    queryKey: ["public-profile", id],
    queryFn: () => loadProfile(id as string),
    enabled: Boolean(id),
    staleTime: 5 * 60_000,
  });
}

export function UserName({ id, withAvatar = false, fallback }: { id: string | null | undefined; withAvatar?: boolean; fallback?: string }) {
  const q = usePublicProfile(id);
  if (!id) return <span className="text-muted-foreground">{fallback ?? "—"}</span>;
  const name = q.data?.displayName ?? shortId(id);
  // Username thay cho userId khi cần nhận diện (mời, tra cứu): "Tên hiển thị @username".
  const handle = q.data?.username ? <span className="text-xs text-muted-foreground">@{q.data.username}</span> : null;
  if (!withAvatar)
    return (
      <span title={id}>
        {name} {handle}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-2" title={id}>
      <Avatar className="size-6">
        {q.data?.avatarUrl && <AvatarImage src={q.data.avatarUrl} alt="" />}
        <AvatarFallback className="text-[10px]">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span>{name}</span>
      {handle}
      {q.data && <span className="text-xs text-muted-foreground">cấp {q.data.level}</span>}
    </span>
  );
}
