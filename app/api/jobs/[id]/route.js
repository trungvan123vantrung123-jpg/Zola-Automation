import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_req, { params }) {
  if (!UUID_PATTERN.test(params.id)) return NextResponse.json({ error: "ID log không hợp lệ." }, { status: 400 });
  const authClient = createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  const { data, error } = await supabaseAdmin.from("jobs").select("id, status, input, result, error_message, created_at, updated_at").eq("id", params.id).eq("customer_id", user.id).single();
  if (error || !data) return NextResponse.json({ error: "Không tìm thấy log." }, { status: 404 });
  return NextResponse.json(data);
}
