// shelf.ts — โหลด shelf_map (รูปชั้น + พิกัดกรอบสินค้า) จาก Drive ให้ฝั่ง server ใช้
// โครงตรงกับ src/shelf_map.py::write_map — คีย์ด้วย mod, กรอบ normalize 0..1

export type ShelfEntry = {
  source?: string;
  aisle?: string;
  aspect: number;                      // กว้าง/สูง ของรูปชั้น (ให้จัดกล่องรูป)
  img_file_id: string;                 // fileId ของ PNG บน Drive
  img_url?: string;
  items: Record<string, number[][]>;   // รหัสสินค้า 9 → [[x,y,w,h] 0..1] (มีได้หลายกรอบ)
};

export type ShelfMap = {
  updated_at: string;
  store: string;
  count: number;
  mods: Record<string, ShelfEntry>;
};

// cache ในหน่วยความจำของ instance ที่ยัง warm (ลดการยิง Drive) — เหมือน lookup/gate
let cache: { data: ShelfMap; at: number } | null = null;
const TTL_MS = 60_000;

function mapUrl(): string {
  const explicit = process.env.DRIVE_SHELF_URL;
  if (explicit) return explicit;
  const id = process.env.DRIVE_SHELF_FILE_ID;
  if (!id) throw new Error("ยังไม่ได้ตั้ง env DRIVE_SHELF_FILE_ID หรือ DRIVE_SHELF_URL");
  return `https://drive.usercontent.google.com/download?id=${id}&export=download`;
}

export async function getShelfMap(): Promise<ShelfMap> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;

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
}

// URL รูป PNG ตรงจาก Drive (ฝั่ง server ดึงมา proxy ต่อ — กัน network/CORS ฝั่ง client)
export function driveImageUrl(fileId: string): string {
  return `https://drive.usercontent.google.com/download?id=${fileId}&export=view`;
}
