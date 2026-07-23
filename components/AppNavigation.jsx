"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AppNavigation() {
  const pathname = usePathname();
  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");

  if (isAdminArea) {
    return (
      <nav className="app-nav" aria-label="Điều hướng quản trị">
        <div className="app-nav-inner">
          <Link id="nav-admin-home" href="/admin" className="app-brand">
            <span>Z</span><strong>Zola Automation · Quản trị</strong>
          </Link>
        </div>
      </nav>
    );
  }

  return (
    <nav className="app-nav" aria-label="Điều hướng chính">
      <div className="app-nav-inner">
        <Link id="nav-campaign-create" href="/" className="app-brand"><span>Z</span><strong>Zola Automation</strong></Link>
        <div className="app-nav-links">
          <Link id="nav-create" href="/" className={pathname === "/" ? "active" : ""}>Tạo chiến dịch</Link>
          <Link id="nav-history" href="/logs" className={pathname.startsWith("/logs") ? "active" : ""}>Lịch sử hoạt động</Link>
        </div>
      </div>
    </nav>
  );
}
