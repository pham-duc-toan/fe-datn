/**
 * Tiến độ hướng dẫn của người dùng trên trình duyệt này (như "đã qua màn hướng dẫn" trong game):
 *   - tourDone      : đã xem (hoặc bỏ qua) tour giới thiệu trang làm bài;
 *   - creatorTourDone: người tạo dự án đã xem (hoặc bỏ qua) tour trang cấu hình dự án.
 * Không có gì bắt buộc: localStorage bị chặn thì coi như chưa xem, tour hiện lại (vẫn bỏ qua được).
 */
const KEY = "crowd:huong-dan:v1";

type TutorialState = { tourDone: boolean; creatorTourDone: boolean };

export function readTutorial(): TutorialState {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as Partial<TutorialState>) : {};
    return { tourDone: v.tourDone === true, creatorTourDone: v.creatorTourDone === true };
  } catch {
    return { tourDone: false, creatorTourDone: false };
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
