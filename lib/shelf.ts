// shelf.ts — โหลด shelf_map (รูปชั้น + พิกัดกรอบสินค้า) จาก Drive ให้ฝั่ง server ใช้
// โครงตรงกับ src/shelf_map.py::write_map — คีย์ด้วย mod, กรอบ normalize 0..1

export type ShelfEntry = {
  source?: string;
  aisle?: string;
  aspect: number;                      // กว้าง/สูง ของรูปชั้น (ให้จัดกล่องรูป)
  img_file_id: string;                 // fileId ของ PNG บน Drive
  img_url?: string;
  img_rev?: string;                    // แฮชของไฟล์รูปรอบล่าสุด (map เก่าอาจไม่มี) — ใช้ทำ ETag
  img_mime?: string;                   // "image/webp" ของใหม่ / map เก่าไม่มีฟิลด์ = PNG
  items: Record<string, number[][]>;   // รหัสสินค้า 9 → [[x,y,w,h] 0..1] (มีได้หลายกรอบ)
  // กรอบที่ "เดาตำแหน่ง" ให้สินค้าที่ผังไม่ได้พิมพ์รหัสกำกับไว้บนหน้ารูป — แยกจาก items
  // เสมอ เพราะความแม่นต่างกัน (map รุ่นก่อนหน้าไม่มีฟิลด์นี้)
  items_approx?: Record<string, number[][]>;
};

export type ShelfMap = {
  updated_at: string;
  store: string;
  count: number;
  mods: Record<string, ShelfEntry>;
};

/**
 * cache ในหน่วยความจำของ instance ที่ยัง warm (ลดการยิง Drive) — แต่ต่างจาก lookup/gate
 * ตรงที่ใช้ **stale-while-revalidate**: หมดอายุแล้วก็ยังคืนของเก่าทันที แล้วค่อยไปโหลดใหม่
 * เบื้องหลัง
 *
 * เหตุผล: shelf_map.json ~440KB และถูกเรียกจาก /api/shelf/img ด้วย — ถ้า TTL หมดพอดี
 * ผู้ใช้คนนั้นต้องรอโหลด JSON จาก Drive จบก่อน **แล้วค่อยเริ่ม** ดึง PNG (รอสองต่อ)
 * ไฟล์นี้เปลี่ยนเฉพาะตอน reprocess planogram → คืนของเก่าไปสักครู่ไม่มีผลเสีย
 */
let cache: { data: ShelfMap; at: number } | null = null;
let inflight: Promise<ShelfMap> | null = null;
const FRESH_MS = 10 * 60_000;   // ภายในนี้ใช้ของใน cache เลย ไม่ยิง Drive
const STALE_MS = 24 * 60 * 60_000; // เก่ากว่านี้ = ไม่กล้าใช้ ต้องรอโหลดจริง

function mapUrl(): string {
  const explicit = process.env.DRIVE_SHELF_URL;
  if (explicit) return explicit;
  const id = process.env.DRIVE_SHELF_FILE_ID;
  if (!id) throw new Error("ยังไม่ได้ตั้ง env DRIVE_SHELF_FILE_ID หรือ DRIVE_SHELF_URL");
  return `https://drive.usercontent.google.com/download?id=${id}&export=download`;
}

/** โหลดจริง — dedupe ไม่ให้หลาย request ยิง Drive พร้อมกัน */
function fetchMap(): Promise<ShelfMap> {
  if (inflight) return inflight;
  inflight = (async () => {
    // dev: อ่านไฟล์ในเครื่องได้ (ตั้ง LOCAL_SHELF_PATH) — ไม่ต้องต่อ Drive
    let text: string;
    const localPath = process.env.LOCAL_SHELF_PATH;
    if (localPath) {
      const { readFile } = await import("fs/promises");
      text = await readFile(localPath, "utf-8");
    } else {
      const res = await fetch(mapUrl(), { cache: "no-store" });
      if (!res.ok) throw new Error(`ดึง shelf_map จาก Drive ไม่ได้ (HTTP ${res.status})`);
      text = await res.text();
    }
    let data: ShelfMap;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("shelf_map ที่ได้ไม่ใช่ JSON");
    }
    cache = { data, at: Date.now() };
    return data;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export async function getShelfMap(): Promise<ShelfMap> {
  const age = cache ? Date.now() - cache.at : Infinity;
  if (cache && age < FRESH_MS) return cache.data;

  if (cache && age < STALE_MS) {
    // คืนของเก่าทันที แล้วรีเฟรชเบื้องหลัง — โหลดพลาดก็ไม่กระทบคำขอนี้
    void fetchMap().catch(() => {});
    return cache.data;
  }
  return fetchMap();
}

// URL รูป PNG ตรงจาก Drive (ฝั่ง server ดึงมา proxy ต่อ — กัน network/CORS ฝั่ง client)
export function driveImageUrl(fileId: string): string {
  return `https://drive.usercontent.google.com/download?id=${fileId}&export=view`;
}
