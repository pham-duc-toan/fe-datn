import { Hourglass } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { ToolKind } from "@/lib/types";

/** Tập nhãn có câu trả lời mở (freeText) — chấm theo nghĩa nên tính công lâu hơn (kiến trúc 3.19). */
export function hasFreeText(kinds: readonly (ToolKind | string)[] | null | undefined): boolean {
  return !!kinds?.includes("freeText");
}

/** Lấy danh sách loại công cụ từ labelSchema (bài làm / dự án). */
export function schemaToolKinds(schema: unknown): string[] {
  const tools = (schema as { tools?: { kind?: string }[] } | null | undefined)?.tools ?? [];
  return tools.map((t) => t.kind ?? "");
}

const NOI_DUNG = {
  business:
    "Câu trả lời mở không có đáp án định sẵn nên được chấm bằng phân tích ngữ nghĩa (AI so ý của từng câu với câu “ở giữa” của mọi người). Khi dự án kết thúc, bước phân tích này tốn thời gian hơn các dạng khác — kết quả chấm và tiền công cho labeler sẽ có muộn hơn.",
  labeler:
    "Dự án có câu trả lời mở: hệ thống phân tích ý nghĩa từng câu để chấm, nên khi dự án kết thúc, kết quả và tiền công của bạn sẽ có muộn hơn các dạng khác. Hãy viết đúng ý, rõ ràng — câu lạc đề hoặc gõ bừa sẽ không được tính.",
  pending:
    "Dự án có câu trả lời mở — hệ thống đang phân tích ngữ nghĩa từng câu trước khi chấm. Bước này lâu hơn các dạng khác; kết quả và tiền công sẽ có ngay khi phân tích xong.",
} as const;

export function FreeTextNotice({ audience, className }: { audience: keyof typeof NOI_DUNG; className?: string }) {
  return (
    <Alert className={className}>
      <Hourglass className="text-amber-600" />
      <AlertTitle>{audience === "pending" ? "Đang phân tích câu trả lời mở" : "Câu trả lời mở tính công lâu hơn"}</AlertTitle>
      <AlertDescription>{NOI_DUNG[audience]}</AlertDescription>
    </Alert>
  );
}
