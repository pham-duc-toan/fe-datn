import { LIST_TOOLS, TOOL_LABEL } from "./labels";
import type { LabelData, LabelSchema, SampleContent, Tool } from "./types";

/** Đơn vị đếm cho công cụ dạng danh sách đối tượng. */
const UNIT: Partial<Record<Tool["kind"], string>> = {
  bbox: "khung",
  polygon: "vùng",
  keypoint: "điểm",
  polyline: "đường",
  mask: "vùng tô",
  span: "đoạn chữ",
  relation: "quan hệ",
  temporalSegment: "đoạn thời gian",
  track: "đối tượng theo dõi",
};

/**
 * Mô tả bằng chữ một giá trị nhãn của MỘT công cụ — cho doanh nghiệp / labeler đọc thay vì JSON.
 * `content` (tuỳ chọn) để hiện tên mục khi xếp hạng, chữ được đánh dấu khi gán đoạn.
 */
export function describeTool(tool: Tool, value: unknown, content?: SampleContent | null): string {
  if (value === null || value === undefined) return "—";
  if (LIST_TOOLS.includes(tool.kind)) {
    const list = Array.isArray(value) ? (value as { labelId?: string; start?: number; end?: number }[]) : [];
    if (list.length === 0) return `Không có ${UNIT[tool.kind] ?? "đối tượng"} nào`;
    if (tool.kind === "span" && content?.text) {
      return list.map((s) => `${s.labelId ?? "?"}: “${content.text!.slice(s.start ?? 0, s.end ?? 0)}”`).join(" · ");
    }
    const dem = new Map<string, number>();
    for (const o of list) dem.set(o.labelId ?? "(không lớp)", (dem.get(o.labelId ?? "(không lớp)") ?? 0) + 1);
    const chiTiet = [...dem.entries()].map(([k, n]) => (n > 1 ? `${k} ×${n}` : k)).join(", ");
    return `${list.length} ${UNIT[tool.kind] ?? "đối tượng"}: ${chiTiet}`;
  }
  const v = value as { labelIds?: string[]; text?: string; value?: number; choice?: string; order?: number[] };
  switch (tool.kind) {
    case "classification":
      return (v.labelIds ?? []).length ? (v.labelIds ?? []).join(", ") : "Chưa chọn";
    case "freeText":
    case "transcription":
      return v.text ? v.text : "(trống)";
    case "number":
      return typeof v.value === "number" ? String(v.value) : "—";
    case "pairwise":
      return v.choice === "tie" ? "Ngang nhau" : v.choice === "a" ? "Bên A tốt hơn" : v.choice === "b" ? "Bên B tốt hơn" : "—";
    case "ranking": {
      const items = content?.items;
      return (v.order ?? []).map((i) => (items && items[i] !== undefined ? items[i] : `Mục ${i + 1}`)).join(" > ");
    }
    default:
      return TOOL_LABEL[tool.kind] ?? tool.kind;
  }
}

/** Mỗi công cụ một dòng: tên công cụ + mô tả. Công cụ không có trong dữ liệu thì bỏ qua. */
export function describeLabel(schema: LabelSchema | null | undefined, data: LabelData | null | undefined, content?: SampleContent | null): { tool: string; text: string }[] {
  if (!schema || !data) return [];
  return schema.tools.filter((t) => data[t.name] !== undefined).map((t) => ({ tool: t.name, text: describeTool(t, data[t.name], content) }));
}
