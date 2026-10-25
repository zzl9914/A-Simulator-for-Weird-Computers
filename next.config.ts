import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // 用 127.0.0.1 打开时，开发服务器会把 HMR 当成跨源并直接回 Unauthorized。
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    // 调试通道要等 HMR 把调试数据送完才 hydrate。通道断了页面就只剩静态 HTML，按钮点不动。
    reactDebugChannel: false,
  },
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
