import type { Modality, SampleContent, SampleMeta } from "@/lib/types";

/**
 * Câu ví dụ dựng sẵn cho màn luyện tập — mỗi loại dữ liệu một câu. File nằm ở `public/huong-dan/`
 * (sinh bằng ffmpeg, vài KB). Lớp nhãn KHÔNG nằm ở đây: luyện tập dùng đúng tập nhãn của dự án,
 * chỉ thay câu hỏi thật bằng câu ví dụ này — không đụng bài thật, không lộ câu kiểm tra.
 */
export type DemoSample = {
  fileUrl: string | null;
  content: SampleContent | null;
  metadata: SampleMeta;
  /** Câu hỏi của câu ví dụ — giống câu hỏi labeler thấy ở mỗi câu thật. */
  question: string;
  /** Gợi ý nhìn vào đâu trong câu ví dụ, dùng trong lời nhắc nhiệm vụ. */
  hint: Partial<Record<"object" | "region" | "line" | "point" | "phrase", string>>;
};

export const DEMO_SAMPLES: Record<Modality, DemoSample> = {
  image: {
    fileUrl: "/huong-dan/anh-mau.png",
    content: null,
    metadata: { width: 640, height: 400 },
    question: "Trong ảnh có những gì? (câu ví dụ)",
    hint: {
      object: "chiếc xe màu đỏ",
      region: "người đứng bên phải",
      line: "vạch kẻ trắng trên mặt đường",
      point: "giữa mặt trời màu vàng",
    },
  },
  text: {
    fileUrl: null,
    content: { text: "Chiều 5/11, ông Nguyễn Văn An đến Hà Nội để dự hội thảo của Công ty Sao Mai về trí tuệ nhân tạo." },
    metadata: {},
    question: "Câu này nhắc tới ai, ở đâu? (câu ví dụ)",
    hint: { phrase: "“Nguyễn Văn An” hoặc “Hà Nội”" },
  },
  audio: {
    fileUrl: "/huong-dan/am-thanh-mau.mp3",
    content: null,
    metadata: { durationSec: 5.5 },
    question: "Đoạn âm thanh này có gì? (câu ví dụ)",
    hint: { object: "đoạn có tiếng bíp (khoảng giây 0–2)" },
  },
  video: {
    fileUrl: "/huong-dan/video-mau.mp4",
    content: null,
    metadata: { durationSec: 4, fps: 10, width: 320, height: 240 },
    question: "Trong video có vật gì đang chuyển động? (câu ví dụ)",
    hint: { object: "chiếc xe màu đỏ đang chạy" },
  },
  pair: {
    fileUrl: null,
    content: {
      a: "Ánh sáng xanh có bước sóng ngắn nên bị các phân tử khí tán xạ mạnh hơn các màu khác, vì vậy ta thấy bầu trời màu xanh.",
      b: "Vì trời xanh.",
    },
    metadata: {},
    question: "Câu trả lời nào giải thích rõ hơn vì sao bầu trời có màu xanh?",
    hint: {},
  },
  list: {
    fileUrl: null,
    content: { items: ["Phở bò", "Bánh mì trứng", "Lẩu thái", "Kem que"] },
    metadata: { itemCount: 4 },
    question: "Xếp các món theo mức phù hợp cho bữa sáng.",
    hint: {},
  },
};
