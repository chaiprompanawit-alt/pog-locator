"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Scanner from "../scanner";

type GapItem = {
  item: string;
  barcode: string | null;
  shelf: number;
  pos: number;
  boxes: number[][];
};

type GapResp = {
  found: boolean;
  mod?: string;
  dg_desc?: string;
  store?: string;
  updated_at?: string;
  aspect?: number;
  has_img?: boolean;
  img?: string | null;
  items?: GapItem[];
  reason?: string;
  error?: string;
};

const ZOOM_MIN = 1;
const ZOOM_MAX = 6;

/**
 * แกะ slug จากสิ่งที่ QR ป้ายชั้นเก็บไว้ — payload คือ URL เต็ม
 * (https://pog-locator.vercel.app/g/<slug>) แต่รับกรณีพิมพ์ "1L3-1" ตรงๆ ด้วย
 */
function parseTarget(raw: string): { slug?: string; mod?: string } | null {
  const s = (raw || "").trim();
  if (!s) return null;
  const m = s.match(/\/g\/([^/?#\s]+)/i);
  if (m) return { slug: decodeURIComponent(m[1]) };
  if (/^https?:/i.test(s)) return null;      // URL อื่น = ไม่ใช่ป้ายของระบบนี้
  return { mod: s.toUpperCase() };
}

/** คัดลอกข้อความ — clipboard API ใช้ไม่ได้บางเครื่อง (http/เบราว์เซอร์เก่า) จึงมีทางถอย */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* ตกไปใช้วิธีสำรอง */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export default function GapScan() {
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<GapResp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(ZOOM_MIN);
  const [copied, setCopied] = useState<string | null>(null);
  const vpRef = useRef<HTMLDivElement>(null);

  async function load(q: { slug?: string; mod?: string }) {
    setLoading(true);
    setErr(null);
    setPicked(new Set());
    setCopied(null);
    setZoom(ZOOM_MIN);
    try {
      const qs = q.slug ? `slug=${encodeURIComponent(q.slug)}` : `mod=${encodeURIComponent(q.mod || "")}`;
      const r = await fetch(`/api/gap?${qs}`);
      const d: GapResp = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setData(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "โหลดชั้นนี้ไม่ได้");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const items = useMemo(() => data?.items ?? [], [data]);
  const pickedList = useMemo(
    () => items.filter((it) => picked.has(it.item)),
    [items, picked]
  );

  function toggle(item: string) {
    setCopied(null);
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  }

  // ข้อความสรุปที่จะวางลงแชท/ชีต — หนึ่งบรรทัดต่อสินค้า คั่นด้วย TAB
  // (วางใน LINE อ่านรู้เรื่อง วางใน Excel ตกลงช่องพอดี)
  const summary = useMemo(() => {
    if (!data?.mod || pickedList.length === 0) return "";
    const when = new Date().toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
    const head = `GAP ${data.mod} · ${when} · ${pickedList.length} รายการ`;
    const lines = pickedList.map(
      (it) => `${it.item}\t${it.barcode ?? "-"}\tช.${it.shelf}/ต.${it.pos}`
    );
    return [head, ...lines].join("\n");
  }, [data, pickedList]);

  async function onSummary() {
    if (!summary) return;
    const ok = await copyText(summary);
    setCopied(ok ? "คัดลอกแล้ว — วางได้เลย" : "คัดลอกไม่สำเร็จ กดค้างที่ข้อความเพื่อคัดลอกเอง");
  }

  async function onShare() {
    if (!summary) return;
    try {
      await navigator.share({ text: summary });
    } catch {
      /* ผู้ใช้ยกเลิกการแชร์ — ไม่ต้องทำอะไร */
    }
  }

  // ลากด้วยเมาส์เพื่อเลื่อนรูป (มือถือเลื่อนนิ้วตามปกติ)
  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType !== "mouse") return;
    // กดโดนกรอบสินค้า = ตั้งใจจะเลือก ไม่ใช่จะลากรูป — ต้องไม่ setPointerCapture
    // (capture จะดึง event ไปที่ viewport จน click ของปุ่มไม่เกิด กรอบเลยไม่เปลี่ยนสี)
    if ((e.target as HTMLElement).closest(".gap-box")) return;
    const vp = vpRef.current;
    if (!vp) return;
    const sx = e.clientX, sy = e.clientY;
    const l0 = vp.scrollLeft, t0 = vp.scrollTop;
    vp.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      vp.scrollLeft = l0 - (ev.clientX - sx);
      vp.scrollTop = t0 - (ev.clientY - sy);
    };
    const up = () => {
      vp.removeEventListener("pointermove", move);
      vp.removeEventListener("pointerup", up);
    };
    vp.addEventListener("pointermove", move);
    vp.addEventListener("pointerup", up);
  }

  // เตือนก่อนปิด/ถอยหลัง ถ้ายังเลือกค้างไว้แล้วไม่ได้สรุป — เดินเก็บมาทั้งชั้นแล้วหายนี่เจ็บ
  useEffect(() => {
    if (pickedList.length === 0) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pickedList.length]);

  return (
    <main className="page">
      <header className="topbar">
        <div className="brand">GAP</div>
        <div className="subtitle">
          <svg className="subtitle-icon" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">
            <path d="M120-120v-720h80v720h-80Zm640 0v-720h80v720h-80ZM280-280v-400h400v400H280Zm80-80h240v-240H360v240Z" />
          </svg>
          <span>เช็คของขาดที่ชั้น</span>
        </div>
      </header>

      <div className="card">
        <div className="card-head">เลือกชั้นที่จะเช็ค</div>
        <button type="button" className="btn scan-open" onClick={() => setScanning(true)}>
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm8 6v-8h2v2h2v-2h2v2h-2v2h2v4h-2v-2h-2v2h-2zm4-2v-2h-2v2h2z" />
          </svg>
          สแกน QR ป้ายชั้น
        </button>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const t = parseTarget(manual);
            if (t) load(t);
          }}
        >
          <div className="label-row">
            <label htmlFor="gap-mod">หรือพิมพ์รหัสชั้น</label>
            <span className="hint-right">เช่น 1L3-1</span>
          </div>
          <input
            id="gap-mod"
            className="field"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="1L3-1"
            enterKeyHint="go"
            autoComplete="off"
            aria-label="รหัสชั้น"
          />
          <button className="btn ghost" type="submit" disabled={loading || !manual.trim()}>
            {loading ? "กำลังโหลด…" : "เปิดชั้นนี้"}
          </button>
        </form>

        <p className="tiny center">
          <a href="/" className="gap-link">← กลับไปค้นตำแหน่งสินค้า</a>
        </p>
      </div>

      {scanning && (
        <Scanner
          mode="qr"
          onDetected={(raw) => {
            setScanning(false);
            const t = parseTarget(raw);
            if (t) load(t);
            else setErr("QR นี้ไม่ใช่ป้ายชั้นของระบบ POG");
          }}
          onClose={() => setScanning(false)}
        />
      )}

      {err && <div className="msg err">⚠️ {err}</div>}

      {data && !err && !data.found && (
        <div className="card notfound">
          <div className="nf-emoji">🗄️</div>
          <div className="nf-q">{data.mod || "—"}</div>
          <div className="nf-text">{data.reason || "ยังไม่มีรายการสินค้าของชั้นนี้"}</div>
        </div>
      )}

      {data && !err && data.found && (
        <div className="results">
          <div className="loc">
            <div className="loc-mod">
              <span>ชั้นที่เช็ค</span>
              <b>{data.mod}</b>
            </div>
            {data.dg_desc && <p className="tiny center">{data.dg_desc}</p>}

            <div className="fp">
              <div className="fp-cap">
                แตะที่สินค้าที่ <b>ขาด</b> — กรอบเขียวจะเปลี่ยนเป็นแดง
              </div>

              {data.has_img ? (
                <>
                  <div className="fp-viewport" ref={vpRef} onPointerDown={onPointerDown}>
                    <div className="fp-content" style={{ width: `${zoom * 100}%` }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={data.img || ""}
                        alt={`รูปชั้น ${data.mod}`}
                        className="fp-img"
                        draggable={false}
                        decoding="async"
                      />
                      {items.map((it) =>
                        it.boxes.map(([x, y, w, h], i) => (
                          <button
                            type="button"
                            key={`${it.item}-${i}`}
                            className={picked.has(it.item) ? "gap-box on" : "gap-box"}
                            style={{
                              left: `${x * 100}%`,
                              top: `${y * 100}%`,
                              width: `${w * 100}%`,
                              height: `${h * 100}%`,
                            }}
                            onClick={() => toggle(it.item)}
                            aria-pressed={picked.has(it.item)}
                            aria-label={`${it.item} ชั้น ${it.shelf} ตำแหน่ง ${it.pos}`}
                            title={`${it.item}${it.barcode ? ` · ${it.barcode}` : ""}`}
                          />
                        ))
                      )}
                    </div>
                  </div>

                  <div className="fp-tools">
                    <button
                      type="button"
                      className="fp-btn"
                      onClick={() => setZoom((z) => Math.max(ZOOM_MIN, +(z - 0.6).toFixed(1)))}
                      disabled={zoom <= ZOOM_MIN}
                      aria-label="ซูมออก"
                    >
                      −
                    </button>
                    <button type="button" className="fp-btn wide" onClick={() => setZoom(1)}>
                      ⤢ ทั้งชั้น
                    </button>
                    <button
                      type="button"
                      className="fp-btn"
                      onClick={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + 0.6).toFixed(1)))}
                      disabled={zoom >= ZOOM_MAX}
                      aria-label="ซูมเข้า"
                    >
                      +
                    </button>
                  </div>
                </>
              ) : (
                <div className="fp-note">🖼️ ยังไม่มีรูปชั้นของ Mod นี้ — เลือกจากรายการด้านล่างได้</div>
              )}
            </div>

            {/* รายการทั้งชั้น — ครอบคลุมสินค้าที่ไม่มีกรอบบนรูปด้วย */}
            <div className="gap-list">
              {items.map((it) => (
                <button
                  type="button"
                  key={it.item}
                  className={picked.has(it.item) ? "gap-row on" : "gap-row"}
                  onClick={() => toggle(it.item)}
                  aria-pressed={picked.has(it.item)}
                >
                  <span className="gap-tick">{picked.has(it.item) ? "●" : "○"}</span>
                  <span className="gap-codes">
                    <b className="num">{it.item}</b>
                    <span className="tiny">{it.barcode ?? "ไม่มีบาร์โค้ด"}</span>
                  </span>
                  <span className="gap-where">ช.{it.shelf}/ต.{it.pos}</span>
                </button>
              ))}
            </div>
            <p className="tiny center">ทั้งชั้นมี {items.length} รายการ</p>
          </div>
        </div>
      )}

      {data?.found && (
        <div className="gap-bar">
          <div className="gap-count">
            เลือกแล้ว <b className="num">{pickedList.length}</b>
          </div>
          <button
            type="button"
            className="btn gap-sum"
            onClick={onSummary}
            disabled={pickedList.length === 0}
          >
            📋 สรุปรวม & คัดลอก
          </button>
        </div>
      )}

      {copied && (
        <div className="card gap-out">
          <div className="msg ok">{copied}</div>
          <textarea className="field gap-text" readOnly value={summary} rows={Math.min(12, pickedList.length + 2)} />
          <div className="fp-tools">
            <button type="button" className="fp-btn wide" onClick={onSummary}>คัดลอกอีกครั้ง</button>
            {typeof navigator !== "undefined" && "share" in navigator && (
              <button type="button" className="fp-btn wide" onClick={onShare}>แชร์</button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
