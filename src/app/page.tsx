"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Link2, ShieldCheck, Tags, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";

const FEATURES = [
  { icon: Briefcase, title: "Doanh nghiệp", text: "Tạo dự án, đặt tập nhãn với 15 loại công cụ, nạp dữ liệu, ký quỹ và nhận kết quả đã gộp đồng thuận." },
  { icon: Users, title: "Người gán nhãn", text: "Chọn dự án trong chợ, làm cả bài như bài kiểm tra, đạt ngưỡng của dự án thì nhận trọn tiền thưởng, rút về tài khoản." },
  { icon: Link2, title: "Cổng link", text: "Rút gọn link, khách giải 1–3 câu gán nhãn nhanh trước khi tới đích — người chia sẻ hưởng doanh thu." },
  { icon: ShieldCheck, title: "Chất lượng", text: "Câu vàng, Krippendorff alpha, Dawid–Skene, STAPLE, redundancy thích ứng và chống gian lận." },
  { icon: Wallet, title: "Ký quỹ minh bạch", text: "Sổ cái kép, đối soát tự động, VNPay / MoMo, hoá đơn VAT, chỉ trả thưởng cho bài đạt, hoàn phần suất thừa." },
];

export default function Home() {
  const { status, activeRole } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (status === "authed") router.replace(activeRole === "admin" ? "/admin" : "/tong-quan");
  }, [status, activeRole, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Tags className="size-4" />
          </span>
          Crowd Label
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" asChild>
            <Link href="/dang-nhap">Đăng nhập</Link>
          </Button>
          <Button asChild>
            <Link href="/dang-ky">Đăng ký</Link>
          </Button>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-12 text-center">
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">Gán nhãn dữ liệu cộng đồng cho AI</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Một nền tảng nối doanh nghiệp cần dữ liệu có nhãn với cộng đồng người gán nhãn — ảnh, văn bản, âm thanh, video, so sánh và xếp hạng.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/dang-ky">Bắt đầu miễn phí</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/dang-nhap">Tôi đã có tài khoản</Link>
          </Button>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-20 md:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-xl border bg-card p-5">
            <f.icon className="mb-3 size-6 text-primary" />
            <h3 className="font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
