"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  onDetected: (code: string) => void;
  onClose: () => void;
};

// BarcodeDetector ยังไม่มีใน TS DOM types → ประกาศหลวมๆ ผ่าน any
export default function Scanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef(false);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const [status, setStatus] = useState("กำลังเปิดกล้องหลัง…");
  const [fatal, setFatal] = useState(false);

  useEffect(() => {
    stopRef.current = false;

    function stop() {
      stopRef.current = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    async function openRearCamera(): Promise<MediaStream | null> {
      // บังคับกล้องหลัง (exact) ก่อน — ถ้าอุปกรณ์ไม่ให้ exact ค่อยลอง ideal
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: "environment" } },
          audio: false,
        });
      } catch {
        try {
          return await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          });
        } catch {
          return null;
        }
      }
    }

    async function start() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const BD = (window as any).BarcodeDetector;
      if (!BD) {
        setStatus("เบราว์เซอร์นี้ไม่รองรับสแกน — ใช้พิมพ์แทน (แนะนำ Chrome บน Android)");
        setFatal(true);
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("อุปกรณ์นี้เปิดกล้องในเบราว์เซอร์ไม่ได้");
        setFatal(true);
        return;
      }

      const stream = await openRearCamera();
      if (!stream) {
        setStatus("เปิดกล้องหลังไม่ได้ — อนุญาตสิทธิ์กล้อง หรือไม่มีกล้องหลัง");
        setFatal(true);
        return;
      }
      if (stopRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        /* บาง browser เล่นอัตโนมัติไม่ได้ ไม่เป็นไร */
      }
      setStatus("เล็งบาร์โค้ดให้อยู่ในกรอบ");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let detector: any;
      try {
        detector = new BD({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"],
        });
      } catch {
        detector = new BD();
      }

      while (!stopRef.current) {
        try {
          const codes = await detector.detect(video);
          if (codes && codes.length) {
            // ส่งค่าดิบ ไม่ล้างตัวคั่นทิ้ง — ป้ายราคาที่ชั้นเข้ารหัส
            // "รหัสสินค้า/บาร์โค้ด/..." ไว้ด้วยกัน ฝั่ง lookup ต้องเอาไปแยกต่อ
            const raw = String(codes[0].rawValue || "").trim();
            const nDigits = (raw.match(/\d/g) ?? []).length;
            if (nDigits >= 6) {
              stop();
              onDetectedRef.current(raw);
              return;
            }
          }
        } catch {
          /* detect อาจ throw ระหว่างเฟรมยังไม่พร้อม — ข้าม */
        }
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    start();
    return () => stop();
  }, []);

  return (
    <div className="scan-overlay" role="dialog" aria-modal="true">
      <div className="scan-box">
        <video ref={videoRef} className="scan-video" playsInline muted autoPlay />
        {!fatal && <div className="scan-frame" />}
      </div>
      <div className="scan-status">{status}</div>
      <button type="button" className="btn ghost scan-close" onClick={onClose}>
        ปิดกล้อง
      </button>
    </div>
  );
}
