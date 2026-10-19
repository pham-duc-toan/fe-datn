import type { AttributeDef, LabelData, LabelSchema, SampleMeta, Tool, ToolKind } from "@/lib/types";
import { TOOL_LABEL } from "@/lib/labels";

export const LIST_KINDS = new Set<ToolKind>(["bbox", "polygon", "keypoint", "polyline", "mask", "span", "relation", "temporalSegment", "track"]);
export const IMAGE_KINDS = new Set<ToolKind>(["bbox", "polygon", "keypoint", "polyline", "mask"]);
export const SPATIAL_KINDS = new Set<ToolKind>(["bbox", "polygon", "keypoint", "polyline", "mask", "span", "temporalSegment", "track"]);

export type Point = [number, number];
export type BBox = { labelId: string; x: number; y: number; w: number; h: number; angle?: number; attributes?: Record<string, unknown> };
export type PolyObj = { labelId: string; points: Point[]; attributes?: Record<string, unknown> };
export type KeyPoint = { labelId: string; x: number; y: number; attributes?: Record<string, unknown> };
export type Rle = { size: [number, number]; counts: number[] };
export type MaskObj = { labelId: string; rle: Rle; attributes?: Record<string, unknown> };
export type SpanObj = { labelId: string; start: number; end: number; attributes?: Record<string, unknown> };
export type RelationObj = { labelId: string; from: { start: number; end: number }; to: { start: number; end: number } };
export type SegmentObj = { labelId: string; start: number; end: number; attributes?: Record<string, unknown> };
export type Keyframe = { t: number; x: number; y: number; w: number; h: number; visible?: boolean };
export type TrackObj = { labelId: string; keyframes: Keyframe[]; attributes?: Record<string, unknown> };
export type AnyObj = { labelId: string; attributes?: Record<string, unknown> };

export const isList = (t: Tool) => LIST_KINDS.has(t.kind);
export const toolTitle = (t: Tool) => `${t.name} · ${TOOL_LABEL[t.kind] ?? t.kind}`;

/** Bảng màu cho lớp: cùng lớp luôn cùng màu trong một công cụ. */
const PALETTE = ["#2563eb", "#16a34a", "#dc2626", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#65a30d", "#ea580c", "#4f46e5", "#0d9488", "#be123c"];
export function classColor(tool: Tool, labelId: string): string {
  const i = Math.max(0, (tool.classes ?? []).indexOf(labelId));
  return PALETTE[i % PALETTE.length];
}

/** Xáo trộn ổn định theo hạt giống (vd sampleId) — xáo hiển thị để giảm thiên vị, gửi theo chỉ số gốc. */
export function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const rnd = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function seededBool(seed: string): boolean {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return (h & 1) === 1;
}

function emptyValue(v: unknown, t: Tool): boolean {
  if (v === undefined || v === null) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (t.kind === "classification") return ((v as { labelIds?: string[] }).labelIds ?? []).length === 0;
  if (t.kind === "freeText" || t.kind === "transcription") return !((v as { text?: string }).text ?? "").length;
  if (t.kind === "number") return typeof (v as { value?: unknown }).value !== "number";
  if (t.kind === "pairwise") return !(v as { choice?: string }).choice;
  if (t.kind === "ranking") return !((v as { order?: number[] }).order ?? []).length;
  return false;
}

/** Câu chưa có nội dung gì ở mọi công cụ (bài làm: câu bỏ trống). */
export function isBlank(schema: LabelSchema, data: LabelData): boolean {
  return schema.tools.every((t) => emptyValue(data[t.name], t));
}

/** Bỏ khoá của công cụ tuỳ chọn mà người dùng không làm (mục 6.2). */
export function buildPayload(schema: LabelSchema, data: LabelData): LabelData {
  const out: LabelData = {};
  for (const t of schema.tools) {
    const v = data[t.name];
    const required = t.required !== false;
    if (emptyValue(v, t)) {
      // Công cụ danh sách bắt buộc nhưng không có đối tượng nào: gửi mảng rỗng (minItems mặc định 0).
      if (required && isList(t)) out[t.name] = [];
      continue;
    }
    out[t.name] = v;
  }
  return out;
}

function checkAttributes(t: Tool, objs: AnyObj[], errs: string[]) {
  const defs: AttributeDef[] = t.attributes ?? [];
  objs.forEach((o, i) => {
    for (const a of defs) {
      const v = o.attributes?.[a.name];
      if (a.required && (v === undefined || v === null || (a.type === "text" && String(v).trim() === ""))) {
        errs.push(`${t.name} mục ${i + 1}: thiếu thuộc tính "${a.name}"`);
      }
    }
  });
}

/** Kiểm trước ở trình duyệt để báo lỗi sớm; server vẫn kiểm lại tất cả (mục 6.5). */
export function validateLabel(schema: LabelSchema, data: LabelData, meta: SampleMeta): string[] {
  const errs: string[] = [];
  for (const t of schema.tools) {
    const v = data[t.name];
    const required = t.required !== false;
    if (emptyValue(v, t)) {
      if (required) {
        if (!isList(t)) errs.push(`${t.name}: bắt buộc`);
        else if ((t.minItems ?? 0) > 0) errs.push(`${t.name}: cần ít nhất ${t.minItems} mục`);
      }
      continue;
    }
    if (t.kind === "classification") {
      const ids = (v as { labelIds: string[] }).labelIds;
      if (!t.allowMultiple && ids.length !== 1) errs.push(`${t.name}: chọn đúng một lớp`);
    }
    if (t.kind === "number") {
      const n = (v as { value: number }).value;
      if (t.integer && !Number.isInteger(n)) errs.push(`${t.name}: phải là số nguyên`);
      if (t.min !== null && t.min !== undefined && n < t.min) errs.push(`${t.name}: nhỏ hơn ${t.min}`);
      if (t.max !== null && t.max !== undefined && n > t.max) errs.push(`${t.name}: lớn hơn ${t.max}`);
    }
    if ((t.kind === "freeText" || t.kind === "transcription") && t.maxLength) {
      if (((v as { text: string }).text ?? "").length > t.maxLength) errs.push(`${t.name}: quá ${t.maxLength} ký tự`);
    }
    if (t.kind === "ranking") {
      const order = (v as { order: number[] }).order;
      if (meta.itemCount && order.length !== meta.itemCount) errs.push(`${t.name}: phải xếp đủ ${meta.itemCount} mục`);
    }
    if (isList(t) && Array.isArray(v)) {
      const n = v.length;
      if (n < (t.minItems ?? 0)) errs.push(`${t.name}: cần ít nhất ${t.minItems} mục`);
      if (n > (t.maxItems ?? 1000)) errs.push(`${t.name}: tối đa ${t.maxItems} mục`);
      if (t.kind === "polygon") (v as PolyObj[]).forEach((p, i) => p.points.length < 3 && errs.push(`${t.name} mục ${i + 1}: đa giác cần ≥ 3 đỉnh`));
      if (t.kind === "polyline") (v as PolyObj[]).forEach((p, i) => p.points.length < 2 && errs.push(`${t.name} mục ${i + 1}: đường cần ≥ 2 đỉnh`));
      if (t.kind === "track") (v as TrackObj[]).forEach((p, i) => p.keyframes.length < 2 && errs.push(`${t.name} chuỗi ${i + 1}: cần ≥ 2 keyframe`));
      if (t.kind === "temporalSegment") (v as SegmentObj[]).forEach((s, i) => s.start >= s.end && errs.push(`${t.name} đoạn ${i + 1}: bắt đầu phải trước kết thúc`));
      if (t.kind !== "relation") checkAttributes(t, v as AnyObj[], errs);
    }
  }
  return errs;
}

/** Nhãn ban đầu (từ nháp) — chỉ giữ khoá thuộc tập nhãn. */
export function initialData(schema: LabelSchema, draft: LabelData | null | undefined): LabelData {
  const out: LabelData = {};
  if (!draft) return out;
  for (const t of schema.tools) if (draft[t.name] !== undefined) out[t.name] = draft[t.name];
  return out;
}

/** Nội suy tuyến tính khung của chuỗi tại thời điểm t (mục 6.3 track, 17.6 visible). */
export function interpolateTrack(kfs: Keyframe[], t: number): Keyframe | null {
  if (kfs.length === 0) return null;
  const sorted = kfs.slice().sort((a, b) => a.t - b.t);
  if (t < sorted[0].t || t > sorted[sorted.length - 1].t) return null;
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (!b || t < b.t) {
      if (a.visible === false) return null;
      if (!b) return a;
      const r = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
      return { t, x: a.x + (b.x - a.x) * r, y: a.y + (b.y - a.y) * r, w: a.w + (b.w - a.w) * r, h: a.h + (b.h - a.h) * r };
    }
    if (t === b.t && b.visible === false) return null;
  }
  return null;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
