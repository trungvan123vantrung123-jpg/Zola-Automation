// Supabase client CHỈ dùng trong API routes (app/api/**), chạy trên server.
// Dùng service_role key -> bypass RLS, có toàn quyền đọc/ghi.
// TUYỆT ĐỐI không import file này vào bất kỳ client component nào,
// vì service_role key sẽ bị bundle ra browser nếu làm vậy.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.warn(
    "[supabaseAdmin] Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env"
  );
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
