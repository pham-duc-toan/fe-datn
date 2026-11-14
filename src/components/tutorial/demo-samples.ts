import type { Modality, SampleContent, SampleMeta } from "@/lib/types";

/**
 * Câu ví dụ dựng sẵn cho "Xem như labeler" (labeler-preview) — mỗi loại dữ liệu một câu. File nằm ở
 * `public/huong-dan/` (sinh bằng ffmpeg, vài KB). Lớp nhãn KHÔNG nằm ở đây: xem trước dùng đúng tập nhãn
 * của dự án, chỉ thay mẫu thật bằng câu ví dụ này.
 */
export type DemoSample = {
  fileUrl: string | null;
  content: SampleContent | null;
  metadata: SampleMeta;
};

export const DEMO_SAMPLES: Record<Modality, DemoSample> = {
  image: {
    fileUrl: "/huong-dan/anh-mau.png",
    content: null,
    metadata: { width: 640, height: 400 },
  },
  text: {
    fileUrl: null,
    content: { text: "Chiều 5/11, ông Nguyễn Văn An đến Hà Nội để dự hội thảo của Công ty Sao Mai về trí tuệ nhân tạo." },
    metadata: {},
  },
  audio: {
    fileUrl: "/huong-dan/am-thanh-mau.mp3",
    content: null,
    metadata: { durationSec: 5.5 },
  },
  video: {
    fileUrl: "/huong-dan/video-mau.mp4",
    content: null,
    metadata: { durationSec: 4, fps: 10, width: 320, height: 240 },
  },
  pair: {
    fileUrl: null,
    content: {
      a: "Ánh sáng xanh có bước sóng ngắn nên bị các phân tử khí tán xạ mạnh hơn các màu khác, vì vậy ta thấy bầu trời màu xanh.",
      b: "Vì trời xanh.",
    },
    metadata: {},
  },
  list: {
    fileUrl: null,
    content: { items: ["Phở bò", "Bánh mì trứng", "Lẩu thái", "Kem que"] },
    metadata: { itemCount: 4 },
  },
};
