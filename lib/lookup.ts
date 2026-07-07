// lookup.ts — normalize + ค้น index (ให้ตรงกับฝั่ง Python src/location_index.py)

export type Loc = {
  mod: string;      // จุดวาง เช่น "1L3-1"
  aisle: string;    // ทางเดิน เช่น "1L3"
  shelf: number;    // ชั้นที่วาง
  pos: number;      // ตำแหน่งบนชั้น (ซ้าย→ขวา)
  is_bay: boolean;
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

export function findLocations(
  index: PogIndex,
  query: string
): { key: string | null; locations: Loc[] } {
  for (const k of lookupKeys(query)) {
    const hit = index.items?.[k];
    if (hit && hit.length) return { key: k, locations: hit };
  }
  return { key: null, locations: [] };
}
