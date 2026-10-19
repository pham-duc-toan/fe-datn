import type { NextConfig } from "next";

// App gần như toàn bộ nằm sau đăng nhập và lấy dữ liệu từ gateway ở trình duyệt (SPA),
// nên không bật cacheComponents / partialPrefetching (chỉ có lợi cho trang render phía server).
const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
