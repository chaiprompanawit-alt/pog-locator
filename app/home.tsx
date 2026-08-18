"use client";

import { useRef, useState } from "react";
import type { Loc } from "@/lib/lookup";
import Scanner from "./scanner";
import Floorplan from "./floorplan";
import ShelfView from "./shelf";

type ApiResp = {
  query: string;
  key: string | null;
  found: boolean;
  store: string;
  updated_at: string;
  locations: Loc[];
  label?: { item: string | null; barcode: string | null } | null;
  error?: string;
};

type Mode = "barcode" | "item";

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("th-TH", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("barcode");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<ApiResp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function search(q: string) {
    // ส่งดิบๆ (แค่ตัดช่องว่างหัวท้าย) — ห้ามล้างตัวคั่นทิ้ง ไม่งั้นบาร์โค้ดป้ายชั้น
    // ที่เป็น "รหัสสินค้า/บาร์โค้ด/..." จะกลายเป็นเลขยาวก้อนเดียวจนแยกไม่ออก
    const query = q.trim();
    if (!/\d/.test(query)) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/lookup?code=${encodeURIComponent(query)}`);
      const data: ApiResp = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setResp(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "ค้นหาไม่สำเร็จ");
      setResp(null);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    search(code);
    inputRef.current?.blur();
  }

  const hasInput = /\d/.test(code);

  return (
    <main className="page">
      <header className="topbar">
        <div className="brand">POG</div>
        <div className="subtitle">
          <svg className="subtitle-icon" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">
            <path d="M80-145v-304h304v304H80Zm60-60h184v-184H140v184Zm81-361 220-354 220 354H221Zm108-60h224L441-807 329-626ZM870-51 769-152q-22 15-48.11 23.5T666-120q-74 0-124-50t-50-124q0-74 50-124t124-50q74 0 124 50t50 124q0 28-7.52 52.5T811-196L913-94l-43 43ZM747-213.08q33-33.09 33-81Q780-342 746.92-375q-33.09-33-81-33Q618-408 585-374.92q-33 33.09-33 81Q552-246 585.08-213q33.09 33 81 33Q714-180 747-213.08ZM324-389Zm117-237Z" />
          </svg>
          <span>ค้นตำแหน่งสินค้า</span>
        </div>
      </header>

      <div className="card">
        <div className="card-head">ค้นหาสินค้า</div>

        <div className="seg" role="tablist">
          <button
            type="button"
            className={mode === "barcode" ? "seg-btn on" : "seg-btn"}
            aria-selected={mode === "barcode"}
            onClick={() => setMode("barcode")}
          >
            บาร์โค้ด (13)
          </button>
          <button
            type="button"
            className={mode === "item" ? "seg-btn on" : "seg-btn"}
            aria-selected={mode === "item"}
            onClick={() => setMode("item")}
          >
            รหัสสินค้า (9)
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="label-row">
            <label htmlFor="code">{mode === "barcode" ? "เลขบาร์โค้ด" : "รหัสสินค้า"}</label>
            <span className="hint-right">{mode === "barcode" ? "ตัวเลข 13 หลัก" : "ตัวเลข 9 หลัก"}</span>
          </div>
          <input
            id="code"
            ref={inputRef}
            className="field"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            /* ไม่ใส่ pattern="[0-9]*" — บาร์โค้ดป้ายชั้นมี "/" ปนมา ถ้าใส่ไว้
               เครื่องสแกนแบบต่อคีย์บอร์ดจะยิงจบด้วย Enter แล้วโดน browser บล็อกไม่ให้ submit */
            autoFocus
            enterKeyHint="search"
            placeholder={mode === "barcode" ? "เช่น 8850..." : "เช่น 071073248"}
            aria-label="เลขบาร์โค้ดหรือรหัสสินค้า"
          />
          <p className="tiny">พิมพ์หรือสแกน — สแกนบาร์โค้ดบนป้ายราคาที่ชั้นก็ได้ ระบบแยกรหัสสินค้าให้เอง</p>
          <button className="btn" type="submit" disabled={loading || !hasInput}>
            {loading ? "กำลังค้นหา…" : "ค้นหาตำแหน่ง"}
          </button>
        </form>

        <button type="button" className="btn ghost scan-open" onClick={() => setScanning(true)}>
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M9 3 7.2 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.2L15 3H9zm3 5a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
          </svg>
          สแกนด้วยกล้อง
        </button>
      </div>

      {scanning && (
        <Scanner
          onDetected={(raw) => {
            setScanning(false);
            setMode("barcode");
            setCode(raw);
            search(raw);
          }}
          onClose={() => setScanning(false)}
        />
      )}

      {err && <div className="msg err">⚠️ {err}</div>}

      {resp && !err && resp.label && (
        <div className="from-label">
          🏷️ อ่านจากป้ายราคาที่ชั้น
          {resp.label.item && <> · รหัสสินค้า <b>{resp.label.item}</b></>}
          {resp.label.barcode && <> · บาร์โค้ด <b>{resp.label.barcode}</b></>}
        </div>
      )}

      {resp && !err && (
        resp.found ? (
          <div className="results">
            {resp.locations.map((loc, i) => (
              <div className="loc" key={`${loc.mod}-${loc.shelf}-${loc.pos}-${i}`}>
                <div className="loc-mod">
                  <span>จุดวาง</span>
                  <b>{loc.mod}</b>
                </div>
                <div className="loc-grid">
                  <div className="loc-cell">
                    <span>ชั้นที่</span>
                    <b className="num">{loc.shelf}</b>
                  </div>
                  <div className="loc-cell">
                    <span>ตำแหน่งบนชั้น</span>
                    <b className="num">{loc.pos}</b>
                  </div>
                </div>
                {!loc.is_bay && <div className="badge">POG ไม่มีเลข bay</div>}
                <ShelfView mod={loc.mod} item={loc.item} />
                <Floorplan mod={loc.mod} />
              </div>
            ))}
            {resp.locations.length > 1 && (
              <p className="tiny center">พบ {resp.locations.length} ตำแหน่ง</p>
            )}
            <div className="foot">
              สาขา {resp.store || "—"} · ข้อมูล ณ {fmtDate(resp.updated_at)}
            </div>
          </div>
        ) : (
          <div className="card notfound">
            <div className="nf-emoji">🔍</div>
            <div className="nf-q">{resp.query}</div>
            <div className="nf-text">ไม่พบสินค้านี้ในผัง</div>
            <div className="foot">
              สาขา {resp.store || "—"} · ข้อมูล ณ {fmtDate(resp.updated_at)}
            </div>
          </div>
        )
      )}
    </main>
  );
}
