import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_ERROR_LENGTH = 2000;

export async function POST(req) {
  const expectedSecret = process.env.N8N_WEBHOOK_SECRET;
  if (!expectedSecret || req.headers.get("x-webhook-secret") !== expectedSecret) {
    return NextResponse.json({ error: "Không có quyền." }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload không hợp lệ." }, { status: 400 });
  }

  const { job_id: jobId, status, result = null, error_message: errorMessage = null } = body;
  if (!UUID_PATTERN.test(jobId || "") || !["done", "error"].includes(status)) {
    return NextResponse.json({ error: "job_id hoặc status không hợp lệ." }, { status: 400 });
  }
  if (status === "error" && errorMessage !== null && (typeof errorMessage !== "string" || errorMessage.length > MAX_ERROR_LENGTH)) {
    return NextResponse.json({ error: "error_message không hợp lệ." }, { status: 400 });
  }
  if (result !== null && (typeof result !== "object" || Array.isArray(result))) {
    return NextResponse.json({ error: "result phải là object JSON." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc("settle_broadcast_job", {
    p_job_id: jobId,
    p_status: status,
    p_result: result,
    p_error_message: errorMessage,
  });
  if (error) {
    console.error("[/api/job-callback] Lỗi settlement:", error.message);
    const statusCode = error.message?.includes("JOB_NOT_FOUND") ? 404 : 500;
    return NextResponse.json({ error: statusCode === 404 ? "Không tìm thấy job." : "Không thể hoàn tất job." }, { status: statusCode });
  }

  return NextResponse.json({ ok: true, ...data });
}
