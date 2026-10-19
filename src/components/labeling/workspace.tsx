"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import { ImageOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/common/states";
import type { LabelData, LabelSchema, Modality, SampleContent, SampleMeta, Tool } from "@/lib/types";
import { TOOL_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { IMAGE_KINDS, isList, seededBool, seededShuffle, type AnyObj, type RelationObj, type SpanObj } from "./schema";
import { ClassificationPanel, NumberPanel, ObjectListPanel, PairwisePanel, RankingPanel, RelationPanel, TextPanel } from "./panels";
import { TextSpanView } from "./text-span";
import type { Selection } from "./image-canvas";

const ImageCanvas = dynamic(() => import("./image-canvas"), { ssr: false, loading: () => <Loading label="Đang tải khung vẽ…" /> });
const MediaView = dynamic(() => import("./media-view"), { ssr: false, loading: () => <Loading label="Đang tải trình phát…" /> });

export type WorkspaceProps = {
  schema: LabelSchema;
  modality: Modality;
  fileUrl: string | null;
  content: SampleContent | null;
  metadata: SampleMeta;
  value: LabelData;
  onChange?: (v: LabelData) => void;
  readOnly?: boolean;
  /** Hạt giống xáo trộn hiển thị (sampleId) — trái / phải của cặp, thứ tự danh sách. */
  seed: string;
  onMediaError?: () => void;
  /** Gọn cho trang vượt link: chỉ cột công cụ dưới mẫu. */
  stacked?: boolean;
};

export function Workspace({ schema, modality, fileUrl, content, metadata, value, onChange, readOnly = false, seed, onMediaError, stacked }: WorkspaceProps) {
  const tools = schema.tools;
  const spatial = tools.filter((t) => isList(t) && t.kind !== "relation");
  const [activeTool, setActiveTool] = useState<string | null>(readOnly ? null : spatial[0]?.name ?? null);
  const [activeClass, setActiveClass] = useState<Record<string, string>>(() => Object.fromEntries(tools.map((t) => [t.name, t.classes?.[0] ?? ""])));
  const [selected, setSelected] = useState<Selection>(null);
  const [mediaBroken, setMediaBroken] = useState(false);

  const set = useCallback(
    (name: string, v: unknown) => {
      if (!onChange || readOnly) return;
      const next = { ...value };
      if (v === undefined) delete next[name];
      else next[name] = v;
      // Xoá một đoạn thì xoá cả quan hệ trỏ tới nó (mục 6.3 relation).
      const spanTool = tools.find((t) => t.name === name && t.kind === "span");
      if (spanTool) {
        const spans = (v as SpanObj[] | undefined) ?? [];
        for (const rt of tools.filter((t) => t.kind === "relation" && t.spanTool === name)) {
          const rels = (next[rt.name] as RelationObj[] | undefined) ?? [];
          const has = (r: { start: number; end: number }) => spans.some((s) => s.start === r.start && s.end === r.end);
          const kept = rels.filter((r) => has(r.from) && has(r.to));
          if (kept.length !== rels.length) next[rt.name] = kept;
        }
      }
      onChange(next);
    },
    [onChange, readOnly, value, tools],
  );

  const swapped = useMemo(() => seededBool(seed), [seed]);
  const items = useMemo(() => content?.items ?? [], [content]);
  const seedOrder = useMemo(() => seededShuffle(items.map((_, i) => i), seed), [items, seed]);
  const imageTools = tools.filter((t) => IMAGE_KINDS.has(t.kind));
  const spanTools = tools.filter((t) => t.kind === "span");
  const segTools = tools.filter((t) => t.kind === "temporalSegment");
  const trackTools = tools.filter((t) => t.kind === "track");
  const text = content?.text ?? "";

  const handleMediaError = () => {
    setMediaBroken(true);
    onMediaError?.();
  };

  const listOf = (t: Tool) => ((value[t.name] as AnyObj[] | undefined) ?? []);

  /* ------------------------- khung hiển thị mẫu ------------------------- */
  let sample: React.ReactNode = null;
  if (modality === "image") {
    if (!fileUrl || mediaBroken) sample = <BrokenMedia />;
    else if (imageTools.length > 0)
      sample = (
        <ImageCanvas
          src={fileUrl}
          width={metadata.width}
          height={metadata.height}
          tools={imageTools}
          data={value}
          activeTool={activeTool}
          activeClass={activeClass}
          selected={selected}
          onSelect={setSelected}
          onChange={(name, l) => set(name, l)}
          readOnly={readOnly}
          onError={handleMediaError}
        />
      );
    else
      // eslint-disable-next-line @next/next/no-img-element
      sample = <img src={fileUrl} alt="Mẫu" onError={handleMediaError} onContextMenu={(e) => e.preventDefault()} className="no-drag mx-auto max-h-[70vh] rounded-md border object-contain" />;
  } else if (modality === "text") {
    sample =
      spanTools.length > 0 ? (
        <TextSpanView
          text={text}
          spanTools={spanTools}
          spans={Object.fromEntries(spanTools.map((t) => [t.name, (value[t.name] as SpanObj[] | undefined) ?? []]))}
          activeTool={activeTool && spanTools.some((t) => t.name === activeTool) ? activeTool : null}
          activeClass={activeTool ? activeClass[activeTool] ?? null : null}
          selected={selected}
          readOnly={readOnly}
          onAdd={(name, s) => {
            const arr = ((value[name] as SpanObj[] | undefined) ?? []).concat([s]);
            set(name, arr);
            setSelected({ tool: name, index: arr.length - 1 });
          }}
          onSelect={setSelected}
        />
      ) : (
        <div className="rounded-md border bg-card p-4 text-[15px] leading-7 whitespace-pre-wrap">{text}</div>
      );
  } else if (modality === "audio" || modality === "video") {
    sample =
      !fileUrl || mediaBroken ? (
        <BrokenMedia />
      ) : (
        <MediaView
          kind={modality}
          src={fileUrl}
          meta={metadata}
          segTools={segTools}
          trackTools={trackTools}
          data={value}
          activeTool={activeTool}
          activeClass={activeClass}
          selected={selected}
          readOnly={readOnly}
          onChange={(name, l) => set(name, l)}
          onSelect={setSelected}
          onError={handleMediaError}
        />
      );
  } else if (modality === "pair") {
    const left = swapped ? content?.b : content?.a;
    const right = swapped ? content?.a : content?.b;
    sample = (
      <div className="space-y-3">
        {content?.prompt && <div className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap"><b>Câu hỏi:</b> {content.prompt}</div>}
        <div className="grid gap-3 md:grid-cols-2">
          {[left, right].map((txt, i) => (
            <div key={i} className="rounded-md border bg-card p-3">
              <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{i === 0 ? "Bên trái" : "Bên phải"}</div>
              <div className="text-sm whitespace-pre-wrap">{txt}</div>
            </div>
          ))}
        </div>
      </div>
    );
  } else if (modality === "list") {
    sample = (
      <div className="space-y-3">
        {content?.prompt && <div className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap"><b>Câu hỏi:</b> {content.prompt}</div>}
        {!tools.some((t) => t.kind === "ranking") && (
          <ol className="list-decimal space-y-1 pl-6 text-sm">
            {seedOrder.map((i) => (
              <li key={i} className="whitespace-pre-wrap">{items[i]}</li>
            ))}
          </ol>
        )}
      </div>
    );
  }

  /* ------------------------- cột công cụ ------------------------- */
  const panels = tools.map((t) => {
    let body: React.ReactNode = null;
    switch (t.kind) {
      case "classification":
        body = <ClassificationPanel tool={t} value={value[t.name] as { labelIds: string[] } | undefined} onChange={(v) => set(t.name, v)} readOnly={readOnly} />;
        break;
      case "freeText":
      case "transcription":
        body = <TextPanel tool={t} value={value[t.name] as { text: string } | undefined} onChange={(v) => set(t.name, v)} readOnly={readOnly} />;
        break;
      case "number":
        body = <NumberPanel tool={t} value={value[t.name] as { value: number } | undefined} onChange={(v) => set(t.name, v)} readOnly={readOnly} />;
        break;
      case "pairwise":
        body = <PairwisePanel tool={t} value={value[t.name] as { choice: string } | undefined} onChange={(v) => set(t.name, v)} readOnly={readOnly} swapped={swapped} />;
        break;
      case "ranking":
        body = <RankingPanel items={items} value={value[t.name] as { order: number[] } | undefined} onChange={(v) => set(t.name, v)} readOnly={readOnly} seedOrder={seedOrder} />;
        break;
      case "relation":
        body = (
          <RelationPanel
            tool={t}
            spans={(value[t.spanTool ?? ""] as SpanObj[] | undefined) ?? []}
            text={text}
            list={(value[t.name] as RelationObj[] | undefined) ?? []}
            onChange={(l) => set(t.name, l)}
            readOnly={readOnly}
          />
        );
        break;
      default:
        body = (
          <ObjectListPanel
            tool={t}
            list={listOf(t)}
            onChange={(l) => set(t.name, l)}
            readOnly={readOnly}
            active={activeTool === t.name}
            onActivate={() => {
              setActiveTool(t.name);
              setSelected(null);
            }}
            activeClass={activeClass[t.name] ?? ""}
            onClass={(c) => setActiveClass((m) => ({ ...m, [t.name]: c }))}
            selectedIndex={selected?.tool === t.name ? selected.index : null}
            onSelect={(i) => {
              if (!readOnly) setActiveTool(t.name);
              setSelected(i === null ? null : { tool: t.name, index: i });
            }}
            text={text}
          />
        );
    }
    return (
      <div key={t.name} className={cn("rounded-lg border bg-card p-3", activeTool === t.name && "ring-2 ring-primary/40")}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{t.name}</div>
            <div className="text-xs text-muted-foreground">{TOOL_LABEL[t.kind]}{t.allowMultiple ? " · chọn nhiều" : ""}</div>
          </div>
          {t.required !== false ? <Badge variant="secondary">Bắt buộc</Badge> : <Badge variant="outline">Tuỳ chọn</Badge>}
        </div>
        {body}
      </div>
    );
  });

  if (stacked)
    return (
      <div className="space-y-4">
        {sample}
        <div className="space-y-3">{panels}</div>
      </div>
    );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">{sample}</div>
      <div className="space-y-3 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto lg:pr-1">{panels}</div>
    </div>
  );
}

function BrokenMedia() {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-md border border-dashed text-sm text-muted-foreground">
      <ImageOff className="size-6" /> Không hiển thị được file mẫu.
    </div>
  );
}
