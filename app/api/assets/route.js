// GET /api/assets
// Trả về danh sách tài nguyên (assets) đang active để hiển thị ở Vùng 1.
// Dữ liệu này được ghi vào bảng `assets` bởi workflow n8n sau khi
// người dùng đăng nhập quét QR thành công (flow riêng, không nằm trong route này).

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("assets")
    .select("asset_id, asset_name, status, created_at")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[/api/assets] Lỗi truy vấn Supabase:", error.message);
    return NextResponse.json(
      { error: "Không lấy được danh sách tài nguyên." },
      { status: 500 }
    );
  }

  return NextResponse.json({ assets: data });
}
