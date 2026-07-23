import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

const MAX_USER_COUNT = 200;

export async function POST(req) {
  const authClient = createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });

  let payload;
  try { payload = await req.json(); } catch { return NextResponse.json({ error: "Payload không hợp lệ." }, { status: 400 }); }
  const validationError = validatePayload(payload);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const requestedAmount = payload.user_number_list.length;
  const { data: createdJob, error: createError } = await supabaseAdmin.rpc("create_broadcast_job", {
    p_customer_id: user.id,
    p_input: payload,
    p_requested_amount: requestedAmount,
  });
  if (createError) return handleCreateError(createError);

  const jobId = createdJob?.job_id;
  if (typeof jobId !== "string") {
    console.error("[/api/submit] RPC tạo job trả về dữ liệu không hợp lệ.");
    return NextResponse.json({ error: "Không tạo được job xử lý." }, { status: 500 });
  }

  const n8nUrl = process.env.N8N_SEND_MESSAGE_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET;
  if (!n8nUrl || !webhookSecret) {
    await failDispatch(jobId, "Thiếu cấu hình webhook n8n hoặc secret.");
    return NextResponse.json({ error: "Hệ thống xử lý chưa được cấu hình đầy đủ." }, { status: 503 });
  }

  try {
    const n8nRes = await fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Webhook-Secret": webhookSecret },
      body: JSON.stringify({ job_id: jobId, ...payload }),
    });
    if (n8nRes.status >= 400 && n8nRes.status < 500) {
      await failDispatch(jobId, `n8n từ chối yêu cầu (HTTP ${n8nRes.status})`);
      return NextResponse.json({ error: "Hệ thống xử lý (n8n) từ chối yêu cầu." }, { status: 502 });
    }
    if (!n8nRes.ok) console.warn(`[/api/submit] n8n HTTP ${n8nRes.status}; giữ job processing để chờ callback.`);
  } catch (error) {
    // Không biết n8n đã nhận request hay chưa; không giải phóng reservation để tránh
    // callback thành công đến sau nhưng quota không còn được giữ.
    console.warn(`[/api/submit] Dispatch chưa xác định cho job ${jobId}:`, error.message);
  }

  await supabaseAdmin.from("jobs").update({ dispatched_at: new Date().toISOString() }).eq("id", jobId).eq("status", "processing");
  return NextResponse.json({ job_id: jobId, status: "processing", limits: { quota_available: createdJob.quota_available, daily_available: createdJob.daily_available, usage_date: createdJob.usage_date } });
}

async function failDispatch(jobId, message) {
  const { error } = await supabaseAdmin.rpc("fail_broadcast_dispatch", { p_job_id: jobId, p_error_message: message });
  if (error) console.error("[/api/submit] Không thể kết thúc dispatch:", error.message);
}

function handleCreateError(error) {
  const message = error.message || "";
  if (message.includes("INSUFFICIENT_QUOTA")) {
    const available = extractLimit(message, "INSUFFICIENT_QUOTA");
    return NextResponse.json({ error: `Số lượt còn lại của bạn là ${available}. Bạn chỉ có thể nhập tối đa ${available} số điện thoại.`, code: "INSUFFICIENT_QUOTA", available }, { status: 403 });
  }
  if (message.includes("DAILY_ASSET_CAP")) {
    const [, available = "0", usageDate] = message.match(/DAILY_ASSET_CAP:([0-9]+):([0-9-]+)/) || [];
    return NextResponse.json({ error: "Asset này đã đạt giới hạn 50 lời mời kết bạn thành công hôm nay. Hãy cân nhắc tiếp tục vào ngày mai để giảm nguy cơ bị khóa tài khoản.", code: "DAILY_ASSET_CAP", available: Number(available), usage_date: usageDate || null }, { status: 429 });
  }
  if (message.includes("ACCOUNT_NOT_ACTIVE")) return NextResponse.json({ error: "Tài khoản không ở trạng thái được phép gửi tin." }, { status: 403 });
  if (message.includes("PROFILE_NOT_FOUND")) return NextResponse.json({ error: "Không tìm thấy hồ sơ khách hàng." }, { status: 404 });
  console.error("[/api/submit] Không tạo được job:", message);
  return NextResponse.json({ error: "Không tạo được job xử lý." }, { status: 500 });
}

function extractLimit(message, code) {
  const match = message.match(new RegExp(`${code}:([0-9]+)`));
  return Number(match?.[1] || 0);
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") return "Payload không hợp lệ.";
  if (typeof payload.asset_id !== "string" || !payload.asset_id.trim() || typeof payload.asset_name !== "string" || !payload.asset_name.trim()) return "Vui lòng chọn tài nguyên gửi.";
  if (!Array.isArray(payload.user_number_list) || payload.user_number_list.length === 0) return "Danh sách người nhận đang trống.";
  if (payload.user_number_list.length > MAX_USER_COUNT || payload.user_number_list.some((item) => typeof item !== "string" || !item.trim())) return "Danh sách người nhận không hợp lệ.";
  if (!payload.message || typeof payload.message.content !== "string" || !payload.message.content.trim()) return "Nội dung tin nhắn đang trống.";
  if (!Number.isFinite(payload.speed_min) || !Number.isFinite(payload.speed_max) || payload.speed_min < 0 || payload.speed_max < payload.speed_min) return "Tốc độ gửi (min/max) không hợp lệ.";
  return null;
}
