"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * ด่านครั้งแรกของตัวเว็บ — ใส่รหัส 4 หลักก่อนใช้งานหน้าค้นหา
 * ใช้ /api/gate ตัวเดียวกับหน้าสแกน QR แต่ไม่ส่ง slug (ไม่ได้ขอลิงก์ Drive)
 * ผ่านแล้ว server ตั้งคุกกี้ 30 วัน → refresh ให้ server component เรนเดอร์หน้าค้นหาแทน
 */
export default function UnlockForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(value: string) {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: value }),
      });
      const data: { ok?: boolean; error?: string } = await r.json();
      if (!r.ok || !data.ok) throw new Error(data.error || `HTTP ${r.status}`);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "ยืนยันไม่สำเร็จ");
      setCode("");
      setBusy(false);
    }
  }

  function onChange(v: string) {
    const digits = v.replace(/\D+/g, "").slice(0, 4);
    setCode(digits);
    if (err) setErr(null);
    if (digits.length === 4) submit(digits);   // ครบ 4 หลัก → ยืนยันให้เลย
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

      <div className="card">
        <div className="card-head">ใส่รหัสก่อนเริ่มใช้งาน</div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(code);
          }}
        >
          <div className="label-row gate-label">
            <label htmlFor="unlock-code">รหัสพนักงาน</label>
            <span className="hint-right">ตัวเลข 4 หลัก</span>
          </div>
          <input
            id="unlock-code"
            className="field gate-code"
            value={code}
            onChange={(e) => onChange(e.target.value)}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            autoFocus
            autoComplete="off"
            enterKeyHint="go"
            disabled={busy}
            placeholder="••••"
            aria-label="รหัส 4 หลัก"
          />
          <button className="btn" type="submit" disabled={busy || code.length < 4}>
            {busy ? "กำลังตรวจสอบ…" : "เริ่มใช้งาน"}
          </button>
        </form>

        {err && <div className="msg err gate-err">⚠️ {err}</div>}

        <p className="tiny center">ใส่ครั้งเดียว เครื่องนี้จำไว้ 30 วัน</p>
      </div>
    </main>
  );
}
