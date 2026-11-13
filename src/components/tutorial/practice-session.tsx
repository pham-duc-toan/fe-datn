"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, GraduationCap, Lightbulb, Loader2, Play, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Workspace } from "@/components/labeling/workspace";
import { cn } from "@/lib/utils";
import type { LabelData, LabelSchema, ToolKind } from "@/lib/types";
import { DEMO_SAMPLES } from "./demo-samples";
import { buildPracticeSteps } from "./practice-steps";

type Props = {
  schema: LabelSchema;
  /** Chỉ dạy các loại công cụ này; null = dạy hết (xem lại hướng dẫn). */
  only: ToolKind[] | null;
  /** finished = đi hết các bước; false = bấm "Bỏ qua hướng dẫn". */
  onDone: (finished: boolean) => void;
};

/**
 * Màn LUYỆN TẬP trước khi vào bài (kiểu màn hướng dẫn trong game): câu ví dụ dựng sẵn + đúng tập nhãn của dự án,
 * mỗi bước một nhiệm vụ — làm xong thì "Tiếp" mới mở. Câu trả lời luyện tập chỉ nằm trong state của màn này:
 * không ghi nháp, không gọi API.
 */
export function PracticeSession({ schema, only, onDone }: Props) {
  const demo = DEMO_SAMPLES[schema.modality];
  const steps = useMemo(() => buildPracticeSteps(schema, demo, only), [schema, demo, only]);
  const [i, setI] = useState(0);
  const [data, setData] = useState<LabelData>({});
  // Bước đã hoàn thành một lần thì giữ "đã xong" kể cả khi người dùng xoá đối tượng sau đó.
  const [done, setDone] = useState<Set<string>>(new Set());

  const step = steps[i];
  const xong = !step.check || done.has(step.key) || step.check(data);
  const cuoi = i === steps.length - 1;

  useEffect(() => {
    if (step.check && !done.has(step.key) && step.check(data)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDone((s) => new Set(s).add(step.key));
    }
  }, [data, step, done]);

  // Enter = Tiếp (khi đã xong), như bấm "A" để đi tiếp trong game. Bỏ qua khi đang gõ chữ.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (e.key !== "Enter" || tag === "INPUT" || tag === "TEXTAREA" || !xong) return;
      // Enter còn dùng để khép đa giác trên khung vẽ: chỉ đi tiếp ở bước không có nhiệm vụ.
      if (step.check) return;
      e.preventDefault();
      if (cuoi) onDone(true);
      else setI((x) => x + 1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [xong, cuoi, step, onDone]);

  const nhiemVu = steps.filter((s) => s.check);
  const soXong = nhiemVu.filter((s) => done.has(s.key)).length;

  return (
    <div className="space-y-4">
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="space-y-3 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-2 font-semibold">
              <GraduationCap className="size-5 text-primary" /> Hướng dẫn làm bài
            </span>
            <span className="text-sm text-muted-foreground tabular-nums">
              Bước {i + 1}/{steps.length}
              {nhiemVu.length > 0 && ` · nhiệm vụ ${soXong}/${nhiemVu.length}`}
            </span>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => onDone(false)}>
              <SkipForward /> Bỏ qua hướng dẫn
            </Button>
          </div>
          <Progress value={((i + (xong ? 1 : 0)) / steps.length) * 100} />

          <div className="space-y-2">
            <h2 className="text-lg font-semibold">{step.title}</h2>
            <p className="text-sm leading-6">{step.body}</p>
            {step.tip && (
              <p className="flex gap-2 text-xs text-muted-foreground">
                <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-amber-500" /> {step.tip}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {step.check && (
              <span className={cn("flex items-center gap-1.5 text-sm", xong ? "font-medium text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
                {xong ? (
                  <>
                    <CheckCircle2 className="size-4" /> Hoàn thành nhiệm vụ!
                  </>
                ) : (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Đang chờ bạn thao tác trên câu ví dụ…
                  </>
                )}
              </span>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="outline" disabled={i === 0} onClick={() => setI((x) => x - 1)}>
                <ChevronLeft /> Quay lại
              </Button>
              {cuoi ? (
                <Button onClick={() => onDone(true)}>
                  <Play /> Vào làm bài
                </Button>
              ) : (
                <Button disabled={!xong} onClick={() => setI((x) => x + 1)} className={cn(xong && step.check && "animate-pulse")}>
                  Tiếp <ChevronRight />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-dashed p-3">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Câu ví dụ — chỉ để luyện tập, không được lưu</p>
        <Workspace
          schema={schema}
          modality={schema.modality}
          fileUrl={demo.fileUrl}
          content={demo.content}
          question={demo.question}
          metadata={demo.metadata}
          value={data}
          onChange={setData}
          seed="huong-dan"
          highlightTool={step.tool}
        />
      </div>
    </div>
  );
}
