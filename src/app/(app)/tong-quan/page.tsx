"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { Loading } from "@/components/common/states";
import { trangChu } from "@/lib/nav";

/**
 * Trang "Tổng quan" đã bỏ: labeler vào thẳng Chợ dự án (lướt feed), doanh nghiệp vào Dự án của tôi, số liệu tổng
 * quan nằm ở trang Thông tin cá nhân. Giữ đường dẫn này để chuyển hướng (đăng nhập / đăng ký / link cũ trỏ tới đây).
 */
export default function OverviewRedirect() {
  const { activeRole } = useAuth();
  const router = useRouter();
  useEffect(() => {
    router.replace(trangChu(activeRole));
  }, [activeRole, router]);
  return <Loading />;
}
