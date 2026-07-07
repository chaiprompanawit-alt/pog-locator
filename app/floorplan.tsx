"use client";

import { useEffect, useRef, useState } from "react";
import {
  loadFloorplan,
  findBay,
  type FloorplanData,
  type BayHit,
} from "@/lib/floorplan";

const ZOOM_MIN = 1;
const ZOOM_MAX = 9;

// ซูมเริ่มต้น: เจอ bay ตรงตัวซูมลึก (bay เล็ก), เจอแค่ทางเดินซูมกลาง
function initialZoom(hit: BayHit): number {
  return hit.kind === "exact" ? 5 : hit.kind === "aisle" ? 3 : 1;
}

export default function Floorplan({ mod }: { mod: string }) {
  const [data, setData] = useState<FloorplanData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [zoom, setZoom] = useState(5);
  const vpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    loadFloorplan()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setErr(e instanceof Error ? e.message : "โหลดแผนผังไม่ได้"));
    return () => {
      alive = false;
    };
  }, []);

  const hit = data ? findBay(data, mod) : null;

  // เลื่อนให้หมุดอยู่กลางจอ (คำนวณจากสัดส่วน ใช้ได้แม้รูปยังโหลดไม่เสร็จ)
  function recenter() {
    const vp = vpRef.current;
    if (!vp || !data || !hit || hit.kind === "none") return;
    const cx = hit.rect.x + hit.rect.w / 2;
    const cy = hit.rect.y + hit.rect.h / 2;
    const contentW = vp.clientWidth * zoom;
    const contentH = contentW / data.aspect;
    vp.scrollLeft = cx * contentW - vp.clientWidth / 2;
    vp.scrollTop = cy * contentH - vp.clientHeight / 2;
  }

  // ตั้งซูมเริ่มต้นตามชนิดที่เจอ (เมื่อ data มา หรือเปลี่ยน mod)
  useEffect(() => {
    if (hit) setZoom(initialZoom(hit));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, mod]);

  // เลื่อนให้หมุดอยู่กลางจอทุกครั้งที่ซูม/เปลี่ยนเป้า
  useEffect(() => {
    const id = requestAnimationFrame(recenter);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, mod, zoom]);

  // ลากด้วยเมาส์เพื่อเลื่อน (มือถือใช้เลื่อนนิ้วปกติอยู่แล้ว)
  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType !== "mouse") return;
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

  if (err) return <div className="fp-note">🗺️ {err}</div>;
  if (!data || !hit) return <div className="fp-note">กำลังโหลดแผนผัง…</div>;

  if (hit.kind === "none") {
    return <div className="fp-note">🗺️ Mod นี้ไม่มีตำแหน่งบนแผนผัง</div>;
  }

  const cx = hit.rect.x + hit.rect.w / 2;
  const cy = hit.rect.y + hit.rect.h / 2;
  const isAisle = hit.kind === "aisle";

  return (
    <div className="fp">
      <div className="fp-cap">
        {isAisle ? (
          <>📍 อยู่แถวโซน <b>{hit.code}</b> (โดยประมาณ)</>
        ) : (
          <>📍 อยู่ที่ <b>{hit.code}</b> บนแผนผัง</>
        )}
      </div>

      <div
        className="fp-viewport"
        ref={vpRef}
        onPointerDown={onPointerDown}
      >
        <div className="fp-content" style={{ width: `${zoom * 100}%` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/floorplan.png"
            alt="แผนผังร้าน"
            className="fp-img"
            draggable={false}
            onLoad={recenter}
          />
          {isAisle && (
            <div
              className="fp-region"
              style={{
                left: `${hit.rect.x * 100}%`,
                top: `${hit.rect.y * 100}%`,
                width: `${hit.rect.w * 100}%`,
                height: `${hit.rect.h * 100}%`,
              }}
            />
          )}
          <div className="fp-pin" style={{ left: `${cx * 100}%`, top: `${cy * 100}%` }}>
            <span className="fp-pin-dot" />
          </div>
        </div>
      </div>

      <div className="fp-tools">
        <button
          type="button"
          className="fp-btn"
          onClick={() => setZoom((z) => Math.max(ZOOM_MIN, +(z - 1).toFixed(1)))}
          disabled={zoom <= ZOOM_MIN}
          aria-label="ซูมออก"
        >
          −
        </button>
        <button
          type="button"
          className="fp-btn wide"
          onClick={() => setZoom(1)}
          aria-label="ดูทั้งแผน"
        >
          ⤢ ทั้งแผน
        </button>
        <button
          type="button"
          className="fp-btn wide"
          onClick={() => setZoom(initialZoom(hit))}
          aria-label="ไปที่หมุด"
        >
          🎯 ที่หมุด
        </button>
        <button
          type="button"
          className="fp-btn"
          onClick={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + 1).toFixed(1)))}
          disabled={zoom >= ZOOM_MAX}
          aria-label="ซูมเข้า"
        >
          +
        </button>
      </div>
    </div>
  );
}
