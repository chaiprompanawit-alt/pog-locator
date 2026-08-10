import { NextRequest, NextResponse } from "next/server";
import { getShelfMap } from "@/lib/shelf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/shelf?mod=1L3-1 → พิกัดกรอบสินค้าบนรูปชั้นของ Mod นั้น (รูปดึงผ่าน /api/shelf/img)
export async function GET(req: NextRequest) {
  const mod = req.nextUrl.searchParams.get("mod")?.trim() ?? "";
  if (!mod) {
    return NextResponse.json({ error: "ต้องระบุ mod" }, { status: 400 });
  }
  try {
    const map = await getShelfMap();
    const e = map.mods?.[mod];
    if (!e || !e.img_file_id) {
      return NextResponse.json({ found: false, mod });
    }
    return NextResponse.json({
      found: true,
      mod,
      aspect: e.aspect || 1,
      items: e.items || {},
      img: `/api/shelf/img?mod=${encodeURIComponent(mod)}`,
    });
  } catch (err) {
    console.error("shelf error:", err);
    return NextResponse.json({ error: "โหลดรูปชั้นไม่สำเร็จ" }, { status: 500 });
  }
}
