/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // กัน build พังเพราะ lint (เราทดสอบในเครื่องไม่ได้ ไม่มี Node) — TS ยังเช็ก type ตามปกติ
  eslint: { ignoreDuringBuilds: true },
  // ── security headers (กัน clickjacking / MIME sniffing / บังคับ HTTPS) ──
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next.js ฝัง inline script/style ตอน hydrate
              // dev เท่านั้น: webpack ห่อโมดูลด้วย eval() — ไม่ใส่ 'unsafe-eval' แล้ว
              // หน้าเว็บจะไม่ hydrate เลยตอน next dev (โปรดักชันไม่ใช้ eval จึงไม่ต้องมี)
              `script-src 'self' 'unsafe-inline'${
                process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"
              }`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
