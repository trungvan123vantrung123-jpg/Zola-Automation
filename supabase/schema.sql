-- ============================================================
-- SCHEMA CHO SUPABASE
-- Chạy toàn bộ file này trong Supabase SQL Editor
-- ============================================================

-- Bật extension tạo UUID (Supabase thường đã bật sẵn, chạy lại cũng không lỗi)
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Bảng: assets
-- Danh sách tài nguyên (tài khoản đã đăng nhập qua QR) để chọn ở Vùng 1
-- Được ghi vào bởi workflow n8n sau khi quét QR đăng nhập thành công
-- ------------------------------------------------------------
create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  asset_id text not null unique,        -- ID định danh tài nguyên (vd: ID page/tài khoản FB)
  asset_name text not null,             -- Tên hiển thị (vd: tên page/tài khoản)
  status text not null default 'active', -- active | inactive | expired | error
  meta jsonb default '{}'::jsonb,       -- chỗ trống cho n8n lưu thêm thông tin nếu cần
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_assets_status on assets(status);

-- ------------------------------------------------------------
-- Bảng: jobs
-- Mỗi lần submit form gửi tin nhắn tạo 1 job, n8n xử lý ngầm rồi update lại
-- ------------------------------------------------------------
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'processing', -- processing | done | error
  input jsonb not null,                 -- toàn bộ payload đã gửi cho n8n (để đối chiếu/debug)
  result jsonb,                         -- kết quả trả về khi xong (số lượng gửi thành công, lỗi...)
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_jobs_status on jobs(status);
create index if not exists idx_jobs_created_at on jobs(created_at desc);

-- ------------------------------------------------------------
-- Trigger tự động cập nhật updated_at
-- ------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_assets_updated_at on assets;
create trigger trg_assets_updated_at
  before update on assets
  for each row execute function set_updated_at();

drop trigger if exists trg_jobs_updated_at on jobs;
create trigger trg_jobs_updated_at
  before update on jobs
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- Row Level Security
-- Frontend (anon key) chỉ được ĐỌC. Mọi thao tác ghi/update phải qua
-- service_role key (dùng trong n8n hoặc trong API route phía server).
-- ------------------------------------------------------------
alter table assets enable row level security;
alter table jobs enable row level security;

drop policy if exists "Cho phép đọc assets" on assets;
create policy "Cho phép đọc assets"
  on assets for select
  using (true);

drop policy if exists "Cho phép đọc jobs" on jobs;
create policy "Cho phép đọc jobs"
  on jobs for select
  using (true);

-- Không tạo policy insert/update/delete cho anon -> mặc định bị chặn,
-- chỉ service_role (bypass RLS) mới ghi được, đúng như thiết kế.

-- ------------------------------------------------------------
-- Bật Realtime cho bảng assets (để trang tự cập nhật khi n8n
-- thêm tài nguyên mới sau khi quét QR xong)
-- ------------------------------------------------------------
alter publication supabase_realtime add table assets;

-- ------------------------------------------------------------
-- Storage bucket cho ảnh đính kèm (attachments)
-- Chạy phần này nếu chưa tạo bucket qua giao diện Supabase Storage
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

-- Cho phép đọc công khai (vì n8n cần tải ảnh về bằng URL trực tiếp)
drop policy if exists "Public read attachments" on storage.objects;
create policy "Public read attachments"
  on storage.objects for select
  using (bucket_id = 'attachments');

-- Cho phép upload từ phía client (anon) - nếu bạn muốn giới hạn hơn,
-- có thể chuyển việc upload qua API route dùng service_role thay vì client trực tiếp
drop policy if exists "Public upload attachments" on storage.objects;
create policy "Public upload attachments"
  on storage.objects for insert
  with check (bucket_id = 'attachments');
