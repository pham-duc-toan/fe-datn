"use client";

import type { TourStep } from "@/components/tutorial/spotlight-tour";

/**
 * Tour trang cấu hình cho người TẠO dự án (như phần giới thiệu giao diện trong game): mỗi điểm dừng là một vùng
 * `data-tour`, nói rõ thông số làm gì với dự án và labeler thấy ở đâu. Chi tiết từng ô xem ở biểu tượng ⓘ.
 */
export const CREATOR_TOUR: TourStep[] = [
  {
    target: "cfg-checklist",
    title: "Còn thiếu gì để publish",
    body: "Danh sách này luôn ghim ở đầu trang khi dự án còn nháp, ở mọi tab. Còn mục đỏ nào thì chưa publish được; hết mục đỏ thì nút Publish sáng lên.",
  },
  {
    target: "cfg-xem-truoc",
    title: "Xem như labeler",
    body: "Mở bản xem trước dựng từ cấu hình đang soạn: thẻ dự án ở chợ và một câu trong bài (gán thử được). Nên mở sau mỗi lần đổi câu hỏi hay công cụ.",
  },
  {
    target: "cfg-thong-tin",
    title: "Thông tin dự án",
    body: "Tên và mô tả hiện trên thẻ dự án ở chợ. Chế độ tham gia quyết định ai được vào: công khai, cần duyệt đơn, hay chỉ người được mời (riêng tư không hiện ở chợ).",
  },
  {
    target: "cfg-cau-hoi",
    title: "Câu hỏi chung — bắt buộc",
    body: "Labeler thấy câu hỏi này nổi bật trên mẫu ở MỌI câu, nên viết rõ cần trả lời gì (vd “Con vật trong ảnh là gì?”). Mẫu cần hỏi khác thì đặt câu hỏi riêng ở tab Dữ liệu.",
  },
  {
    target: "cfg-cong-cu",
    title: "Công cụ gán nhãn",
    body: "Mỗi công cụ là một cách trả lời (chọn lớp, vẽ khung, bôi đoạn…). Dòng nhắc của công cụ hiện ngay dưới tên công cụ. Lần đầu gặp công cụ nào, labeler được luyện tập trước.",
  },
  {
    target: "cfg-gia",
    title: "Tiền thưởng, số suất, ngưỡng đạt",
    body: "Thưởng × số suất (cộng phí nền tảng) được giữ ký quỹ lúc publish. Bài đạt khi giống đa số từ ngưỡng t trở lên và không sai câu kiểm tra; suất trao theo thứ tự nộp sớm.",
  },
  {
    target: "cfg-kenh",
    title: "Kênh thu thập",
    body: "Kênh chuyên nghiệp đưa dự án lên chợ. Cổng vượt link cho khách giải 1–3 câu khi mở link rút gọn, trả theo nhãn từ ngân sách riêng.",
  },
  {
    target: "cfg-dieu-kien",
    title: "Điều kiện tham gia",
    body: "Cấp độ, uy tín tối thiểu, xác minh danh tính và bài test đầu vào lọc người làm. Chợ dự án chỉ hiện dự án labeler làm được ngay, nên điều kiện càng cao thì càng ít người thấy dự án.",
  },
  {
    target: "cfg-bao-ve",
    title: "Bảo vệ nội dung & NDA",
    body: "Dữ liệu nhạy cảm: chỉ người đã xác minh và đủ tuổi, mẫu được che tới khi bấm hiện. NDA: labeler ký trước khi vào.",
  },
  {
    target: "du-an-tabs",
    title: "Bước tiếp theo",
    body: "Nạp mẫu ở tab Dữ liệu (đặt câu hỏi riêng cho từng mẫu nếu cần), thêm câu kiểm tra ở tab Câu vàng, rồi publish khi danh sách bên trên đã xanh hết. Mỗi ô có biểu tượng ⓘ giải thích chi tiết.",
  },
];
