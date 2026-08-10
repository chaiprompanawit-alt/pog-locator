import { readFile } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { findLocations, type PogIndex } from "@/lib/lookup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// cache ตัว index ในหน่วยความจำของ instance ที่ยัง warm อยู่ (ลดการยิง Drive)
let cache: { data: PogIndex; at: number } | null = null;
const TTL_MS = 60_000;

function indexUrl(): string {
  const explicit = process.env.DRIVE_INDEX_URL;
  if (explicit) return explicit;
  const id = process.env.DRIVE_INDEX_FILE_ID;
  if (!id) throw new Error("ยังไม่ได้ตั้ง env DRIVE_INDEX_FILE_ID หรือ DRIVE_INDEX_URL");
  // ใช้ host usercontent (เช็กแล้วส่งไฟล์ตรง) — drive.google.com/uc บาง network ถูก reset
  return `https://drive.usercontent.google.com/download?id=${id}&export=download`;
}

async function getIndex(): Promise<PogIndex> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;

  // dev: อ่านจากไฟล์ในเครื่องได้ (ตั้ง LOCAL_INDEX_PATH) — ไม่ต้องต่อ Drive
  let text: string;
  const localPath = process.env.LOCAL_INDEX_PATH;
  if (localPath) {
    text = await readFile(localPath, "utf-8");
  } else {
    const res = await fetch(indexUrl(), { cache: "no-store" });
    if (!res.ok) throw new Error(`ดึง index จาก Drive ไม่ได้ (HTTP ${res.status})`);
    // อ่านเป็น text ก่อน กันกรณี Drive ตอบ content-type แปลก
    text = await res.text();
  }
  let data: PogIndex;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("index ที่ได้ไม่ใช่ JSON (ไฟล์อาจใหญ่เกินจน Drive แทรกหน้ายืนยัน)");
  }
  cache = { data, at: Date.now() };
  return data;
}

export async function GET(req: NextRequest) {
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
