"use client";

import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TOOL_LABEL, TOOLS_BY_MODALITY } from "@/lib/labels";
import type { Modality, ToolKind } from "@/lib/types";

type Guide = { what: string; when: string; example: string; grading: string };

/** Mô tả từng loại công cụ — dùng chung cho popup hướng dẫn và gợi ý ngắn trong trình soạn tập nhãn. */
export const TOOL_GUIDE: Record<ToolKind, Guide> = {
  classification: {
    what: "Labeler chọn một (hoặc nhiều) lớp có sẵn cho cả mẫu.",
    when: "Câu hỏi có đáp án cố định: loại phương tiện, cảm xúc của câu, ảnh có/không có người…",
    example: "Ảnh giao thông → lớp: ô tô, xe máy, xe đạp. Bật “Cho chọn nhiều lớp” nếu một ảnh có thể vừa ô tô vừa xe máy.",
    grading: "Giống đa số khi chọn cùng lớp (nhiều lớp: cùng tập lớp).",
  },
  freeText: {
    what: "Labeler tự gõ câu trả lời ngắn.",
    when: "Câu hỏi mở không liệt kê trước được đáp án: mô tả ảnh, tóm tắt đoạn văn, gợi ý tiêu đề.",
    example: "“Mô tả ngắn hành động trong ảnh” → “Hai người đang đá bóng trên sân cỏ”.",
    grading: "So nghĩa giữa các câu (phân tích ngữ nghĩa khi dự án kết thúc) — chấm và trả công lâu hơn các dạng khác.",
  },
  number: {
    what: "Labeler nhập một con số trong khoảng cho trước.",
    when: "Đếm số lượng, chấm điểm theo thang, ước lượng tuổi / giá.",
    example: "“Có bao nhiêu người trong ảnh?” — Nhỏ nhất 0, Lớn nhất 50, Số nguyên, Lệch cho phép 1 (đếm 7 hay 8 đều tính là giống).",
    grading: "Giống nhau khi chênh lệch không quá “Lệch cho phép”.",
  },
  bbox: {
    what: "Kéo khung chữ nhật bao quanh từng đối tượng, gắn lớp cho mỗi khung.",
    when: "Phát hiện vật thể: xe, người, biển báo, khuôn mặt.",
    example: "Lớp: ô tô, người đi bộ. Labeler kéo một khung quanh mỗi xe và mỗi người trong ảnh.",
    grading: "Khung khớp khi độ chồng lấp IoU ≥ ngưỡng (0,5 = chồng nhau ít nhất một nửa).",
  },
  polygon: {
    what: "Bấm từng điểm để vẽ đa giác ôm sát đường viền đối tượng.",
    when: "Cần hình dạng chính xác hơn khung: mái nhà, ruộng, khối u, vết nứt rộng.",
    example: "Ảnh vệ tinh → vẽ đa giác quanh từng toà nhà, lớp “nhà ở” / “nhà xưởng”.",
    grading: "Khớp khi IoU ≥ ngưỡng (0,5 = chồng nhau một nửa).",
  },
  keypoint: {
    what: "Đặt từng điểm mốc lên vị trí cụ thể.",
    when: "Khớp xương người, điểm trên khuôn mặt, góc biển số.",
    example: "Lớp: mắt trái, mắt phải, mũi. Labeler bấm đúng ba vị trí đó trên mặt.",
    grading: "Khớp khi lệch nhỏ so với kích thước ảnh (0,98 = lệch tối đa 2% đường chéo ảnh).",
  },
  polyline: {
    what: "Vẽ đường gấp khúc (không khép kín).",
    when: "Làn đường, dây điện, vết nứt mảnh, đường biên.",
    example: "Ảnh camera hành trình → vẽ một đường dọc theo mỗi vạch kẻ làn.",
    grading: "Khớp khi độ lệch trung bình nhỏ (càng gần 1 càng phải sát nhau).",
  },
  mask: {
    what: "Tô bằng cọ từng điểm ảnh thuộc đối tượng.",
    when: "Phân vùng chi tiết từng pixel: tóc, bầu trời, vùng tổn thương.",
    example: "Lớp “bầu trời”: tô toàn bộ phần trời trong ảnh phong cảnh.",
    grading: "Khớp khi IoU vùng tô ≥ ngưỡng (0,5 = vùng tô trùng nhau một nửa).",
  },
  span: {
    what: "Bôi đen đoạn chữ trong văn bản và gắn lớp (nhận dạng thực thể — NER).",
    when: "Trích tên người, địa điểm, tổ chức, ngày tháng, sản phẩm.",
    example: "“Anh Nam làm ở Hà Nội” → bôi “Nam” lớp TÊN_NGƯỜI, “Hà Nội” lớp ĐỊA_ĐIỂM.",
    grading: "So theo F1 các đoạn (1,0 = phải trùng hoàn toàn).",
  },
  relation: {
    what: "Nối hai đoạn đã bôi (của một công cụ Đoạn văn bản) bằng một quan hệ.",
    when: "Quan hệ giữa thực thể: “làm việc tại”, “là vợ/chồng của”, “nguyên nhân của”.",
    example: "Nối “Nam” → “Hà Nội” với quan hệ “sống ở”. Cần có trước một công cụ Đoạn văn bản và chọn nó ở “Công cụ đoạn gốc”.",
    grading: "So theo F1 các quan hệ (1,0 = phải trùng hoàn toàn).",
  },
  transcription: {
    what: "Gõ lại nội dung nghe / nhìn thấy.",
    when: "Chép lời âm thanh, chữ trong ảnh (OCR), biển số.",
    example: "Đoạn ghi âm 10 giây → labeler gõ lại đúng lời nói.",
    grading: "So tỉ lệ ký tự sai (CER): ngưỡng 0,1 = sai tối đa 10% ký tự vẫn tính là giống.",
  },
  temporalSegment: {
    what: "Đánh dấu khoảng thời gian (bắt đầu – kết thúc) trên âm thanh / video, gắn lớp.",
    when: "Ai đang nói, đoạn có nhạc, lúc xảy ra hành động.",
    example: "Lớp “người nói A”, “người nói B”: kéo các đoạn tương ứng trên thanh thời gian.",
    grading: "Khớp khi đoạn chồng nhau IoU ≥ ngưỡng (0,5 = chồng nhau một nửa).",
  },
  track: {
    what: "Theo một đối tượng qua nhiều khung hình video bằng chuỗi khung chữ nhật.",
    when: "Theo dõi xe, người chạy qua camera.",
    example: "Lớp “xe máy”: khoanh chiếc xe ở các khung hình then chốt, hệ thống nội suy ở giữa.",
    grading: "Khớp khi IoU theo thời gian ≥ ngưỡng (0,5 = chồng nhau một nửa).",
  },
  pairwise: {
    what: "Labeler chọn phương án tốt hơn giữa A và B (có thể cho “ngang nhau”).",
    when: "So sánh hai câu trả lời của mô hình AI, hai bản dịch, hai ảnh.",
    example: "Câu hỏi + hai câu trả lời → chọn câu trả lời hay hơn.",
    grading: "Giống đa số khi chọn cùng phương án.",
  },
  ranking: {
    what: "Kéo thả để xếp các mục theo thứ tự.",
    when: "Xếp hạng kết quả tìm kiếm, mức độ liên quan, độ ưu tiên.",
    example: "5 kết quả tìm kiếm → xếp từ liên quan nhất tới ít liên quan nhất.",
    grading: "So theo tỉ lệ cặp mục xếp cùng thứ tự (Kendall; 0,8 = 80% cặp cùng thứ tự).",
  },
};

/** Giải thích các trường trong trình soạn tập nhãn. */
export const FIELD_GUIDE: { name: string; text: string; example?: string }[] = [
  { name: "Loại công cụ", text: "Cách labeler trả lời câu hỏi này (chọn lớp, vẽ khung, gõ chữ…). Mỗi công cụ là một câu hỏi trên màn hình gán nhãn, theo đúng thứ tự." },
  { name: "Bắt buộc", text: "Bật thì labeler phải trả lời câu này mới nộp được bài. Tắt khi câu có thể bỏ trống (vd ảnh không có vật thể nào để khoanh)." },
  { name: "Các lớp", text: "Danh sách nhãn labeler được chọn, mỗi dòng một lớp. Phân loại cần ít nhất 2 lớp.", example: "ô tô\nxe máy\nxe đạp" },
  { name: "Cho chọn nhiều lớp", text: "Chỉ với Phân loại: labeler chọn được nhiều lớp cho một mẫu." },
  { name: "Tối thiểu / Tối đa", text: "Số đối tượng labeler phải vẽ / bôi trong một mẫu. Trống = không giới hạn.", example: "Tối thiểu 1: mỗi ảnh phải có ít nhất một khung." },
  { name: "Ngưỡng khớp (0–1)", text: "Hai câu trả lời giống nhau tới mức nào thì tính là “giống đa số”. Cao hơn = khắt khe hơn.", example: "Khung chữ nhật 0,7: hai khung phải chồng nhau ít nhất 70%." },
  { name: "Độ dài tối đa", text: "Số ký tự tối đa labeler được gõ (Câu trả lời mở, Chép lại nội dung)." },
  { name: "Nhỏ nhất / Lớn nhất / Lệch cho phép / Số nguyên", text: "Với Số / thang điểm: khoảng giá trị hợp lệ, mức chênh vẫn tính là giống, và có bắt buộc số nguyên không.", example: "Thang điểm 1–5, Số nguyên, Lệch cho phép 0." },
  { name: "Khung xoay được", text: "Với Khung chữ nhật: cho khung xoay nghiêng theo vật thể (vd chữ, xe chụp chéo)." },
  { name: "Cho chọn “ngang nhau”", text: "Với So sánh cặp: cho phép trả lời hai phương án tốt như nhau." },
  { name: "Thuộc tính của từng đối tượng", text: "Câu hỏi phụ cho MỖI khung / đa giác / đoạn labeler vẽ: chữ, lựa chọn, có/không, số.", example: "Khung “ô tô” kèm thuộc tính “màu” (lựa chọn: trắng, đen, đỏ) và “bị che khuất” (có/không)." },
  { name: "Công cụ đoạn gốc", text: "Với Quan hệ giữa đoạn: công cụ Đoạn văn bản mà quan hệ nối các đoạn của nó." },
  { name: "Cắt file dài thành đoạn", text: "Âm thanh / video: cắt mỗi file thành các đoạn N giây, mỗi đoạn là một câu riêng. Trống = mỗi file một câu.", example: "File 5 phút, cắt 30 giây → 10 câu." },
];

export function ToolGuideDialog({ modality }: { modality: Modality }) {
  const kinds = TOOLS_BY_MODALITY[modality];
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <BookOpen /> Hướng dẫn các loại công cụ
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Hướng dẫn soạn tập nhãn</DialogTitle>
          <DialogDescription>Mỗi công cụ là một câu hỏi labeler trả lời cho mỗi mẫu. Kết quả được chấm bằng cách so với đa số labeler khác.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="cong-cu">
          <TabsList>
            <TabsTrigger value="cong-cu">Các loại công cụ</TabsTrigger>
            <TabsTrigger value="truong">Các trường cấu hình</TabsTrigger>
          </TabsList>
          <TabsContent value="cong-cu" className="space-y-3">
            {kinds.map((k) => {
              const g = TOOL_GUIDE[k];
              return (
                <div key={k} className="space-y-1 rounded-md border p-3 text-sm">
                  <p className="font-medium">{TOOL_LABEL[k]}</p>
                  <p>{g.what}</p>
                  <p className="text-muted-foreground">
                    <b>Dùng khi:</b> {g.when}
                  </p>
                  <p className="rounded bg-muted/60 p-2">
                    <b>Ví dụ:</b> {g.example}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <b>Chấm:</b> {g.grading}
                  </p>
                </div>
              );
            })}
          </TabsContent>
          <TabsContent value="truong" className="space-y-3">
            {FIELD_GUIDE.map((f) => (
              <div key={f.name} className="space-y-1 rounded-md border p-3 text-sm">
                <p className="font-medium">{f.name}</p>
                <p>{f.text}</p>
                {f.example && <p className="rounded bg-muted/60 p-2 whitespace-pre-line">Ví dụ: {f.example}</p>}
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
