import { cookies } from "next/headers";
import { GATE_COOKIE, verifyToken } from "@/lib/gate";
import Consent from "./consent";
import Home from "./home";
import UnlockForm from "./unlock-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function Page() {
  // ครั้งแรกที่ใช้งาน (หรือคุกกี้หมดอายุ/เปลี่ยนรหัส) → ให้กรอกรหัสก่อน
  // verifyToken เรียก gateCode() ซึ่ง throw ถ้าไม่ได้ตั้ง env → ถือว่าไม่ผ่าน
  let passed = false;
  try {
    passed = verifyToken(cookies().get(GATE_COOKIE)?.value);
  } catch {
    passed = false;
  }
  return (
    <>
      <Consent />
      {passed ? <Home /> : <UnlockForm />}
    </>
  );
}
