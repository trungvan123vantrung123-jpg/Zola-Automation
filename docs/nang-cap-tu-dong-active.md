# Kế hoạch nâng cấp: từ duyệt thủ công → tự động active

Tài liệu này mô tả cách chuyển hệ thống hiện tại (đăng ký → chờ admin duyệt thủ công)
sang hoàn toàn tự động (đăng ký xong là dùng được ngay), khi bạn đã sẵn sàng mở
rộng quy mô và không muốn tự tay duyệt từng tài khoản nữa.

## Vì sao đang chọn duyệt thủ công trước

Ở giai đoạn đầu, số lượng khách demo còn ít, và việc duyệt thủ công mang lại lợi ích:
- Kiểm soát được ai đang dùng thử, tránh bị lạm dụng vô tội vạ
- Tạo điểm chạm tự nhiên để bạn liên hệ, tư vấn, giới thiệu gói chính thức
- Không cần đầu tư ngay vào các lớp chống lạm dụng phức tạp (SMS OTP, giới hạn IP...)

Khi lượng đăng ký tăng lên tới mức duyệt thủ công trở thành nút thắt cổ chai (bạn không
kịp duyệt, khách phải chờ lâu, trải nghiệm demo bị ảnh hưởng), đó là lúc nên nâng cấp.

## Các bước nâng cấp cụ thể

### Bước 1 — Đổi giá trị mặc định khi tạo tài khoản mới

Trong `supabase/schema.sql`, sửa function `handle_new_auth_user()`:

```sql
create or replace function handle_new_auth_user()
returns trigger as $$
begin
  insert into public.customer_profiles (id, email, status, quota_limit, quota_used)
  values (new.id, new.email, 'active', 20, 0); -- đổi 'pending' -> 'active', cấp sẵn 20 lượt
  return new;
end;
$$ language plpgsql security definer;
```

Chỉ cần đổi `'pending'` thành `'active'` và đặt `quota_limit` mặc định mong muốn
(ví dụ 20 lượt demo miễn phí). Chạy lại đoạn SQL này trong Supabase SQL Editor.

### Bước 2 — Bỏ redirect sang trang chờ duyệt

Trong `middleware.js`, đoạn kiểm tra status khác `active` sẽ tự động không còn kích
hoạt nữa (vì mọi tài khoản mới đều `active` ngay từ đầu) — không cần sửa gì thêm,
nhưng có thể xoá đoạn logic đó cho gọn nếu muốn:

```js
// Có thể xoá đoạn này trong middleware.js nếu không còn dùng trạng thái pending nữa
if (profile && profile.status !== "active" && pathname === "/") {
  return NextResponse.redirect(new URL("/pending-approval", req.url));
}
```

Khuyến nghị: **giữ lại đoạn này** — vẫn hữu ích cho trường hợp admin khoá tài khoản
(`disabled`) hoặc tài khoản hết quota (`exhausted`), chỉ là sẽ không còn ai ở trạng
thái `pending` nữa.

### Bước 3 — Thêm lớp chống lạm dụng (bắt buộc trước khi bỏ duyệt thủ công)

Vì không còn ai kiểm tra thủ công nữa, cần ít nhất 1 trong các lớp sau để tránh
bị tạo hàng loạt tài khoản rác chiếm quota miễn phí:

**3a. Giới hạn theo IP lúc đăng ký (khuyến nghị làm trước tiên, ít tốn công nhất)**

Thêm bảng ghi log đăng ký theo IP:
```sql
create table if not exists signup_attempts (
  id uuid primary key default gen_random_uuid(),
  ip_address text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_signup_attempts_ip_time on signup_attempts(ip_address, created_at);
```

Trong flow đăng ký (cần chuyển từ gọi `supabase.auth.signUp()` trực tiếp ở client
sang qua 1 API route trung gian `/api/register` để có thể đọc IP và chặn trước khi
gọi Supabase Auth):
```js
// app/api/register/route.js (route mới cần tạo)
const ip = req.headers.get("x-forwarded-for") || "unknown";
const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

const { count } = await supabaseAdmin
  .from("signup_attempts")
  .select("*", { count: "exact", head: true })
  .eq("ip_address", ip)
  .gte("created_at", oneWeekAgo);

if (count >= 1) {
  return NextResponse.json(
    { error: "IP này đã đăng ký tài khoản demo gần đây." },
    { status: 429 }
  );
}
// ... tiếp tục gọi supabaseAdmin.auth.admin.createUser() thay vì client tự signUp
```

**3b. Xác thực số điện thoại qua OTP (chặt hơn, tốn phí SMS)**

Dùng Supabase Auth hỗ trợ sẵn `phone` auth provider (Twilio/MessageBird...).
Cân nhắc bước này nếu lớp 3a chưa đủ hiệu quả và giá trị demo đủ lớn để bù chi phí.

**3c. Giảm quota mặc định cho tài khoản chưa xác minh kỹ**

Ví dụ: tài khoản mới tự động chỉ được 5 lượt (thay vì 20), muốn có thêm phải liên
hệ xác minh thủ công (email công ty, số điện thoại xác thực...) để nâng lên 20+.
Đây là cách kết hợp vừa tự động vừa vẫn giữ được điểm kiểm soát.

### Bước 4 — Cân nhắc gỡ trang `/pending-approval` và phần duyệt trong `/admin`

Sau khi không còn tài khoản `pending` nào phát sinh tự nhiên, có thể đơn giản hoá
`AdminPanel.jsx` — bỏ nút "Duyệt", chỉ giữ lại "Cập nhật quota" và "Khoá" cho các
trường hợp cần can thiệp thủ công (khách vi phạm, cần điều chỉnh đặc biệt).

## Tổng kết lộ trình

| Giai đoạn | Trạng thái mặc định | Cần lớp chống lạm dụng? |
|---|---|---|
| Hiện tại | `pending`, admin duyệt tay | Không cần (đã có "màng lọc" con người) |
| Sau nâng cấp | `active` ngay, quota mặc định thấp | **Bắt buộc** ít nhất 1 lớp (khuyến nghị 3a trước) |
| Mở rộng thêm (tuỳ chọn) | `active`, quota cao hơn cho tài khoản đã xác minh | Có thể thêm 3b nếu cần chặt hơn |

Khi bạn quyết định thời điểm nâng cấp, có thể quay lại yêu cầu triển khai cụ thể
từng bước ở trên — ưu tiên làm Bước 3a trước khi bật Bước 1 (đổi mặc định thành
`active`), để tránh khoảng trống dễ bị lạm dụng giữa 2 lần deploy.
