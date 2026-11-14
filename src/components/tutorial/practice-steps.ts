import type { LabelData, LabelSchema, Tool, ToolKind } from "@/lib/types";
import type { TrackObj } from "@/components/labeling/schema";
import type { DemoSample } from "./demo-samples";

/**
 * Một bước của màn luyện tập. Bước có `check` là NHIỆM VỤ: nút "Tiếp" chỉ mở khi người dùng đã thao tác
 * xong trên câu ví dụ (giống màn hướng dẫn trong game). Bước không có `check` chỉ để đọc.
 */
export type PracticeStep = {
  key: string;
  title: string;
  body: string;
  /** Mẹo thao tác thêm (phím tắt...). */
  tip?: string;
  /** Công cụ được làm nổi ở cột bên phải. */
  tool?: string;
  check?: (data: LabelData) => boolean;
};

function list(data: LabelData, name: string): unknown[] {
  const v = data[name];
  return Array.isArray(v) ? v : [];
}

function lop(t: Tool): string {
  return t.classes && t.classes.length > 0 ? `, chọn lớp (ví dụ “${t.classes[0]}”)` : "";
}

function thuocTinh(t: Tool): string | undefined {
  const bat = (t.attributes ?? []).filter((a) => a.required);
  if (bat.length === 0) return undefined;
  return `Đối tượng có thuộc tính bắt buộc (${bat.map((a) => a.name).join(", ")}): sau khi tạo, điền ở thẻ đối tượng trong danh sách của ô “${t.name}”.`;
}

/** Nhiệm vụ cho MỘT công cụ — lời nhắc dùng tên công cụ / lớp thật của dự án và chỗ cần nhìn trong câu ví dụ. */
function buoc(t: Tool, demo: DemoSample): PracticeStep | null {
  const chon = `Bấm vào ô “${t.name}” ở cột bên phải để chọn công cụ${lop(t)}`;
  const h = demo.hint;
  switch (t.kind) {
    case "classification":
      return {
        key: t.name,
        tool: t.name,
        title: "Chọn lớp",
        body: t.allowMultiple
          ? `Ở ô “${t.name}”, bấm chọn những lớp đúng với câu hỏi — được chọn nhiều lớp.`
          : `Ở ô “${t.name}”, bấm chọn MỘT lớp đúng với câu hỏi${t.classes?.length ? ` (ví dụ “${t.classes[0]}”)` : ""}.`,
        tip: "Bấm lại lớp đã chọn để bỏ chọn.",
        check: (d) => {
          const ids = ((d[t.name] as { labelIds?: string[] } | undefined)?.labelIds ?? []).length;
          return t.allowMultiple ? ids >= 1 : ids === 1;
        },
      };
    case "freeText":
      return {
        key: t.name,
        tool: t.name,
        title: "Viết câu trả lời",
        body: `Gõ câu trả lời của bạn vào ô “${t.name}” (ít nhất vài chữ).`,
        tip: "Câu trả lời mở được chấm theo NGHĨA, không cần giống người khác từng chữ.",
        check: (d) => (((d[t.name] as { text?: string } | undefined)?.text ?? "").trim().length >= 3),
      };
    case "transcription":
      return {
        key: t.name,
        tool: t.name,
        title: "Chép lại nội dung",
        body: `Xem / nghe mẫu rồi chép lại nội dung vào ô “${t.name}”. Ở bài luyện tập này gõ thử vài chữ là được.`,
        check: (d) => (((d[t.name] as { text?: string } | undefined)?.text ?? "").trim().length >= 1),
      };
    case "number": {
      const khoang = t.min != null && t.max != null ? ` trong khoảng ${t.min}–${t.max}` : "";
      return {
        key: t.name,
        tool: t.name,
        title: "Nhập số",
        body: `Nhập một số${khoang} vào ô “${t.name}”${t.integer ? " (số nguyên)" : ""}.`,
        check: (d) => typeof (d[t.name] as { value?: unknown } | undefined)?.value === "number",
      };
    }
    case "pairwise":
      return {
        key: t.name,
        tool: t.name,
        title: "So sánh hai câu trả lời",
        body: `Đọc câu bên trái và bên phải, rồi ở ô “${t.name}” chọn bên tốt hơn${t.allowTie ? " (hoặc hoà nếu ngang nhau)" : ""}.`,
        tip: "Vị trí trái / phải được xáo trộn cho từng người — đừng chọn theo thói quen một bên.",
        check: (d) => !!(d[t.name] as { choice?: string } | undefined)?.choice,
      };
    case "ranking":
      return {
        key: t.name,
        tool: t.name,
        title: "Xếp hạng",
        body: `Ở ô “${t.name}”, giữ biểu tượng ⠿ và kéo các mục để xếp từ tốt nhất (số 1) xuống kém nhất.`,
        check: (d) => ((d[t.name] as { order?: number[] } | undefined)?.order ?? []).length > 0,
      };
    case "bbox":
      return {
        key: t.name,
        tool: t.name,
        title: "Vẽ khung chữ nhật",
        body: `${chon}, rồi kéo chuột trên ảnh để vẽ một khung bao quanh ${h.object ?? "đối tượng"}.`,
        tip: "Bấm vào khung để chọn rồi kéo các góc để chỉnh cỡ. Con lăn chuột để phóng to, Delete để xoá khung đang chọn.",
        check: (d) => list(d, t.name).length >= 1,
      };
    case "polygon":
      return {
        key: t.name,
        tool: t.name,
        title: "Vẽ đa giác",
        body: `${chon}, rồi bấm lần lượt từng đỉnh quanh ${h.region ?? "đối tượng"}. Bấm lại đỉnh đầu (hoặc nhấp đúp / Enter) để khép đa giác.`,
        tip: "Backspace xoá đỉnh vừa bấm, Esc huỷ đa giác đang vẽ.",
        check: (d) => list(d, t.name).length >= 1,
      };
    case "polyline":
      return {
        key: t.name,
        tool: t.name,
        title: "Vẽ đường gấp khúc",
        body: `${chon}, rồi bấm từng điểm dọc theo ${h.line ?? "đường cần đánh dấu"}. Nhấp đúp hoặc Enter để kết thúc.`,
        tip: "Backspace xoá điểm vừa bấm, Esc huỷ.",
        check: (d) => list(d, t.name).length >= 1,
      };
    case "keypoint":
      return {
        key: t.name,
        tool: t.name,
        title: "Đặt điểm mốc",
        body: `${chon}, rồi bấm lên ảnh để đặt một điểm ở ${h.point ?? "vị trí cần đánh dấu"}.`,
        tip: "Kéo điểm để chỉnh vị trí.",
        check: (d) => list(d, t.name).length >= 1,
      };
    case "mask":
      return {
        key: t.name,
        tool: t.name,
        title: "Tô mặt nạ",
        body: `${chon}, rồi giữ chuột và tô lên ${h.object ?? "vùng cần đánh dấu"}. Thả chuột là xong một mặt nạ.`,
        tip: "Chọn một mặt nạ trong danh sách để tô / tẩy tiếp; bỏ chọn để tạo mặt nạ mới.",
        check: (d) => list(d, t.name).length >= 1,
      };
    case "span":
      return {
        key: t.name,
        tool: t.name,
        title: "Đánh dấu đoạn văn bản",
        body: `${chon}, rồi kéo chuột bôi đen một cụm từ trong đoạn văn — ví dụ ${h.phrase ?? "một tên riêng"}.`,
        tip: "Bấm vào đoạn đã đánh dấu để chọn, Delete để xoá.",
        check: (d) => list(d, t.name).length >= 1,
      };
    case "relation":
      return {
        key: t.name,
        tool: t.name,
        title: "Nối quan hệ giữa hai đoạn",
        body: `Cần ít nhất hai đoạn đã đánh dấu bằng “${t.spanTool ?? "công cụ đoạn"}”. Sau đó ở ô “${t.name}” chọn đoạn nguồn, đoạn đích và loại quan hệ rồi bấm thêm.`,
        check: (d) => list(d, t.name).length >= 1,
      };
    case "temporalSegment":
      return {
        key: t.name,
        tool: t.name,
        title: "Đánh dấu đoạn thời gian",
        body: `${chon}, rồi kéo trên thanh thời gian để đánh dấu ${h.object ?? "đoạn cần đánh dấu"}. Cũng có thể bấm phát và dùng nút Bắt đầu / Kết thúc.`,
        check: (d) => list(d, t.name).length >= 1,
      };
    case "track":
      return {
        key: t.name,
        tool: t.name,
        title: "Theo dõi đối tượng qua các khung hình",
        body: `${chon}. Dừng video, kéo để vẽ khung quanh ${h.object ?? "đối tượng"}; tua tới thời điểm khác rồi vẽ lại khung — mỗi lần là một keyframe. Cần ít nhất 2 keyframe.`,
        tip: "Giữa hai keyframe, khung được tự nội suy (nét đứt). Bỏ chọn chuỗi để tạo chuỗi mới.",
        check: (d) => (list(d, t.name) as TrackObj[]).some((x) => (x.keyframes ?? []).length >= 2),
      };
    default:
      return null;
  }
}

/**
 * Các bước luyện tập cho tập nhãn của dự án. `only` = chỉ dạy những loại công cụ này (người dùng đã học các
 * loại khác ở dự án trước); null = dạy hết (bấm "Xem lại hướng dẫn").
 */
export function buildPracticeSteps(schema: LabelSchema, demo: DemoSample, only: ToolKind[] | null): PracticeStep[] {
  // Quan hệ cần đoạn có sẵn → luôn dạy sau các công cụ khác.
  const tools = schema.tools
    .filter((t) => only === null || only.includes(t.kind))
    .slice()
    .sort((a, b) => Number(a.kind === "relation") - Number(b.kind === "relation"));

  const steps: PracticeStep[] = [
    {
      key: "__mo_dau",
      title: "Luyện tập trước khi làm bài",
      body:
        "Bạn sẽ thử từng công cụ của dự án trên một câu ví dụ. Bài luyện tập KHÔNG tính điểm, KHÔNG lưu và không ảnh hưởng bài thật. " +
        "Mỗi bước có một nhiệm vụ — làm xong thì nút “Tiếp” sáng lên. Không muốn xem? Bấm “Bỏ qua hướng dẫn” bất cứ lúc nào.",
    },
    {
      key: "__cau_hoi",
      title: "Đọc câu hỏi trước",
      body:
        "Mỗi ô công cụ ở cột bên phải có một CÂU HỎI nổi bật: nó cho biết dùng công cụ đó để trả lời gì về mẫu. " +
        "Đọc câu hỏi của từng công cụ trước khi gán.",
      tip: "Một số câu có thêm dải “Về mẫu này” ở đầu — đó là ngữ cảnh riêng của mẫu (vd câu hỏi gốc của cặp câu trả lời).",
    },
  ];

  for (const t of tools) {
    const s = buoc(t, demo);
    if (s) {
      const them = thuocTinh(t);
      steps.push(them ? { ...s, tip: s.tip ? `${s.tip} ${them}` : them } : s);
    }
  }

  steps.push({
    key: "__ket_thuc",
    title: "Sẵn sàng làm bài thật!",
    body:
      "Câu trả lời thật được lưu nháp ngay trên máy này; chỉ khi bấm “Nộp bài” cả bài mới được gửi lên — và chỉ nộp được một lần. " +
      "Trong bài có lẫn câu kiểm tra (không phân biệt được), bỏ trống câu sẽ bị tính là không giống đa số. Mỗi câu nhớ đọc câu hỏi trước khi trả lời.",
  });
  return steps;
}
