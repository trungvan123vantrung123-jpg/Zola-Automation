import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOWED_STATUSES = new Set(["pending", "active", "disabled", "exhausted"]);
function checkAdminAuth(req) { return Boolean(process.env.ADMIN_SECRET) && req.headers.get("x-admin-secret") === process.env.ADMIN_SECRET; }

export async function GET(req) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: "Không có quyền." }, { status: 401 });
  const { data, error } = await supabaseAdmin.from("customer_profiles").select("id, email, status, quota_limit, quota_used, note, created_at").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Không tải được danh sách." }, { status: 500 });
  return NextResponse.json({ customers: data });
}

export async function PATCH(req) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: "Không có quyền." }, { status: 401 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Payload không hợp lệ." }, { status: 400 }); }
  const { customer_id: customerId, status, quota_limit: quotaLimit, note } = body;
  if (typeof customerId !== "string" || !customerId) return NextResponse.json({ error: "Thiếu customer_id." }, { status: 400 });
  if (status !== undefined && !ALLOWED_STATUSES.has(status)) return NextResponse.json({ error: "Trạng thái không hợp lệ." }, { status: 400 });
  if (quotaLimit !== undefined && (!Number.isInteger(quotaLimit) || quotaLimit < 0)) return NextResponse.json({ error: "Quota phải là số nguyên không âm." }, { status: 400 });
  if (note !== undefined && (typeof note !== "string" || note.length > 1000)) return NextResponse.json({ error: "Ghi chú không hợp lệ." }, { status: 400 });
  const updateFields = {};
  if (status !== undefined) updateFields.status = status;
  if (quotaLimit !== undefined) updateFields.quota_limit = quotaLimit;
  if (note !== undefined) updateFields.note = note;
  if (Object.keys(updateFields).length === 0) return NextResponse.json({ error: "Không có trường nào để cập nhật." }, { status: 400 });
  const { data, error } = await supabaseAdmin.from("customer_profiles").update(updateFields).eq("id", customerId).select().single();
  if (error) return NextResponse.json({ error: "Cập nhật thất bại." }, { status: 500 });
  return NextResponse.json({ customer: data });
}
