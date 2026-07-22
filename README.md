# Bảng điều khiển gửi tin nhắn (Next.js + Supabase + n8n)

## 1. Cài đặt

```bash
npm install
cp .env.example .env.local
# điền các giá trị thật vào .env.local
npm run dev
```

## 2. Setup Supabase

1. Tạo project Supabase mới (nếu chưa có).
2. Vào **SQL Editor**, chạy toàn bộ nội dung file `supabase/schema.sql`.
   File này tạo:
   - Bảng `assets` (danh sách tài nguyên ở Vùng 1)
   - Bảng `jobs` (trạng thái xử lý mỗi lần submit)
   - Storage bucket `attachments` (chứa ảnh đính kèm)
   - RLS policy: client (anon key) chỉ được **đọc**; mọi thao tác ghi phải qua `service_role` key.
3. Lấy 3 giá trị trong **Settings → API** để điền vào `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (giữ bí mật, không public)

## 3. Setup n8n

### a) Workflow nhận request gửi tin (dùng cho form chính)

1. Tạo Webhook node, method `POST`, copy URL vào `N8N_SEND_MESSAGE_WEBHOOK_URL`.
2. (Khuyến nghị) Bật xác thực Header Auth với key `X-Webhook-Secret`, giá trị trùng với `N8N_WEBHOOK_SECRET` trong `.env.local`.
3. Node **Respond to Webhook** đặt sớm để trả lời ngay, không chờ xử lý xong (xem cấu trúc payload nhận được ở mục 4 bên dưới — `job_id` nằm sẵn trong đó).
4. Sau khi xử lý xong toàn bộ, dùng node **Supabase** (Update) để cập nhật bảng `jobs`:
   ```
   WHERE id = {{ $json.job_id }}
   SET status = 'done' (hoặc 'error')
       result = {...}  -- ví dụ: { "sent": 45, "failed": 2 }
       error_message = '...' (nếu lỗi)
   ```
   Dùng `service_role` key khi cấu hình credential Supabase trong n8n (không dùng anon key, vì anon bị chặn ghi theo RLS).

### b) Workflow đăng nhập QR (ghi vào bảng `assets`)

Đây là flow riêng bạn đã có kế hoạch: trigger từ nút "Đăng nhập" trên web → n8n trả QR → sau khi quét xong, n8n `INSERT` (hoặc `UPSERT`) vào bảng `assets` với `asset_id`, `asset_name`, `status = 'active'`.
Ngay khi có bản ghi mới, trang **Vùng 1** sẽ tự cập nhật danh sách nhờ Supabase Realtime (không cần refresh) — component `AssetSelector.jsx` đã lắng nghe sẵn.

## 4. Cấu trúc payload gửi từ web sang n8n (POST tới webhook)

```json
{
  "job_id": "uuid-do-supabase-tao",
  "asset_id": "100033029992497",
  "asset_name": "Tên page đã chọn",
  "user_number_list": ["0987000001", "0987000002", "..."],
  "message": {
    "content": "@khachhang{icon}{Sale|Giảm Giá|Khuyến Mãi}",
    "ai_auto_spin": false
  },
  "attachments": [
    { "url": "https://xxxx.supabase.co/storage/v1/object/public/attachments/uploads/xxx.jpg", "name": "anh1.jpg" }
  ],
  "speed_min": 1,
  "speed_max": 2
}
```

Ghi chú:
- `user_number_list` **tối đa 200 phần tử** — đã validate ở cả frontend (khi gõ tay hoặc upload Excel) và API route `/api/submit` (validate lại lần 2 phía server để tránh bị bypass).
- `attachments` chỉ chứa **URL công khai**, không chứa binary. n8n tự tải ảnh bằng HTTP Request node khi cần dùng (ví dụ để đính kèm gửi Facebook).
- File Excel người dùng tải lên bắt buộc phải có cột tên **`Number`** (không phân biệt hoa/thường). File mẫu tải về từ nút "Tải file mẫu" có sẵn 2 cột `ID` và `Number`.

## 5. Cấu trúc trạng thái job (bảng `jobs`, dùng cho polling)

Frontend gọi `GET /api/status?job_id=...` mỗi 3 giây cho tới khi `status` khác `"processing"`.

| status | ý nghĩa |
|---|---|
| `processing` | n8n đang xử lý, tiếp tục poll |
| `done` | xong, hiển thị `result` |
| `error` | lỗi, hiển thị `error_message` |

## 6. Deploy lên Vercel

1. Push code lên GitHub.
2. Import repo vào Vercel.
3. Khai báo đủ biến môi trường trong **Project Settings → Environment Variables** (giống nội dung `.env.example`).
4. Deploy — không cần cấu hình gì thêm, các API routes tự động chạy dạng Serverless Functions.

## 7. Cấu trúc thư mục

```
app/
  page.js                        Trang chính
  layout.js
  globals.css
  api/
    assets/route.js              GET danh sách tài nguyên (Vùng 1)
    submit/route.js              POST tạo job + forward n8n
    status/route.js              GET trạng thái job (polling)
    upload-attachment/route.js   POST upload 1 ảnh lên Supabase Storage
    template-excel/route.js      GET tải file Excel mẫu
components/
  BroadcastForm.jsx              Component tổng, quản lý state + submit
  AssetSelector.jsx              Vùng 1
  UserListInput.jsx              Vùng 2
  MessageComposer.jsx            Vùng 3
  AttachmentUploader.jsx         Vùng 4
  SpeedControl.jsx                Vùng 5
lib/
  supabaseClient.js               Supabase client phía browser (anon key)
  supabaseAdmin.js                Supabase client phía server (service_role key)
  spinPresets.js                  Dữ liệu các bộ spin từ ngữ + icon
  userListParser.js               Parse & validate danh sách người nhận
  useJobPolling.js                Hook polling trạng thái job
supabase/
  schema.sql                      Toàn bộ SQL setup (bảng, RLS, storage, realtime)
```
