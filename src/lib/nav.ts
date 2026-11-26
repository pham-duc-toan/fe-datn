import {
  BadgeCheck, BarChart3, Bell, Briefcase, Building2, ClipboardCheck, Coins, FileText, Gavel, Heart, Home, KeyRound, Landmark,
  LayoutTemplate, Link2, ListChecks, Megaphone, PlusCircle, ScrollText, Search, Settings, ShieldAlert, ShieldCheck, Store, Tags, Ticket,
  Trophy, UserCog, Users, Wallet, Fingerprint, Receipt, Share2, type LucideIcon,
} from "lucide-react";
import type { Role } from "./types";

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

/**
 * Một nhóm menu. title rỗng = không có tiêu đề (mục "Tổng quan" đầu menu). collapsed = nhóm ÍT DÙNG: thu gọn mặc
 * định, nằm cuối menu, tự mở khi đang ở một trang trong nhóm.
 */
export type NavGroup = { title?: string; items: NavItem[]; collapsed?: boolean };

/** Nhóm "Kiếm tiền từ link" — labeler (và tài khoản cũ "sharer"), không phải vai trò riêng. */
const LINK_GROUP: NavGroup = {
  title: "Kiếm tiền từ link",
  items: [
    { href: "/link", label: "Link của tôi", icon: Link2, exact: true },
    { href: "/link/thong-ke", label: "Thống kê link", icon: BarChart3 },
    { href: "/link/api", label: "API rút gọn", icon: KeyRound },
    { href: "/link/gioi-thieu", label: "Giới thiệu bạn bè", icon: Share2 },
  ],
};

export const NAV: Record<Role, NavGroup[]> = {
  business: [
    {
      title: "Dự án",
      items: [
        { href: "/du-an", label: "Dự án của tôi", icon: Briefcase, exact: true },
        { href: "/du-an/moi", label: "Tạo dự án", icon: PlusCircle },
        { href: "/labeler-cua-toi", label: "Danh sách labeler", icon: Users },
      ],
    },
    {
      title: "Tài chính",
      items: [
        { href: "/vi", label: "Ví & nạp tiền", icon: Wallet },
        { href: "/hoa-don", label: "Hoá đơn VAT", icon: Receipt },
      ],
    },
    {
      title: "Tài khoản",
      items: [
        { href: "/tai-khoan/ho-so", label: "Thông tin cá nhân", icon: BadgeCheck },
        { href: "/doanh-nghiep/kyb", label: "Hồ sơ doanh nghiệp", icon: Building2 },
      ],
    },
  ],
  labeler: [
    {
      title: "Tìm việc",
      items: [
        { href: "/cho", label: "Chợ dự án", icon: Store },
        { href: "/da-thich", label: "Dự án đã thích", icon: Heart },
        { href: "/join", label: "Tham gia bằng mã", icon: Ticket },
      ],
    },
    {
      title: "Công việc & thu nhập",
      items: [
        { href: "/viec-cua-toi", label: "Bài làm của tôi", icon: ListChecks },
        { href: "/vi", label: "Ví & thu nhập", icon: Wallet },
        { href: "/cap-do", label: "Cấp độ & xếp hạng", icon: Trophy },
        { href: "/tai-khoan/ho-so", label: "Thông tin cá nhân", icon: BadgeCheck },
      ],
    },
    LINK_GROUP,
  ],
  // Tài khoản cũ đăng ký với vai trò "sharer" (nay không còn là vai trò).
  sharer: [
    {
      items: [
        { href: "/tai-khoan/ho-so", label: "Thông tin cá nhân", icon: BadgeCheck },
        { href: "/vi", label: "Ví & rút tiền", icon: Wallet },
      ],
    },
    LINK_GROUP,
  ],
  admin: [
    { items: [{ href: "/admin", label: "Tổng quan", icon: Home, exact: true }] },
    {
      title: "Duyệt hồ sơ",
      items: [
        { href: "/admin/du-an", label: "Dự án chờ duyệt", icon: Briefcase },
        { href: "/admin/kyb", label: "Hồ sơ KYB", icon: Building2 },
        { href: "/admin/xac-minh", label: "Xác minh danh tính", icon: Fingerprint },
        { href: "/admin/khieu-nai", label: "Khiếu nại bài làm", icon: Gavel },
      ],
    },
    {
      title: "Tiền",
      items: [
        { href: "/admin/rut-tien", label: "Duyệt rút tiền", icon: Coins },
        { href: "/admin/nap-tien", label: "Nạp chuyển khoản", icon: Landmark },
        { href: "/admin/hoa-don", label: "Hoá đơn", icon: FileText },
      ],
    },
    {
      title: "Người dùng & an toàn",
      items: [
        { href: "/admin/nguoi-dung", label: "Người dùng", icon: UserCog },
        { href: "/admin/gian-lan", label: "Nghi gian lận", icon: ShieldAlert },
        { href: "/admin/link", label: "Kiểm duyệt link", icon: Link2 },
      ],
    },
    {
      title: "Nội dung & cấu hình",
      items: [
        { href: "/admin/thong-bao", label: "Thông báo hệ thống", icon: Megaphone },
        { href: "/admin/mau", label: "Mẫu bài toán", icon: LayoutTemplate },
        { href: "/admin/the", label: "Thẻ lĩnh vực & ngôn ngữ", icon: Tags },
        { href: "/admin/cai-dat", label: "Cài đặt hệ thống", icon: Settings },
      ],
    },
    {
      title: "Ít dùng",
      collapsed: true,
      items: [
        { href: "/admin/nhat-ky", label: "Nhật ký hoạt động", icon: ScrollText },
        { href: "/admin/watermark", label: "Truy watermark", icon: Search },
        { href: "/admin/viec-tay", label: "Việc cần xử lý tay", icon: ClipboardCheck },
      ],
    },
  ],
};

/**
 * Trang chính sau khi đăng nhập / bấm logo / đổi vai trò. Không còn trang "Tổng quan" riêng: labeler lướt feed
 * (Chợ dự án), doanh nghiệp vào Dự án của tôi; số liệu tổng quan nằm ở đầu trang Thông tin cá nhân.
 */
export function trangChu(role: Role | null): string {
  if (role === "admin") return "/admin";
  if (role === "business") return "/du-an";
  if (role === "sharer") return "/link";
  return "/cho";
}

/** Tài khoản: nằm trong menu ảnh đại diện (góc trên phải), chuông thông báo cũng ở đó — không lặp lại ở thanh bên. */
export const ACCOUNT_NAV: NavItem[] = [
  { href: "/thong-bao", label: "Thông báo", icon: Bell },
  { href: "/tai-khoan/ho-so", label: "Thông tin cá nhân", icon: BadgeCheck },
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
