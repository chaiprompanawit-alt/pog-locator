// lookup.ts — normalize + ค้น index (ให้ตรงกับฝั่ง Python src/location_index.py)

export type Loc = {
  mod: string;      // จุดวาง เช่น "1L3-1"
  aisle: string;    // ทางเดิน เช่น "1L3"
  shelf: number;    // ชั้นที่วาง
  pos: number;      // ตำแหน่งบนชั้น (ซ้าย→ขวา)
  is_bay: boolean;
  item?: string;    // รหัสสินค้า 9 หลัก — ใช้เปิด shelf_map วาดกรอบบนรูปชั้น (index เก่าอาจไม่มี)
};

export type PogIndex = {
  updated_at: string;
  store: string;
  count: number;
  items: Record<string, Loc[]>;
};

const digits = (s: string) => (s || "").replace(/\D+/g, "");

// input ผู้ใช้ → คีย์ที่เป็นไปได้ (ลองทั้ง barcode 13 และ item 9) — pad ศูนย์นำ
export function lookupKeys(query: string): string[] {
  const d = digits(query);
  if (!d) return [];
  const keys: string[] = [];
  if (d.length <= 13) keys.push(d.padStart(13, "0"));
  if (d.length <= 9) keys.push(d.padStart(9, "0"));
  if (d.length > 13) keys.push(d);
  return Array.from(new Set(keys));
}

// ── บาร์โค้ดบนป้ายราคาที่ชั้น (SEL) ──────────────────────────────
/**
 * บาร์โค้ดบน "ป้ายราคาที่ชั้น" ไม่ใช่บาร์โค้ดเดียวกับที่อยู่บนตัวสินค้า —
 * มันห่อรหัสสินค้า 9 หลัก + บาร์โค้ด 13 หลัก ไว้ด้วยกัน เช่น
 *
 *     075607923/8859423206504/17  1  1
 *     └─ รหัสสินค้า ┘└─ บาร์โค้ด ─┘
 *
 * สแกนแล้วถ้าเอาไปล้างเหลือแต่ตัวเลขรวดเดียวจะค้นไม่เจอ ต้องแยกออกมาก่อน
 * รองรับทั้งแบบมีตัวคั่น (เครื่องอ่านส่ง "/" มาด้วย) และแบบตัวเลขติดกันยาว
 */

export type ScanParse = {
  isLabel: boolean;          // อ่านได้ว่าเป็นป้ายชั้น (ไม่ใช่บาร์โค้ดสินค้าเดี่ยวๆ)
  item: string | null;       // รหัสสินค้า 9 หลัก ที่แกะได้
  barcode: string | null;    // บาร์โค้ด 13 หลัก ที่แกะได้
  candidates: string[];      // คีย์ที่จะลองค้น เรียงจากน่าเชื่อถือที่สุด
};

/** ตรวจ check digit ของ EAN-13 — ใช้ตัดสินว่าช่วง 13 หลักที่เดามาน่าจะใช่ */
function isEan13(s: string): boolean {
  if (!/^\d{13}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(s[i]) * (i % 2 ? 3 : 1);
  return (10 - (sum % 10)) % 10 === Number(s[12]);
}

/** ป้ายชั้นเรียง item(9) + barcode(13) ติดกัน — เดาตามสูตรก่อน ไม่เข้าค่อยไล่หา */
function splitGlued(s: string): { item: string | null; barcode: string | null } {
  if (s.length >= 22) {
    const barcode = s.slice(9, 22);
    if (isEan13(barcode)) return { item: s.slice(0, 9), barcode };
  }
  // สูตรไม่เข้า → ไล่หาช่วง 13 หลักที่ check digit ผ่าน แล้วเอา 9 หลักหน้ามันเป็นรหัสสินค้า
  for (let i = 0; i + 13 <= s.length; i++) {
    const w = s.slice(i, i + 13);
    if (isEan13(w)) return { item: i >= 9 ? s.slice(i - 9, i) : null, barcode: w };
  }
  return { item: null, barcode: null };
}

export function parseScan(raw: string): ScanParse {
  const runs = (raw || "").match(/\d+/g) ?? [];
  if (!runs.length) return { isLabel: false, item: null, barcode: null, candidates: [] };

  // บาร์โค้ดสินค้าปกติ: ตัวเลขก้อนเดียว ไม่เกิน 13 หลัก
  if (runs.length === 1 && runs[0].length <= 13) {
    return { isLabel: false, item: null, barcode: null, candidates: lookupKeys(runs[0]) };
  }

  let item: string | null = null;
  let barcode: string | null = null;
  if (runs.length === 1) {
    ({ item, barcode } = splitGlued(runs[0]));
  } else {
    item = runs.find((r) => r.length === 9) ?? null;
    barcode = runs.find((r) => r.length === 13) ?? null;
  }

  // รหัสสินค้า 9 หลักมาก่อน — เป็นเลขที่ผังใช้จริง และไม่เปลี่ยนตามแพ็ก
  const candidates: string[] = [];
  if (item) candidates.push(...lookupKeys(item));
  if (barcode) candidates.push(...lookupKeys(barcode));
  // แกะไม่ออก/แกะได้ไม่ครบ → ลองทุกก้อนตามลำดับที่เจอ เผื่อป้ายรูปแบบอื่น
  for (const r of runs) candidates.push(...lookupKeys(r));

  return {
    isLabel: !!(item || barcode),
    item,
    barcode,
    candidates: Array.from(new Set(candidates)),
  };
}

export function findLocations(
  index: PogIndex,
  query: string
): { key: string | null; locations: Loc[]; parse: ScanParse } {
  const parse = parseScan(query);
  for (const k of parse.candidates) {
    const hit = index.items?.[k];
    if (hit && hit.length) return { key: k, locations: hit, parse };
  }
  return { key: null, locations: [], parse };
}
