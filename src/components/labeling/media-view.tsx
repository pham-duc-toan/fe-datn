"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Text } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { Pause, Play, StepBack, StepForward, Flag, FlagOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LabelData, SampleMeta, Tool } from "@/lib/types";
import { formatSeconds } from "@/lib/format";
import { classColor, interpolateTrack, round2, type SegmentObj, type TrackObj, type Keyframe } from "./schema";

type Props = {
  kind: "audio" | "video";
  src: string;
  meta: SampleMeta;
  segTools: Tool[];
  trackTools: Tool[];
  data: LabelData;
  activeTool: string | null;
  activeClass: Record<string, string>;
  selected: { tool: string; index: number } | null;
  readOnly: boolean;
  onChange: (tool: string, list: unknown[]) => void;
  onSelect: (s: { tool: string; index: number } | null) => void;
  onError?: () => void;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export default function MediaView(p: Props) {
  const { kind, src, meta, segTools, trackTools, data, activeTool, activeClass, selected, readOnly, onChange, onSelect, onError } = p;
  const mediaRef = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [mediaDur, setMediaDur] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [box, setBox] = useState({ w: 640, h: 360 });
  const [drag, setDrag] = useState<{ t0: number; t1: number } | null>(null);
  const [pendingStart, setPendingStart] = useState<number | null>(null);
  const [draw, setDraw] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  // Mẫu có thể là MỘT đoạn cắt từ file dài: fileUrl là cả file, mốc 0 = segmentStart (mục 6.4).
  const s0 = meta.segmentStart ?? 0;
  const dur = meta.durationSec ?? (meta.segmentEnd !== undefined ? meta.segmentEnd - s0 : mediaDur !== null ? mediaDur - s0 : 0);
  const s1 = s0 + dur;
  const W = meta.width ?? 1280;
  const H = meta.height ?? 720;
  const activeSeg = segTools.find((x) => x.name === activeTool) ?? null;
  const activeTrack = trackTools.find((x) => x.name === activeTool) ?? null;

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    const onMeta = () => {
      setMediaDur(el.duration);
      el.currentTime = s0;
      setReady(true);
    };
    const onTime = () => {
      if (el.currentTime >= s1 && dur > 0) {
        el.pause();
        el.currentTime = s1;
      }
      if (el.currentTime < s0) el.currentTime = s0;
      setT(clamp(el.currentTime - s0, 0, dur || el.duration));
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("seeked", onTime);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    return () => {
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("seeked", onTime);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, [s0, s1, dur]);

  useEffect(() => {
    if (kind !== "video" || !boxRef.current) return;
    const ro = new ResizeObserver((e) => {
      const w = e[0].contentRect.width;
      setBox({ w, h: (w * H) / W });
    });
    ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, [kind, W, H]);

  const seek = (rel: number) => {
    const el = mediaRef.current;
    if (!el) return;
    el.currentTime = s0 + clamp(rel, 0, dur);
    setT(clamp(rel, 0, dur));
  };
  const toggle = () => {
    const el = mediaRef.current;
    if (!el) return;
    if (el.paused) {
      if (el.currentTime >= s1 - 0.01) el.currentTime = s0;
      void el.play();
    } else el.pause();
  };

  const timeFromX = (clientX: number) => {
    const r = timelineRef.current!.getBoundingClientRect();
    return round2(clamp(((clientX - r.left) / r.width) * dur, 0, dur));
  };

  const segs = (name: string) => (data[name] as SegmentObj[] | undefined) ?? [];
  const tracks = (name: string) => (data[name] as TrackObj[] | undefined) ?? [];

  function addSegment(a: number, b: number) {
    if (!activeSeg) return;
    const start = round2(Math.min(a, b));
    const end = round2(Math.max(a, b));
    if (end - start < 0.05) return;
    const arr = segs(activeSeg.name).concat([{ labelId: activeClass[activeSeg.name] ?? activeSeg.classes?.[0] ?? "", start, end }]);
    onChange(activeSeg.name, arr);
    onSelect({ tool: activeSeg.name, index: arr.length - 1 });
  }

  // ----- track: vẽ khung tại thời điểm hiện tại = thêm / thay keyframe -----
  const sc = box.w / W;
  function setKeyframe(kf: Keyframe) {
    if (!activeTrack) return;
    const arr = tracks(activeTrack.name).slice();
    const cur = selected?.tool === activeTrack.name ? selected.index : -1;
    if (cur >= 0 && cur < arr.length) {
      const kfs = arr[cur].keyframes.filter((k) => Math.abs(k.t - kf.t) > 0.04).concat([kf]).sort((a, b) => a.t - b.t);
      arr[cur] = { ...arr[cur], keyframes: kfs };
      onChange(activeTrack.name, arr);
    } else {
      arr.push({ labelId: activeClass[activeTrack.name] ?? activeTrack.classes?.[0] ?? "", keyframes: [kf] });
      onChange(activeTrack.name, arr);
      onSelect({ tool: activeTrack.name, index: arr.length - 1 });
    }
  }

  const stagePos = (e: KonvaEventObject<MouseEvent>) => {
    const pos = e.target.getStage()!.getPointerPosition()!;
    return [clamp(pos.x / sc, 0, W), clamp(pos.y / sc, 0, H)] as const;
  };

  return (
    <div className="space-y-3">
      {kind === "video" ? (
        <div ref={boxRef} className="relative w-full overflow-hidden rounded-md bg-black" style={{ aspectRatio: `${W} / ${H}` }}>
          <video ref={mediaRef} src={src} className="absolute inset-0 h-full w-full" preload="auto" onError={onError} playsInline />
          {trackTools.length > 0 && (
            <div className="absolute inset-0">
              <Stage
                width={box.w}
                height={box.h}
                onMouseDown={(e) => {
                  if (readOnly || !activeTrack) return;
                  mediaRef.current?.pause();
                  const [x, y] = stagePos(e);
                  setDraw({ x0: x, y0: y, x1: x, y1: y });
                }}
                onMouseMove={(e) => {
                  if (!draw) return;
                  const [x, y] = stagePos(e);
                  setDraw({ ...draw, x1: x, y1: y });
                }}
                onMouseUp={() => {
                  if (!draw) return;
                  const w = Math.abs(draw.x1 - draw.x0);
                  const h = Math.abs(draw.y1 - draw.y0);
                  if (w * sc > 4 && h * sc > 4) setKeyframe({ t: round2(t), x: round2(Math.min(draw.x0, draw.x1)), y: round2(Math.min(draw.y0, draw.y1)), w: round2(w), h: round2(h) });
                  setDraw(null);
                }}
              >
                <Layer>
                  {trackTools.map((tool) =>
                    tracks(tool.name).map((tr, i) => {
                      const b = interpolateTrack(tr.keyframes, t);
                      if (!b) return null;
                      const c = classColor(tool, tr.labelId);
                      const sel = selected?.tool === tool.name && selected.index === i;
                      const exact = tr.keyframes.some((k) => Math.abs(k.t - t) < 0.04);
                      return (
                        <Rect
                          key={`${tool.name}-${i}`}
                          x={b.x * sc}
                          y={b.y * sc}
                          width={b.w * sc}
                          height={b.h * sc}
                          stroke={c}
                          strokeWidth={sel ? 3 : 2}
                          dash={exact ? undefined : [6, 4]}
                          fill={c + "22"}
                          onMouseDown={(e) => {
                            e.cancelBubble = true;
                            onSelect({ tool: tool.name, index: i });
                          }}
                          draggable={!readOnly && sel && tool.name === activeTool}
                          onDragEnd={(e) => {
                            const arr = tracks(tool.name).slice();
                            const kf: Keyframe = { t: round2(t), x: round2(e.target.x() / sc), y: round2(e.target.y() / sc), w: b.w, h: b.h };
                            const kfs = arr[i].keyframes.filter((k) => Math.abs(k.t - kf.t) > 0.04).concat([kf]).sort((a, z) => a.t - z.t);
                            arr[i] = { ...arr[i], keyframes: kfs };
                            onChange(tool.name, arr);
                          }}
                        />
                      );
                    }),
                  )}
                  {trackTools.map((tool) =>
                    tracks(tool.name).map((tr, i) => {
                      const b = interpolateTrack(tr.keyframes, t);
                      return b ? <Text key={`l-${tool.name}-${i}`} x={b.x * sc} y={b.y * sc - 14} text={`${tr.labelId} #${i + 1}`} fontSize={12} fill={classColor(tool, tr.labelId)} listening={false} /> : null;
                    }),
                  )}
                  {draw && activeTrack && (
                    <Rect
                      x={Math.min(draw.x0, draw.x1) * sc}
                      y={Math.min(draw.y0, draw.y1) * sc}
                      width={Math.abs(draw.x1 - draw.x0) * sc}
                      height={Math.abs(draw.y1 - draw.y0) * sc}
                      stroke={classColor(activeTrack, activeClass[activeTrack.name] ?? "")}
                      dash={[6, 4]}
                      strokeWidth={2}
                      listening={false}
                    />
                  )}
                </Layer>
              </Stage>
            </div>
          )}
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white/80">
              <Loader2 className="size-4 animate-spin" /> Đang chuẩn bị video…
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-md border bg-muted/40 p-4">
          <audio ref={mediaRef} src={src} preload="auto" onError={onError} />
          {!ready && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Đang chuẩn bị âm thanh…
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="icon-sm" variant="outline" onClick={() => seek(t - (kind === "video" ? 0.1 : 1))} aria-label="Lùi">
          <StepBack />
        </Button>
        <Button type="button" size="sm" onClick={toggle} disabled={!ready}>
          {playing ? <Pause /> : <Play />} {playing ? "Dừng" : "Phát"}
        </Button>
        <Button type="button" size="icon-sm" variant="outline" onClick={() => seek(t + (kind === "video" ? 0.1 : 1))} aria-label="Tới">
          <StepForward />
        </Button>
        <span className="font-mono text-sm tabular-nums">
          {formatSeconds(t)} / {formatSeconds(dur)}
        </span>
        {meta.segmentStart !== undefined && (
          <span className="text-xs text-muted-foreground">
            Đoạn {formatSeconds(s0)}–{formatSeconds(s1)} của file {formatSeconds(meta.sourceDurationSec ?? mediaDur ?? 0)}
          </span>
        )}
        {activeSeg && !readOnly && (
          <div className="ml-auto flex gap-1.5">
            {pendingStart === null ? (
              <Button type="button" size="sm" variant="outline" onClick={() => setPendingStart(round2(t))}>
                <Flag /> Bắt đầu tại {formatSeconds(t)}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    addSegment(pendingStart, t);
                    setPendingStart(null);
                  }}
                >
                  <FlagOff /> Kết thúc tại {formatSeconds(t)}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setPendingStart(null)}>
                  Huỷ
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <div
        ref={timelineRef}
        className="relative h-14 cursor-pointer select-none rounded-md border bg-muted/50"
        onMouseDown={(e) => {
          const tt = timeFromX(e.clientX);
          if (activeSeg && !readOnly) setDrag({ t0: tt, t1: tt });
          else seek(tt);
        }}
        onMouseMove={(e) => drag && setDrag({ ...drag, t1: timeFromX(e.clientX) })}
        onMouseUp={() => {
          if (drag) {
            if (Math.abs(drag.t1 - drag.t0) < 0.05) seek(drag.t0);
            else addSegment(drag.t0, drag.t1);
          }
          setDrag(null);
        }}
        onMouseLeave={() => setDrag(null)}
      >
        {segTools.map((tool, ti) =>
          segs(tool.name).map((s, i) => {
            const sel = selected?.tool === tool.name && selected.index === i;
            const top = 4 + (ti % 3) * 15;
            return (
              <div
                key={`${tool.name}-${i}`}
                title={`${tool.name}: ${s.labelId} (${formatSeconds(s.start)}–${formatSeconds(s.end)})`}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onSelect({ tool: tool.name, index: i });
                  seek(s.start);
                }}
                className="absolute h-3.5 rounded-sm text-[10px] leading-3.5 text-white overflow-hidden px-1"
                style={{
                  top,
                  left: `${(s.start / (dur || 1)) * 100}%`,
                  width: `${Math.max(0.5, ((s.end - s.start) / (dur || 1)) * 100)}%`,
                  backgroundColor: classColor(tool, s.labelId),
                  outline: sel ? "2px solid #111" : undefined,
                }}
              >
                {s.labelId}
              </div>
            );
          }),
        )}
        {trackTools.map((tool) =>
          tracks(tool.name).flatMap((tr, i) =>
            tr.keyframes.map((k, j) => (
              <div
                key={`${tool.name}-${i}-${j}`}
                className="absolute bottom-1 h-2.5 w-1 rounded-sm"
                style={{ left: `${(k.t / (dur || 1)) * 100}%`, backgroundColor: k.visible === false ? "#999" : classColor(tool, tr.labelId) }}
                title={`${tr.labelId} #${i + 1} @ ${formatSeconds(k.t)}${k.visible === false ? " (ẩn)" : ""}`}
              />
            )),
          ),
        )}
        {drag && (
          <div className="absolute top-0 h-full bg-primary/25" style={{ left: `${(Math.min(drag.t0, drag.t1) / (dur || 1)) * 100}%`, width: `${(Math.abs(drag.t1 - drag.t0) / (dur || 1)) * 100}%` }} />
        )}
        {pendingStart !== null && <div className="absolute top-0 h-full w-0.5 bg-emerald-600" style={{ left: `${(pendingStart / (dur || 1)) * 100}%` }} />}
        <div className="pointer-events-none absolute top-0 h-full w-0.5 bg-destructive" style={{ left: `${(t / (dur || 1)) * 100}%` }} />
      </div>
      {activeSeg && !readOnly && <p className="text-xs text-muted-foreground">Kéo trên thanh thời gian để đánh dấu đoạn, hoặc dùng nút Bắt đầu / Kết thúc khi đang nghe. Bấm một đoạn để chọn.</p>}
      {activeTrack && !readOnly && (
        <p className="text-xs text-muted-foreground">
          Dừng ở một khung hình rồi kéo để vẽ khung = thêm keyframe cho chuỗi đang chọn (bỏ chọn để tạo chuỗi mới). Giữa hai keyframe khung được nội suy (nét đứt).
        </p>
      )}
      <TrackHelpers {...p} t={t} seek={seek} />
    </div>
  );
}

/** Nút thao tác chuỗi đang chọn: ẩn từ thời điểm hiện tại / xoá keyframe tại đây. */
function TrackHelpers(p: Props & { t: number; seek: (x: number) => void }) {
  const { trackTools, selected, data, onChange, readOnly, t } = p;
  if (readOnly || !selected) return null;
  const tool = trackTools.find((x) => x.name === selected.tool);
  if (!tool) return null;
  const list = (data[tool.name] as TrackObj[] | undefined) ?? [];
  const tr = list[selected.index];
  if (!tr) return null;
  const here = tr.keyframes.find((k) => Math.abs(k.t - t) < 0.04);
  const b = interpolateTrack(tr.keyframes, t) ?? tr.keyframes[tr.keyframes.length - 1];
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
      <span>
        Chuỗi <b>{tr.labelId} #{selected.index + 1}</b> · {tr.keyframes.length} keyframe
      </span>
      <Button
        type="button"
        size="xs"
        variant="outline"
        onClick={() => {
          const kf: Keyframe = { t: round2(t), x: b.x, y: b.y, w: b.w, h: b.h, visible: false };
          const next = list.slice();
          next[selected.index] = { ...tr, keyframes: tr.keyframes.filter((k) => Math.abs(k.t - kf.t) > 0.04).concat([kf]).sort((a, z) => a.t - z.t) };
          onChange(tool.name, next);
        }}
      >
        Đối tượng khuất từ đây
      </Button>
      {here && (
        <Button
          type="button"
          size="xs"
          variant="ghost"
          onClick={() => {
            const next = list.slice();
            next[selected.index] = { ...tr, keyframes: tr.keyframes.filter((k) => k !== here) };
            onChange(tool.name, next);
          }}
        >
          Xoá keyframe tại đây
        </Button>
      )}
      <span className="text-xs text-muted-foreground">
        Mốc: {tr.keyframes.map((k) => `${formatSeconds(k.t)}${k.visible === false ? "(ẩn)" : ""}`).join(", ")}
      </span>
    </div>
  );
}
