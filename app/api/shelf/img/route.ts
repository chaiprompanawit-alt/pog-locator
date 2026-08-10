import { NextRequest } from "next/server";
import { getShelfMap, driveImageUrl } from "@/lib/shelf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/shelf/img?mod=1L3-1 → สตรีมรูป PNG ของชั้นนั้น
// proxy ผ่าน server: client ไม่ต้องยิง Drive เอง (กัน CORS/หน้ายืนยันของ Drive)
// จำกัดเฉพาะ mod ที่มีใน shelf_map — ไม่เปิดให้ดึง fileId อะไรก็ได้ (กัน open proxy)
export async function GET(req: NextRequest) {
  const mod = req.nextUrl.searchParams.get("mod")?.trim() ?? "";
  if (!mod) return new Response("missing mod", { status: 400 });
  try {
    const map = await getShelfMap();
    const e = map.mods?.[mod];
    if (!e || !e.img_file_id) return new Response("not found", { status: 404 });

    const res = await fetch(driveImageUrl(e.img_file_id), { cache: "no-store" });
    if (!res.ok) return new Response("drive error", { status: 502 });
    const buf = await res.arrayBuffer();
    return new Response(buf, {
      headers: {
        "Content-Type": "image/png",
        // รูปชั้นเปลี่ยนเฉพาะตอน reprocess — cache ยาวๆ ได้ (เบราว์เซอร์ + CDN ของ Vercel)
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch (err) {
    console.error("shelf img error:", err);
    return new Response("error", { status: 500 });
  }
}
