"use client";

import { useState } from "react";

type Props = { slug: string; mod: string; dgDesc: string };

export default function GateForm({ slug, mod, dgDesc }: Props) {
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
        body: JSON.stringify({ slug, code: value }),
      });
      const data: { ok?: boolean; url?: string; error?: string } = await r.json();
      if (!r.ok || !data.url) throw new Error(data.error || `HTTP ${r.status}`);
      // ผ่านแล้ว → ไปที่ไฟล์บน Drive (replace เพื่อไม่ให้กด back กลับมาหน้าด่านค้าง)
      window.location.replace(data.url);
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
    <div className="card">
      <div className="card-head">ใส่รหัสก่อนเปิดผัง</div>

      <div className="loc-mod">
        <span>ชั้นที่สแกน</span>
        <b>{mod}</b>
      </div>
      {dgDesc && <p className="tiny center gate-desc">{dgDesc}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(code);
        }}
      >
        <div className="label-row gate-label">
          <label htmlFor="gate-code">รหัสพนักงาน</label>
          <span className="hint-right">ตัวเลข 4 หลัก</span>
        </div>
        <input
          id="gate-code"
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
          {busy ? "กำลังตรวจสอบ…" : "เปิดผังชั้นนี้"}
        </button>
      </form>

      {err && <div className="msg err gate-err">⚠️ {err}</div>}

      <p className="tiny center">ใส่ครั้งเดียว เครื่องนี้จำไว้ 30 วัน</p>
    </div>
  );
}
