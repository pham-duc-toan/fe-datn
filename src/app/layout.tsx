import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/providers";
import { FullPageSpinner } from "@/components/common/states";

const sans = Inter({ variable: "--font-sans", subsets: ["latin", "vietnamese"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Crowd Label — Gán nhãn dữ liệu cộng đồng", template: "%s · Crowd Label" },
  description: "Nền tảng gán nhãn dữ liệu cộng đồng: doanh nghiệp tạo dự án, người gán nhãn nhận việc, cổng link thu nhãn nhanh.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${sans.variable} ${mono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background">
        <Providers>
          {/* Mọi trang đọc dữ liệu ở trình duyệt; một Suspense chung cho useSearchParams / useParams. */}
          <Suspense fallback={<FullPageSpinner />}>{children}</Suspense>
        </Providers>
      </body>
    </html>
  );
}
