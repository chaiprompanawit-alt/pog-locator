"use client";

import { useEffect, useRef, useState } from "react";

type ShelfData = {
  found: boolean;
  mod: string;
  aspect: number;
  items: Record<string, number[][]>;
  img: string;
};

const ZOOM_MIN = 1;
const ZOOM_MAX = 6;
const ZOOM_ITEM = 2.6; // ซูมเริ่มต้นให้เห็นสินค้าเป้าหมายชัด (ชั้นเต็มสินค้าจะเล็กมาก)

/**
 * ShelfView — รูป "ชั้นวางจริง" ของ Mod พร้อมกรอบแดงทับตำแหน่งสินค้าที่ค้นเจอ
 * ดึงพิกัดจาก /api/shelf (shelf_map) แล้ววาดกรอบของ item ที่ส่งเข้ามา
 */
export default function ShelfView({ mod, item }: { mod: string; item?: string }) {
  const [data, setData] = useState<ShelfData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [zoom, setZoom] = useState(ZOOM_ITEM);
  const vpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setErr(null);
    fetch(`/api/shelf?mod=${encodeURIComponent(mod)}`)
      .then((r) => r.json())
      .then((d) => alive && setData(d))
      .catch((e) => alive && setErr(e instanceof Error ? e.message : "โหลดรูปชั้นไม่ได้"));
    return () => {
      alive = false;
    };
  }, [mod]);

  const boxes: number[][] =
    (item && data?.found && data.items?.[item]) ? data.items[item] : [];

  // เลื่อนให้กรอบสินค้าตัวแรกอยู่กลางจอ (คำนวณจากสัดส่วน ใช้ได้แม้รูปยังโหลดไม่เสร็จ)
  function recenter() {
    const vp = vpRef.current;
    if (!vp || !data?.found || boxes.length === 0) return;
    const [x, y, w, h] = boxes[0];
    const cx = x + w / 2;
    const cy = y + h / 2;
    const contentW = vp.clientWidth * zoom;
    const contentH = contentW / (data.aspect || 1);
    vp.scrollLeft = cx * contentW - vp.clientWidth / 2;
    vp.scrollTop = cy * contentH - vp.clientHeight / 2;
  }

  useEffect(() => {
    const id = requestAnimationFrame(recenter);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, zoom, item]);

  // ลากด้วยเมาส์เพื่อเลื่อน (มือถือเลื่อนนิ้วปกติ)
  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType !== "mouse") return;
    const vp = vpRef.current;
    if (!vp) return;
    const sx = e.clientX,
      sy = e.clientY;
    const l0 = vp.scrollLeft,
      t0 = vp.scrollTop;
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

  if (err) return <div className="fp-note">🖼️ {err}</div>;
  if (!data) return <div className="fp-note">กำลังโหลดรูปชั้น…</div>;
  if (!data.found) return <div className="fp-note">🖼️ ยังไม่มีรูปชั้นของ Mod นี้</div>;

  return (
    <div className="fp">
      <div className="fp-cap">
        {boxes.length > 0 ? (
          <>
            🖼️ สินค้าอยู่ตรง <b>กรอบแดง</b> บนชั้น
            {boxes.length > 1 && <> · {boxes.length} จุด</>}
          </>
        ) : (
          <>🖼️ รูปชั้นของ <b>{mod}</b></>
        )}
      </div>

      <div className="fp-viewport" ref={vpRef} onPointerDown={onPointerDown}>
        <div className="fp-content" style={{ width: `${zoom * 100}%` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.img}
            alt={`รูปชั้น ${mod}`}
            className="fp-img"
            draggable={false}
            onLoad={recenter}
          />
          {boxes.map(([x, y, w, h], i) => (
            <div
              key={i}
              className="fp-box"
              style={{
                left: `${x * 100}%`,
                top: `${y * 100}%`,
                width: `${w * 100}%`,
                height: `${h * 100}%`,
              }}
            />
          ))}
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
        <button type="button" className="fp-btn wide" onClick={() => setZoom(1)} aria-label="ดูทั้งชั้น">
          ⤢ ทั้งชั้น
        </button>
        <button
          type="button"
          className="fp-btn wide"
          onClick={() => setZoom(ZOOM_ITEM)}
          disabled={boxes.length === 0}
          aria-label="ไปที่สินค้า"
        >
          🎯 ที่สินค้า
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
    </div>
  );
}
