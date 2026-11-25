/**
 * Tiến độ hướng dẫn của người dùng trên trình duyệt này (như "đã qua màn hướng dẫn" trong game):
 *   - tourDone       : đã xem (hoặc bỏ qua) tour giới thiệu trang làm bài;
 *   - creatorTourDone: người tạo dự án đã xem (hoặc bỏ qua) tour trang cấu hình dự án;
 *   - toolsLearned   : loại công cụ đã làm ĐẠT bài tập hướng dẫn (nút "Tập dùng công cụ" gợi ý loại chưa tập).
 * Không có gì bắt buộc: localStorage bị chặn thì coi như chưa xem, tour hiện lại (vẫn bỏ qua được).
 */
const KEY = "crowd:huong-dan:v1";

type TutorialState = { tourDone: boolean; creatorTourDone: boolean; toolsLearned: string[] };

export function readTutorial(): TutorialState {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as Partial<TutorialState>) : {};
    return {
      tourDone: v.tourDone === true,
      creatorTourDone: v.creatorTourDone === true,
      toolsLearned: Array.isArray(v.toolsLearned) ? v.toolsLearned.filter((x): x is string => typeof x === "string") : [],
    };
  } catch {
    return { tourDone: false, creatorTourDone: false, toolsLearned: [] };
  }
}

function write(s: TutorialState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* trình duyệt chặn lưu trữ — lần sau hướng dẫn hiện lại */
  }
}

export function markTourDone() {
  write({ ...readTutorial(), tourDone: true });
}

export function markCreatorTourDone() {
  write({ ...readTutorial(), creatorTourDone: true });
}

export function markToolLearned(kind: string) {
  const s = readTutorial();
  if (!s.toolsLearned.includes(kind)) write({ ...s, toolsLearned: s.toolsLearned.concat([kind]) });
}
