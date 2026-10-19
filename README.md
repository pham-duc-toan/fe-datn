# Crowd Label — Frontend

Giao diện web của hệ thống gán nhãn dữ liệu cộng đồng (đồ án DATN). Backend nằm ở repo `datn`; hợp đồng API: `datn/docs/tich-hop-frontend.md`.

**Công nghệ:** Next.js 16 (App Router, chạy như SPA) · TypeScript · Tailwind CSS 4 · shadcn/ui (Radix) · TanStack Query · react-konva (canvas gán nhãn) · recharts · dnd-kit.

## Chạy

```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL = gateway (stack demo: http://localhost:18080)
npm run dev                  # http://localhost:5173
npm run build && npm start   # bản production, cũng ở cổng 5173
npm run lint && npm run typecheck
```

Cổng **5173** là cố định: backend sinh link email (`identity.frontend_url`), Return URL VNPay / MoMo và CORS của gateway / MinIO đều trỏ về `http://localhost:5173`.

Tài khoản demo (mật khẩu `Matkhau@123`): `admin@crowd.local`, `doanhnghiep1@crowd.local`, `labeler1@crowd.local`, `reviewer1@crowd.local`.

## Cấu trúc

```
src/
  app/
    (public)/        đăng nhập (2FA), đăng ký (?ref=, ?email=&invitation=; chọn doanh nghiệp / labeler), quên / đặt lại mật khẩu, xác thực email
    (app)/           các trang sau đăng nhập (khung thường)
    (work)/          workspace gán nhãn, duyệt nhãn, bài test (khung rộng)
    g/[code]/        trang vượt link công khai (khách vãng lai, Turnstile)
  components/
    labeling/        workspace gán nhãn dùng chung: canvas ảnh (konva), đoạn văn bản, audio / video + track, các khối công cụ
    project/         các tab của trang dự án (tổng quan, cấu hình, dữ liệu, câu vàng, thành viên, kết quả, chất lượng, báo lỗi)
    layout/          khung ứng dụng theo vai trò, chuông thông báo realtime
    common/          trạng thái tải / lỗi, badge, hộp xác nhận, phân trang, tên người dùng (gom /users/public)
    ui/              shadcn/ui
  lib/
    api.ts           gọi gateway: tự làm mới token (một lần, khoá giữa các tab bằng Web Locks), ProblemDetails → ApiError
    errors.ts        dịch mã lỗi `code` sang tiếng Việt
    tokens.ts        lưu cặp token ở localStorage, đồng bộ tab bằng BroadcastChannel
    labels.ts, format.ts, nav.ts, types.ts
  hooks/             use-action (thao tác ghi + toast), use-realtime (WebSocket thông báo, vé dùng một lần)
```

## Màn hình theo vai trò

| Vai trò | Trang |
|---|---|
| Doanh nghiệp | Tổng quan · Dự án (tạo từ mẫu, cấu hình tập nhãn 15 loại công cụ, hướng dẫn, giá, kênh, điều kiện, NDA, nạp dữ liệu ZIP / upload / JSONL / S3 / URL / Drive, câu vàng, thành viên + mã mời + đơn xin, checklist publish, tiến độ, chi phí, kết quả + xuất JSON / CSV / COCO / YOLO / VOC / MOT / CoNLL, chất lượng, báo lỗi task) · Duyệt nhãn · Ví & nạp (VNPay / MoMo / chuyển khoản) · KYB · Hoá đơn VAT · Tranh chấp · Danh sách labeler |
| Người gán nhãn | Chợ dự án + gợi ý · Chi tiết dự án (đồng ý điều khoản / NDA, tham gia, xin duyệt, bài test) · Workspace (đếm ngược lượt giữ, tự lưu nháp, báo lỗi, nghỉ giải lao) · Việc của tôi (task, lời mời, đơn) · Lịch sử + khiếu nại · Ví, rút tiền, thu nhập · Cấp độ & bảng xếp hạng · Tham gia bằng mã |
| Người gán nhãn — nhóm "Kiếm tiền từ link" (không phải vai trò riêng; doanh nghiệp / admin không có) | Link (tạo lẻ / hàng loạt, chiến dịch) · Thống kê · API rút gọn kiểu link4m (`/links/api-shorten`) + Quick Link · Giới thiệu |
| Admin | Tổng quan + đối soát sổ cái · Hàng đợi duyệt chung · KYB · Xác minh danh tính · Dự án · Khiếu nại · Rút tiền · Nạp chuyển khoản · Tranh chấp · Gian lận · Người dùng · Kiểm duyệt link · Cài đặt hệ thống · Nhật ký audit · Thông báo hệ thống · Mẫu bài toán · Truy watermark · Hoá đơn · Vận hành |
| Mọi vai trò | Thông báo (WebSocket realtime) · Hồ sơ + kỹ năng · Bảo mật (đổi mật khẩu, 2FA, đăng xuất mọi nơi) · Xác minh danh tính · Cài đặt email / ngôn ngữ thông báo |

## Quy ước

- Toạ độ nhãn ảnh theo **pixel ảnh gốc** (`metadata.width × height`), mặt nạ mã hoá RLE theo cột kiểu COCO, đoạn văn bản theo chỉ số UTF-16, thời gian audio / video tính từ đầu đoạn cắt.
- Cặp / danh sách được xáo hiển thị theo `sampleId` để giảm thiên vị, nhưng luôn gửi theo tên / chỉ số gốc.
- API tiền gửi `Idempotency-Key` sinh một lần cho mỗi lần định thao tác; nộp nhãn gửi `X-Device-Id`.
- Link xem file sống 5 phút: lỗi tải file thì gọi lại API đã trả link.
