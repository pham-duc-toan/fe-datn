"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";

export function FullPageSpinner() {
  return (
    <div className="flex min-h-[60vh] flex-1 items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export function Loading({ label = "Đang tải…", className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`flex items-center gap-2 py-8 text-sm text-muted-foreground justify-center ${className}`}>
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
      <AlertTriangle className="size-6 text-destructive" />
      <p className="text-sm text-destructive">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw /> Thử lại
        </Button>
      )}
    </div>
  );
}

export function Empty({ title = "Chưa có dữ liệu", children, icon }: { title?: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center">
      {icon ?? <Inbox className="size-7 text-muted-foreground" />}
      <p className="font-medium">{title}</p>
      {children && <div className="text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

/** Hiện loading / lỗi / nội dung theo kết quả useQuery. */
export function QueryState<T>({
  query,
  children,
  empty,
}: {
  query: { data: T | undefined; isPending: boolean; error: unknown; refetch: () => unknown };
  children: (data: T) => ReactNode;
  empty?: (data: T) => boolean;
}) {
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (query.data === undefined) return null;
  if (empty && empty(query.data)) return <Empty />;
  return <>{children(query.data)}</>;
}
