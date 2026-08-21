import { NextRequest, NextResponse } from "next/server";
import { getIndex, indexByMod } from "@/lib/pogindex";
import { getShelfMap } from "@/lib/shelf";
import { getCardsMap, requestPassed } from "@/lib/gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/gap?mod=1L3-1  หรือ  /api/gap?slug=1L3-1
 * → รายการสินค้าทั้งชั้นนั้น (รหัส 9 / บาร์โค้ด 13 / ชั้น / ตำแหน่ง) + กรอบบนรูปชั้น
 *
 * slug มาจาก QR ที่ติดหน้าชั้น (https://.../g/<slug>) — แปลงเป็น mod ผ่าน cards_map
 * ตัวเดียวกับที่ด่านใช้ เพื่อให้ป้ายเก่าที่ย้ายทางเดินยังชี้ถูกชั้นเหมือนกัน
 */
export async function GET(req: NextRequest) {
  if (!requestPassed(req)) {
    return NextResponse.json({ error: "ยังไม่ได้ใส่รหัส" }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  let mod = sp.get("mod")?.trim() ?? "";
  const slug = sp.get("slug")?.trim() ?? "";
  if (!mod && !slug) {
    return NextResponse.json({ error: "ต้องระบุ mod หรือ slug" }, { status: 400 });
  }

  try {
    let dgDesc = "";
    if (!mod) {
      const cards = await getCardsMap();
      const entry = cards.mods?.[slug];
      if (!entry) {
        return NextResponse.json({ found: false, slug, reason: "ไม่พบป้ายนี้ในระบบ" });
      }
      mod = entry.mod;
      dgDesc = entry.dg_desc || "";
    }

    const [index, shelfMap] = await Promise.all([getIndex(), getShelfMap()]);
    const rows = indexByMod(index).get(mod) ?? [];
    const shelf = shelfMap.mods?.[mod];

    const items = rows.map((r) => {
      const boxes = shelf?.items?.[r.item] ?? [];
      const approx = boxes.length ? [] : (shelf?.items_approx?.[r.item] ?? []);
      return {
        item: r.item,
        barcode: r.barcode,
        name: r.name,
        shelf: r.shelf,
        pos: r.pos,
        boxes: boxes.length ? boxes : approx,
        approx: boxes.length === 0 && approx.length > 0,
      };
    });

    return NextResponse.json({
      found: items.length > 0,
      mod,
      dg_desc: dgDesc,
      store: index.store,
      updated_at: index.updated_at,
      aspect: shelf?.aspect || 1,
      has_img: !!shelf?.img_file_id,
      img: shelf?.img_file_id ? `/api/shelf/img?mod=${encodeURIComponent(mod)}` : null,
      items,
    });
  } catch (e: unknown) {
    console.error("gap error:", e);
    return NextResponse.json({ error: "ระบบขัดข้อง กรุณาลองใหม่" }, { status: 500 });
  }
}
