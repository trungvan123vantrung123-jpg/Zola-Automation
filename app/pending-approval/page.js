"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const STATUS_CONTENT = {
  pending: {
    title: "Tài khoản đang chờ duyệt",
    text: "Quản trị viên sẽ xem xét và cấp lượt dùng demo trong thời gian sớm nhất. Trang này sẽ tự chuyển khi tài khoản được duyệt.",
  },
  disabled: {
    title: "Tài khoản đã bị khoá",
    text: "Vui lòng liên hệ quản trị viên để biết thêm chi tiết.",
  },
  exhausted: {
    title: "Đã dùng hết lượt demo",
    text: "Vui lòng liên hệ để được cấp thêm lượt hoặc nâng cấp lên gói chính thức.",
  },
};

export default function PendingApprovalPage() {
  const router = useRouter();
  const [status, setStatus] = useState("pending");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let channel;

    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("customer_profiles")
        .select("status")
        .eq("id", user.id)
        .single();

      if (!isMounted) return;

      if (profile?.status === "active") {
        router.push("/");
        return;
      }

      setStatus(profile?.status || "pending");
      setLoading(false);

      // Lắng nghe realtime -> tự chuyển trang ngay khi admin duyệt xong,
      // không cần người dùng tự bấm F5.
      channel = supabase
        .channel(`profile-status-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "customer_profiles",
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.new.status === "active") {
              router.push("/");
            } else {
              setStatus(payload.new.status);
            }
          }
        )
        .subscribe();
    }

    loadProfile();
    const fallbackTimer = setInterval(loadProfile, 30000);

    return () => {
      isMounted = false;
      clearInterval(fallbackTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <p className="auth-text">Đang tải...</p>
        </div>
      </main>
    );
  }

  const content = STATUS_CONTENT[status] || STATUS_CONTENT.pending;

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <h1 className="auth-title">{content.title}</h1>
        <p className="auth-text">{content.text}</p>
        <button type="button" className="btn btn-ghost" onClick={handleLogout}>
          Đăng xuất
        </button>
      </div>
    </main>
  );
}
