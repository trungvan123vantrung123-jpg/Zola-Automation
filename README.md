# Bảng điều khiển gửi tin nhắn (Next.js + Supabase Auth + Quota + n8n)

## 1. Cài đặt

```bash
npm install
cp .env.example .env.local
# điền các giá trị thật vào .env.local
npm run dev
```

## 2. Setup Supabase

1. Vào **SQL Editor**, chạy toàn bộ nội dung file `supabase/schema.sql`.
   File này tạo:
   - Bảng `assets` (danh sách tài nguyên ở Vùng 1)
   - Bảng `jobs` (trạng thái xử lý mỗi lần submit, có gắn `customer_id` + `requested_amount`)
   - Bảng `customer_profiles` (hồ sơ mở rộng cho mỗi tài khoản Supabase Auth — trạng thái, quota)
   - Bảng `usage_logs` (lịch sử trừ quota, đối soát khi cần)
   - Trigger tự tạo `customer_profiles` khi có user đăng ký mới (mặc định `status = 'pending'`)
   - Storage bucket `attachments`
   - RLS policy cho toàn bộ bảng trên
2. Vào **Authentication → Providers**, đảm bảo **Email** provider đang bật, và bật **Confirm email**.
3. Vào **Authentication → URL Configuration**, thêm domain thật của bạn (kể cả `http://localhost:3000` lúc dev) vào **Redirect URLs**, vì flow đăng ký cần redirect về `/auth/callback`.
4. Lấy 3 giá trị trong **Settings → API** để điền vào `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (giữ bí mật)

## 3. Luồng người dùng mới (Auth + Quota)

```
1. Khách vào /register -> nhập email/password -> Supabase Auth tạo user
2. Trigger tự động tạo dòng trong customer_profiles, status = 'pending', quota_limit = 0
3. Khách nhận email xác thực -> bấm link -> redirect qua /auth/callback -> /pending-approval
4. Trang /pending-approval lắng nghe Realtime, tự chuyển sang trang chính
   ngay khi admin duyệt xong (không cần khách tự F5)
5. Admin vào /admin (nhập ADMIN_SECRET) -> thấy danh sách tài khoản pending
   -> nhập quota_limit -> bấm "Duyệt" -> status chuyển thành 'active'
6. Khách đăng nhập lại (hoặc trang tự chuyển) -> vào trang chính, thấy
   "Còn lại X/Y lượt" trên AccountBar
7. Khách bấm "Gửi tin nhắn" -> /api/submit kiểm tra:
   - Đã đăng nhập chưa?
   - status có phải 'active' không?
   - Quota còn đủ cho số lượng người nhận trong request này không?
   -> Nếu đủ điều kiện: tạo job (customer_id + requested_amount), forward n8n
   -> QUOTA CHƯA BỊ TRỪ Ở BƯỚC NÀY
8. n8n xử lý xong -> gọi POST /api/job-callback báo status done/error
   -> CHỈ khi status = 'done' mới thực sự trừ quota_used += requested_amount
   -> Ghi 1 dòng vào usage_logs
   -> Nếu quota_used >= quota_limit sau khi trừ -> tự chuyển status = 'exhausted'
```

**Vì sao trừ quota ở bước 8 chứ không phải bước 7:** nếu job bị lỗi giữa chừng ở
phía n8n (ví dụ tài khoản Facebook/Zalo bị chặn), khách không bị trừ oan quota cho
lần gửi thất bại đó.

## 4. Setup n8n

### a) Workflow nhận request gửi tin (không đổi so với trước)

1. Webhook node, method `POST`, URL copy vào `N8N_SEND_MESSAGE_WEBHOOK_URL`.
2. Bật Header Auth với key `X-Webhook-Secret` = giá trị `N8N_WEBHOOK_SECRET`.
3. **Respond to Webhook** trả lời ngay, không chờ xử lý xong.
4. Xử lý nghiệp vụ (node Code tách `user_number_list`, resolve spin, gửi tin...).

### b) Bước MỚI bắt buộc — gọi ngược báo kết quả để trừ quota

Ở cuối workflow (sau khi toàn bộ user_number_list đã được xử lý), thêm 1 node
**HTTP Request**:

```
Method: POST
URL: https://your-domain.vercel.app/api/job-callback
Headers:
  Content-Type: application/json
  X-Webhook-Secret: <giống N8N_WEBHOOK_SECRET>
Body (JSON):
{
  "job_id": "{{ $('Webhook').item.json.body.job_id }}",
  "status": "done",
  "result": { ... }
}
```

Nếu workflow gặp lỗi giữa chừng, nên có nhánh **Error Trigger** riêng gọi cùng
endpoint này với `"status": "error", "error_message": "..."` — để job không bị kẹt
mãi ở trạng thái `processing` và quota không bị trừ.

**Route `/api/job-callback` tự chống trừ trùng lặp**: nếu n8n gọi lại (do retry mạng)
cho cùng 1 `job_id` đã xử lý xong trước đó, route sẽ bỏ qua, không trừ quota lần 2.

### c) Workflow đăng nhập QR (ghi vào bảng `assets`, không đổi so với trước)

Trigger từ nút "Đăng nhập" trên web → n8n trả QR → sau khi quét xong, n8n `INSERT`
vào bảng `assets`. Trang Vùng 1 tự cập nhật nhờ Supabase Realtime.

## 5. Trang quản trị `/admin`

- Bảo vệ bằng `ADMIN_SECRET` (nhập 1 lần, lưu tạm trong `sessionStorage` của trình
  duyệt). Đây là giải pháp **tạm thời cho giai đoạn thủ công**, không phải hệ thống
  phân quyền đầy đủ.
- Duyệt tài khoản `pending` → `active`, kèm nhập `quota_limit`.
- Cập nhật lại quota bất kỳ lúc nào cho tài khoản `active`.
- Khoá (`disabled`) / kích hoạt lại tài khoản.

## 6. Kế hoạch mở rộng sau này

Xem chi tiết trong [`docs/nang-cap-tu-dong-active.md`](./docs/nang-cap-tu-dong-active.md)
— mô tả cách chuyển từ "đăng ký → chờ duyệt thủ công" sang "đăng ký → tự động active
ngay", kèm các lớp chống lạm dụng cần thêm trước khi bỏ bước duyệt tay.

## 7. Cấu trúc payload gửi từ web sang n8n (POST tới webhook)

```json
{
  "job_id": "uuid-do-supabase-tao",
  "asset_id": "111111",
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

## 8. Cấu trúc trạng thái job (bảng `jobs`, dùng cho polling)

Frontend gọi `GET /api/status?job_id=...` mỗi 3 giây cho tới khi `status` khác
`"processing"`. `jobs` có thêm cột `customer_id` và `requested_amount` dùng nội bộ
cho việc trừ quota.

## 9. Deploy lên Vercel

1. Push code lên GitHub, import vào Vercel.
2. Khai báo đủ biến môi trường (xem `.env.example`, bao gồm cả `ADMIN_SECRET` mới).
3. Trong Supabase **Authentication → URL Configuration**, thêm domain Vercel thật vào
   **Redirect URLs**.
4. Deploy.

## 10. Cấu trúc thư mục

```
app/
  page.js                          Trang chính (yêu cầu đăng nhập + status active)
  layout.js
  globals.css
  login/page.js                    Đăng nhập
  register/page.js                 Đăng ký
  pending-approval/page.js         Trạng thái chờ duyệt / bị khoá / hết quota
  admin/page.js                    Trang quản trị (bảo vệ bằng ADMIN_SECRET)
  auth/callback/route.js           Xử lý redirect xác thực email từ Supabase
  api/
    assets/route.js                GET danh sách tài nguyên (Vùng 1)
    submit/route.js                POST kiểm tra quota + tạo job + forward n8n
    status/route.js                GET trạng thái job (polling)
    job-callback/route.js          POST (n8n gọi) báo job xong, trừ quota
    quota/route.js                 GET quota của người dùng đang đăng nhập
    upload-attachment/route.js     POST upload 1 ảnh lên Supabase Storage
    template-excel/route.js        GET tải file Excel mẫu
    auth/logout/route.js           POST đăng xuất
    admin/customers/route.js       GET/PATCH quản lý customer_profiles
components/
  BroadcastForm.jsx                Component tổng form gửi tin
  AssetSelector.jsx                Vùng 1
  UserListInput.jsx                Vùng 2
  MessageComposer.jsx              Vùng 3
  AttachmentUploader.jsx           Vùng 4
  SpeedControl.jsx                 Vùng 5
  LoginForm.jsx / RegisterForm.jsx Form đăng nhập/đăng ký
  AccountBar.jsx                   Hiển thị quota + nút đăng xuất trên trang chính
  AdminPanel.jsx                   Giao diện quản trị duyệt/khoá/set quota
lib/
  supabaseClient.js                Supabase client browser (session qua cookie)
  supabaseServer.js                Supabase client server (đọc session trong API routes)
  supabaseAdmin.js                 Supabase client server (service_role, bypass RLS)
  spinPresets.js                   Dữ liệu các bộ spin từ ngữ + icon
  userListParser.js                Parse & validate danh sách người nhận
  useJobPolling.js                 Hook polling trạng thái job
middleware.js                      Bảo vệ route: bắt đăng nhập, chặn theo status
supabase/
  schema.sql                       Toàn bộ SQL setup (bảng, trigger, RLS, storage, realtime)
docs/
  nang-cap-tu-dong-active.md       Kế hoạch chuyển sang tự động active + chống lạm dụng
```
