import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function GET() {
  const authClient = createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });

  const { data: profile } = await supabaseAdmin.from("customer_profiles").select("status").eq("id", user.id).single();
  if (profile?.status !== "active") return NextResponse.json({ error: "Tài khoản không được phép truy cập tài nguyên." }, { status: 403 });

  const { data, error } = await supabaseAdmin.from("assets")
    .select("asset_id, asset_name, status, created_at")
    .eq("status", "active").order("created_at", { ascending: false });
  if (error) {
    console.error("[/api/assets] Lỗi truy vấn Supabase:", error.message);
    return NextResponse.json({ error: "Không lấy được danh sách tài nguyên." }, { status: 500 });
  }
  return NextResponse.json({ assets: data });
}
