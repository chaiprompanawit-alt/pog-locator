import type { Metadata } from "next";
import { cookies } from "next/headers";
import { GATE_COOKIE, verifyToken } from "@/lib/gate";
import Consent from "../consent";
import UnlockForm from "../unlock-form";
import GapScan from "./gap-scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gap Scan | POG",
  robots: { index: false, follow: false },
};

export default function GapPage() {
  // ด่านเดียวกับหน้าแรก — ยังไม่ผ่านก็ให้กรอกรหัสก่อน (API ฝั่งหลังก็เช็กซ้ำอยู่แล้ว)
  let passed = false;
  try {
    passed = verifyToken(cookies().get(GATE_COOKIE)?.value);
  } catch {
    passed = false;
  }
  return (
    <>
      <Consent />
      {passed ? <GapScan /> : <UnlockForm />}
    </>
  );
}
