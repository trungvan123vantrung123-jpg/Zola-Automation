// POST /api/submit
// Nhận payload đầy đủ đã được frontend build sẵn (asset, user_number_list,
// message, attachments, speed) -> tạo 1 job "processing" trong Supabase
// -> forward toàn bộ payload kèm job_id sang webhook n8n -> trả job_id về cho frontend.
//
// n8n sẽ tự cập nhật job (status: done/error, result) khi xử lý xong,
// việc gọi Supabase update nằm trong workflow n8n, KHÔNG nằm trong route này.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req) {
  const payload = await req.json();

  const validationError = validatePayload(payload);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  // 1) Tạo job trong Supabase trước, để có job_id gửi kèm cho n8n
  const { data: job, error: insertError } = await supabaseAdmin
    .from("jobs")
    .insert({ status: "processing", input: payload })
    .select("id")
    .single();

  if (insertError) {
    console.error("[/api/submit] Lỗi tạo job:", insertError.message);
    return NextResponse.json(
      { error: "Không tạo được job xử lý." },
      { status: 500 }
    );
  }

  // 2) Forward sang n8n, kèm job_id để n8n biết update job nào khi xong
  const n8nUrl = process.env.N8N_SEND_MESSAGE_WEBHOOK_URL;

  try {
    const n8nRes = await fetch(n8nUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.N8N_WEBHOOK_SECRET
          ? { "X-Webhook-Secret": process.env.N8N_WEBHOOK_SECRET }
          : {}),
      },
      body: JSON.stringify({ job_id: job.id, ...payload }),
    });

    if (!n8nRes.ok) {
      // n8n từ chối nhận việc ngay từ đầu -> đánh dấu job lỗi luôn, không để "processing" treo mãi
      await supabaseAdmin
        .from("jobs")
        .update({
          status: "error",
          error_message: `n8n trả về lỗi HTTP ${n8nRes.status}`,
        })
        .eq("id", job.id);

      return NextResponse.json(
        { error: "Hệ thống xử lý (n8n) từ chối yêu cầu." },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error("[/api/submit] Không gọi được n8n:", err.message);
    await supabaseAdmin
      .from("jobs")
      .update({ status: "error", error_message: "Không kết nối được n8n." })
      .eq("id", job.id);

    return NextResponse.json(
      { error: "Không kết nối được tới hệ thống xử lý." },
      { status: 502 }
    );
  }

  return NextResponse.json({ job_id: job.id, status: "processing" });
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") return "Payload không hợp lệ.";

  if (!payload.asset_id || !payload.asset_name) {
    return "Vui lòng chọn tài nguyên gửi.";
  }

  if (
    !Array.isArray(payload.user_number_list) ||
    payload.user_number_list.length === 0
  ) {
    return "Danh sách người nhận đang trống.";
  }

  if (payload.user_number_list.length > 200) {
    return "Danh sách người nhận vượt quá 200 số.";
  }

  if (!payload.message || !payload.message.content?.trim()) {
    return "Nội dung tin nhắn đang trống.";
  }

  if (
    typeof payload.speed_min !== "number" ||
    typeof payload.speed_max !== "number" ||
    payload.speed_min < 0 ||
    payload.speed_max < payload.speed_min
  ) {
    return "Tốc độ gửi (min/max) không hợp lệ.";
  }

  return null;
}
