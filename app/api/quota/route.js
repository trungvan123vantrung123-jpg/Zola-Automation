// GET /api/quota
// Trả về trạng thái + quota của người dùng đang đăng nhập,
// để frontend hiển thị "còn lại X/Y lượt" trên đầu trang.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function GET() {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from("customer_profiles")
    .select("status, quota_limit, quota_used, quota_reserved, email")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: "Không tìm thấy hồ sơ khách hàng." }, { status: 404 });
  }

  return NextResponse.json({
    email: profile.email,
    status: profile.status,
    quota_limit: profile.quota_limit,
    quota_used: profile.quota_used,
    quota_reserved: profile.quota_reserved,
    quota_remaining: Math.max(profile.quota_limit - profile.quota_used - profile.quota_reserved, 0),
  });
}
