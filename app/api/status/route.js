import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function GET(req) {
  const jobId = new URL(req.url).searchParams.get("job_id");
  if (!jobId) return NextResponse.json({ error: "Thiếu job_id." }, { status: 400 });

  const authClient = createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });

  const { data, error } = await supabaseAdmin.from("jobs")
    .select("status, result, error_message, created_at, updated_at")
    .eq("id", jobId).eq("customer_id", user.id).single();
  if (error || !data) return NextResponse.json({ error: "Không tìm thấy job." }, { status: 404 });
  return NextResponse.json(data);
}
