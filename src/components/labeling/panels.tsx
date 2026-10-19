"use client";

import { useMemo, useState } from "react";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MousePointer2, Star, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AttributeDef, Tool } from "@/lib/types";
import { formatSeconds } from "@/lib/format";
import { cn } from "@/lib/utils";
import { classColor, type AnyObj, type BBox, type KeyPoint, type PolyObj, type RelationObj, type SegmentObj, type SpanObj, type TrackObj } from "./schema";

export function ClassChips({ tool, value, onPick, multi, readOnly }: { tool: Tool; value: string[]; onPick: (c: string) => void; multi?: boolean; readOnly?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(tool.classes ?? []).map((c) => {
        const on = value.includes(c);
        const color = classColor(tool, c);
        return (
          <button
            type="button"
            key={c}
            disabled={readOnly}
            onClick={() => onPick(c)}
            className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm transition-colors disabled:cursor-default", on ? "font-medium" : "hover:bg-muted")}
            style={on ? { borderColor: color, backgroundColor: color + "1f", color } : undefined}
          >
            {multi ? <span className="size-3 rounded-sm border" style={{ backgroundColor: on ? color : "transparent", borderColor: color }} /> : <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />}
            {c}
          </button>
        );
      })}
    </div>
  );
}

export function ClassificationPanel({ tool, value, onChange, readOnly }: { tool: Tool; value?: { labelIds: string[] }; onChange: (v: { labelIds: string[] } | undefined) => void; readOnly?: boolean }) {
  const ids = value?.labelIds ?? [];
  return (
    <ClassChips
      tool={tool}
      value={ids}
      multi={tool.allowMultiple}
      readOnly={readOnly}
      onPick={(c) => {
        if (tool.allowMultiple) {
          const next = ids.includes(c) ? ids.filter((x) => x !== c) : ids.concat([c]);
          onChange(next.length ? { labelIds: next } : undefined);
        } else onChange(ids[0] === c && tool.required === false ? undefined : { labelIds: [c] });
      }}
    />
  );
}

export function TextPanel({ tool, value, onChange, readOnly }: { tool: Tool; value?: { text: string }; onChange: (v: { text: string } | undefined) => void; readOnly?: boolean }) {
  const text = value?.text ?? "";
  const max = tool.maxLength ?? 5000;
  return (
    <div className="space-y-1">
      <Textarea
        rows={tool.kind === "transcription" ? 5 : 4}
        value={text}
        readOnly={readOnly}
        placeholder={tool.kind === "transcription" ? "Chép lại đúng nội dung nghe / thấy…" : "Câu trả lời của bạn…"}
        onChange={(e) => onChange(e.target.value ? { text: e.target.value } : undefined)}
      />
      <p className={cn("text-right text-xs", text.length > max ? "text-destructive" : "text-muted-foreground")}>
        {text.length} / {max}
      </p>
    </div>
  );
}

export function NumberPanel({ tool, value, onChange, readOnly }: { tool: Tool; value?: { value: number }; onChange: (v: { value: number } | undefined) => void; readOnly?: boolean }) {
  const v = value?.value;
  const min = tool.min ?? null;
  const max = tool.max ?? null;
  const stars = tool.integer && min !== null && max !== null && max - min <= 10 && max - min >= 1;
  if (stars) {
    const opts = Array.from({ length: max! - min! + 1 }, (_, i) => min! + i);
    return (
      <div className="flex flex-wrap items-center gap-1">
        {opts.map((n) => (
          <button
            key={n}
            type="button"
            disabled={readOnly}
            onClick={() => onChange({ value: n })}
            className="flex flex-col items-center rounded-md px-1.5 py-1 text-xs hover:bg-muted disabled:cursor-default"
            title={String(n)}
          >
            <Star className={cn("size-6", v !== undefined && n <= v ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
            {n}
          </button>
        ))}
        {v !== undefined && <span className="ml-2 text-sm font-medium">= {v}</span>}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        className="w-40"
        readOnly={readOnly}
        step={tool.integer ? 1 : "any"}
        min={min ?? undefined}
        max={max ?? undefined}
        value={v ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : { value: Number(e.target.value) })}
      />
      <span className="text-xs text-muted-foreground">
        {min !== null ? `≥ ${min}` : ""} {max !== null ? `≤ ${max}` : ""} {tool.integer ? "· số nguyên" : ""}
      </span>
    </div>
  );
}

export function PairwisePanel({ tool, value, onChange, readOnly, swapped }: { tool: Tool; value?: { choice: string }; onChange: (v: { choice: string }) => void; readOnly?: boolean; swapped: boolean }) {
  const left = swapped ? "b" : "a";
  const right = swapped ? "a" : "b";
  const opt = (choice: string, label: string) => (
    <Button type="button" variant={value?.choice === choice ? "default" : "outline"} disabled={readOnly} onClick={() => onChange({ choice })} className="flex-1">
      {label}
    </Button>
  );
  return (
    <div className="flex flex-wrap gap-2">
      {opt(left, "Bên trái tốt hơn")}
      {tool.allowTie !== false && opt("tie", "Ngang nhau")}
      {opt(right, "Bên phải tốt hơn")}
    </div>
  );
}

function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("flex items-start gap-2 rounded-md border bg-card p-2 text-sm", isDragging && "z-10 shadow-lg")}>
      <button type="button" {...attributes} {...listeners} className="mt-0.5 cursor-grab text-muted-foreground" aria-label="Kéo để sắp xếp">
        <GripVertical className="size-4" />
      </button>
      <div className="min-w-0 flex-1 whitespace-pre-wrap">{children}</div>
    </li>
  );
}

/** Xếp hạng: hiển thị đã xáo (giảm thiên vị), gửi chỉ số gốc tốt nhất → kém nhất (mục 6.3). */
export function RankingPanel({ items, value, onChange, readOnly, seedOrder }: { items: string[]; value?: { order: number[] }; onChange: (v: { order: number[] }) => void; readOnly?: boolean; seedOrder: number[] }) {
  const order = value?.order?.length === items.length ? value.order : seedOrder;
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const ids = order.map(String);
  function onEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = ids.indexOf(String(e.active.id));
    const to = ids.indexOf(String(e.over.id));
    onChange({ order: arrayMove(order, from, to) });
  }
  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy} disabled={readOnly}>
          <ol className="space-y-1.5">
            {order.map((idx, rank) => (
              <SortableItem key={idx} id={String(idx)}>
                <span className="mr-2 inline-flex size-5 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{rank + 1}</span>
                {items[idx]}
              </SortableItem>
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      {!readOnly && !value && (
        <Button type="button" size="sm" variant="outline" onClick={() => onChange({ order })}>
          Giữ nguyên thứ tự này
        </Button>
      )}
      {value && <p className="text-xs text-muted-foreground">Đã xếp — kéo để đổi. Mục 1 là tốt nhất.</p>}
    </div>
  );
}

export function AttributesEditor({ defs, value, onChange, readOnly }: { defs: AttributeDef[]; value: Record<string, unknown> | undefined; onChange: (v: Record<string, unknown> | undefined) => void; readOnly?: boolean }) {
  const cur = value ?? {};
  const set = (name: string, v: unknown) => {
    const next = { ...cur };
    if (v === undefined || v === "") delete next[name];
    else next[name] = v;
    onChange(Object.keys(next).length ? next : undefined);
  };
  return (
    <div className="space-y-2 rounded-md bg-muted/50 p-2">
      {defs.map((a) => (
        <div key={a.name} className="grid grid-cols-[110px_1fr] items-center gap-2 text-sm">
          <span className="truncate text-muted-foreground" title={a.name}>
            {a.name} {a.required && <span className="text-destructive">*</span>}
          </span>
          {a.type === "choice" ? (
            <Select value={(cur[a.name] as string) ?? ""} onValueChange={(v) => set(a.name, v)} disabled={readOnly}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue placeholder="Chọn" />
              </SelectTrigger>
              <SelectContent>
                {(a.options ?? []).map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : a.type === "boolean" ? (
            <Checkbox checked={cur[a.name] === true} disabled={readOnly} onCheckedChange={(c) => set(a.name, c === true ? true : a.required ? false : undefined)} />
          ) : a.type === "number" ? (
            <Input type="number" className="h-7" readOnly={readOnly} value={(cur[a.name] as number | undefined) ?? ""} onChange={(e) => set(a.name, e.target.value === "" ? undefined : Number(e.target.value))} />
          ) : (
            <Input className="h-7" readOnly={readOnly} maxLength={a.maxLength} value={(cur[a.name] as string | undefined) ?? ""} onChange={(e) => set(a.name, e.target.value)} />
          )}
        </div>
      ))}
    </div>
  );
}

function summary(tool: Tool, o: unknown, text?: string): string {
  switch (tool.kind) {
    case "bbox": {
      const b = o as BBox;
      return `x ${Math.round(b.x)}, y ${Math.round(b.y)}, ${Math.round(b.w)}×${Math.round(b.h)}${b.angle ? `, ${b.angle}°` : ""}`;
    }
    case "polygon":
    case "polyline":
      return `${(o as PolyObj).points.length} đỉnh`;
    case "keypoint": {
      const k = o as KeyPoint;
      return `(${Math.round(k.x)}, ${Math.round(k.y)})`;
    }
    case "mask":
      return "mặt nạ";
    case "span": {
      const s = o as SpanObj;
      const snip = text?.slice(s.start, s.end) ?? "";
      return `"${snip.length > 40 ? snip.slice(0, 40) + "…" : snip}" [${s.start}, ${s.end})`;
    }
    case "temporalSegment": {
      const s = o as SegmentObj;
      return `${formatSeconds(s.start)} → ${formatSeconds(s.end)}`;
    }
    case "track":
      return `${(o as TrackObj).keyframes.length} keyframe`;
    default:
      return "";
  }
}

/** Công cụ dạng danh sách: chọn lớp để vẽ, danh sách đối tượng, đổi lớp, thuộc tính, xoá. */
export function ObjectListPanel({
  tool,
  list,
  onChange,
  readOnly,
  active,
  onActivate,
  activeClass,
  onClass,
  selectedIndex,
  onSelect,
  text,
}: {
  tool: Tool;
  list: AnyObj[];
  onChange: (l: AnyObj[]) => void;
  readOnly?: boolean;
  active: boolean;
  onActivate: () => void;
  activeClass: string;
  onClass: (c: string) => void;
  selectedIndex: number | null;
  onSelect: (i: number | null) => void;
  text?: string;
}) {
  const sel = selectedIndex !== null ? list[selectedIndex] : undefined;
  return (
    <div className="space-y-2">
      {!readOnly && (
        <div className="space-y-2">
          <Button type="button" size="sm" variant={active ? "default" : "outline"} onClick={onActivate} className="w-full">
            <MousePointer2 /> {active ? "Đang dùng công cụ này" : "Dùng công cụ này để vẽ / đánh dấu"}
          </Button>
          {active && (
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Lớp cho đối tượng mới:</p>
              <ClassChips tool={tool} value={[activeClass]} onPick={onClass} />
            </div>
          )}
        </div>
      )}
      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground">Chưa có đối tượng nào.</p>
      ) : (
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {list.map((o, i) => (
            <li
              key={i}
              onClick={() => onSelect(selectedIndex === i ? null : i)}
              className={cn("flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1 text-sm", selectedIndex === i ? "border-primary bg-primary/5" : "hover:bg-muted")}
            >
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: classColor(tool, o.labelId) }} />
              <span className="font-medium">{o.labelId}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{summary(tool, o, text)}</span>
              {!readOnly && (
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = list.slice();
                    next.splice(i, 1);
                    onChange(next);
                    onSelect(null);
                  }}
                  aria-label="Xoá"
                >
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {sel && selectedIndex !== null && (
        <div className="space-y-2 rounded-md border p-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Lớp</span>
            <Select
              value={sel.labelId}
              disabled={readOnly}
              onValueChange={(v) => {
                const next = list.slice();
                next[selectedIndex] = { ...sel, labelId: v };
                onChange(next);
              }}
            >
              <SelectTrigger size="sm" className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(tool.classes ?? []).map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {tool.kind === "temporalSegment" && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              {(["start", "end"] as const).map((k) => (
                <label key={k} className="space-y-1">
                  <span className="text-xs text-muted-foreground">{k === "start" ? "Bắt đầu (giây)" : "Kết thúc (giây)"}</span>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-7"
                    readOnly={readOnly}
                    value={(sel as unknown as SegmentObj)[k]}
                    onChange={(e) => {
                      const next = list.slice();
                      next[selectedIndex] = { ...sel, [k]: Number(e.target.value) } as AnyObj;
                      onChange(next);
                    }}
                  />
                </label>
              ))}
            </div>
          )}
          {(tool.attributes ?? []).length > 0 && (
            <AttributesEditor
              defs={tool.attributes!}
              value={sel.attributes}
              readOnly={readOnly}
              onChange={(a) => {
                const next = list.slice();
                const o = { ...sel };
                if (a) o.attributes = a;
                else delete o.attributes;
                next[selectedIndex] = o;
                onChange(next);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Quan hệ có hướng giữa hai đoạn của công cụ span (mục 6.3 relation). */
export function RelationPanel({ tool, spans, text, list, onChange, readOnly }: { tool: Tool; spans: SpanObj[]; text: string; list: RelationObj[]; onChange: (l: RelationObj[]) => void; readOnly?: boolean }) {
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [cls, setCls] = useState<string>(tool.classes?.[0] ?? "");
  const opts = useMemo(() => spans.map((s) => ({ key: `${s.start}:${s.end}`, label: `"${text.slice(s.start, s.end).slice(0, 30)}" (${s.labelId})`, s })), [spans, text]);
  const find = (k: string) => opts.find((o) => o.key === k)?.s;
  const lbl = (r: { start: number; end: number }) => `"${text.slice(r.start, r.end).slice(0, 24)}"`;
  return (
    <div className="space-y-2">
      {!readOnly && (
        <div className="space-y-2 rounded-md border p-2">
          {opts.length < 2 ? (
            <p className="text-xs text-muted-foreground">Cần đánh dấu ít nhất hai đoạn bằng công cụ “{tool.spanTool}” trước.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-2">
                <Select value={from} onValueChange={setFrom}>
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue placeholder="Từ đoạn" />
                  </SelectTrigger>
                  <SelectContent>
                    {opts.map((o) => (
                      <SelectItem key={o.key} value={o.key}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={cls} onValueChange={setCls}>
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue placeholder="Loại quan hệ" />
                  </SelectTrigger>
                  <SelectContent>
                    {(tool.classes ?? []).map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={to} onValueChange={setTo}>
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue placeholder="Tới đoạn" />
                  </SelectTrigger>
                  <SelectContent>
                    {opts.map((o) => (
                      <SelectItem key={o.key} value={o.key}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={!from || !to || from === to || !cls}
                onClick={() => {
                  const a = find(from)!;
                  const b = find(to)!;
                  const r: RelationObj = { labelId: cls, from: { start: a.start, end: a.end }, to: { start: b.start, end: b.end } };
                  if (list.some((x) => x.labelId === r.labelId && x.from.start === r.from.start && x.from.end === r.from.end && x.to.start === r.to.start && x.to.end === r.to.end)) return;
                  onChange(list.concat([r]));
                }}
              >
                <Plus /> Thêm quan hệ
              </Button>
            </>
          )}
        </div>
      )}
      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground">Chưa có quan hệ nào.</p>
      ) : (
        <ul className="space-y-1">
          {list.map((r, i) => (
            <li key={i} className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm">
              <span className="min-w-0 flex-1 truncate">
                {lbl(r.from)} <b className="mx-1" style={{ color: classColor(tool, r.labelId) }}>→ {r.labelId} →</b> {lbl(r.to)}
              </span>
              {!readOnly && (
                <Button type="button" size="icon-xs" variant="ghost" onClick={() => onChange(list.filter((_, k) => k !== i))} aria-label="Xoá">
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
