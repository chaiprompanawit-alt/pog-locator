import { NextRequest, NextResponse } from "next/server";
import { findLocations } from "@/lib/lookup";
import { getIndex } from "@/lib/pogindex";
import { requestPassed } from "@/lib/gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!requestPassed(req)) {
    return NextResponse.json({ error: "ยังไม่ได้ใส่รหัส" }, { status: 401 });
  }
  const query = req.nextUrl.searchParams.get("code")?.trim() ?? "";
  if (!query) {
    return NextResponse.json({ error: "กรุณาใส่เลขสินค้า" }, { status: 400 });
  }
  try {
    const index = await getIndex();
    const { key, locations, parse } = findLocations(index, query);
    return NextResponse.json({
      query,
      key,
      found: locations.length > 0,
      store: index.store,
      updated_at: index.updated_at,
      locations,
      // อ่านจากป้ายราคาที่ชั้น → บอกหน้าเว็บว่าแกะรหัสอะไรออกมาได้บ้าง
      label: parse.isLabel ? { item: parse.item, barcode: parse.barcode } : null,
    });
  } catch (e: unknown) {
    console.error("lookup error:", e);
    return NextResponse.json({ error: "ระบบขัดข้อง กรุณาลองใหม่" }, { status: 500 });
  }
}
