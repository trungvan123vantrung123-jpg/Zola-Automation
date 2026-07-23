import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function DELETE(req) {
  const authClient = createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Payload không hợp lệ." }, { status: 400 }); }
  const path = body?.path;
  const ownedPrefix = `uploads/${user.id}/`;
  if (typeof path !== "string" || !path.startsWith(ownedPrefix) || path.includes("..")) return NextResponse.json({ error: "Đường dẫn file không hợp lệ." }, { status: 400 });
  const { error } = await supabaseAdmin.storage.from("attachments").remove([path]);
  if (error) return NextResponse.json({ error: "Không xóa được ảnh." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
