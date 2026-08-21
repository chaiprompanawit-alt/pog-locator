// pogindex.ts — โหลด index.json (บาร์โค้ด → ตำแหน่ง) ให้ฝั่ง server ใช้ร่วมกัน
// เดิม getIndex อยู่ใน /api/lookup ตัวเดียว — พอ /api/gap ต้องใช้ด้วยจึงย้ายมาไว้ตรงกลาง
// เพื่อให้ cache เป็นก้อนเดียว (index ~2MB ดึงจาก Drive ทีนึงไม่ถูก)

import { readFile } from "fs/promises";
import type { PogIndex } from "@/lib/lookup";

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

export async function getIndex(): Promise<PogIndex> {
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

// ── มุมมอง "รายชั้น" ของ index (ใช้โดย Gap Scan) ─────────────────
export type ModRow = {
  item: string;             // รหัสสินค้า 9 หลัก
  barcode: string | null;   // บาร์โค้ด 13 หลัก (index บางแถวอาจไม่มีคู่)
  shelf: number;
  pos: number;
};

/**
 * index เก็บเป็น "คีย์เลข → ตำแหน่ง" ซึ่งค้นย้อนกลับจาก mod ไม่ได้ตรงๆ
 * จึงกวาดทั้งก้อนหนึ่งรอบแล้วพลิกเป็น mod → รายการสินค้า + item → barcode
 * ทำครั้งเดียวต่อ index หนึ่งก้อน (ผูกด้วย WeakMap กับตัว object เอง — index
 * รีเฟรชเมื่อไร ก็ได้ object ใหม่ ตารางเก่าถูกทิ้งเอง ไม่ต้องคอย invalidate)
 */
type Derived = { byMod: Map<string, ModRow[]> };
const derivedCache = new WeakMap<PogIndex, Derived>();

export function indexByMod(index: PogIndex): Map<string, ModRow[]> {
  const hit = derivedCache.get(index);
  if (hit) return hit.byMod;

  const barcodeOf = new Map<string, string>();   // item 9 → barcode 13
  const seen = new Map<string, Set<string>>();   // mod → item ที่ใส่ไปแล้ว (กันซ้ำ)
  const byMod = new Map<string, ModRow[]>();

  for (const [key, locs] of Object.entries(index.items || {})) {
    if (key.length === 13) {
      // คีย์ 13 หลัก = บาร์โค้ดสินค้า — จับคู่กับรหัส 9 หลักที่แถวนั้นบอกไว้
      for (const loc of locs) {
        if (loc.item && !barcodeOf.has(loc.item)) barcodeOf.set(loc.item, key);
      }
      continue;
    }
    if (key.length !== 9) continue;
    for (const loc of locs) {
      const item = loc.item || key;
      let set = seen.get(loc.mod);
      if (!set) seen.set(loc.mod, (set = new Set()));
      if (set.has(item)) continue;
      set.add(item);
      const rows = byMod.get(loc.mod) || [];
      rows.push({ item, barcode: null, shelf: loc.shelf, pos: loc.pos });
      byMod.set(loc.mod, rows);
    }
  }

  for (const rows of byMod.values()) {
    for (const r of rows) r.barcode = barcodeOf.get(r.item) ?? null;
    rows.sort((a, b) => a.shelf - b.shelf || a.pos - b.pos);
  }

  derivedCache.set(index, { byMod });
  return byMod;
}
