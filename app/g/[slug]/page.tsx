import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GATE_COOKIE, driveViewUrl, getCardsMap, verifyToken, type CardEntry } from "@/lib/gate";
import GateForm from "./gate-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// อย่าให้ Google เก็บหน้าด่านไปทำ index
export const metadata: Metadata = {
  title: "ยืนยันสิทธิ์ | POG",
  robots: { index: false, follow: false },
};

export default async function GatePage({ params }: { params: { slug: string } }) {
  let entry: CardEntry | undefined;
  let err: string | null = null;
  let passed = false;
  try {
    const map = await getCardsMap();
    entry = map.mods[params.slug];
    // verifyToken เรียก gateCode() ซึ่ง throw ถ้าไม่ได้ตั้ง env → ต้องอยู่ใน try
    if (entry) passed = verifyToken(cookies().get(GATE_COOKIE)?.value);
  } catch (e: unknown) {
    err = e instanceof Error ? e.message : "เปิดระบบไม่ได้";
  }

  // ผ่านด่านมาแล้วภายใน 30 วัน → ส่งต่อไป Drive เลย ไม่ต้องถามซ้ำ
  // (redirect() ต้องอยู่นอก try — มันทำงานด้วยการ throw)
  if (passed && entry) {
    redirect(driveViewUrl(entry.file_id));
  }

  return (
    <main className="page gate-page">
      <header className="topbar">
        <div className="brand">POG</div>
        <div className="subtitle">
          <svg className="subtitle-icon" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">
            <path d="M240-80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h40v-80q0-83 58.5-141.5T480-920q83 0 141.5 58.5T680-720v80h40q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Zm240-200q33 0 56.5-23.5T560-360q0-33-23.5-56.5T480-440q-33 0-56.5 23.5T400-360q0 33 23.5 56.5T480-280ZM360-640h240v-80q0-50-35-85t-85-35q-50 0-85 35t-35 85v80Z" />
          </svg>
          <span>ยืนยันสิทธิ์</span>
        </div>
      </header>

      {err ? (
        <div className="card notfound">
          <div className="nf-emoji">⚠️</div>
          <div className="nf-text">{err}</div>
          <p className="tiny center">ลองสแกนใหม่อีกครั้ง หรือแจ้งผู้ดูแลระบบ</p>
        </div>
      ) : !entry ? (
        <div className="card notfound">
          <div className="nf-emoji">🏷️</div>
          <div className="nf-q">{params.slug}</div>
          <div className="nf-text">ไม่พบป้ายนี้ในระบบ</div>
          <p className="tiny center">ป้ายอาจเป็นของรุ่นเก่า หรือชั้นนี้ถูกถอดออกจากผังแล้ว</p>
        </div>
      ) : (
        <GateForm slug={params.slug} mod={entry.mod} dgDesc={entry.dg_desc} />
      )}
    </main>
  );
}
