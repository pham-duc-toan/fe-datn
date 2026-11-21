"use client";

import Link from "next/link";
import { useState } from "react";
import { Heart, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, Loading } from "@/components/common/states";
import { LuotDuAn, useFeed, useThe } from "@/components/feed/luot-du-an";

/**
 * Dự án đã thích (kiến trúc 3.40): lướt như chợ dự án, chỉ gồm dự án đã bấm tim mà còn làm được — sắp hết hạn trước.
 * Bỏ thích thì thẻ biến khỏi danh sách. Gần hạn chót, hệ thống nhắc qua thông báo.
 */
export default function DuAnDaThichPage() {
  const [an, setAn] = useState<Set<string>>(() => new Set());
  const q = useFeed("liked");
  const the = useThe(q.data?.pages, an);

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Dự án đã thích</h1>
        <p className="hidden text-sm text-muted-foreground sm:block">Sắp hết hạn xếp trước · nhắc bạn trước hạn chót</p>
      </div>
      {q.isLoading ? (
        <Loading label="Đang tải dự án đã thích…" />
      ) : q.isError && the.length === 0 ? (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>Chưa tải được danh sách. Thử lại sau ít phút.</span>
            <Button size="sm" variant="outline" onClick={() => void q.refetch()}>
              <RefreshCw /> Thử lại
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <LuotDuAn
          the={the}
          hasNextPage={q.hasNextPage}
          isFetchingNextPage={q.isFetchingNextPage}
          fetchNextPage={() => void q.fetchNextPage()}
          onHide={(id) => setAn((s) => new Set(s).add(id))}
          onRefresh={() => {
            setAn(new Set());
            void q.refetch();
          }}
          anKhiBoThich
          trong={
            <Empty title="Chưa có dự án nào">
              Bấm <Heart className="inline size-4 align-text-bottom" /> trên thẻ ở{" "}
              <Link href="/cho" className="text-primary underline">chợ dự án</Link> để lưu lại làm sau. Dự án đã nộp bài hoặc đã đóng sẽ tự ẩn khỏi đây.
            </Empty>
          }
        />
      )}
    </>
  );
}
