import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function checkAdminAuth(req) { return Boolean(process.env.ADMIN_SECRET) && req.headers.get("x-admin-secret") === process.env.ADMIN_SECRET; }

export async function GET(req) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: "Không có quyền." }, { status: 401 });
  const { data, error } = await supabaseAdmin.from("assets").select("asset_id, asset_name, status, owner_id, created_at").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Không tải được danh sách tài nguyên." }, { status: 500 });
  return NextResponse.json({ assets: data || [] });
}

export async function PATCH(req) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: "Không có quyền." }, { status: 401 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Payload không hợp lệ." }, { status: 400 }); }
  const { asset_id: assetId, owner_id: ownerId } = body;
  if (typeof assetId !== "string" || !assetId.trim()) return NextResponse.json({ error: "Thiếu asset_id." }, { status: 400 });
  if (ownerId !== null && (typeof ownerId !== "string" || !UUID_PATTERN.test(ownerId))) return NextResponse.json({ error: "owner_id không hợp lệ." }, { status: 400 });
  if (ownerId) {
    const { data: owner, error: ownerError } = await supabaseAdmin.from("customer_profiles").select("id").eq("id", ownerId).single();
    if (ownerError || !owner) return NextResponse.json({ error: "Không tìm thấy tài khoản chủ sở hữu." }, { status: 404 });
  }
  const { data, error } = await supabaseAdmin.from("assets").update({ owner_id: ownerId }).eq("asset_id", assetId).select("asset_id, asset_name, status, owner_id, created_at").single();
  if (error || !data) return NextResponse.json({ error: "Không thể cập nhật chủ sở hữu tài nguyên." }, { status: 500 });
  return NextResponse.json({ asset: data });
}