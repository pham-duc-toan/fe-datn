import type { Modality, ToolKind } from "./types";

export type Tone = "default" | "success" | "warning" | "danger" | "info" | "muted";
type Entry = [string, Tone];

function pick(map: Record<string, Entry>, key: string | null | undefined): Entry {
  if (!key) return ["—", "muted"];
  return map[key] ?? [key, "muted"];
}

export const ROLE_LABEL: Record<string, string> = {
  business: "Doanh nghiệp",
  labeler: "Người gán nhãn",
  sharer: "Người chia sẻ link",
  admin: "Quản trị viên",
};

export const MODALITY_LABEL: Record<Modality, string> = {
  image: "Ảnh",
  text: "Văn bản",
  audio: "Âm thanh",
  video: "Video",
  pair: "So sánh cặp",
  list: "Danh sách",
};

export const TOOL_LABEL: Record<ToolKind, string> = {
  classification: "Phân loại",
  freeText: "Câu trả lời mở",
  number: "Số / thang điểm",
  bbox: "Khung chữ nhật",
  polygon: "Đa giác",
  keypoint: "Điểm mốc",
  polyline: "Đường gấp khúc",
  mask: "Mặt nạ (cọ tô)",
  span: "Đoạn văn bản (NER)",
  relation: "Quan hệ giữa đoạn",
  transcription: "Chép lại nội dung",
  temporalSegment: "Đoạn thời gian",
  track: "Theo dõi đối tượng",
  pairwise: "So sánh cặp",
  ranking: "Xếp hạng",
};

/** Công cụ dùng được với loại dữ liệu nào (mục 4.4). */
export const TOOLS_BY_MODALITY: Record<Modality, ToolKind[]> = {
  image: ["classification", "freeText", "number", "bbox", "polygon", "keypoint", "polyline", "mask", "transcription"],
  text: ["classification", "freeText", "number", "span", "relation"],
  audio: ["classification", "freeText", "number", "transcription", "temporalSegment"],
  video: ["classification", "freeText", "number", "transcription", "temporalSegment", "track"],
  pair: ["classification", "freeText", "number", "pairwise"],
  list: ["classification", "freeText", "number", "ranking"],
};

/** Dạng gán nhãn của dự án (mỗi loại công cụ một lần), vd "Phân loại · Khung chữ nhật". */
export function toolKindsText(kinds: ToolKind[] | null | undefined): string {
  return (kinds ?? []).map((k) => TOOL_LABEL[k] ?? k).join(" · ");
}

export const LIST_TOOLS: ToolKind[] = ["bbox", "polygon", "keypoint", "polyline", "mask", "span", "relation", "temporalSegment", "track"];
export const CLASS_TOOLS: ToolKind[] = ["classification", ...LIST_TOOLS];
export const NO_CLASS_TOOLS: ToolKind[] = ["transcription", "freeText", "number", "pairwise", "ranking"];

export const PROJECT_STATUS: Record<string, Entry> = {
  draft: ["Nháp", "muted"],
  pendingEscrow: ["Đang ký quỹ", "info"],
  pendingApproval: ["Chờ admin duyệt", "warning"],
  running: ["Đang chạy", "success"],
  paused: ["Tạm dừng", "warning"],
  grading: ["Đang chấm", "info"],
  completed: ["Hoàn thành", "info"],
  cancelled: ["Đã huỷ", "danger"],
};
export const projectStatus = (s: string | null | undefined) => pick(PROJECT_STATUS, s);

export const VISIBILITY_LABEL: Record<string, string> = {
  public: "Công khai",
  approval: "Cần duyệt đơn",
  private: "Riêng tư",
};

export const ANNOTATION_STATUS: Record<string, Entry> = {
  submitted: ["Chờ chấm", "warning"],
  accepted: ["Vào kết quả", "success"],
  excluded: ["Bị loại (bài trượt)", "danger"],
};
export const annotationStatus = (s: string | null | undefined) => pick(ANNOTATION_STATUS, s);

export const ATTEMPT_STATE: Record<string, Entry> = {
  inProgress: ["Đang làm", "info"],
  submitted: ["Đã nộp", "warning"],
  expired: ["Hết giờ", "muted"],
  cancelled: ["Đã huỷ", "muted"],
};
export const attemptState = (s: string | null | undefined) => pick(ATTEMPT_STATE, s);

export const APPEAL_STATE: Record<string, Entry> = {
  none: ["Không khiếu nại", "muted"],
  open: ["Đang khiếu nại", "warning"],
  accepted: ["Khiếu nại được chấp nhận", "success"],
  rejected: ["Khiếu nại bị bác", "danger"],
};
export const appealState = (s: string | null | undefined) => pick(APPEAL_STATE, s);

/** Giai đoạn của dự án ở task-svc (thu bài → chấm → khiếu nại → chốt). */
export const PROJECT_PHASE: Record<string, Entry> = {
  open: ["Đang nhận bài", "success"],
  finished: ["Đã đóng thu bài — đang chấm", "info"],
  graded: ["Đã chấm — trong hạn khiếu nại", "warning"],
  settled: ["Đã chốt kết quả", "muted"],
};
export const projectPhase = (s: string | null | undefined) => pick(PROJECT_PHASE, s);
/** Đã đóng thu bài nhưng còn chờ phân tích câu trả lời mở (kiến trúc 3.19). */
export const PHASE_ANALYZING: Entry = ["Đang phân tích câu trả lời mở", "info"];
export const phaseOf = (s: string | null | undefined, freeText: boolean) =>
  s === "finished" && freeText ? PHASE_ANALYZING : projectPhase(s);

export const FINISH_REASON: Record<string, string> = {
  du_suat: "đủ suất",
  het_han: "hết hạn chót",
  ket_thuc_som: "chủ dự án kết thúc sớm",
};

export const DEPOSIT_STATUS: Record<string, Entry> = {
  pending: ["Chờ thanh toán", "warning"],
  awaitingApproval: ["Chờ đối chiếu", "info"],
  succeeded: ["Thành công", "success"],
  failed: ["Thất bại", "danger"],
  rejected: ["Bị từ chối", "danger"],
  expired: ["Hết hạn", "muted"],
};
export const depositStatus = (s: string | null | undefined) => pick(DEPOSIT_STATUS, s);

export const WITHDRAWAL_STATE: Record<string, Entry> = {
  pendingApproval: ["Đang chờ duyệt", "warning"],
  requested: ["Đang chuyển", "info"],
  completed: ["Đã chuyển", "success"],
  failed: ["Thất bại", "danger"],
  rejected: ["Bị từ chối", "danger"],
};
export const withdrawalState = (s: string | null | undefined) => pick(WITHDRAWAL_STATE, s);

export const KYB_STATUS: Record<string, Entry> = {
  draft: ["Chưa nộp", "muted"],
  submitted: ["Chờ duyệt", "warning"],
  verified: ["Đã xác minh", "success"],
  rejected: ["Bị từ chối", "danger"],
};
export const kybStatus = (s: string | null | undefined) => pick(KYB_STATUS, s);

export const DATASET_STATUS: Record<string, Entry> = {
  pending: ["Chờ xử lý", "warning"],
  ingesting: ["Đang nạp", "info"],
  ready: ["Sẵn sàng", "success"],
  failed: ["Thất bại", "danger"],
};
export const datasetStatus = (s: string | null | undefined) => pick(DATASET_STATUS, s);

export const LINK_STATUS: Record<string, Entry> = {
  pendingScan: ["Đang kiểm tra", "warning"],
  active: ["Đang chạy", "success"],
  blocked: ["Bị chặn", "danger"],
  disabled: ["Đã tắt", "muted"],
};
export const linkStatus = (s: string | null | undefined) => pick(LINK_STATUS, s);

export const GENERIC_STATUS: Record<string, Entry> = {
  pending: ["Đang chờ", "warning"],
  waiting: ["Chờ ký quỹ", "info"],
  approved: ["Đã duyệt", "success"],
  rejected: ["Từ chối", "danger"],
  cancelled: ["Đã huỷ", "muted"],
  resolved: ["Đã xử lý", "success"],
  accepted: ["Đã chấp nhận", "success"],
  declined: ["Đã từ chối", "muted"],
  revoked: ["Đã thu hồi", "muted"],
  expired: ["Hết hạn", "muted"],
  exhausted: ["Hết lượt", "muted"],
  active: ["Hoạt động", "success"],
  blocked: ["Bị khoá", "danger"],
  open: ["Đang mở", "warning"],
  dismissed: ["Bỏ qua", "muted"],
  confirmed: ["Xác nhận", "danger"],
  excluded: ["Đã loại", "danger"],
  draft: ["Nháp", "muted"],
  submitted: ["Chờ duyệt", "warning"],
  verified: ["Đã xác minh", "success"],
};
export const genericStatus = (s: string | null | undefined) => pick(GENERIC_STATUS, s);

/** Mã thiếu ở checklist publish (mục 4.8). */
export const READINESS_LABEL: Record<string, string> = {
  chua_co_tap_nhan: "Chưa có tập nhãn",
  chua_co_huong_dan: "Chưa có hướng dẫn",
  chua_cau_hinh_gia: "Chưa cấu hình tiền thưởng / số suất / ngưỡng đạt",
  chua_co_du_lieu: "Chưa có dữ liệu",
  du_lieu_dang_xu_ly: "Dữ liệu đang xử lý",
  video_dang_chuan_bi: "Video đang được chuẩn bị (mã hoá lại để gắn watermark) — chờ xong mới publish được",
  deadline_da_qua: "Hạn chót đã qua",
  thieu_cau_hoi_vang_cho_test: "Thiếu câu vàng cho bài test đầu vào",
  thuong_duoi_toi_thieu: "Tiền thưởng mỗi suất dưới mức tối thiểu",
  so_suat_khong_hop_le: "Số suất nằm ngoài giới hạn",
  nguong_dat_ngoai_khoang: "Ngưỡng đạt nằm ngoài khoảng cho phép",
  qua_nhieu_cau: "Quá nhiều câu hỏi cho một bài",
  chua_cau_hinh_cong_link: "Cổng link chưa có đơn giá / ngân sách",
  cong_cu_khong_hop_cong_link: "Có công cụ không dùng được trên cổng link",
  thieu_cau_vang_cong_link: "Cổng link cần câu vàng kiểm tra chất lượng",
};

/** Cảnh báo ở checklist (không chặn publish). */
export const READINESS_WARNING: Record<string, string> = {
  cham_cau_tra_loi_mo_lau:
    "Có câu trả lời mở: khi dự án kết thúc, hệ thống phải phân tích ngữ nghĩa từng câu nên chấm và trả công cho labeler lâu hơn các dạng khác.",
  video_khong_xu_ly_duoc: "Có video hỏng, hệ thống không xử lý được — labeler có thể không xem được các video này (xem tab Dữ liệu).",
};

export const REPORT_REASON: Record<string, string> = {
  broken: "Mẫu hỏng / không mở được",
  inappropriate: "Nội dung không phù hợp",
  unclear: "Không rõ cách gán",
  other: "Lý do khác",
};

export const HISTORY_ACTION: Record<string, string> = {
  submitted: "Nộp trong bài",
  accepted: "Vào kết quả (bài đạt)",
  excluded: "Bị loại (bài trượt)",
  appeal_accepted: "Vào kết quả sau khiếu nại",
};

export const APPROVAL_KIND: Record<string, string> = {
  kyb: "Hồ sơ doanh nghiệp",
  identity: "Xác minh danh tính",
  project: "Dự án",
  withdrawal: "Rút tiền",
  appeal: "Khiếu nại bài làm",
  link: "Báo cáo link",
  referral: "Giới thiệu nghi lạm dụng",
};

export const FRAUD_TYPE: Record<string, string> = {
  qua_nhanh: "Làm quá nhanh",
  mot_nhan_lien_tuc: "Chọn một lớp liên tục",
  chung_ip: "Nhiều tài khoản chung IP",
  chung_thiet_bi: "Nhiều tài khoản chung thiết bị",
};

export const GATE_OUTCOME: Record<string, string> = {
  tinhTien: "Tính tiền",
  truotCauVang: "Trượt câu vàng",
  trungIp: "Trùng IP",
  tuVuot: "Tự vượt link của mình",
  hetNganSach: "Hết ngân sách",
  khongCoCauHoi: "Không có câu hỏi",
};

export const EARNING_KIND: Record<string, string> = {
  projectReward: "Thưởng bài đạt",
  annotation: "Gán nhãn (cũ)",
  gateClick: "Cổng link",
  referral: "Giới thiệu",
};

export const PROVIDER_LABEL: Record<string, string> = {
  sandbox: "Cổng thử nghiệm",
  vnpay: "VNPay",
  momo: "MoMo",
  manual_transfer: "Chuyển khoản ngân hàng",
};

export const MEMBER_ROLE: Record<string, string> = { owner: "Chủ dự án", labeler: "Người gán nhãn", reviewer: "Người duyệt" };
