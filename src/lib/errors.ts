import { ApiError } from "./api";

/** Dịch mã lỗi `code` của backend sang câu hiển thị (tích hợp FE mục 9, 17.11). */
const MESSAGES: Record<string, string> = {
  khong_tim_thay: "Không tìm thấy (hoặc bạn không có quyền với mục này).",
  khong_co_quyen: "Bạn không có quyền thực hiện thao tác này.",
  xung_dot_dong_thoi: "Dữ liệu vừa được người khác thay đổi. Hãy tải lại rồi thử lại.",
  thieu_idempotency_key: "Thiếu khoá chống trùng của giao dịch.",
  loai_du_lieu_khong_hop_le: "Loại dữ liệu không hợp lệ.",
  tap_nhan_sai_dinh_dang: "Tập nhãn sai định dạng.",
  tap_nhan_khong_hop_le: "Tập nhãn không hợp lệ.",
  loai_du_lieu_khong_khop: "Loại dữ liệu của tập nhãn khác loại dữ liệu của dự án.",
  thuong_khong_hop_le: "Tiền thưởng không hợp lệ.",
  thuong_duoi_toi_thieu: "Tiền thưởng mỗi suất thấp hơn mức tối thiểu của nền tảng.",
  so_suat_khong_hop_le: "Số suất nằm ngoài giới hạn cho phép.",
  nguong_dat_ngoai_khoang: "Ngưỡng đạt phải nằm trong khoảng quản trị viên cho phép.",
  nguong_dau_khong_hop_le: "Ngưỡng đạt không hợp lệ.",
  qua_nhieu_cau: "Dự án có quá nhiều câu hỏi.",
  gia_cong_link_khong_hop_le: "Đơn giá cổng link không hợp lệ.",
  ngan_sach_cong_link_qua_nho: "Ngân sách cổng link quá nhỏ.",
  chua_cau_hinh_cong_link: "Bật cổng link thì phải đặt đơn giá và ngân sách cổng link.",
  thieu_deadline: "Cần đặt hạn chót.",
  deadline_da_qua: "Hạn chót đã qua.",
  zip_chi_cho_anh: "Tải ZIP chỉ dùng cho dự án ảnh.",
  khong_phai_zip: "File không phải ZIP.",
  zip_qua_lon: "File ZIP quá lớn.",
  duoi_file_khong_hop_le: "Đuôi file không hợp với loại dữ liệu của dự án.",
  qua_nhieu_file: "Quá nhiều file trong một lần tải lên.",
  dung_luong_khong_hop_le: "Dung lượng file không hợp lệ.",
  manifest_khong_hop_le: "Manifest không hợp lệ.",
  manifest_qua_dai: "Manifest quá dài.",
  mau_khong_thuoc_du_an: "Mẫu không thuộc dự án này.",
  da_la_cau_vang: "Mẫu này đã là câu vàng.",
  qua_nhieu_cau_vang: "Đã vượt số câu vàng tối đa.",
  thieu_nhan: "Thiếu nội dung nhãn.",
  bai_da_nop: "Bài đã nộp — không sửa được nữa.",
  da_nop_bai: "Bạn đã nộp bài cho dự án này.",
  bai_da_ket_thuc: "Bài làm đã kết thúc.",
  bai_da_het_han: "Bài làm đã hết thời gian.",
  bai_chua_nop: "Bài chưa nộp.",
  bai_chua_hop_le: "Có câu trả lời chưa hợp lệ — xem danh sách câu cần sửa.",
  bai_qua_lon: "Bài làm quá lớn.",
  cau_tra_loi_qua_lon: "Câu trả lời quá lớn (tối đa 256 KB).",
  cau_tra_loi_sai_dinh_dang: "Câu trả lời sai định dạng.",
  het_suat: "Dự án đã hết suất làm bài.",
  du_an_da_dong_thu_bai: "Dự án đã đóng thu bài.",
  du_an_khong_nhan_bai: "Dự án hiện không nhận bài.",
  du_an_tam_dung: "Dự án đang tạm dừng — chưa nộp được, bài vẫn được giữ.",
  du_an_chua_co_cau_hoi: "Dự án chưa có câu hỏi.",
  da_yeu_cau_ket_thuc: "Đã yêu cầu kết thúc dự án.",
  chua_cham: "Bài chưa được chấm.",
  bai_da_dat: "Bài đã đạt — không cần khiếu nại.",
  het_han_khieu_nai: "Đã hết hạn khiếu nại.",
  noi_dung_khieu_nai_khong_hop_le: "Nội dung khiếu nại không hợp lệ (tối đa 1000 ký tự).",
  khong_co_khieu_nai_mo: "Bài không có khiếu nại đang chờ.",
  khong_phai_thanh_vien: "Bạn chưa là thành viên dự án này.",
  bi_chan_khoi_du_an: "Bạn đã bị chặn khỏi dự án này.",
  du_an_khong_chay: "Dự án hiện không chạy.",
  du_an_chua_san_sang: "Dự án đang được chuẩn bị, thử lại sau vài giây.",
  da_qua_deadline: "Dự án đã quá hạn chót.",
  chua_du_cap_do: "Chưa đủ cấp độ yêu cầu.",
  chua_du_uy_tin: "Chưa đủ điểm uy tín yêu cầu.",
  khong_mo_kenh_chuyen_nghiep: "Dự án không mở kênh gán nhãn chuyên nghiệp.",
  tai_khoan_bi_khoa: "Tài khoản đã bị khoá, liên hệ quản trị viên.",
  can_lam_test: "Dự án yêu cầu làm bài test đầu vào.",
  du_an_rieng_tu: "Dự án riêng tư.",
  da_la_thanh_vien: "Đã là thành viên dự án.",
  bi_chan: "Đang bị chặn khỏi dự án.",
  can_xin_duyet: "Dự án cần gửi đơn xin tham gia.",
  khong_phai_labeler: "Tài khoản không có vai trò người gán nhãn.",
  ma_moi_het_han: "Mã mời đã hết hạn.",
  ma_moi_het_luot: "Mã mời đã hết lượt dùng.",
  ma_moi_da_thu_hoi: "Mã mời đã bị thu hồi.",
  han_ma_moi_khong_hop_le: "Thời hạn mã mời không hợp lệ.",
  so_luot_khong_hop_le: "Số lượt dùng không hợp lệ.",
  ghi_chu_qua_dai: "Ghi chú quá dài.",
  da_co_don_dang_cho: "Bạn đã có một đơn đang chờ duyệt.",
  chua_duoc_xin_lai: "Chưa đến lúc được gửi đơn lại.",
  khong_can_duyet: "Dự án công khai — bấm Tham gia, không cần gửi đơn.",
  don_da_xu_ly: "Đơn đã được xử lý.",
  loi_nhan_qua_dai: "Lời nhắn quá dài (tối đa 500 ký tự).",
  ly_do_qua_dai: "Lý do quá dài (tối đa 500 ký tự).",
  thieu_thong_tin: "Thiếu thông tin bắt buộc.",
  qua_nhieu_nguoi: "Mời quá số người tối đa trong một lần.",
  khong_the_them_owner: "Không thể thêm chủ dự án.",
  vuot_han_muc_moi_email: "Đã vượt hạn mức mời qua email trong 24 giờ.",
  da_khieu_nai: "Bài đã được khiếu nại.",
  khong_du_so_du: "Số dư khả dụng không đủ.",
  duoi_muc_toi_thieu: "Số tiền dưới mức tối thiểu.",
  so_tien_nap_khong_hop_le: "Số tiền nạp nằm ngoài hạn mức.",
  chuyen_khoan_tat: "Kênh chuyển khoản thủ công đang tắt.",
  lenh_nap_da_chot: "Lệnh nạp đã hoàn tất.",
  khong_phai_chuyen_khoan: "Lệnh này không phải chuyển khoản thủ công.",
  ma_giao_dich_trung: "Mã giao dịch ngân hàng đã dùng cho lệnh khác.",
  lenh_rut_khong_cho_duyet: "Lệnh rút đã được xử lý.",
  thieu_ly_do: "Cần nhập lý do.",
  gia_tri_khong_hop_le: "Giá trị không hợp lệ.",
  thieu_gia_tri: "Thiếu giá trị.",
  url_khong_hop_le: "Địa chỉ URL không hợp lệ.",
  ten_mien_bi_chan: "Tên miền này đang bị chặn.",
  alias_khong_hop_le: "Alias không hợp lệ (3–32 ký tự A-Z, 0-9, _ -).",
  mat_khau_khong_hop_le: "Mật khẩu không hợp lệ.",
  het_han_trong_qua_khu: "Thời điểm hết hạn đã ở quá khứ.",
  qua_nhieu_url: "Quá nhiều URL trong một lần.",
  alias_da_ton_tai: "Alias đã có người dùng.",
  chien_dich_da_ton_tai: "Chiến dịch đã tồn tại.",
  link_da_ngung: "Link đã ngừng hoạt động.",
  khong_duoc_chia_se_link: "Chỉ tài khoản người gán nhãn mới chia sẻ link kiếm tiền.",
  chua_xac_thuc: "Chưa xác thực.",
  ma_gioi_thieu_sai: "Mã giới thiệu không đúng.",
  tu_gioi_thieu: "Không thể tự giới thiệu chính mình.",
  qua_han_nhap_ma: "Đã quá hạn nhập mã giới thiệu.",
  da_co_nguoi_gioi_thieu: "Tài khoản đã có người giới thiệu.",
  gioi_thieu_vong: "Không thể giới thiệu vòng.",
  link_khong_ton_tai: "Link không tồn tại hoặc đã bị gỡ.",
  sai_mat_khau: "Sai mật khẩu.",
  turnstile_that_bai: "Xác minh chống bot thất bại, thử lại.",
  chua_het_dem_nguoc: "Chưa hết thời gian đếm ngược.",
  da_nop: "Đã nộp rồi.",
  thieu_cau_tra_loi: "Hãy trả lời tất cả câu hỏi.",
  phien_het_han: "Bộ câu hỏi đã hết hạn, tải lại trang.",
  token_da_dung: "Link đã được dùng, hãy vượt lại.",
  token_khong_hop_le: "Link mở không hợp lệ hoặc đã hết hạn.",
  xung_dot_setting: "Giá trị mâu thuẫn với một cài đặt khác.",
  dinh_dang_chua_ho_tro: "Định dạng xuất chưa hỗ trợ cho dự án này.",
  coco_chi_cho_khung_anh: "COCO chỉ dành cho dự án ảnh có khung / đa giác / mặt nạ.",
  khung_chi_cho_anh: "Định dạng này chỉ dành cho dự án ảnh có khung.",
  chua_xac_minh_doanh_nghiep: "Doanh nghiệp chưa được xác minh (KYB).",
  ten_doanh_nghiep_khong_hop_le: "Tên doanh nghiệp không hợp lệ.",
  ma_so_thue_khong_hop_le: "Mã số thuế không hợp lệ (10 chữ số, chi nhánh dạng 0123456789-001).",
  dia_chi_khong_hop_le: "Địa chỉ không hợp lệ.",
  file_khong_hop_le: "File không đúng loại cho phép.",
  file_qua_lon: "File quá lớn.",
  ho_so_chua_du: "Hồ sơ chưa khai đủ thông tin.",
  thieu_giay_phep: "Chưa tải lên giấy phép kinh doanh.",
  ho_so_dang_cho_duyet: "Hồ sơ đang chờ duyệt, chưa sửa được.",
  da_xac_minh: "Hồ sơ đã được xác minh.",
  khong_cho_duyet: "Hồ sơ không còn ở trạng thái chờ duyệt.",
  khong_khoa_admin: "Không thể khoá tài khoản quản trị viên.",
  trang_thai_khong_hop_le: "Trạng thái không hợp lệ.",
  loai_bat_buoc: "Loại thông báo này bắt buộc gửi email.",
  loai_khong_hop_le: "Loại không hợp lệ.",
  thieu_tuy_chon: "Thiếu tuỳ chọn.",
  email_da_ton_tai: "Email này đã được đăng ký.",
  sai_thong_tin: "Sai email hoặc mật khẩu.",
  phien_khong_hop_le: "Phiên đăng nhập đã hết hạn, hãy đăng nhập lại.",
  phien_da_bi_thu_hoi: "Phiên đăng nhập đã bị thu hồi, hãy đăng nhập lại.",
  qua_nhieu_yeu_cau: "Bạn thao tác quá nhanh, hãy thử lại sau ít giây.",
  du_lieu_khong_hop_le: "Dữ liệu không hợp lệ.",
  ma_khong_hop_le: "Mã không hợp lệ, đã dùng hoặc đã hết hạn.",
  da_xac_thuc: "Email đã được xác thực.",
  gui_qua_nhanh: "Vừa gửi xong, hãy chờ 60 giây rồi gửi lại.",
  mat_khau_hien_tai_sai: "Mật khẩu hiện tại không đúng.",
  chua_xac_thuc_email: "Bạn cần xác thực email trước.",
  ten_khong_hop_le: "Tên không hợp lệ (1–100 ký tự).",
  gioi_thieu_qua_dai: "Giới thiệu quá dài (tối đa 500 ký tự).",
  key_khong_hop_le: "Khoá file không hợp lệ.",
  chua_tai_anh: "Chưa tải ảnh lên.",
  linh_vuc_khong_hop_le: "Lĩnh vực không hợp lệ.",
  ngon_ngu_khong_hop_le: "Ngôn ngữ không hợp lệ.",
  ky_khong_hop_le: "Kỳ không hợp lệ.",
  id_khong_hop_le: "Mã định danh không hợp lệ.",
  qua_nhieu_id: "Quá nhiều mã định danh.",
  nhap_khong_hop_le: "Bản nháp không hợp lệ.",
  nhap_qua_lon: "Bản nháp quá lớn (tối đa 256 KB).",
  ly_do_khong_hop_le: "Lý do không hợp lệ.",
  thieu_ghi_chu: "Cần nhập ghi chú.",
  hanh_dong_khong_hop_le: "Hành động không hợp lệ.",
  con_nguoi_dang_lam: "Đang có người làm bài, thử lại sau.",
  nhom_khong_hop_le: "Cách nhóm không hợp lệ.",
  khoang_ngay_khong_hop_le: "Khoảng ngày không hợp lệ (tối đa 366 ngày).",
  ho_so_da_xu_ly: "Hồ sơ đã được xử lý.",
  tieu_de_khong_hop_le: "Tiêu đề không hợp lệ.",
  noi_dung_khong_hop_le: "Nội dung không hợp lệ.",
  doi_tuong_khong_hop_le: "Đối tượng nhận không hợp lệ.",
  link_khong_hop_le: "Link xem file không hợp lệ.",
  link_het_han: "Link xem file đã hết hạn.",
  khong_co_file: "File không còn trong kho.",
  anh_hong: "Ảnh hỏng, không hiển thị được.",
  anh_khong_hop_le: "File không phải ảnh hợp lệ.",
  kich_thuoc_khong_hop_le: "Kích thước không hợp lệ.",
  ma_2fa_sai: "Mã xác thực không đúng.",
  het_luot_2fa: "Đã hết lượt nhập mã, hãy đăng nhập lại.",
  cong_cu_khong_hop_cong_link: "Tập nhãn có công cụ không dùng được trên cổng link.",
  ma_da_ton_tai: "Mã đã tồn tại.",
  da_xet: "Đã được xét trước đó.",
  media_hong: "File âm thanh / video hỏng.",
  can_tam_dung_truoc: "Cần tạm dừng dự án trước.",
  chua_the_dong: "Chưa đóng được dự án.",
  dich_vu_khong_san_sang: "Hệ thống tạm thời chưa kiểm được, thử lại sau.",
  du_an_da_ket_thuc: "Dự án đã kết thúc.",
  du_an_chua_dong: "Dự án chưa hoàn thành / huỷ.",
  nhan_sai_dinh_dang: "Nhãn sai định dạng.",
  nhan_khong_hop_le: "Nhãn không hợp lệ.",
  can_dong_y_dieu_khoan: "Bạn cần đọc và đồng ý điều khoản của dự án trước.",
  can_xac_minh_danh_tinh: "Dự án yêu cầu xác minh danh tính.",
  chua_du_tuoi: "Dự án chỉ dành cho người đủ tuổi.",
  loi_moi_het_han: "Lời mời đã hết hạn.",
  loi_moi_da_xu_ly: "Lời mời đã được xử lý.",
  loi_moi_cua_nguoi_khac: "Lời mời thuộc tài khoản khác.",
  chua_dong_y_canh_bao: "Bạn cần đồng ý cảnh báo nội dung của dự án.",
  chua_dong_y_nda: "Bạn cần ký thoả thuận bảo mật (NDA) của dự án.",
  chua_san_sang_publish: "Dự án chưa đủ điều kiện publish — xem checklist.",
  da_bi_chan: "Đã bị chặn.",
  da_co_cau_hoi_vang: "Mẫu đã có câu vàng.",
  chua_cau_hinh_google_drive: "Chưa hỗ trợ nhập từ Google Drive.",
  chua_dong_bo_tam_dung: "Dự án đang được tạm dừng, thử lại sau vài giây.",
};

/** Câu có dấu tiếng Việt — backend viết thông báo cho người dùng bằng tiếng Việt có dấu. */
const VIET = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

/** Lỗi của khung ASP.NET (ràng buộc model) chưa có `code` riêng: dịch các câu tiếng Anh hay gặp. */
function validationMessages(errors: Record<string, string[] | string>): string {
  const out: string[] = [];
  for (const [field, raw] of Object.entries(errors)) {
    for (const m of Array.isArray(raw) ? raw : [raw]) {
      if (VIET.test(m)) out.push(m);
      else if (/required/i.test(m)) out.push(`Thiếu “${field}”.`);
      else out.push(`“${field}” không hợp lệ.`);
    }
  }
  return out.length ? `Dữ liệu gửi lên chưa hợp lệ: ${Array.from(new Set(out)).join(" ")}` : "Dữ liệu gửi lên chưa hợp lệ.";
}

const STATUS_MESSAGE: Record<number, string> = {
  400: "Yêu cầu không hợp lệ.",
  401: "Phiên đăng nhập đã hết hạn, hãy đăng nhập lại.",
  403: "Bạn không có quyền thực hiện thao tác này.",
  404: "Không tìm thấy (hoặc bạn không có quyền với mục này).",
  409: "Thao tác xung đột với trạng thái hiện tại, hãy tải lại trang rồi thử lại.",
  413: "Dữ liệu gửi lên quá lớn.",
  429: "Bạn thao tác quá nhanh, hãy thử lại sau ít giây.",
  502: "Hệ thống đang bận hoặc đang khởi động lại, thử lại sau ít phút.",
  503: "Hệ thống tạm thời chưa sẵn sàng, thử lại sau ít phút.",
  504: "Hệ thống phản hồi quá lâu, thử lại sau.",
};

export function messageForCode(code: string): string | undefined {
  return MESSAGES[code];
}

/**
 * Câu báo lỗi cho người dùng. Thứ tự: câu tiếng Việt có dấu của backend (đầy đủ nhất — chỉ rõ chỗ sai, giới hạn)
 * → bản dịch theo `code` → lỗi ràng buộc model → câu chung theo mã HTTP. Không bao giờ hiện câu không dấu / tiếng Anh
 * thô của hệ thống.
 */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const base = MESSAGES[e.code];
    let msg: string;
    if (e.detail && VIET.test(e.detail)) msg = e.detail;
    else if (base) msg = base;
    else if (e.status === 400 && e.data.errors && typeof e.data.errors === "object") msg = validationMessages(e.data.errors as Record<string, string[]>);
    else msg = STATUS_MESSAGE[e.status] ?? (e.status >= 500 ? "Hệ thống gặp lỗi, thử lại sau." : "Không thực hiện được thao tác.");
    if (e.status >= 500 && e.traceId) msg += ` (mã tra cứu ${e.traceId})`;
    if (e.status === 429 && e.retryAfter) msg += ` Thử lại sau ${e.retryAfter} giây.`;
    return msg;
  }
  // fetch() lỗi mạng: "Failed to fetch" / "NetworkError..." / "Load failed".
  if (e instanceof TypeError && /fetch|network|load failed/i.test(e.message)) return "Không kết nối được máy chủ — kiểm tra mạng rồi thử lại.";
  if (e instanceof DOMException && e.name === "AbortError") return "Yêu cầu đã bị huỷ.";
  if (e instanceof Error && VIET.test(e.message)) return e.message;
  return "Đã có lỗi xảy ra, thử lại sau.";
}

export function isApiError(e: unknown, code?: string): e is ApiError {
  return e instanceof ApiError && (code === undefined || e.code === code);
}
