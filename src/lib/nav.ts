import {
  BadgeCheck, BarChart3, Bell, Briefcase, Building2, ClipboardCheck, Coins, FileText, Gavel, Home, KeyRound, Landmark,
  LayoutTemplate, Link2, ListChecks, Megaphone, PlusCircle, ScrollText, Search, Settings, ShieldAlert, ShieldCheck, Store, Tags, Ticket,
  Trophy, UserCog, Users, Wallet, Wrench, Fingerprint, Receipt, Share2, type LucideIcon,
} from "lucide-react";
import type { Role } from "./types";

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

export const NAV: Record<Role, NavItem[]> = {
  business: [
    { href: "/tong-quan", label: "Tổng quan", icon: Home },
    { href: "/du-an", label: "Dự án của tôi", icon: Briefcase, exact: true },
    { href: "/du-an/moi", label: "Tạo dự án", icon: PlusCircle },
    { href: "/vi", label: "Ví & nạp tiền", icon: Wallet },
    { href: "/doanh-nghiep/kyb", label: "Hồ sơ doanh nghiệp", icon: Building2 },
    { href: "/hoa-don", label: "Hoá đơn VAT", icon: Receipt },
    { href: "/labeler-cua-toi", label: "Danh sách labeler", icon: Users },
  ],
  labeler: [
    { href: "/tong-quan", label: "Tổng quan", icon: Home },
    { href: "/cho", label: "Chợ dự án", icon: Store },
    { href: "/viec-cua-toi", label: "Bài làm của tôi", icon: ListChecks },
    { href: "/vi", label: "Ví & thu nhập", icon: Wallet },
    { href: "/cap-do", label: "Cấp độ & xếp hạng", icon: Trophy },
    { href: "/join", label: "Tham gia bằng mã", icon: Ticket },
  ],
  // Tài khoản cũ đăng ký với vai trò "sharer" (nay không còn là vai trò): các trang link nằm ở linkNav.
  sharer: [
    { href: "/tong-quan", label: "Tổng quan", icon: Home },
    { href: "/vi", label: "Ví & rút tiền", icon: Wallet },
  ],
  admin: [
    { href: "/admin", label: "Tổng quan", icon: Home, exact: true },
    { href: "/admin/duyet", label: "Hàng đợi duyệt", icon: ClipboardCheck },
    { href: "/admin/kyb", label: "Hồ sơ KYB", icon: Building2 },
    { href: "/admin/xac-minh", label: "Xác minh danh tính", icon: Fingerprint },
    { href: "/admin/du-an", label: "Dự án chờ duyệt", icon: Briefcase },
    { href: "/admin/khieu-nai", label: "Khiếu nại bài làm", icon: Gavel },
    { href: "/admin/rut-tien", label: "Duyệt rút tiền", icon: Coins },
    { href: "/admin/nap-tien", label: "Nạp chuyển khoản", icon: Landmark },
    { href: "/admin/gian-lan", label: "Nghi gian lận", icon: ShieldAlert },
    { href: "/admin/nguoi-dung", label: "Người dùng", icon: UserCog },
    { href: "/admin/link", label: "Kiểm duyệt link", icon: Link2 },
    { href: "/admin/cai-dat", label: "Cài đặt hệ thống", icon: Settings },
    { href: "/admin/nhat-ky", label: "Nhật ký audit", icon: ScrollText },
    { href: "/admin/thong-bao", label: "Thông báo hệ thống", icon: Megaphone },
    { href: "/admin/mau", label: "Mẫu bài toán", icon: LayoutTemplate },
    { href: "/admin/the", label: "Thẻ lĩnh vực & ngôn ngữ", icon: Tags },
    { href: "/admin/watermark", label: "Truy watermark", icon: Search },
    { href: "/admin/hoa-don", label: "Hoá đơn", icon: FileText },
    { href: "/admin/van-hanh", label: "Vận hành", icon: Wrench },
  ],
};

/** Vai trò có chức năng chia sẻ link kiếm tiền: labeler (và tài khoản cũ "sharer"). Doanh nghiệp / admin không có. */
export function canShareLinks(role: Role | null): boolean {
  return role === "labeler" || role === "sharer";
}

/** Nhóm "Kiếm tiền từ link" — hiện dưới menu labeler, không phải vai trò riêng. */
export const LINK_NAV: NavItem[] = [
  { href: "/link", label: "Link của tôi", icon: Link2, exact: true },
  { href: "/link/thong-ke", label: "Thống kê link", icon: BarChart3 },
  { href: "/link/api", label: "API rút gọn", icon: KeyRound },
  { href: "/link/gioi-thieu", label: "Giới thiệu bạn bè", icon: Share2 },
];

export const ACCOUNT_NAV: NavItem[] = [
  { href: "/thong-bao", label: "Thông báo", icon: Bell },
  { href: "/tai-khoan/ho-so", label: "Hồ sơ cá nhân", icon: BadgeCheck },
  { href: "/tai-khoan/bao-mat", label: "Bảo mật & 2FA", icon: ShieldCheck },
  { href: "/tai-khoan/xac-minh", label: "Xác minh danh tính", icon: Fingerprint },
  { href: "/tai-khoan/thong-bao", label: "Cài đặt thông báo", icon: Settings },
];

/** Ánh xạ `link` của thông báo (đường dẫn tài nguyên backend) sang trang frontend (mục 14). */
export function mapNotificationLink(link: string | null, role: Role | null): string | null {
  if (!link) return null;
  let m = /^\/attempts\/([0-9a-f-]{36})/.exec(link);
  if (m) return `/bai-lam/${m[1]}`;
  m = /^\/projects\/([0-9a-f-]{36})\/join-requests/.exec(link);
  if (m) return `/du-an/${m[1]}?tab=thanh-vien`;
  m = /^\/projects\/([0-9a-f-]{36})/.exec(link);
  if (m) return role === "business" || role === "admin" ? `/du-an/${m[1]}` : `/cho/${m[1]}`;
  if (link.startsWith("/kyb")) return "/doanh-nghiep/kyb";
  if (link.startsWith("/ledger/withdrawals")) return "/vi?tab=rut-tien";
  if (link.startsWith("/ledger")) return "/vi";
  if (link.startsWith("/annotations")) return "/viec-cua-toi";
  if (link.startsWith("/me/identity")) return "/tai-khoan/xac-minh";
  if (link.startsWith("/me/level")) return "/cap-do";
  if (link.startsWith("/projects/invitations")) return "/viec-cua-toi";
  if (link.startsWith("/me")) return "/tai-khoan/ho-so";
  return null;
}
