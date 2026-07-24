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
-- Bảng: customer_profiles
-- Mở rộng thông tin cho mỗi tài khoản Supabase Auth (auth.users).
-- KHÔNG được sửa trực tiếp bảng auth.users, nên tách riêng bảng profile
-- liên kết 1-1 qua id (id ở đây = auth.users.id).
--
-- status:
--   pending   -> vừa đăng ký, đang chờ admin duyệt (mặc định)
--   active    -> đã duyệt, được dùng theo quota_limit/quota_used
--   exhausted -> đã dùng hết quota
--   disabled  -> admin khoá tài khoản
-- ------------------------------------------------------------
create table if not exists customer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  status text not null default 'pending',
  quota_limit int not null default 0,
  quota_used int not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customer_profiles_status on customer_profiles(status);

drop trigger if exists trg_customer_profiles_updated_at on customer_profiles;
create trigger trg_customer_profiles_updated_at
  before update on customer_profiles
  for each row execute function set_updated_at();

-- Tự động tạo 1 dòng customer_profiles mỗi khi có user mới đăng ký qua Supabase Auth.
create or replace function handle_new_auth_user()
returns trigger as $$
begin
  insert into public.customer_profiles (id, email, status, quota_limit, quota_used)
  values (new.id, new.email, 'pending', 0, 0);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- ------------------------------------------------------------
-- Bảng: usage_logs — ghi lại từng lần trừ quota thành công.
-- ------------------------------------------------------------
create table if not exists usage_logs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customer_profiles(id) on delete cascade,
  job_id uuid references jobs(id) on delete set null,
  amount_used int not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_usage_logs_customer on usage_logs(customer_id);
create index if not exists idx_usage_logs_job on usage_logs(job_id);

-- jobs cần biết thuộc về khách nào và số lượng dự kiến, để lúc n8n báo
-- kết quả xong thì biết trừ đúng quota của đúng khách.
alter table jobs add column if not exists customer_id uuid references customer_profiles(id);
alter table jobs add column if not exists requested_amount int;

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table assets enable row level security;
alter table jobs enable row level security;
alter table customer_profiles enable row level security;
alter table usage_logs enable row level security;

drop policy if exists "Cho phép đọc assets" on assets;
create policy "Cho phép đọc assets"
  on assets for select
  using (true);

drop policy if exists "Cho phép đọc jobs" on jobs;
create policy "Cho phép đọc jobs"
  on jobs for select
  using (true);

drop policy if exists "Khách xem profile của chính mình" on customer_profiles;
create policy "Khách xem profile của chính mình"
  on customer_profiles for select
  using (auth.uid() = id);

drop policy if exists "Khách xem lịch sử dùng của chính mình" on usage_logs;
create policy "Khách xem lịch sử dùng của chính mình"
  on usage_logs for select
  using (auth.uid() = customer_id);

-- Không tạo policy insert/update/delete cho anon ở các bảng trên -> mặc định
-- bị chặn, chỉ service_role (bypass RLS) mới ghi được, đúng như thiết kế.

-- ------------------------------------------------------------
-- Bật Realtime cho bảng assets (để trang tự cập nhật khi n8n
-- thêm tài nguyên mới sau khi quét QR xong) và customer_profiles
-- (để trang tự cập nhật khi admin duyệt tài khoản / trừ quota)
-- ------------------------------------------------------------
-- Realtime được đăng ký bằng block idempotent ở phần hardening bên dưới.

-- ------------------------------------------------------------
-- GHI CHÚ: cách admin duyệt tài khoản demo thủ công (giai đoạn hiện tại)
-- Chạy trong SQL Editor, thay email và số lượt phù hợp:
--
--   update customer_profiles
--   set status = 'active', quota_limit = 20
--   where email = 'khach@example.com';
--
-- Xem danh sách tài khoản đang chờ duyệt:
--
--   select id, email, status, quota_limit, quota_used, created_at
--   from customer_profiles
--   where status = 'pending'
--   order by created_at asc;
-- ------------------------------------------------------------

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

-- Atomic, retry-safe terminal settlement for n8n callbacks.
create or replace function settle_broadcast_job(p_job_id uuid, p_status text, p_result jsonb default null, p_error_message text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_job jobs%rowtype; v_new_used int;
begin
  select * into v_job from jobs where id = p_job_id for update;
  if not found then raise exception 'Job not found'; end if;
  if v_job.status <> 'processing' then return jsonb_build_object('settled', false, 'note', 'Job already settled'); end if;
  update jobs set status = p_status, result = p_result, error_message = p_error_message where id = p_job_id;
  if p_status = 'done' and v_job.customer_id is not null and coalesce(v_job.requested_amount, 0) > 0 then
    update customer_profiles set quota_used = quota_used + v_job.requested_amount where id = v_job.customer_id returning quota_used into v_new_used;
    update customer_profiles set status = 'exhausted' where id = v_job.customer_id and quota_used >= quota_limit;
    insert into usage_logs (customer_id, job_id, amount_used) values (v_job.customer_id, p_job_id, v_job.requested_amount);
  end if;
  return jsonb_build_object('settled', true);
end;
$$;
revoke all on function settle_broadcast_job(uuid, text, jsonb, text) from public;
grant execute on function settle_broadcast_job(uuid, text, jsonb, text) to service_role;

-- ============================================================
-- HARDENING MIGRATION: quota reservations, constraints, RLS
-- Safe to run after the base schema.
-- ============================================================
alter table customer_profiles add column if not exists quota_reserved int not null default 0;
alter table jobs add column if not exists quota_reserved int not null default 0;
alter table jobs add column if not exists dispatched_at timestamptz;

alter table customer_profiles drop constraint if exists customer_profiles_status_check;
alter table customer_profiles add constraint customer_profiles_status_check check (status in ('pending','active','exhausted','disabled'));
alter table customer_profiles drop constraint if exists customer_profiles_quota_check;
alter table customer_profiles add constraint customer_profiles_quota_check check (quota_limit >= 0 and quota_used >= 0 and quota_reserved >= 0);
alter table jobs drop constraint if exists jobs_status_check;
alter table jobs add constraint jobs_status_check check (status in ('processing','done','error'));
alter table jobs drop constraint if exists jobs_amount_check;
alter table jobs add constraint jobs_amount_check check (coalesce(requested_amount,0) >= 0 and quota_reserved >= 0);
alter table usage_logs drop constraint if exists usage_logs_amount_check;
alter table usage_logs add constraint usage_logs_amount_check check (amount_used > 0);
create unique index if not exists idx_usage_logs_job_unique on usage_logs(job_id) where job_id is not null;

-- Replace the broad job read policy with owner-only reads.
drop policy if exists "Cho ph�p �?c jobs" on jobs;
drop policy if exists "Kh�ch xem jobs c?a ch�nh m?nh" on jobs;
create policy "Kh�ch xem jobs c?a ch�nh m?nh" on jobs for select using (auth.uid() = customer_id);

-- Uploads go through authenticated server APIs only.
drop policy if exists "Public upload attachments" on storage.objects;

-- Rerunnable Realtime registration.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='assets') then
    alter publication supabase_realtime add table assets;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='customer_profiles') then
    alter publication supabase_realtime add table customer_profiles;
  end if;
end $$;

-- Compatibility bridge for rerunning the full historical schema. A database may
-- already contain the newer jsonb-returning function; remove the exact signature
-- before this legacy uuid-returning declaration is evaluated below.
drop function if exists create_broadcast_job(uuid, jsonb, integer);
create or replace function create_broadcast_job(p_customer_id uuid, p_input jsonb, p_requested_amount int)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_profile customer_profiles%rowtype; v_job_id uuid;
begin
  if p_requested_amount <= 0 or p_requested_amount > 200 then raise exception 'INVALID_AMOUNT'; end if;
  select * into v_profile from customer_profiles where id=p_customer_id for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  if v_profile.status <> 'active' then raise exception 'ACCOUNT_NOT_ACTIVE'; end if;
  if p_requested_amount > v_profile.quota_limit-v_profile.quota_used-v_profile.quota_reserved then raise exception 'INSUFFICIENT_QUOTA'; end if;
  update customer_profiles set quota_reserved=quota_reserved+p_requested_amount where id=p_customer_id;
  insert into jobs(status,input,customer_id,requested_amount,quota_reserved) values('processing',p_input,p_customer_id,p_requested_amount,p_requested_amount) returning id into v_job_id;
  return v_job_id;
end $$;

create or replace function fail_broadcast_dispatch(p_job_id uuid, p_error_message text)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_job jobs%rowtype;
begin
  select * into v_job from jobs where id=p_job_id for update;
  if not found or v_job.status <> 'processing' then return false; end if;
  if v_job.customer_id is not null and v_job.quota_reserved > 0 then
    update customer_profiles set quota_reserved=greatest(quota_reserved-v_job.quota_reserved,0) where id=v_job.customer_id;
  end if;
  update jobs set status='error',error_message=p_error_message,quota_reserved=0 where id=p_job_id;
  return true;
end $$;

create or replace function settle_broadcast_job(p_job_id uuid,p_status text,p_result jsonb default null,p_error_message text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_job jobs%rowtype; v_reserved int;
begin
  if p_status not in ('done','error') then raise exception 'INVALID_STATUS'; end if;
  select * into v_job from jobs where id=p_job_id for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if v_job.status <> 'processing' then return jsonb_build_object('settled',false,'note','Job already settled'); end if;
  v_reserved:=greatest(coalesce(v_job.quota_reserved,0),0);
  if v_job.customer_id is not null and v_reserved > 0 then
    if p_status='done' then
      update customer_profiles set quota_reserved=greatest(quota_reserved-v_reserved,0),quota_used=quota_used+v_reserved where id=v_job.customer_id;
      insert into usage_logs(customer_id,job_id,amount_used) values(v_job.customer_id,p_job_id,v_reserved) on conflict (job_id) where job_id is not null do nothing;
      update customer_profiles set status='exhausted' where id=v_job.customer_id and quota_used>=quota_limit;
    else
      update customer_profiles set quota_reserved=greatest(quota_reserved-v_reserved,0) where id=v_job.customer_id;
    end if;
  end if;
  update jobs set status=p_status,result=p_result,error_message=case when p_status='error' then coalesce(p_error_message,'X? l? th?t b?i.') else null end,quota_reserved=0 where id=p_job_id;
  return jsonb_build_object('settled',true);
end $$;

revoke all on function create_broadcast_job(uuid,jsonb,int) from public;
revoke all on function fail_broadcast_dispatch(uuid,text) from public;
revoke all on function settle_broadcast_job(uuid,text,jsonb,text) from public;
grant execute on function create_broadcast_job(uuid,jsonb,int),fail_broadcast_dispatch(uuid,text),settle_broadcast_job(uuid,text,jsonb,text) to service_role;

-- ============================================================
-- DAILY ASSET FRIEND-REQUEST SAFETY CAP (Asia/Ho_Chi_Minh)
-- ============================================================
create table if not exists asset_daily_usage (
  asset_id text not null,
  usage_date date not null,
  successful_count int not null default 0 check (successful_count >= 0 and successful_count <= 50),
  reserved_count int not null default 0 check (reserved_count >= 0 and reserved_count <= 50),
  updated_at timestamptz not null default now(),
  primary key (asset_id, usage_date),
  check (successful_count + reserved_count <= 50)
);

alter table jobs add column if not exists asset_id text;
alter table jobs add column if not exists daily_usage_date date;
alter table jobs add column if not exists daily_reserved_count int not null default 0;
alter table jobs drop constraint if exists jobs_daily_reserved_check;
alter table jobs add constraint jobs_daily_reserved_check check (daily_reserved_count >= 0 and daily_reserved_count <= 50);
create index if not exists idx_jobs_asset_usage_date on jobs(asset_id, daily_usage_date);
alter table asset_daily_usage enable row level security;

-- The previous implementation returned uuid; PostgreSQL cannot change a function
-- return type via CREATE OR REPLACE, so remove only this exact signature first.
drop function if exists create_broadcast_job(uuid, jsonb, int);

create or replace function create_broadcast_job(p_customer_id uuid, p_input jsonb, p_requested_amount int)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_profile customer_profiles%rowtype;
  v_job_id uuid;
  v_asset_id text;
  v_usage_date date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_daily asset_daily_usage%rowtype;
  v_quota_available int;
  v_daily_available int;
begin
  if p_requested_amount <= 0 or p_requested_amount > 200 then raise exception 'INVALID_AMOUNT'; end if;
  v_asset_id := nullif(trim(coalesce(p_input->>'asset_id','')), '');
  if v_asset_id is null then raise exception 'INVALID_ASSET'; end if;

  select * into v_profile from customer_profiles where id=p_customer_id for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  if v_profile.status <> 'active' then raise exception 'ACCOUNT_NOT_ACTIVE'; end if;
  v_quota_available := greatest(v_profile.quota_limit-v_profile.quota_used-v_profile.quota_reserved, 0);
  if p_requested_amount > v_quota_available then
    raise exception 'INSUFFICIENT_QUOTA:%', v_quota_available;
  end if;

  insert into asset_daily_usage(asset_id, usage_date) values(v_asset_id, v_usage_date) on conflict do nothing;
  select * into v_daily from asset_daily_usage where asset_id=v_asset_id and usage_date=v_usage_date for update;
  v_daily_available := greatest(50-v_daily.successful_count-v_daily.reserved_count, 0);
  if p_requested_amount > v_daily_available then
    raise exception 'DAILY_ASSET_CAP:%:%', v_daily_available, v_usage_date;
  end if;

  update customer_profiles set quota_reserved=quota_reserved+p_requested_amount where id=p_customer_id;
  update asset_daily_usage set reserved_count=reserved_count+p_requested_amount, updated_at=now() where asset_id=v_asset_id and usage_date=v_usage_date;
  insert into jobs(status,input,customer_id,requested_amount,quota_reserved,asset_id,daily_usage_date,daily_reserved_count)
  values('processing',p_input,p_customer_id,p_requested_amount,p_requested_amount,v_asset_id,v_usage_date,p_requested_amount)
  returning id into v_job_id;
  return jsonb_build_object('job_id',v_job_id,'quota_available',v_quota_available-p_requested_amount,'daily_available',v_daily_available-p_requested_amount,'usage_date',v_usage_date);
end $$;

create or replace function fail_broadcast_dispatch(p_job_id uuid, p_error_message text)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_job jobs%rowtype;
begin
  select * into v_job from jobs where id=p_job_id for update;
  if not found or v_job.status <> 'processing' then return false; end if;
  if v_job.customer_id is not null and v_job.quota_reserved > 0 then
    update customer_profiles set quota_reserved=greatest(quota_reserved-v_job.quota_reserved,0) where id=v_job.customer_id;
  end if;
  if v_job.asset_id is not null and v_job.daily_usage_date is not null and v_job.daily_reserved_count > 0 then
    update asset_daily_usage set reserved_count=greatest(reserved_count-v_job.daily_reserved_count,0),updated_at=now() where asset_id=v_job.asset_id and usage_date=v_job.daily_usage_date;
  end if;
  update jobs set status='error',error_message=left(coalesce(p_error_message,'Dispatch th?t b?i.'),2000),quota_reserved=0,daily_reserved_count=0 where id=p_job_id;
  return true;
end $$;

create or replace function settle_broadcast_job(p_job_id uuid,p_status text,p_result jsonb default null,p_error_message text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_job jobs%rowtype; v_reserved int; v_friend_successes int:=0;
begin
  if p_status not in ('done','error') then raise exception 'INVALID_STATUS'; end if;
  select * into v_job from jobs where id=p_job_id for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if v_job.status <> 'processing' then return jsonb_build_object('settled',false,'note','Job already settled'); end if;
  v_reserved:=greatest(coalesce(v_job.quota_reserved,0),0);

  if p_status='done' then
    if jsonb_typeof(coalesce(p_result->'details','null'::jsonb)) <> 'array' then raise exception 'INVALID_RESULT_DETAILS'; end if;
    if jsonb_array_length(p_result->'details') > coalesce(v_job.daily_reserved_count,0) then raise exception 'INVALID_RESULT_DETAILS'; end if;
    select count(*) into v_friend_successes from jsonb_array_elements(p_result->'details') detail where detail->'send_add_friend_request' = 'true'::jsonb;
    if v_friend_successes > coalesce(v_job.daily_reserved_count,0) then raise exception 'INVALID_SUCCESS_COUNT'; end if;
  end if;

  if v_job.customer_id is not null and v_reserved > 0 then
    if p_status='done' then
      update customer_profiles set quota_reserved=greatest(quota_reserved-v_reserved,0),quota_used=quota_used+v_reserved where id=v_job.customer_id;
      insert into usage_logs(customer_id,job_id,amount_used) values(v_job.customer_id,p_job_id,v_reserved) on conflict (job_id) where job_id is not null do nothing;
      update customer_profiles set status='exhausted' where id=v_job.customer_id and quota_used>=quota_limit;
    else
      update customer_profiles set quota_reserved=greatest(quota_reserved-v_reserved,0) where id=v_job.customer_id;
    end if;
  end if;

  if v_job.asset_id is not null and v_job.daily_usage_date is not null and v_job.daily_reserved_count > 0 then
    update asset_daily_usage
      set reserved_count=greatest(reserved_count-v_job.daily_reserved_count,0),
          successful_count=successful_count+case when p_status='done' then v_friend_successes else 0 end,
          updated_at=now()
      where asset_id=v_job.asset_id and usage_date=v_job.daily_usage_date;
  end if;

  update jobs set status=p_status,result=p_result,error_message=case when p_status='error' then left(coalesce(p_error_message,'X? l? th?t b?i.'),2000) else null end,quota_reserved=0,daily_reserved_count=0 where id=p_job_id;
  return jsonb_build_object('settled',true,'friend_request_successes',v_friend_successes);
end $$;

revoke all on table asset_daily_usage from public;
revoke all on function create_broadcast_job(uuid,jsonb,int) from public;
revoke all on function fail_broadcast_dispatch(uuid,text) from public;
revoke all on function settle_broadcast_job(uuid,text,jsonb,text) from public;
grant execute on function create_broadcast_job(uuid,jsonb,int),fail_broadcast_dispatch(uuid,text),settle_broadcast_job(uuid,text,jsonb,text) to service_role;

-- ============================================================
-- TENANT ASSET OWNERSHIP MIGRATION
-- Every asset belongs to one customer. Legacy assets stay unassigned and hidden
-- until an administrator explicitly assigns them.
-- ============================================================
alter table assets add column if not exists owner_id uuid references customer_profiles(id) on delete restrict;
create index if not exists idx_assets_owner_status_created on assets(owner_id, status, created_at desc);

-- Remove the historical public read policy and enforce direct owner-only reads.
drop policy if exists "Cho ph�p �?c assets" on assets;
drop policy if exists "Kh�ch xem assets c?a ch�nh m?nh" on assets;
create policy "Kh�ch xem assets c?a ch�nh m?nh" on assets for select using (auth.uid() = owner_id);

-- The job RPC is the authoritative server-side boundary. It verifies the supplied
-- asset is active and owned by the authenticated customer before reserving quota.
-- The initial rollout used a uuid return type. PostgreSQL cannot change a
-- function return type with CREATE OR REPLACE, so drop the exact signature first.
-- The function is recreated immediately below and permissions are granted again.
drop function if exists create_broadcast_job(uuid, jsonb, integer);
create or replace function create_broadcast_job(p_customer_id uuid, p_input jsonb, p_requested_amount int)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_profile customer_profiles%rowtype;
  v_asset assets%rowtype;
  v_job_id uuid;
  v_asset_id text;
  v_usage_date date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_daily asset_daily_usage%rowtype;
  v_quota_available int;
  v_daily_available int;
begin
  if p_requested_amount <= 0 or p_requested_amount > 200 then raise exception 'INVALID_AMOUNT'; end if;
  v_asset_id := nullif(trim(coalesce(p_input->>'asset_id','')), '');
  if v_asset_id is null then raise exception 'INVALID_ASSET'; end if;

  select * into v_profile from customer_profiles where id=p_customer_id for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  if v_profile.status <> 'active' then raise exception 'ACCOUNT_NOT_ACTIVE'; end if;

  select * into v_asset from assets where asset_id=v_asset_id for key share;
  if not found or v_asset.owner_id is distinct from p_customer_id or v_asset.status <> 'active' then
    raise exception 'ASSET_NOT_AVAILABLE';
  end if;

  v_quota_available := greatest(v_profile.quota_limit-v_profile.quota_used-v_profile.quota_reserved, 0);
  if p_requested_amount > v_quota_available then raise exception 'INSUFFICIENT_QUOTA:%', v_quota_available; end if;

  insert into asset_daily_usage(asset_id, usage_date) values(v_asset_id, v_usage_date) on conflict do nothing;
  select * into v_daily from asset_daily_usage where asset_id=v_asset_id and usage_date=v_usage_date for update;
  v_daily_available := greatest(50-v_daily.successful_count-v_daily.reserved_count, 0);
  if p_requested_amount > v_daily_available then raise exception 'DAILY_ASSET_CAP:%:%', v_daily_available, v_usage_date; end if;

  update customer_profiles set quota_reserved=quota_reserved+p_requested_amount where id=p_customer_id;
  update asset_daily_usage set reserved_count=reserved_count+p_requested_amount, updated_at=now() where asset_id=v_asset_id and usage_date=v_usage_date;
  insert into jobs(status,input,customer_id,requested_amount,quota_reserved,asset_id,daily_usage_date,daily_reserved_count)
  values('processing',p_input,p_customer_id,p_requested_amount,p_requested_amount,v_asset_id,v_usage_date,p_requested_amount)
  returning id into v_job_id;
  return jsonb_build_object('job_id',v_job_id,'quota_available',v_quota_available-p_requested_amount,'daily_available',v_daily_available-p_requested_amount,'usage_date',v_usage_date);
end $$;

revoke all on function create_broadcast_job(uuid,jsonb,int) from public;
grant execute on function create_broadcast_job(uuid,jsonb,int) to service_role;

-- ============================================================
-- SECURITY HARDENING: private attachments, callback integrity, stale jobs
-- ============================================================
update storage.buckets set public = false where id = 'attachments';
drop policy if exists "Public read attachments" on storage.objects;

-- A callback may only report unique recipients that exist in the original job input.
create or replace function settle_broadcast_job(p_job_id uuid,p_status text,p_result jsonb default null,p_error_message text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_job jobs%rowtype; v_reserved int; v_friend_successes int:=0; v_detail jsonb; v_number text;
begin
  if p_status not in ('done','error') then raise exception 'INVALID_STATUS'; end if;
  select * into v_job from jobs where id=p_job_id for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if v_job.status <> 'processing' then return jsonb_build_object('settled',false,'note','Job already settled'); end if;
  v_reserved:=greatest(coalesce(v_job.quota_reserved,0),0);

  if p_status='done' then
    if jsonb_typeof(coalesce(p_result->'details','null'::jsonb)) <> 'array' then raise exception 'INVALID_RESULT_DETAILS'; end if;
    if jsonb_array_length(p_result->'details') > coalesce(v_job.requested_amount,0) then raise exception 'INVALID_RESULT_DETAILS'; end if;
    for v_detail in select value from jsonb_array_elements(p_result->'details') loop
      v_number := nullif(trim(coalesce(v_detail->>'user_number','')), '');
      if v_number is null or not exists (select 1 from jsonb_array_elements_text(coalesce(v_job.input->'user_number_list','[]'::jsonb)) submitted(value) where submitted.value=v_number) then raise exception 'INVALID_RESULT_RECIPIENT'; end if;
      if (select count(*) from jsonb_array_elements(p_result->'details') duplicate_detail where duplicate_detail->>'user_number'=v_number) <> 1 then raise exception 'INVALID_RESULT_RECIPIENT'; end if;
    end loop;
    select count(*) into v_friend_successes from jsonb_array_elements(p_result->'details') detail where detail->'send_add_friend_request' = 'true'::jsonb;
    if v_friend_successes > coalesce(v_job.daily_reserved_count,0) then raise exception 'INVALID_SUCCESS_COUNT'; end if;
  end if;

  if v_job.customer_id is not null and v_reserved > 0 then
    if p_status='done' then
      update customer_profiles set quota_reserved=greatest(quota_reserved-v_reserved,0),quota_used=quota_used+v_reserved where id=v_job.customer_id;
      insert into usage_logs(customer_id,job_id,amount_used) values(v_job.customer_id,p_job_id,v_reserved) on conflict (job_id) where job_id is not null do nothing;
      update customer_profiles set status='exhausted' where id=v_job.customer_id and quota_used>=quota_limit;
    else
      update customer_profiles set quota_reserved=greatest(quota_reserved-v_reserved,0) where id=v_job.customer_id;
    end if;
  end if;
  if v_job.asset_id is not null and v_job.daily_usage_date is not null and v_job.daily_reserved_count > 0 then
    update asset_daily_usage set reserved_count=greatest(reserved_count-v_job.daily_reserved_count,0),successful_count=successful_count+case when p_status='done' then v_friend_successes else 0 end,updated_at=now() where asset_id=v_job.asset_id and usage_date=v_job.daily_usage_date;
  end if;
  update jobs set status=p_status,result=p_result,error_message=case when p_status='error' then left(coalesce(p_error_message,'Xử lý thất bại.'),2000) else null end,quota_reserved=0,daily_reserved_count=0 where id=p_job_id;
  return jsonb_build_object('settled',true,'friend_request_successes',v_friend_successes);
end $$;

-- Run this from a protected scheduler to release reservations for jobs that never callback.
create or replace function expire_stale_broadcast_jobs(p_before timestamptz)
returns integer language plpgsql security definer set search_path=public as $$
declare v_job jobs%rowtype; v_count integer:=0;
begin
  for v_job in select * from jobs where status='processing' and coalesce(dispatched_at,created_at) < p_before for update skip locked loop
    if v_job.customer_id is not null and v_job.quota_reserved > 0 then update customer_profiles set quota_reserved=greatest(quota_reserved-v_job.quota_reserved,0) where id=v_job.customer_id; end if;
    if v_job.asset_id is not null and v_job.daily_usage_date is not null and v_job.daily_reserved_count > 0 then update asset_daily_usage set reserved_count=greatest(reserved_count-v_job.daily_reserved_count,0),updated_at=now() where asset_id=v_job.asset_id and usage_date=v_job.daily_usage_date; end if;
    update jobs set status='error',error_message='Job hết hạn do không nhận được callback.',quota_reserved=0,daily_reserved_count=0 where id=v_job.id and status='processing';
    v_count:=v_count+1;
  end loop;
  return v_count;
end $$;
revoke all on function settle_broadcast_job(uuid,text,jsonb,text) from public;
revoke all on function expire_stale_broadcast_jobs(timestamptz) from public;
grant execute on function settle_broadcast_job(uuid,text,jsonb,text),expire_stale_broadcast_jobs(timestamptz) to service_role;