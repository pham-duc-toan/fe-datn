import type { LabelData } from "@/lib/types";

/**
 * Nháp bài làm (câu đang làm dở) — CHỈ lưu ở trình duyệt, backend không giữ nháp.
 * Nộp bài thì gửi cả bài một lần (`POST /tasks/attempts/{id}/submit` với `answers`), nộp xong thì xoá nháp.
 *
 * Mỗi bài một khoá: `{ [sampleId]: dữ liệu nhãn theo tên công cụ }`. Đổi máy / xoá dữ liệu trình duyệt thì mất nháp.
 * Trình duyệt chặn lưu trữ (chế độ riêng tư…) thì vẫn làm bài được trong phiên, chỉ không giữ được khi tải lại trang.
 */
const DRAFT_KEY = (attemptId: string) => `crowd:attempt-draft:${attemptId}`;

export type AttemptDraft = Record<string, LabelData>;

export function readDraft(attemptId: string): AttemptDraft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY(attemptId));
    const v: unknown = raw ? JSON.parse(raw) : null;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as AttemptDraft) : {};
  } catch {
    return {};
  }
}

/** Ghi một câu vào nháp; `data` null = bỏ trống câu đó. Trả false nếu trình duyệt không cho lưu. */
export function writeDraftAnswer(attemptId: string, sampleId: string, data: LabelData | null): boolean {
  try {
    const d = readDraft(attemptId);
    if (data === null) delete d[sampleId];
    else d[sampleId] = data;
    localStorage.setItem(DRAFT_KEY(attemptId), JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(attemptId: string): void {
  try {
    localStorage.removeItem(DRAFT_KEY(attemptId));
  } catch {
    /* bỏ qua */
  }
}
