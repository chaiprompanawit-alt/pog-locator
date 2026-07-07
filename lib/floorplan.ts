// floorplan.ts — โหลดแผนผัง + หาว่า Mod อยู่ตรงไหนบนแปลน (พิกัดสัดส่วน 0..1)

export type Rect = { x: number; y: number; w: number; h: number };

export type FloorplanData = {
  store: string;
  updated_at: string;
  aspect: number; // กว้าง/สูง ของแปลน
  bays: Record<string, Rect>;
};

// "1L3-1" → "1L3" (ตัดเลขท้าย -N ออก เหลือชื่อทางเดิน)
export function aisleOf(mod: string): string {
  return (mod || "").replace(/-\d+$/, "");
}

export type BayHit =
  | { kind: "exact"; code: string; rect: Rect } // เจอ bay ตรงตัว
  | { kind: "aisle"; code: string; rect: Rect } // ไม่เจอ bay แต่เจอทางเดิน → โซนคร่าวๆ
  | { kind: "none" }; // ไม่มีบนแผนผัง (เช่น POG พิเศษ)

function bbox(rects: Rect[]): Rect {
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.w));
  const y1 = Math.max(...rects.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** หาตำแหน่งของ Mod บนแปลน: ตรงตัวก่อน, ไม่เจอลองทั้งทางเดิน, สุดท้ายไม่มี */
export function findBay(data: FloorplanData, mod: string): BayHit {
  const exact = data.bays[mod];
  if (exact) return { kind: "exact", code: mod, rect: exact };

  const aisle = aisleOf(mod);
  if (aisle) {
    const rects = Object.entries(data.bays)
      .filter(([code]) => aisleOf(code) === aisle)
      .map(([, r]) => r);
    if (rects.length) return { kind: "aisle", code: aisle, rect: bbox(rects) };
  }
  return { kind: "none" };
}

// โหลด floorplan.json ครั้งเดียว (แชร์ทั้งแอป)
let cache: Promise<FloorplanData> | null = null;
export function loadFloorplan(): Promise<FloorplanData> {
  if (!cache) {
    cache = fetch("/floorplan.json", { cache: "force-cache" }).then((r) => {
      if (!r.ok) throw new Error(`โหลดแผนผังไม่ได้ (HTTP ${r.status})`);
      return r.json() as Promise<FloorplanData>;
    });
  }
  return cache;
}
