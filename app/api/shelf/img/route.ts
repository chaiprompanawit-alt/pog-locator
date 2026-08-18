import { NextRequest } from "next/server";
import { getShelfMap, driveImageUrl } from "@/lib/shelf";
import { requestPassed } from "@/lib/gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/shelf/img?mod=1L3-1 → สตรีมรูปชั้นนั้น (WebP; map เก่าที่ยังเป็น PNG ก็เสิร์ฟได้)
// proxy ผ่าน server: client ไม่ต้องยิง Drive เอง (กัน CORS/หน้ายืนยันของ Drive)
// จำกัดเฉพาะ mod ที่มีใน shelf_map — ไม่เปิดให้ดึง fileId อะไรก็ได้ (กัน open proxy)
//
// รูปชั้นเปลี่ยนเฉพาะตอน reprocess planogram → cache ยาวๆ ได้ แต่ต้องมี ETag ที่ถูกต้อง
// **fileId ใช้เป็นเวอร์ชันไม่ได้**: reprocess ทับเนื้อไฟล์เดิม fileId คงที่ (กฎความเสถียรของ QR)
// จึงใช้ img_rev (แฮชของ PNG จาก shelf_map.py) — map เก่าที่ยังไม่มีฟิลด์นี้ถอยไปใช้
// updated_at ของทั้งแผนที่แทน (หยาบกว่า: reprocess ทีเดียวรูปทุกใบถือว่าเปลี่ยน แต่ไม่ค้างของเก่า)
//
// s-maxage สั้นเพื่อให้ CDN เช็กกับ ETag บ่อยๆ ส่วน stale-while-revalidate ยาว = ผู้ใช้ได้ของ
// จาก CDN ทันทีเสมอ แล้ว CDN ค่อยไปเช็กเบื้องหลัง — รูปใหม่ขึ้นเองภายในไม่กี่นาทีหลัง reprocess
const CACHE_CONTROL =
  "private, max-age=300, stale-while-revalidate=604800";

export async function GET(req: NextRequest) {
  if (!requestPassed(req)) return new Response("locked", { status: 401 });
  const mod = req.nextUrl.searchParams.get("mod")?.trim() ?? "";
  if (!mod) return new Response("missing mod", { status: 400 });
  try {
    const map = await getShelfMap();
    const e = map.mods?.[mod];
    if (!e || !e.img_file_id) return new Response("not found", { status: 404 });

    const etag = `"${e.img_file_id}:${e.img_rev || map.updated_at}"`;
    if (req.headers.get("if-none-match") === etag) {
      return new Response(null, {
        status: 304,
        headers: { ETag: etag, "Cache-Control": CACHE_CONTROL },
      });
    }

    const res = await fetch(driveImageUrl(e.img_file_id), { cache: "no-store" });
    if (!res.ok || !res.body) return new Response("drive error", { status: 502 });

    // สตรีมต่อเลย ไม่ arrayBuffer() รอทั้งไฟล์ก่อน — เบราว์เซอร์เริ่มถอดรหัสรูปได้ทันที
    const headers = new Headers({
      // ชนิดรูปมาจากแผนที่ ไม่ใช่จาก Drive — เสิร์ฟผิดชนิดแล้ว nosniff จะทำให้รูปไม่ขึ้นเลย
      "Content-Type": e.img_mime || "image/png",
      "Cache-Control": CACHE_CONTROL,
      ETag: etag,
    });
    const len = res.headers.get("content-length");
    if (len) headers.set("Content-Length", len); // ให้เบราว์เซอร์รู้ความคืบหน้า
    return new Response(res.body, { headers });
  } catch (err) {
    console.error("shelf img error:", err);
    return new Response("error", { status: 500 });
  }
}
