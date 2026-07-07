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

  return (
    <main className="wrap">
      <div className="head">
        <h1>ค้นตำแหน่งสินค้า</h1>
        <p>ใส่บาร์โค้ด (13 หลัก) หรือรหัสสินค้า (9 หลัก)</p>
      </div>

      <form className="searchbar" onSubmit={onSubmit}>
        <input
          ref={inputRef}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          pattern="[0-9]*"
          autoFocus
          enterKeyHint="search"
          placeholder="พิมพ์/สแกนเลข…"
          aria-label="เลขบาร์โค้ดหรือรหัสสินค้า"
        />
        <button type="submit" disabled={loading || !code.replace(/\D+/g, "")}>
          {loading ? "…" : "ค้นหา"}
        </button>
      </form>
      <p className="hint">เครื่องสแกนแบบต่อคีย์บอร์ดก็ใช้ได้ (สแกนแล้วค้นให้อัตโนมัติ)</p>

      {err && <div className="status err">⚠️ {err}</div>}

      {resp && !err && (
        <>
          {resp.found ? (
            <div className="results">
              {resp.locations.map((loc, i) => (
                <div className="card" key={`${loc.mod}-${loc.shelf}-${loc.pos}-${i}`}>
                  <div className="mod">
                    <small>จุดวาง</small>
                    {loc.mod}
                  </div>
                  <div className="grid">
                    <div className="cell">
                      <div className="k">ชั้นที่</div>
                      <div className="v">{loc.shelf}</div>
                    </div>
                    <div className="cell">
                      <div className="k">ตำแหน่งบนชั้น</div>
                      <div className="v">{loc.pos}</div>
                    </div>
                  </div>
                  {!loc.is_bay && <span className="tag secondary">POG ไม่มีเลข bay</span>}
                </div>
              ))}
              {resp.locations.length > 1 && (
                <p className="hint">พบ {resp.locations.length} ตำแหน่ง</p>
              )}
            </div>
          ) : (
            <div className="notfound">
              <div className="big">🔍</div>
              <div className="q">{resp.query}</div>
              <p>ไม่พบสินค้านี้ในผัง</p>
            </div>
          )}

          <div className="foot">
            สาขา {resp.store || "—"} · ข้อมูล ณ {fmtDate(resp.updated_at)}
          </div>
        </>
      )}
    </main>
  );
}
