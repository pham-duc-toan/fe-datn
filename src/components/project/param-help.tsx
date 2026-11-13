"use client";

import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Giải thích một thông số cho người tạo dự án — như ô "?" cạnh từng tuỳ chọn trong game:
 *   - effect: thông số này làm gì với dự án (tiền, chấm bài, ai được vào...);
 *   - shows : labeler nhìn thấy nó ở đâu (hoặc không thấy).
 */
export type ParamHelp = { effect: string; shows: string };

/** Lời giải thích từng thông số — một chỗ duy nhất, tour và ô ⓘ dùng chung. */
export const PARAM_HELP = {
  name: {
    effect: "Để bạn, labeler và quản trị viên nhận ra dự án.",
    shows: "Tiêu đề thẻ dự án ở chợ, trang dự án, trang làm bài và các thông báo.",
  },
  description: {
    effect: "Giới thiệu dữ liệu và mục đích — giúp labeler quyết định có làm hay không.",
    shows: "Thẻ dự án ở chợ (rút gọn) và trang dự án.",
  },
  visibility: {
    effect: "Công khai: ai đủ điều kiện cũng tự vào. Cần duyệt: labeler gửi đơn, bạn duyệt từng người. Riêng tư: chỉ người được mời hoặc có mã mời.",
    shows: "Dự án công khai và cần duyệt hiện ở chợ; dự án riêng tư chỉ thành viên mới thấy.",
  },
  question: {
    effect: "Bắt buộc trước khi publish. Câu hỏi cho biết labeler phải trả lời gì về mỗi mẫu; mẫu nào có câu hỏi riêng thì dùng câu riêng.",
    shows: "Dòng nổi bật ngay trên mẫu ở MỌI câu trong bài, ở trang dự án trong chợ và trên cổng vượt link.",
  },
  toolHint: {
    effect: "Lưu ý riêng cho một công cụ (vd “khoanh sát mép, kể cả phần bị che”). Không bắt buộc.",
    shows: "Dòng chữ nhỏ ngay dưới tên công cụ ở cột công cụ bên phải.",
  },
  tools: {
    effect: "Quyết định labeler trả lời bằng cách nào (chọn lớp, vẽ khung, bôi đoạn…) và bài được chấm theo đa số của từng công cụ.",
    shows: "Cột công cụ bên phải mẫu. Lần đầu gặp một loại công cụ, labeler được luyện tập trên câu ví dụ trước khi làm.",
  },
  requiredTool: {
    effect: "Bật thì câu nào cũng phải có câu trả lời của công cụ này mới hợp lệ.",
    shows: "Nhãn “Bắt buộc” / “Tuỳ chọn” ở góc ô công cụ.",
  },
  matchThreshold: {
    effect: "Giống tới mức nào thì tính là giống đa số và đúng câu kiểm tra. Cao = khắt khe hơn.",
    shows: "Labeler không thấy con số này.",
  },
  segmentSeconds: {
    effect: "Cắt file dài thành nhiều đoạn — mỗi đoạn là một câu riêng, nên số câu của bài tăng lên.",
    shows: "Mỗi câu chỉ phát đúng một đoạn.",
  },
  reward: {
    effect: "Số tiền một bài ĐẠT nhận được. Tiền thưởng × số suất (cộng phí nền tảng) được giữ ký quỹ lúc publish.",
    shows: "Số tiền nổi bật trên thẻ dự án ở chợ và dòng “Thưởng … nếu đạt” ở đầu trang làm bài.",
  },
  slots: {
    effect: "Số bài đạt được trả thưởng, theo thứ tự nộp sớm nhất. Số người được làm nhiều hơn số suất (theo hệ số của nền tảng) để đa số chắc hơn — người làm thêm không tốn thêm tiền.",
    shows: "“… suất” trên thẻ dự án ở chợ.",
  },
  deadline: {
    effect: "Hết hạn thì dự án tự đóng thu bài và chấm. Mỗi bài có hạn làm riêng, không quá hạn chót của dự án.",
    shows: "Hạn chót ở chợ; đồng hồ đếm ngược ở trang làm bài.",
  },
  passThreshold: {
    effect: "Bài đạt khi tỉ lệ câu giống đa số ≥ ngưỡng này VÀ không sai câu kiểm tra nào.",
    shows: "Dòng “giống đa số ≥ …% và không sai câu kiểm tra” ở đầu trang làm bài.",
  },
  fillSlots: {
    effect: "Khi số bài đạt ít hơn số suất, trao suất còn trống cho bài giống đa số nhiều nhất (vẫn phải đúng hết câu kiểm tra).",
    shows: "Labeler không thấy cài đặt này, chỉ thấy kết quả được thưởng hay không.",
  },
  professional: {
    effect: "Labeler đăng ký trên nền tảng làm cả bài, nhận thưởng khi đạt.",
    shows: "Dự án hiện trong chợ dự án (nếu không phải riêng tư).",
  },
  linkGateway: {
    effect: "Khách mở link rút gọn giải 1–3 câu trước khi được chuyển tiếp; trả theo từng nhãn, tiêu trong ngân sách cổng. Ngân sách không còn đủ thì cổng ngừng lấy câu của dự án.",
    shows: "Trang vượt link: câu hỏi + mẫu + công cụ làm nhanh.",
  },
  gateBudget: {
    effect: "Số tiền tối đa chi cho cổng link — cộng vào ký quỹ, không đụng vào tiền thưởng của labeler.",
    shows: "Labeler và khách không thấy.",
  },
  minLevel: {
    effect: "Người có cấp thấp hơn không vào được dự án.",
    shows: "Chợ dự án chỉ hiện dự án labeler làm được ngay — người chưa đủ cấp không thấy dự án ở chợ.",
  },
  minReputation: {
    effect: "Người có uy tín (0–100) thấp hơn không vào được dự án.",
    shows: "Chợ dự án chỉ hiện dự án labeler làm được ngay — người chưa đủ uy tín không thấy dự án ở chợ.",
  },
  entranceTest: {
    effect: "Phải làm đạt bài test (dùng câu vàng mục đích “bài test”) mới được vào. Đặt số câu và điểm đạt.",
    shows: "Nút “Làm bài test” ở trang dự án trước khi tham gia.",
  },
  sensitive: {
    effect: "Chỉ nhận người đã xác minh danh tính và đủ tuổi; phải đồng ý cảnh báo trước khi vào.",
    shows: "Hộp cảnh báo ở trang dự án; mẫu được che cho tới khi bấm hiện.",
  },
  nda: {
    effect: "Labeler phải ký thoả thuận bảo mật trước khi vào dự án. Đổi văn bản là ra phiên bản mới.",
    shows: "Hộp NDA ở trang dự án, ký bằng họ tên.",
  },
  verifiedIdentity: {
    effect: "Chỉ người đã xác minh danh tính (CCCD) được vào.",
    shows: "Nhãn “Cần xác minh” trên thẻ dự án ở chợ.",
  },
  tags: {
    effect: "Labeler có thẻ lĩnh vực / ngôn ngữ trùng sẽ được gợi ý dự án này.",
    shows: "Mục “Gợi ý cho bạn” của labeler.",
  },
  retention: {
    effect: "Đồng ý để hệ thống xoá file gốc khi dự án đóng quá thời hạn giữ.",
    shows: "Labeler không thấy.",
  },
  sampleQuestion: {
    effect: "Thay câu hỏi chung cho riêng mẫu này. Cùng nội dung nhưng câu hỏi khác nhau là hai mẫu khác nhau.",
    shows: "Dòng câu hỏi trên mẫu ở câu đó.",
  },
} satisfies Record<string, ParamHelp>;

export type ParamKey = keyof typeof PARAM_HELP;

/** Ô ⓘ cạnh tên thông số: bấm để xem tác dụng + chỗ labeler thấy. */
export function HelpTip({ k, className }: { k: ParamKey; className?: string }) {
  const h = PARAM_HELP[k];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex size-4 items-center justify-center rounded-full align-middle text-muted-foreground hover:text-primary ${className ?? ""}`}
          aria-label="Thông số này có tác dụng gì"
        >
          <Info className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-2 text-sm" align="start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tác dụng với dự án</p>
          <p className="leading-5">{h.effect}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Labeler thấy ở đâu</p>
          <p className="leading-5">{h.shows}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
