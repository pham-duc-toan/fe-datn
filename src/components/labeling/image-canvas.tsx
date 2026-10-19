"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Group, Image as KImage, Rect, Line, Circle, Text, Transformer } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { Hand, Minus, Plus, Maximize2, Eraser, Brush } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { LabelData, Tool } from "@/lib/types";
import { classColor, round2, type BBox, type KeyPoint, type MaskObj, type Point, type PolyObj } from "./schema";
import { canvasToMask, encodeRle, maskCanvas, rememberCanvas } from "./rle";

export type Selection = { tool: string; index: number } | null;

type Props = {
  src: string;
  width?: number;
  height?: number;
  tools: Tool[];
  data: LabelData;
  activeTool: string | null;
  activeClass: Record<string, string>;
  selected: Selection;
  onSelect: (s: Selection) => void;
  onChange: (tool: string, list: unknown[]) => void;
  readOnly: boolean;
  onError?: () => void;
};

const normAngle = (a: number) => round2(((((a + 180) % 360) + 360) % 360) - 180);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export default function ImageCanvas(props: Props) {
  const { src, tools, data, activeTool, activeClass, selected, onSelect, onChange, readOnly, onError } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const nodes = useRef(new Map<string, Konva.Node>());
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [cw, setCw] = useState(800);
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const [hand, setHand] = useState(false);
  const [space, setSpace] = useState(false);
  const [drawRect, setDrawRect] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [drawPoly, setDrawPoly] = useState<Point[] | null>(null);
  // Đọc / ghi đa giác đang vẽ qua ref: bấm đỉnh nhanh thì handler kế tiếp chạy trước khi React render lại.
  const polyRef = useRef<Point[] | null>(null);
  const setPoly = (v: Point[] | null) => {
    polyRef.current = v;
    setDrawPoly(v);
  };
  const [cursor, setCursor] = useState<Point | null>(null);
  const [brush, setBrush] = useState(12);
  const [erase, setErase] = useState(false);
  const painting = useRef<{ index: number; canvas: HTMLCanvasElement; color: string; last: Point; isNew: boolean } | null>(null);
  const paintImgRef = useRef<Konva.Image>(null);
  const [paintCanvas, setPaintCanvas] = useState<{ index: number; canvas: HTMLCanvasElement } | null>(null);
  const panRef = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null);

  useEffect(() => {
    const i = new window.Image();
    i.onload = () => setImg(i);
    i.onerror = () => onError?.();
    i.src = src;
    return () => {
      i.onload = null;
      i.onerror = null;
    };
  }, [src, onError]);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((e) => setCw(Math.max(200, e[0].contentRect.width)));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const W = props.width || img?.naturalWidth || 1;
  const H = props.height || img?.naturalHeight || 1;
  const maxH = typeof window !== "undefined" ? window.innerHeight * 0.72 : 600;
  const fit = Math.min(cw / W, maxH / H);
  const scale = fit * view.zoom;
  const stageH = Math.max(160, Math.round(H * fit));
  const active = tools.find((t) => t.name === activeTool) ?? null;
  const cls = active ? activeClass[active.name] ?? active.classes?.[0] ?? "" : "";

  const list = <T,>(name: string) => ((data[name] as T[] | undefined) ?? []);

  function toImage(): Point | null {
    const st = stageRef.current;
    const p = st?.getPointerPosition();
    if (!p) return null;
    return [(p.x - view.x) / scale, (p.y - view.y) / scale];
  }

  // Transformer cho khung đang chọn.
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    if (selected && !readOnly) {
      const t = tools.find((x) => x.name === selected.tool);
      const n = nodes.current.get(`${selected.tool}:${selected.index}`);
      if (t?.kind === "bbox" && n && t.name === activeTool) {
        tr.nodes([n]);
        tr.getLayer()?.batchDraw();
        return;
      }
    }
    tr.nodes([]);
  }, [selected, data, tools, readOnly, activeTool]);

  function finishPoly() {
    const cur = polyRef.current;
    if (!active || !cur) return;
    // Bỏ đỉnh trùng liên tiếp (nhấp đúp để kết thúc thêm một đỉnh ngay trên đỉnh cuối).
    const pts = cur.filter((p, i) => i === 0 || Math.hypot(p[0] - cur[i - 1][0], p[1] - cur[i - 1][1]) * scale >= 4);
    const need = active.kind === "polygon" ? 3 : 2;
    if (pts.length >= need) {
      const arr = list<PolyObj>(active.name).concat([{ labelId: cls, points: pts.map(([x, y]) => [round2(x), round2(y)] as Point) }]);
      onChange(active.name, arr);
      onSelect({ tool: active.name, index: arr.length - 1 });
    }
    setPoly(null);
  }

  // Phím tắt: Delete xoá, Esc huỷ vẽ, Enter kết thúc đa giác, Space giữ để kéo ảnh.
  useEffect(() => {
    const isTyping = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
    };
    const down = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      if (e.code === "Space") {
        setSpace(true);
        e.preventDefault();
      }
      if (e.key === "Escape") {
        setPoly(null);
        setDrawRect(null);
        onSelect(null);
      }
      if (e.key === "Enter" && polyRef.current) finishPoly();
      if ((e.key === "Delete" || e.key === "Backspace") && !readOnly) {
        if (polyRef.current && polyRef.current.length) {
          setPoly(polyRef.current.slice(0, -1));
          e.preventDefault();
        } else if (selected && tools.some((t) => t.name === selected.tool)) {
          const arr = list<unknown>(selected.tool).slice();
          arr.splice(selected.index, 1);
          onChange(selected.tool, arr);
          onSelect(null);
          e.preventDefault();
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpace(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  });

  function paintAt(p: Point) {
    const st = painting.current;
    if (!st) return;
    const ctx = st.canvas.getContext("2d")!;
    ctx.globalCompositeOperation = erase ? "destination-out" : "source-over";
    ctx.strokeStyle = st.color;
    ctx.fillStyle = st.color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = brush * 2;
    ctx.beginPath();
    ctx.moveTo(st.last[0], st.last[1]);
    ctx.lineTo(p[0], p[1]);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p[0], p[1], brush, 0, Math.PI * 2);
    ctx.fill();
    st.last = p;
    paintImgRef.current?.getLayer()?.batchDraw();
  }

  function onDown(e: KonvaEventObject<MouseEvent>) {
    const st = stageRef.current;
    if (!st) return;
    if (hand || space || e.evt.button === 1) {
      const p = st.getPointerPosition()!;
      panRef.current = { sx: p.x, sy: p.y, vx: view.x, vy: view.y };
      return;
    }
    if (readOnly || !active || e.evt.button !== 0) {
      if (e.target === st || e.target.name() === "bg") onSelect(null);
      return;
    }
    const p = toImage();
    if (!p) return;
    const pt: Point = [clamp(p[0], 0, W), clamp(p[1], 0, H)];
    if (active.kind === "bbox") {
      if (e.target !== st && e.target.name() !== "bg") return;
      onSelect(null);
      setDrawRect({ x0: pt[0], y0: pt[1], x1: pt[0], y1: pt[1] });
    } else if (active.kind === "keypoint") {
      if (e.target !== st && e.target.name() !== "bg") return;
      const arr = list<KeyPoint>(active.name).concat([{ labelId: cls, x: round2(pt[0]), y: round2(pt[1]) }]);
      onChange(active.name, arr);
      onSelect({ tool: active.name, index: arr.length - 1 });
    } else if (active.kind === "polygon" || active.kind === "polyline") {
      const cur = polyRef.current;
      if (!cur) {
        if (e.target !== st && e.target.name() !== "bg") return;
        onSelect(null);
        setPoly([pt]);
      } else {
        const first = cur[0];
        const near = Math.hypot(first[0] - pt[0], first[1] - pt[1]) * scale < 8;
        if (active.kind === "polygon" && near && cur.length >= 3) finishPoly();
        else setPoly(cur.concat([pt]));
      }
    } else if (active.kind === "mask") {
      const masks = list<MaskObj>(active.name);
      let index = selected?.tool === active.name ? selected.index : -1;
      const isNew = index < 0 || index >= masks.length;
      const labelId = isNew ? cls : masks[index].labelId;
      const color = classColor(active, labelId);
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      if (!isNew) c.getContext("2d")!.drawImage(maskCanvas(masks[index].rle, color), 0, 0);
      if (isNew) {
        index = masks.length;
        if (erase) return;
      }
      painting.current = { index, canvas: c, color, last: pt, isNew };
      setPaintCanvas({ index, canvas: c });
      paintAt(pt);
    }
  }

  function onMove() {
    const st = stageRef.current;
    if (!st) return;
    if (panRef.current) {
      const p = st.getPointerPosition()!;
      const pr = panRef.current;
      setView((v) => ({ ...v, x: pr.vx + p.x - pr.sx, y: pr.vy + p.y - pr.sy }));
      return;
    }
    const p = toImage();
    if (!p) return;
    const pt: Point = [clamp(p[0], 0, W), clamp(p[1], 0, H)];
    if (drawRect) setDrawRect({ ...drawRect, x1: pt[0], y1: pt[1] });
    if (drawPoly) setCursor(pt);
    if (painting.current) paintAt(pt);
  }

  function onUp() {
    panRef.current = null;
    if (drawRect && active) {
      const x = Math.min(drawRect.x0, drawRect.x1);
      const y = Math.min(drawRect.y0, drawRect.y1);
      const w = Math.abs(drawRect.x1 - drawRect.x0);
      const h = Math.abs(drawRect.y1 - drawRect.y0);
      if (w * scale > 3 && h * scale > 3) {
        const box: BBox = { labelId: cls, x: round2(x), y: round2(y), w: round2(w), h: round2(h) };
        if (active.rotatable) box.angle = 0;
        const arr = list<BBox>(active.name).concat([box]);
        onChange(active.name, arr);
        onSelect({ tool: active.name, index: arr.length - 1 });
      }
      setDrawRect(null);
    }
    const st = painting.current;
    if (st && active) {
      painting.current = null;
      const m = canvasToMask(st.canvas);
      const masks = list<MaskObj>(active.name).slice();
      const any = m.some((v) => v === 1);
      if (!any) {
        if (!st.isNew) masks.splice(st.index, 1);
        onChange(active.name, masks);
        onSelect(null);
      } else {
        const rle = encodeRle(m, W, H);
        rememberCanvas(rle, st.canvas, st.color);
        if (st.isNew) masks.push({ labelId: cls, rle });
        else masks[st.index] = { ...masks[st.index], rle };
        onChange(active.name, masks);
        onSelect({ tool: active.name, index: st.index });
      }
      setPaintCanvas(null);
    }
  }

  function onWheel(e: KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const st = stageRef.current;
    const p = st?.getPointerPosition();
    if (!p) return;
    const factor = e.evt.deltaY < 0 ? 1.12 : 1 / 1.12;
    setView((v) => {
      const zoom = clamp(v.zoom * factor, 0.5, 12);
      const s0 = fit * v.zoom;
      const s1 = fit * zoom;
      const ix = (p.x - v.x) / s0;
      const iy = (p.y - v.y) / s0;
      return { zoom, x: p.x - ix * s1, y: p.y - iy * s1 };
    });
  }

  const stroke = 2;
  const isActive = (t: Tool) => !readOnly && t.name === activeTool && !drawPoly;
  const selectHandler = (t: Tool, i: number) => (e: KonvaEventObject<MouseEvent>) => {
    if (hand || space) return;
    e.cancelBubble = true;
    onSelect({ tool: t.name, index: i });
  };

  const shapes = useMemo(() => tools, [tools]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button type="button" size="icon-sm" variant="outline" onClick={() => setView((v) => ({ ...v, zoom: clamp(v.zoom * 1.25, 0.5, 12) }))} aria-label="Phóng to">
          <Plus />
        </Button>
        <Button type="button" size="icon-sm" variant="outline" onClick={() => setView((v) => ({ ...v, zoom: clamp(v.zoom / 1.25, 0.5, 12) }))} aria-label="Thu nhỏ">
          <Minus />
        </Button>
        <Button type="button" size="icon-sm" variant="outline" onClick={() => setView({ zoom: 1, x: 0, y: 0 })} aria-label="Vừa khung">
          <Maximize2 />
        </Button>
        <Button type="button" size="sm" variant={hand ? "default" : "outline"} onClick={() => setHand((h) => !h)}>
          <Hand /> Kéo ảnh
        </Button>
        <span className="text-xs text-muted-foreground">{Math.round(view.zoom * 100)}% · {W}×{H}px</span>
        {active?.kind === "mask" && !readOnly && (
          <div className="ml-auto flex items-center gap-2">
            <Button type="button" size="sm" variant={erase ? "outline" : "default"} onClick={() => setErase(false)}>
              <Brush /> Cọ
            </Button>
            <Button type="button" size="sm" variant={erase ? "default" : "outline"} onClick={() => setErase(true)}>
              <Eraser /> Tẩy
            </Button>
            <span className="text-xs text-muted-foreground">Cỡ {brush}px</span>
            <Slider className="w-28" min={1} max={80} step={1} value={[brush]} onValueChange={(v) => setBrush(v[0])} />
          </div>
        )}
      </div>
      <div ref={wrapRef} className="no-drag relative overflow-hidden rounded-md border bg-[repeating-conic-gradient(#f4f4f5_0_25%,#fff_0_50%)] bg-[length:16px_16px]" style={{ cursor: hand || space ? "grab" : active && !readOnly ? "crosshair" : "default" }}>
        <Stage
          ref={stageRef}
          width={cw}
          height={stageH}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
          onWheel={onWheel}
          onDblClick={() => {
            const cur = polyRef.current;
            if (!cur || cur.length < 2) return;
            const a = cur[cur.length - 1];
            const b = cur[cur.length - 2];
            if (Math.hypot(a[0] - b[0], a[1] - b[1]) * scale < 6) finishPoly();
          }}
          onContextMenu={(e) => e.evt.preventDefault()}
        >
          <Layer>
            <Group x={view.x} y={view.y} scaleX={scale} scaleY={scale}>
              {img && <KImage image={img} width={W} height={H} name="bg" />}
              {shapes.map((t) => {
                const act = isActive(t);
                const op = !activeTool || t.name === activeTool ? 1 : 0.45;
                if (t.kind === "mask")
                  return list<MaskObj>(t.name).map((m, i) => {
                    const live = paintCanvas && t.name === activeTool && paintCanvas.index === i ? paintCanvas.canvas : null;
                    return (
                      <KImage
                        key={`${t.name}-${i}`}
                        ref={live ? paintImgRef : undefined}
                        image={live ?? maskCanvas(m.rle, classColor(t, m.labelId))}
                        width={W}
                        height={H}
                        opacity={(selected?.tool === t.name && selected.index === i ? 0.6 : 0.42) * op}
                        listening={false}
                      />
                    );
                  });
                if (t.kind === "bbox")
                  return list<BBox>(t.name).map((b, i) => {
                    const c = classColor(t, b.labelId);
                    const sel = selected?.tool === t.name && selected.index === i;
                    return (
                      <Group key={`${t.name}-${i}`} opacity={op}>
                        <Rect
                          ref={(n) => {
                            if (n) nodes.current.set(`${t.name}:${i}`, n);
                          }}
                          x={b.x + b.w / 2}
                          y={b.y + b.h / 2}
                          offsetX={b.w / 2}
                          offsetY={b.h / 2}
                          width={b.w}
                          height={b.h}
                          rotation={b.angle ?? 0}
                          stroke={c}
                          strokeWidth={sel ? stroke + 1 : stroke}
                          strokeScaleEnabled={false}
                          fill={c + (sel ? "33" : "1a")}
                          listening={act}
                          draggable={act && sel}
                          onMouseDown={selectHandler(t, i)}
                          onDragEnd={(e) => {
                            const n = e.target;
                            const arr = list<BBox>(t.name).slice();
                            arr[i] = { ...b, x: round2(n.x() - b.w / 2), y: round2(n.y() - b.h / 2) };
                            onChange(t.name, arr);
                          }}
                          onTransformEnd={(e) => {
                            const n = e.target as Konva.Rect;
                            const w = Math.max(1, n.width() * n.scaleX());
                            const h = Math.max(1, n.height() * n.scaleY());
                            n.scaleX(1);
                            n.scaleY(1);
                            const arr = list<BBox>(t.name).slice();
                            const next: BBox = { ...b, w: round2(w), h: round2(h), x: round2(n.x() - w / 2), y: round2(n.y() - h / 2) };
                            if (t.rotatable) next.angle = normAngle(n.rotation());
                            arr[i] = next;
                            onChange(t.name, arr);
                          }}
                        />
                        <Text x={b.x} y={b.y - 14 / scale} text={b.labelId} fontSize={12 / scale} fill={c} listening={false} />
                      </Group>
                    );
                  });
                if (t.kind === "polygon" || t.kind === "polyline")
                  return list<PolyObj>(t.name).map((p, i) => {
                    const c = classColor(t, p.labelId);
                    const sel = selected?.tool === t.name && selected.index === i;
                    return (
                      <Group key={`${t.name}-${i}`} opacity={op}>
                        <Line
                          points={p.points.flat()}
                          closed={t.kind === "polygon"}
                          stroke={c}
                          strokeWidth={sel ? stroke + 1 : stroke}
                          strokeScaleEnabled={false}
                          fill={t.kind === "polygon" ? c + (sel ? "33" : "1a") : undefined}
                          hitStrokeWidth={10}
                          listening={act}
                          onMouseDown={selectHandler(t, i)}
                        />
                        {sel &&
                          act &&
                          p.points.map((pt, k) => (
                            <Circle
                              key={k}
                              x={pt[0]}
                              y={pt[1]}
                              radius={5 / scale}
                              fill="#fff"
                              stroke={c}
                              strokeWidth={2}
                              strokeScaleEnabled={false}
                              draggable
                              onMouseDown={(e) => {
                                e.cancelBubble = true;
                              }}
                              onDragMove={(e) => {
                                const arr = list<PolyObj>(t.name).slice();
                                const pts = arr[i].points.slice();
                                pts[k] = [round2(clamp(e.target.x(), 0, W)), round2(clamp(e.target.y(), 0, H))];
                                arr[i] = { ...arr[i], points: pts };
                                onChange(t.name, arr);
                              }}
                            />
                          ))}
                      </Group>
                    );
                  });
                if (t.kind === "keypoint")
                  return list<KeyPoint>(t.name).map((p, i) => {
                    const c = classColor(t, p.labelId);
                    const sel = selected?.tool === t.name && selected.index === i;
                    return (
                      <Group key={`${t.name}-${i}`} opacity={op}>
                        <Circle
                          x={p.x}
                          y={p.y}
                          radius={(sel ? 6 : 4.5) / scale}
                          fill={c}
                          stroke="#fff"
                          strokeWidth={1.5}
                          strokeScaleEnabled={false}
                          listening={act}
                          draggable={act}
                          onMouseDown={selectHandler(t, i)}
                          onDragEnd={(e) => {
                            const arr = list<KeyPoint>(t.name).slice();
                            arr[i] = { ...p, x: round2(clamp(e.target.x(), 0, W)), y: round2(clamp(e.target.y(), 0, H)) };
                            onChange(t.name, arr);
                          }}
                        />
                        <Text x={p.x + 6 / scale} y={p.y - 6 / scale} text={p.labelId} fontSize={11 / scale} fill={c} listening={false} />
                      </Group>
                    );
                  });
                return null;
              })}
              {paintCanvas && active?.kind === "mask" && paintCanvas.index >= list<MaskObj>(active.name).length && (
                <KImage ref={paintImgRef} image={paintCanvas.canvas} width={W} height={H} opacity={0.5} listening={false} />
              )}
              {drawRect && active && (
                <Rect
                  x={Math.min(drawRect.x0, drawRect.x1)}
                  y={Math.min(drawRect.y0, drawRect.y1)}
                  width={Math.abs(drawRect.x1 - drawRect.x0)}
                  height={Math.abs(drawRect.y1 - drawRect.y0)}
                  stroke={classColor(active, cls)}
                  dash={[6, 4]}
                  strokeWidth={stroke}
                  strokeScaleEnabled={false}
                  listening={false}
                />
              )}
              {drawPoly && active && (
                <>
                  <Line
                    points={drawPoly.concat(cursor ? [cursor] : []).flat()}
                    stroke={classColor(active, cls)}
                    strokeWidth={stroke}
                    strokeScaleEnabled={false}
                    dash={[6, 4]}
                    listening={false}
                  />
                  {drawPoly.map((pt, k) => (
                    <Circle key={k} x={pt[0]} y={pt[1]} radius={(k === 0 ? 6 : 4) / scale} fill={k === 0 ? "#fff" : classColor(active, cls)} stroke={classColor(active, cls)} strokeWidth={1.5} strokeScaleEnabled={false} listening={false} />
                  ))}
                </>
              )}
            </Group>
            <Transformer
              ref={trRef}
              rotateEnabled={Boolean(active?.rotatable)}
              keepRatio={false}
              ignoreStroke
              flipEnabled={false}
              boundBoxFunc={(oldB, newB) => (Math.abs(newB.width) < 3 || Math.abs(newB.height) < 3 ? oldB : newB)}
            />
          </Layer>
        </Stage>
        {!img && <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Đang tải ảnh…</div>}
      </div>
      {active && !readOnly && (
        <p className="text-xs text-muted-foreground">
          {active.kind === "bbox" && "Kéo chuột trên ảnh để vẽ khung. Chọn khung để kéo, đổi cỡ" + (active.rotatable ? ", xoay." : ".")}
          {active.kind === "polygon" && "Bấm từng đỉnh; bấm lại đỉnh đầu, nhấp đúp hoặc Enter để khép đa giác. Backspace xoá đỉnh cuối, Esc huỷ."}
          {active.kind === "polyline" && "Bấm từng đỉnh; nhấp đúp hoặc Enter để kết thúc đường. Backspace xoá đỉnh cuối, Esc huỷ."}
          {active.kind === "keypoint" && "Bấm lên ảnh để đặt điểm, kéo điểm để chỉnh."}
          {active.kind === "mask" && "Tô bằng cọ; chọn một mặt nạ trong danh sách để tô / tẩy tiếp, bỏ chọn để tạo mặt nạ mới."}{" "}
          Con lăn để phóng to, giữ Space để kéo ảnh, Delete xoá đối tượng đang chọn.
        </p>
      )}
    </div>
  );
}
