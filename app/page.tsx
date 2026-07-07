"use client";

import { useRef, useState } from "react";
import type { Loc } from "@/lib/lookup";

type ApiResp = {
  query: string;
  key: string | null;
  found: boolean;
  store: string;
  updated_at: string;
  locations: Loc[];
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
  const inputRef = useRef<HTMLInputElement>(null);

  async function search(q: string) {
    const query = q.replace(/\D+/g, "");
    if (!query) return;
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

  const hasInput = !!code.replace(/\D+/g, "");

  return (
    <main className="page">
      <header className="topbar">
        <div className="brand">POG</div>
        <div className="subtitle">ค้นตำแหน่งสินค้า</div>
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
            pattern="[0-9]*"
            autoFocus
            enterKeyHint="search"
            placeholder={mode === "barcode" ? "เช่น 8850..." : "เช่น 071073248"}
            aria-label="เลขบาร์โค้ดหรือรหัสสินค้า"
          />
          <p className="tiny">พิมพ์หรือสแกน (เครื่องสแกนต่อคีย์บอร์ดก็ค้นให้อัตโนมัติ)</p>
          <button className="btn" type="submit" disabled={loading || !hasInput}>
            {loading ? "กำลังค้นหา…" : "ค้นหาตำแหน่ง"}
          </button>
        </form>
      </div>

      {err && <div className="msg err">⚠️ {err}</div>}

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
