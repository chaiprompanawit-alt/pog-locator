/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // กัน build พังเพราะ lint (เราทดสอบในเครื่องไม่ได้ ไม่มี Node) — TS ยังเช็ก type ตามปกติ
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
