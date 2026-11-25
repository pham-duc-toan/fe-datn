"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, ChevronRight, CircleAlert, Dumbbell, GraduationCap, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Workspace } from "@/components/labeling/workspace";
import type { LabelData, LabelSchema } from "@/lib/types";
import { cn } from "@/lib/utils";
import { GuidedTour } from "./guided-tour";
import { lessonsFor, type CheckResult, type Lesson } from "./tool-lessons";
import { markToolLearned, readTutorial } from "./tutorial-store";

/**
 * Nút "Tập dùng công cụ" trên trang làm bài / bài test: mở khung bài tập cho đúng các loại công cụ của dự án, với dữ
 * liệu tập riêng (không phải mẫu của dự án, không lưu, không tính điểm). Loại công cụ chưa tập đạt thì nút hiện
 * "N mới" để gợi ý tập trước khi làm.
 */
export function ToolGuideButton({ schema }: { schema: LabelSchema | null | undefined }) {
  const lessons = useMemo(() => lessonsFor(schema), [schema]);
  const [open, setOpen] = useState(false);
  const [learned, setLearned] = useState<string[]>([]);

  // Đọc localStorage sau khi gắn trang (lúc dựng phía server chưa có) và mỗi lần đóng khung bài tập.
  useEffect(() => {
    if (open) return;
    const r = requestAnimationFrame(() => setLearned(readTutorial().toolsLearned));
    return () => cancelAnimationFrame(r);
  }, [open]);

  if (lessons.length === 0) return null;
  const moi = lessons.filter((l) => !learned.includes(l.kind)).length;

  return (
    <>
      <Button
        variant={moi > 0 ? "outline" : "ghost"}
        size="sm"
        onClick={() => setOpen(true)}
        data-tour="tap-cong-cu"
        title={moi > 0 ? `Dự án dùng ${moi} công cụ bạn chưa tập — tập thử với dữ liệu mẫu trước khi làm` : "Tập lại cách dùng các công cụ của dự án"}
        className={cn(moi > 0 && "border-amber-400")}
      >
        <Dumbbell /> Tập dùng công cụ
        {moi > 0 && <span className="rounded-full bg-amber-400 px-1.5 text-[11px] font-semibold text-amber-950">{moi} mới</span>}
      </Button>
      {open && <ToolPractice lessons={lessons} learned={learned} onClose={() => setOpen(false)} />}
    </>
  );
}

function ToolPractice({ lessons, learned, onClose }: { lessons: Lesson[]; learned: string[]; onClose: () => void }) {
  // Mở ở bài đầu tiên chưa tập.
  const [idx, setIdx] = useState(() => Math.max(0, lessons.findIndex((l) => !learned.includes(l.kind))));
  const lesson = lessons[idx];
  const [value, setValue] = useState<LabelData>(() => lesson.initial ?? {});
  const [result, setResult] = useState<CheckResult | null>(null);
  const [lan, setLan] = useState(0);
  const [tour, setTour] = useState(true);
  const [passed, setPassed] = useState<string[]>(learned);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const ketQuaRef = useRef<HTMLDivElement>(null);

  // Chấm xong thì cuộn tới nhận xét (thường nằm dưới mép màn hình, dưới vùng vẽ).
  useEffect(() => {
    if (result) ketQuaRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [result]);

  function moBai(k: number) {
    setIdx(k);
    setValue(lessons[k].initial ?? {});
    setResult(null);
    setLan((x) => x + 1);
    setTour(true);
  }

  function lamLai() {
    setValue(lesson.initial ?? {});
    setResult(null);
    setLan((x) => x + 1);
  }

  function cham() {
    const r = lesson.check(value);
    setResult(r);
    if (r.ok) {
      markToolLearned(lesson.kind);
      setPassed((p) => (p.includes(lesson.kind) ? p : p.concat([lesson.kind])));
    }
  }

  const sau = idx < lessons.length - 1 ? idx + 1 : null;

  return createPortal(
    <div ref={setRoot} className="fixed inset-0 z-40 overflow-y-auto bg-background" role="dialog" aria-modal="true" aria-label="Tập dùng công cụ">
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2">
          <div className="mr-2 flex items-center gap-2 font-semibold">
            <Dumbbell className="size-5 text-primary" /> Tập dùng công cụ
          </div>
          <div className="flex flex-wrap gap-1.5">
            {lessons.map((l, k) => (
              <button
                key={l.kind}
                type="button"
                onClick={() => moBai(k)}
                className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs", k === idx ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
              >
                {passed.includes(l.kind) && <CheckCircle2 className={cn("size-3.5", k === idx ? "" : "text-emerald-600")} />}
                {k + 1}. {l.title}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={onClose}>
            <X /> Đóng
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-4 px-4 py-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">
              Bài {idx + 1}/{lessons.length}: {lesson.title}
            </h2>
            <p className="text-sm text-muted-foreground">{lesson.intro}</p>
            <p className="mt-1 text-xs text-muted-foreground">Dữ liệu tập có sẵn, không phải mẫu của dự án — không lưu, không tính điểm, không ảnh hưởng bài làm.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setTour(true)}>
            <GraduationCap /> Xem hướng dẫn
          </Button>
        </div>

        <Workspace
          key={`${lesson.kind}-${lan}`}
          schema={lesson.schema}
          modality={lesson.modality}
          fileUrl={lesson.fileUrl}
          content={lesson.content}
          metadata={lesson.metadata}
          value={value}
          onChange={(v) => {
            setValue(v);
            setResult(null);
          }}
          seed={`huong-dan-${lesson.kind}`}
        />

        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <Button variant="ghost" onClick={lamLai}>
            <RotateCcw /> Làm lại
          </Button>
          <Button onClick={cham} data-tour="cham-bai-tap">
            <CheckCircle2 /> Chấm bài tập
          </Button>
          {result?.ok &&
            (sau !== null ? (
              <Button variant="outline" className="ml-auto" onClick={() => moBai(sau)}>
                Bài tiếp: {lessons[sau].title} <ChevronRight />
              </Button>
            ) : (
              <Button variant="outline" className="ml-auto" onClick={onClose}>
                Xong, quay lại làm bài <ChevronRight />
              </Button>
            ))}
        </div>

        {result && (
          <div
            ref={ketQuaRef}
            className={cn(
              "rounded-lg border p-3 text-sm",
              result.ok ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100" : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
            )}
          >
            <div className="mb-1 flex items-center gap-1.5 font-semibold">
              {result.ok ? <CheckCircle2 className="size-4" /> : <CircleAlert className="size-4" />}
              {result.ok ? "Đạt! Bạn đã biết dùng công cụ này." : "Chưa đạt — sửa theo gợi ý rồi chấm lại."}
            </div>
            <ul className="list-disc space-y-0.5 pl-5">
              {result.notes.map((n, k) => (
                <li key={k}>{n}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {tour && root && <GuidedTour key={`${lesson.kind}-${lan}`} root={root} steps={lesson.steps} ctx={{ value, checked: result !== null }} onClose={() => setTour(false)} />}
    </div>,
    document.body,
  );
}
