import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

const MAX_USER_COUNT = 200;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_ATTACHMENT_COUNT = 8;
const MAX_SPEED_SECONDS = 120;
const ATTACHMENT_BUCKET = "attachments";

export async function POST(req) {
  const authClient = createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });

  let payload;
  try { payload = await req.json(); } catch { return NextResponse.json({ error: "Payload không hợp lệ." }, { status: 400 }); }
  const validation = validatePayload(payload, user.id);
  if (validation.error) return NextResponse.json({ error: validation.error }, { status: 400 });
  payload = validation.payload;

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

  const signedAttachments = await createSignedAttachments(payload.attachments);
  if (!signedAttachments) {
    await failDispatch(jobId, "Ảnh đính kèm không còn khả dụng.");
    return NextResponse.json({ error: "Một hoặc nhiều ảnh đính kèm không còn khả dụng. Vui lòng upload lại." }, { status: 400 });
  }

  try {
    const n8nRes = await fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Webhook-Secret": webhookSecret },
      body: JSON.stringify({ job_id: jobId, ...payload, attachments: signedAttachments }),
    });
    if (n8nRes.status >= 400 && n8nRes.status < 500) {
      await failDispatch(jobId, `n8n từ chối yêu cầu (HTTP ${n8nRes.status})`);
      return NextResponse.json({ error: "Hệ thống xử lý (n8n) từ chối yêu cầu." }, { status: 502 });
    }
    if (!n8nRes.ok) console.warn(`[/api/submit] n8n HTTP ${n8nRes.status}; giữ job processing để chờ callback.`);
  } catch (error) {
    console.warn(`[/api/submit] Dispatch chưa xác định cho job ${jobId}:`, error.message);
  }

  await supabaseAdmin.from("jobs").update({ dispatched_at: new Date().toISOString() }).eq("id", jobId).eq("status", "processing");
  return NextResponse.json({ job_id: jobId, status: "processing", limits: { quota_available: createdJob.quota_available, daily_available: createdJob.daily_available, usage_date: createdJob.usage_date } });
}

async function createSignedAttachments(attachments) {
  if (!attachments.length) return [];
  const storage = supabaseAdmin.storage.from(ATTACHMENT_BUCKET);
  const paths = attachments.map((attachment) => attachment.path);
  const { data, error } = await storage.createSignedUrls(paths, 60 * 60);
  if (error || !data || data.length !== paths.length || data.some((item) => !item.signedUrl)) return null;
  return attachments.map((attachment, index) => ({ ...attachment, url: data[index].signedUrl }));
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
  if (message.includes("ASSET_NOT_AVAILABLE")) return NextResponse.json({ error: "Tài nguyên đã chọn không còn khả dụng cho tài khoản này. Vui lòng chọn lại tài nguyên." }, { status: 403 });
  if (message.includes("ACCOUNT_NOT_ACTIVE")) return NextResponse.json({ error: "Tài khoản không ở trạng thái được phép gửi tin." }, { status: 403 });
  if (message.includes("PROFILE_NOT_FOUND")) return NextResponse.json({ error: "Không tìm thấy hồ sơ khách hàng." }, { status: 404 });
  console.error("[/api/submit] Không tạo được job:", message);
  return NextResponse.json({ error: "Không tạo được job xử lý." }, { status: 500 });
}

function extractLimit(message, code) {
  const match = message.match(new RegExp(`${code}:([0-9]+)`));
  return Number(match?.[1] || 0);
}

function validatePayload(payload, userId) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { error: "Payload không hợp lệ." };
  if (typeof payload.asset_id !== "string" || !payload.asset_id.trim()) return { error: "Vui lòng chọn tài nguyên gửi." };
  if (!Array.isArray(payload.user_number_list) || payload.user_number_list.length === 0 || payload.user_number_list.length > MAX_USER_COUNT) return { error: "Danh sách người nhận không hợp lệ." };
  const recipients = payload.user_number_list.map((item) => String(item).trim()).filter(Boolean);
  if (recipients.length !== payload.user_number_list.length || new Set(recipients).size !== recipients.length) return { error: "Danh sách số điện thoại có giá trị trống hoặc trùng lặp." };
  if (!payload.message || typeof payload.message.content !== "string" || !payload.message.content.trim() || payload.message.content.length > MAX_MESSAGE_LENGTH || (payload.message.ai_auto_spin !== undefined && typeof payload.message.ai_auto_spin !== "boolean")) return { error: "Nội dung tin nhắn không hợp lệ." };
  if (!Number.isFinite(payload.speed_min) || !Number.isFinite(payload.speed_max) || payload.speed_min < 0 || payload.speed_max < payload.speed_min || payload.speed_max > MAX_SPEED_SECONDS) return { error: "Tốc độ gửi (min/max) không hợp lệ." };
  const attachments = payload.attachments || [];
  if (!Array.isArray(attachments) || attachments.length > MAX_ATTACHMENT_COUNT) return { error: "Danh sách ảnh đính kèm không hợp lệ." };
  const prefix = `uploads/${userId}/`;
  if (attachments.some((item) => !item || typeof item !== "object" || item.bucket !== ATTACHMENT_BUCKET || typeof item.path !== "string" || !item.path.startsWith(prefix) || item.path.includes("..") || typeof item.name !== "string")) return { error: "Ảnh đính kèm không thuộc tài khoản này hoặc không hợp lệ." };
  return { payload: { asset_id: payload.asset_id.trim(), asset_name: typeof payload.asset_name === "string" ? payload.asset_name.trim().slice(0, 200) : "", user_number_list: recipients, message: { content: payload.message.content.trim(), ai_auto_spin: Boolean(payload.message.ai_auto_spin) }, attachments: attachments.map(({ bucket, path, name, size }) => ({ bucket, path, name: name.slice(0, 200), size: Number.isFinite(size) ? size : null })), speed_min: payload.speed_min, speed_max: payload.speed_max } };
}
