"use client";

import { useMemo, useRef } from "react";
import type { Tool } from "@/lib/types";
import { classColor, type SpanObj } from "./schema";

/** Vị trí ký tự (UTF-16) của (node, offset) trong khung — chỉ đếm text node, nên khớp chuỗi gốc. */
function charOffset(root: HTMLElement, node: Node, offset: number): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let total = 0;
  let n: Node | null = walker.nextNode();
  while (n) {
    if (n === node) return total + offset;
    total += (n.textContent ?? "").length;
    n = walker.nextNode();
  }
  // node là phần tử (vd chọn tới hết khối): đếm các text node đứng trước nó.
  if (node.nodeType === Node.ELEMENT_NODE) {
    const range = document.createRange();
    range.setStart(root, 0);
    range.setEnd(node, offset);
    return range.toString().length;
  }
  return total;
}

type Props = {
  text: string;
  spanTools: Tool[];
  spans: Record<string, SpanObj[]>;
  activeTool: string | null;
  activeClass: string | null;
  selected: { tool: string; index: number } | null;
  readOnly: boolean;
  onAdd: (tool: string, span: SpanObj) => void;
  onSelect: (s: { tool: string; index: number } | null) => void;
};

export function TextSpanView({ text, spanTools, spans, activeTool, activeClass, selected, readOnly, onAdd, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Cắt chuỗi theo mọi mốc đầu / cuối đoạn để tô màu (đoạn được phép chồng nhau).
  const segments = useMemo(() => {
    const marks = new Set<number>([0, text.length]);
    const all: { tool: Tool; s: SpanObj; index: number }[] = [];
    for (const t of spanTools) {
      (spans[t.name] ?? []).forEach((s, index) => {
        marks.add(Math.max(0, Math.min(text.length, s.start)));
        marks.add(Math.max(0, Math.min(text.length, s.end)));
        all.push({ tool: t, s, index });
      });
    }
    const pts = Array.from(marks).sort((a, b) => a - b);
    const out: { start: number; end: number; covers: typeof all }[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if (a === b) continue;
      out.push({ start: a, end: b, covers: all.filter((x) => x.s.start <= a && x.s.end >= b) });
    }
    return out;
  }, [text, spanTools, spans]);

  function onMouseUp() {
    if (readOnly || !activeTool || !activeClass || !ref.current) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
    const r = sel.getRangeAt(0);
    if (!ref.current.contains(r.startContainer) || !ref.current.contains(r.endContainer)) return;
    const a = charOffset(ref.current, r.startContainer, r.startOffset);
    const b = charOffset(ref.current, r.endContainer, r.endOffset);
    const start = Math.min(a, b);
    const end = Math.max(a, b);
    sel.removeAllRanges();
    if (end > start) onAdd(activeTool, { labelId: activeClass, start, end });
  }

  return (
    <div
      ref={ref}
      onMouseUp={onMouseUp}
      className="min-h-32 rounded-md border bg-card p-4 text-[15px] leading-8 whitespace-pre-wrap break-words select-text"
    >
      {segments.map((seg) => {
        if (seg.covers.length === 0) return <span key={seg.start}>{text.slice(seg.start, seg.end)}</span>;
        const top = seg.covers[seg.covers.length - 1];
        const color = classColor(top.tool, top.s.labelId);
        const isSel = seg.covers.some((c) => selected?.tool === c.tool.name && selected.index === c.index);
        return (
          <span
            key={seg.start}
            title={seg.covers.map((c) => `${c.tool.name}: ${c.s.labelId}`).join("\n")}
            onClick={() => onSelect({ tool: top.tool.name, index: top.index })}
            className="cursor-pointer rounded-sm"
            style={{
              backgroundColor: color + (isSel ? "55" : "26"),
              boxShadow: `inset 0 -2px 0 ${color}`,
              outline: seg.covers.length > 1 ? `1px dashed ${color}` : undefined,
            }}
          >
            {text.slice(seg.start, seg.end)}
          </span>
        );
      })}
    </div>
  );
}
