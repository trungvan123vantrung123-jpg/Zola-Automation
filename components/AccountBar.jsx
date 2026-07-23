"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AccountBar() {
  const router = useRouter();
  const [quota, setQuota] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadQuota() {
      const res = await fetch("/api/quota");
      if (!res.ok) return;
      const data = await res.json();
      if (isMounted) setQuota(data);
    }

    loadQuota();
    const fallbackTimer = setInterval(loadQuota, 30000);

    // Lắng nghe realtime để cập nhật ngay khi quota thay đổi
    // (ví dụ sau khi 1 job vừa hoàn tất và bị trừ quota)
    let channel;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel(`quota-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "customer_profiles",
            filter: `id=eq.${user.id}`,
          },
          () => loadQuota()
        )
        .subscribe();
    })();

    return () => {
      isMounted = false;
      clearInterval(fallbackTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="account-bar">
      {quota && (
        <span className="quota-badge">
          Còn lại <strong>{quota.quota_remaining}</strong> / {quota.quota_limit} lượt
          {quota.quota_reserved > 0 && <small> · đang giữ {quota.quota_reserved}</small>}
        </span>
      )}
      <button type="button" className="btn btn-ghost" onClick={handleLogout}>
        Đăng xuất
      </button>
    </div>
  );
}
