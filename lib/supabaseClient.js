// Supabase client CHỈ dùng ở phía browser (client component).
// Dùng anon key -> chỉ có quyền đọc theo RLS policy đã set trong schema.sql.
// KHÔNG import file này vào bất kỳ API route nào cần quyền ghi.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[supabaseClient] Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY trong .env"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
