import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function GET(req) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login?auth_error=missing_code", requestUrl.origin));

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[/auth/callback] Không đổi được code:", error.message);
    return NextResponse.redirect(new URL("/login?auth_error=invalid_or_expired", requestUrl.origin));
  }
  return NextResponse.redirect(new URL("/pending-approval", requestUrl.origin));
}
