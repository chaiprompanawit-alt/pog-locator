import { createHmac, timingSafeEqual } from "crypto";
import { readFile } from "fs/promises";

/**
 * gate.ts — ตัวช่วยของ "ด่านยืนยันสิทธิ์" ก่อนเปิดผัง Planogram บน Drive
 *
 * ใช้ที่ฝั่ง server เท่านั้น (route handler / server component)
 * — fileId ของ Drive ต้องไม่ถูกส่งไป browser ก่อนกรอกรหัสถูก ไม่งั้นก็ข้ามด่านได้เลย
 *
 * แผนที่ slug → fileId มาจาก `python export_cards_map.py` (ฝั่งเดสก์ท็อป) ที่อัป
 * cards_map.json ขึ้น Drive แล้วเอา fileId ไปตั้งเป็น env DRIVE_CARDS_FILE_ID
 */

export type CardEntry = {
  mod: string;
  file_id: string;
  dg_desc: string;
  aisle: string;
};

export type CardsMap = {
  updated_at: string;
  store: string;
  count: number;
  mods: Record<string, CardEntry>;
};

// ── แผนที่ slug → fileId (ดึงจาก Drive, cache เหมือน /api/lookup) ──
let cache: { data: CardsMap; at: number } | null = null;
const TTL_MS = 60_000;

function mapUrl(): string {
  const explicit = process.env.DRIVE_CARDS_URL;
  if (explicit) return explicit;
  const id = process.env.DRIVE_CARDS_FILE_ID;
  if (!id) throw new Error("ยังไม่ได้ตั้ง env DRIVE_CARDS_FILE_ID หรือ DRIVE_CARDS_URL");
  // host usercontent ส่งไฟล์ตรง (drive.google.com/uc บาง network ถูก reset) — เหมือน index
  return `https://drive.usercontent.google.com/download?id=${id}&export=download`;
}

export async function getCardsMap(): Promise<CardsMap> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;

  // dev: อ่านจากไฟล์ในเครื่องได้ (ตั้ง LOCAL_CARDS_MAP_PATH) — ไม่ต้องต่อ Drive
  let text: string;
  const localPath = process.env.LOCAL_CARDS_MAP_PATH;
  if (localPath) {
    text = await readFile(localPath, "utf-8");
  } else {
    const res = await fetch(mapUrl(), { cache: "no-store" });
    if (!res.ok) throw new Error(`ดึงแผนที่ QR จาก Drive ไม่ได้ (HTTP ${res.status})`);
    text = await res.text();
  }
  let data: CardsMap;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("แผนที่ QR ที่ได้ไม่ใช่ JSON");
  }
  cache = { data, at: Date.now() };
  return data;
}

export function driveViewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

// ── รหัสผ่าน 4 หลัก ──
/**
 * รหัสจริงอยู่ใน env บน Vercel เท่านั้น — **ห้ามใส่ค่า default ไว้ในโค้ด**
 * (repo นี้เป็น public → ค่าที่เขียนไว้ = ประกาศรหัสให้คนทั้งโลกอ่าน)
 * ไม่ตั้ง env = ด่านปิดตาย (throw) ดีกว่าเผลอปล่อยผ่านด้วยรหัสที่เดาได้
 */
export function gateCode(): string {
  const code = (process.env.POG_GATE_CODE || "").trim();
  if (!code) throw new Error("ยังไม่ได้ตั้ง env POG_GATE_CODE");
  return code;
}

/** เทียบรหัสแบบเวลาคงที่ (กันเดาจากเวลาตอบ) */
export function codeMatches(input: unknown): boolean {
  if (typeof input !== "string") return false;
  const a = Buffer.from(input.trim());
  const b = Buffer.from(gateCode());
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ── คุกกี้ "ผ่านด่านแล้ว" (30 วัน) ──
export const GATE_COOKIE = "pog_gate";
export const GATE_MAX_AGE_S = 30 * 24 * 60 * 60;

/** เซ็นด้วยรหัสปัจจุบัน → เปลี่ยนรหัสเมื่อไร คุกกี้เก่าใช้ไม่ได้ทันที (ตั้งใจให้เป็นแบบนั้น) */
function sign(exp: string): string {
  return createHmac("sha256", `pog-gate:${gateCode()}`).update(exp).digest("base64url");
}

export function makeToken(): string {
  const exp = String(Date.now() + GATE_MAX_AGE_S * 1000);
  return `${exp}.${sign(exp)}`;
}

export function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const good = sign(exp);
  if (sig.length !== good.length) return false;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return false;
  const ts = Number(exp);
  return Number.isFinite(ts) && ts > Date.now();
}

/**
 * ผ่านด่านแล้วหรือยัง (อ่านจากคุกกี้ในคำขอ) — ใช้กับ route handler
 * ไม่ผ่าน = ไม่ควรตอบข้อมูลผัง ไม่งั้นยิง /api ตรงๆ ก็ข้ามด่านหน้าเว็บได้
 */
export function requestPassed(req: { cookies: { get(name: string): { value: string } | undefined } }): boolean {
  try {
    return verifyToken(req.cookies.get(GATE_COOKIE)?.value);
  } catch {
    return false;
  }
}
