"use client";

import { useEffect, useState } from "react";

const KEY = "pog_consent_v1";

/**
 * ป๊อปอัปครั้งแรกที่เข้าเว็บ — แจ้งเรื่องคุกกี้ + ขอสิทธิ์กล้องล่วงหน้า
 *
 * คุกกี้ที่ใช้มีตัวเดียว (pog_gate = จำว่ายืนยันรหัสแล้ว 30 วัน) เป็นคุกกี้จำเป็น
 * ไม่มี tracking/analytics → จึงเป็นการ "รับทราบ" ไม่ใช่ตัวเลือกเปิด-ปิด
 *
 * สิทธิ์กล้องขอตรงนี้เพื่อให้ป๊อปอัปของเบราว์เซอร์เด้งตอนผู้ใช้ตั้งใจอยู่กับหน้าจอ
 * — ไม่ใช่ตอนกดปุ่มสแกนแล้วต้องรอ. ขอเสร็จปิดสตรีมทันที ไม่ได้อัดหรือส่งอะไรออกไป
 * จำคำตอบไว้ใน localStorage ของเครื่อง (ไม่ส่งขึ้น server)
 */
export default function Consent() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // อ่าน localStorage ใน effect เท่านั้น — ถ้าอ่านตอน render ฝั่ง server จะ hydrate ไม่ตรงกัน
  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      setShow(true); // โหมดส่วนตัวบางตัวห้ามอ่าน → ถามใหม่ทุกครั้ง ดีกว่าไม่ถามเลย
    }
  }, []);

  function remember(camera: "granted" | "denied" | "skipped") {
    try {
      localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), camera }));
    } catch {
      /* เขียนไม่ได้ก็ช่างมัน — แค่จะถามใหม่รอบหน้า */
    }
    setShow(false);
  }

  async function acceptWithCamera() {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      // ขอกล้องหลังแบบไม่บังคับ — ที่ต้องการคือ "สิทธิ์" ไม่ใช่ภาพ ปิดสตรีมทิ้งทันที
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      stream.getTracks().forEach((t) => t.stop());
      remember("granted");
    } catch {
      // ปฏิเสธ/ไม่มีกล้อง → ใช้เว็บต่อได้ตามปกติ แค่พิมพ์เลขเอง
      setBusy(false);
      setNote("ไม่ได้รับสิทธิ์กล้อง — ใช้งานต่อได้โดยพิมพ์เลขเอง");
      remember("denied");
    }
  }

  if (!show) return null;

  return (
    <div className="consent-overlay" role="dialog" aria-modal="true" aria-labelledby="consent-head">
      <div className="card consent-card">
        <div className="card-head" id="consent-head">ก่อนเริ่มใช้งาน</div>

        <ul className="consent-list">
          <li>
            <span className="consent-ico" aria-hidden="true">🍪</span>
            <div>
              <b>คุกกี้</b>
              <p className="tiny">เก็บคุกกี้ที่จำเป็นตัวเดียว เพื่อจำว่าเครื่องนี้ยืนยันรหัสแล้ว 30 วัน ไม่มีการติดตามโฆษณา</p>
            </div>
          </li>
          <li>
            <span className="consent-ico" aria-hidden="true">📷</span>
            <div>
              <b>กล้อง</b>
              <p className="tiny">ใช้สแกนบาร์โค้ดบนป้ายราคาเท่านั้น ภาพประมวลผลในเครื่อง ไม่มีการบันทึกหรือส่งออก</p>
            </div>
          </li>
        </ul>

        {note && <div className="msg err consent-note">⚠️ {note}</div>}

        <button className="btn" type="button" onClick={acceptWithCamera} disabled={busy}>
          {busy ? "กำลังขอสิทธิ์กล้อง…" : "ยอมรับ และอนุญาตกล้อง"}
        </button>
        <button
          className="btn ghost consent-skip"
          type="button"
          onClick={() => remember("skipped")}
          disabled={busy}
        >
          ยอมรับ ไม่ใช้กล้อง
        </button>

        <p className="tiny center">เปลี่ยนใจภายหลังได้จากการตั้งค่าสิทธิ์ของเบราว์เซอร์</p>
      </div>
    </div>
  );
}
