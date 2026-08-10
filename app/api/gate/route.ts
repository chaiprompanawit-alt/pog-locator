import { NextRequest, NextResponse } from "next/server";
import {
  GATE_COOKIE,
  GATE_MAX_AGE_S,
  codeMatches,
  driveViewUrl,
  getCardsMap,
  makeToken,
} from "@/lib/gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** หน่วงตอนรหัสผิด — กันไล่เดา 4 หลักรัวๆ */
const WRONG_DELAY_MS = 700;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── rate-limit ต่อ IP (กัน brute-force รหัส 4 หลักแบบยิงขนาน) ──
// sleep อย่างเดียวหน่วงแค่ request เดียว — ยิงพร้อมกัน 10,000 คำขอก็ยังไล่รหัสครบได้
// จึงต้องนับความผิดพลาดต่อ IP แล้วล็อกเมื่อเกินเพดาน
// เก็บใน memory ของ instance (Vercel serverless = ต่อ instance, รีเซ็ตเมื่อ cold start)
// — ไม่กันได้ 100% แต่ยกเพดานการโจมตีขึ้นมากโดยไม่ต้องเพิ่มโครงสร้างพื้นฐาน
const MAX_FAILS = 10; // ผิดได้กี่ครั้งในหน้าต่างเวลา ก่อนโดนล็อก
const WINDOW_MS = 10 * 60_000; // 10 นาที
const LOCK_MS = 15 * 60_000; // ล็อกนาน 15 นาทีเมื่อเกินเพดาน
type RlEntry = { fails: number; first: number; lockedUntil: number };
const rl = new Map<string, RlEntry>();

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

/** คืน ms ที่ยังโดนล็อกอยู่ (0 = ยังยิงได้) */
function rateLimited(ip: string): number {
  const now = Date.now();
  const e = rl.get(ip);
  if (!e) return 0;
  if (e.lockedUntil > now) return e.lockedUntil - now;
  if (now - e.first > WINDOW_MS) {
    rl.delete(ip);
    return 0;
  }
  return 0;
}

function noteFail(ip: string): void {
  const now = Date.now();
  const e = rl.get(ip);
  if (!e || now - e.first > WINDOW_MS) {
    rl.set(ip, { fails: 1, first: now, lockedUntil: 0 });
    return;
  }
  e.fails += 1;
  if (e.fails >= MAX_FAILS) e.lockedUntil = now + LOCK_MS;
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const waitMs = rateLimited(ip);
  if (waitMs > 0) {
    return NextResponse.json(
      { error: "พยายามหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(waitMs / 1000)) } }
    );
  }

  let body: { slug?: unknown; code?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบคำขอไม่ถูกต้อง" }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug : "";
  if (!slug) {
    return NextResponse.json({ error: "ไม่รู้ว่าเป็นป้ายไหน" }, { status: 400 });
  }

  let entry;
  let ok = false;
  try {
    const map = await getCardsMap();
    entry = map.mods[slug];
    // codeMatches เรียก gateCode() ซึ่ง throw ถ้าไม่ได้ตั้ง env → ต้องอยู่ใน try
    if (entry) ok = codeMatches(body.code);
  } catch (e: unknown) {
    console.error("gate error:", e);
    return NextResponse.json({ error: "ระบบขัดข้อง กรุณาลองใหม่" }, { status: 500 });
  }
  if (!entry) {
    return NextResponse.json({ error: "ไม่พบป้ายนี้ในระบบ" }, { status: 404 });
  }

  if (!ok) {
    noteFail(ip);
    await sleep(WRONG_DELAY_MS);
    return NextResponse.json({ error: "รหัสไม่ถูกต้อง" }, { status: 401 });
  }

  // ผ่านแล้วเท่านั้นถึงส่งลิงก์ Drive กลับไป
  const res = NextResponse.json({ ok: true, url: driveViewUrl(entry.file_id) });
  res.cookies.set(GATE_COOKIE, makeToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: GATE_MAX_AGE_S,
    path: "/",
  });
  return res;
}
