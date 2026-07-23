// Supabase client CHỈ dùng ở phía browser (client component).
// Dùng createBrowserClient để session được lưu trong cookie và đồng bộ với
// middleware.js cùng các API routes phía server.
// KHÔNG import file này vào bất kỳ API route nào cần quyền ghi.

import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[supabaseClient] Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY trong .env"
  );
}

export const supabase = createBrowserClient(
  supabaseUrl || "https://build-placeholder.supabase.co",
  supabaseAnonKey || "build-placeholder-key"
);
