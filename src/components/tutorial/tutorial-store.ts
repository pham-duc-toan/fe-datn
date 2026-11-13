import type { ToolKind } from "@/lib/types";

/**
 * Tiến độ hướng dẫn của người dùng trên trình duyệt này (như "đã qua màn hướng dẫn" trong game):
 *   - learned       : loại công cụ đã luyện (hoặc đã bỏ qua) — dự án sau chỉ dạy công cụ MỚI;
 *   - tourDone      : đã xem (hoặc bỏ qua) tour giới thiệu trang làm bài;
 *   - creatorTourDone: người tạo dự án đã xem (hoặc bỏ qua) tour trang cấu hình dự án.
 * Không có gì bắt buộc: localStorage bị chặn thì coi như chưa học, hướng dẫn hiện lại (vẫn bỏ qua được).
 */
const KEY = "crowd:huong-dan:v1";

type TutorialState = { learned: ToolKind[]; tourDone: boolean; creatorTourDone: boolean };

export function readTutorial(): TutorialState {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as Partial<TutorialState>) : {};
    return { learned: Array.isArray(v.learned) ? v.learned : [], tourDone: v.tourDone === true, creatorTourDone: v.creatorTourDone === true };
  } catch {
    return { learned: [], tourDone: false, creatorTourDone: false };
  }
}

function write(s: TutorialState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* trình duyệt chặn lưu trữ — lần sau hướng dẫn hiện lại */
  }
}

export function markLearned(kinds: ToolKind[]) {
  const s = readTutorial();
  write({ ...s, learned: Array.from(new Set([...s.learned, ...kinds])) });
}

export function markTourDone() {
  write({ ...readTutorial(), tourDone: true });
}

export function markCreatorTourDone() {
  write({ ...readTutorial(), creatorTourDone: true });
}

/** Loại công cụ của dự án mà người dùng chưa luyện. */
export function unlearnedKinds(kinds: ToolKind[]): ToolKind[] {
  const learned = new Set(readTutorial().learned);
  return Array.from(new Set(kinds)).filter((k) => !learned.has(k));
}
