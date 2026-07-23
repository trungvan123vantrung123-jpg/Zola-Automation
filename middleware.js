import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// Các route không cần đăng nhập (qua Supabase Auth) vẫn truy cập được.
// /admin và /api/admin tự bảo vệ riêng bằng ADMIN_SECRET (xem AdminPanel.jsx),
// không dùng chung cơ chế session khách hàng thông thường.
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/auth/callback",
  "/pending-approval",
  "/admin",
  "/api/admin",
  "/api/job-callback",
];

export async function middleware(req) {
  let res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: {
      get(name) { return req.cookies.get(name)?.value; },
      set(name, value, options) { res.cookies.set({ name, value, ...options }); },
      remove(name, options) { res.cookies.set({ name, value: "", ...options }); },
    } }
  );

  const pathname = req.nextUrl.pathname;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const isApiAuthPath = pathname.startsWith("/api/auth");
  const isStaticAsset = pathname.startsWith("/_next") || pathname.startsWith("/favicon");
  if (isStaticAsset || isApiAuthPath) return res;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user && !isPublicPath) return NextResponse.redirect(new URL("/login", req.url));
  if (user && (pathname === "/login" || pathname === "/register")) return NextResponse.redirect(new URL("/", req.url));

  if (user && !isPublicPath) {
    const { data: profile } = await supabase.from("customer_profiles").select("status").eq("id", user.id).single();
    const status = profile?.status || "pending";
    if (status === "disabled") return NextResponse.redirect(new URL("/pending-approval", req.url));
    const requiresActivePage = pathname === "/";
    if (requiresActivePage && status !== "active") return NextResponse.redirect(new URL("/pending-approval", req.url));
  }
  return res;
}

export const config = {
  matcher: [
    /*
     * Áp dụng cho mọi route trừ static file của Next.js
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
