import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const PAGE_SIZE = 20;
const STATUSES = new Set(["processing", "done", "error"]);

export async function GET(req) {
  const params = new URL(req.url).searchParams;
  const page = Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1);
  const status = params.get("status") || "all";
  if (status !== "all" && !STATUSES.has(status)) return NextResponse.json({ error: "Trạng thái không hợp lệ." }, { status: 400 });

  let query = supabaseAdmin.from("jobs").select("id, status, input, result, error_message, created_at, updated_at", { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status !== "all") query = query.eq("status", status);
  const [{ data, error, count }, processing, done, failed, total] = await Promise.all([
    query,
    countStatus("processing"), countStatus("done"), countStatus("error"), countStatus(),
  ]);
  if (error) return NextResponse.json({ error: "Không tải được lịch sử chiến dịch." }, { status: 500 });

  const jobs = (data || []).map((job) => ({
    id: job.id, status: job.status, error_message: job.error_message,
    created_at: job.created_at, updated_at: job.updated_at,
    asset_id: job.result?.summary?.assetID || job.input?.asset_id || "Không xác định",
    asset_name: job.input?.asset_name || "Không xác định",
    recipient_count: Array.isArray(job.input?.user_number_list) ? job.input.user_number_list.length : 0,
    message_preview: job.input?.message?.content || "",
  }));
  return NextResponse.json({ jobs, page, page_size: PAGE_SIZE, total: count || 0, total_pages: Math.max(1, Math.ceil((count || 0) / PAGE_SIZE)), stats: { total, processing, done, error: failed } });
}

async function countStatus(status) {
  let query = supabaseAdmin.from("jobs").select("id", { count: "exact", head: true });
  if (status) query = query.eq("status", status);
  const { count, error } = await query;
  return error ? 0 : count || 0;
}
