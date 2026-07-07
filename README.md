# POG Locator (web)

ค้นตำแหน่งสินค้าในร้านด้วยบาร์โค้ด — ใส่เลข **13 หลัก** (บาร์โค้ด) หรือ **9 หลัก** (รหัสสินค้า)
แล้วบอก **จุดวาง (Mod) / ชั้นที่วาง / ตำแหน่งบนชั้น**

Next.js (App Router) · deploy บน Vercel · "DB" = ไฟล์ `index.json` public บน Google Drive

---

## ข้อมูลมาจากไหน

ฝั่ง desktop app (โปรเจกต์แม่) ตอน process planogram จะแตกตารางตำแหน่งสินค้า
สร้าง `index.json` แล้วอัปขึ้น Drive แบบ public. เว็บนี้แค่ **อ่าน** ไฟล์นั้น
(ผ่าน API route ฝั่ง server เพื่อเลี่ยง CORS + cache 60 วิ)

```
พิมพ์/สแกนเลข → /api/lookup?code=xxxx → ดึง index จาก Drive → คืน [{mod, shelf, pos}]
```

## รันในเครื่อง (dev)

```bash
cd web
npm install
cp .env.example .env.local     # แล้วแก้ค่าในไฟล์
npm run dev                    # http://localhost:3000
```

โหมด dev ไม่ต้องต่อ Drive — ตั้งใน `.env.local`:

```
LOCAL_INDEX_PATH=public/index.json
```

(มีไฟล์ตัวอย่าง `public/index.json` = COOKING SAUCE 1 planogram, 130 สินค้า ให้ลองแล้ว)
ลองเลข `8801052801773` → ควรได้ จุดวาง 1L3-1 · ชั้น 5 · ตำแหน่ง 1

## ตั้งค่าโปรดักชัน (Vercel)

ตั้ง env ตัวใดตัวหนึ่ง (เอาค่าจากตอนรัน `python backfill_index.py` ฝั่ง desktop):

| env | ค่า |
|---|---|
| `DRIVE_INDEX_FILE_ID` | fileId ของ `index.json` บน Drive |
| `DRIVE_INDEX_URL` | (ทางเลือก) URL เต็ม จะทับ FILE_ID |

> ⚠️ อย่าตั้ง `LOCAL_INDEX_PATH` บน Vercel (มันจะไปหาไฟล์ในเครื่อง serverless ที่ไม่มี)

## Deploy: GitHub + Vercel (repo แยกของ web/)

โฟลเดอร์นี้ตั้งใจให้เป็น **git repo ของตัวเอง** (แยกจากโปรเจกต์ Python ที่มี credential)

```bash
cd web
git init
git add -A
git commit -m "POG locator web"
gh repo create pog-locator --public --source=. --remote=origin --push
```

แล้วที่ Vercel: New Project → เลือก repo `pog-locator` → ใส่ env `DRIVE_INDEX_FILE_ID` → Deploy

## ต่อยอด (เฟสถัดไป)

- กล้องสแกนบาร์โค้ด (`BarcodeDetector` / html5-qrcode) — ตอนนี้พิมพ์/สแกนคีย์บอร์ดได้แล้ว
- ลิงก์เปิดผัง PDF ของ bay นั้น, แสดงยี่ห้อ/ขนาด
