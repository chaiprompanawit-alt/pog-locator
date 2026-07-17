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

export async function POST(req: NextRequest) {
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
    const msg = e instanceof Error ? e.message : "เกิดข้อผิดพลาด";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  if (!entry) {
    return NextResponse.json({ error: "ไม่พบป้ายนี้ในระบบ" }, { status: 404 });
  }

  if (!ok) {
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
