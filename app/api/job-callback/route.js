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
  const resultValidationError = validateCallbackResult(status, result);
  if (resultValidationError) return NextResponse.json({ error: resultValidationError }, { status: 400 });

  const { data, error } = await supabaseAdmin.rpc("settle_broadcast_job", {
    p_job_id: jobId,
    p_status: status,
    p_result: result,
    p_error_message: errorMessage,
  });
  if (error) {
    console.error("[/api/job-callback] Lỗi settlement:", error.message);
    const clientError = ["INVALID_RESULT_DETAILS", "INVALID_SUCCESS_COUNT"].some((code) => error.message?.includes(code));
    const statusCode = error.message?.includes("JOB_NOT_FOUND") ? 404 : clientError ? 400 : 500;
    return NextResponse.json({ error: statusCode === 404 ? "Không tìm thấy job." : clientError ? "Kết quả callback không khớp với job." : "Không thể hoàn tất job." }, { status: statusCode });
  }

  return NextResponse.json({ ok: true, ...data });
}

function validateCallbackResult(status, result) {
  if (status !== "done") return null;
  if (!result || !Array.isArray(result.details)) {
    return "Job hoàn tất phải có result.details là danh sách kết quả theo từng số điện thoại.";
  }
  if (result.details.length > 200) return "result.details vượt quá số lượng cho phép.";
  for (const detail of result.details) {
    if (!detail || typeof detail !== "object" || Array.isArray(detail)) {
      return "Mỗi phần tử result.details phải là object.";
    }
    if ("send_add_friend_request" in detail && typeof detail.send_add_friend_request !== "boolean") {
      return "send_add_friend_request phải là boolean.";
    }
  }
  return null;
}
