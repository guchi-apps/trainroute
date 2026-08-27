import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // サブPCの汎用ランチャーがtailnet(`**.ts.net`)経由で開発サーバーを公開するため、
  // Next.jsのdevサーバーがそのオリジンからのリクエストをブロックしないよう許可する。
  allowedDevOrigins: ["**.ts.net"],
};

export default nextConfig;
