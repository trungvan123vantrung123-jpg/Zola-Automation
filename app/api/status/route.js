// GET /api/status?job_id=xxxx
// Đọc trạng thái job từ Supabase để frontend polling.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req) {
  const jobId = new URL(req.url).searchParams.get("job_id");

  if (!jobId) {
    return NextResponse.json({ error: "Thiếu job_id." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("jobs")
    .select("status, result, error_message, created_at, updated_at")
    .eq("id", jobId)
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Không tìm thấy job." },
      { status: 404 }
    );
  }

  return NextResponse.json(data);
}
