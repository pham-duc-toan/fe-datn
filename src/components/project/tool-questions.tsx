import { CircleHelp } from "lucide-react";
import type { LabelSchema } from "@/lib/types";
import { TOOL_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

/**
 * Câu hỏi của từng công cụ trong tập nhãn (kiến trúc 3.35 — không còn câu hỏi chung). Dùng ở trang dự án trong chợ
 * và trang admin xem dự án. Công cụ chưa có câu hỏi hiện "Chưa có câu hỏi" (dự án nháp).
 */
export function ToolQuestions({ schema, className }: { schema: LabelSchema | null | undefined; className?: string }) {
  const tools = schema?.tools ?? [];
  if (tools.length === 0) return <p className={cn("text-sm text-muted-foreground", className)}>Chưa có công cụ gán nhãn.</p>;
  return (
    <ol className={cn("space-y-2", className)}>
      {tools.map((t, i) => (
        <li key={t.name} className="flex items-start gap-2">
          <CircleHelp className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="min-w-0">
            {t.question?.trim() ? (
              <p className="text-sm font-medium whitespace-pre-wrap">{t.question.trim()}</p>
            ) : (
              <p className="text-sm italic text-destructive">Chưa có câu hỏi</p>
            )}
            <p className="text-xs text-muted-foreground">
              Công cụ {i + 1} · {TOOL_LABEL[t.kind]}
              {t.classes?.length ? ` · ${t.classes.join(", ")}` : ""}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
