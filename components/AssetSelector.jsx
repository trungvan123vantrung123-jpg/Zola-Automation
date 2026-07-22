"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/**
 * Vùng 1 - Chọn tài nguyên gửi.
 * Danh sách được lấy từ Supabase (bảng `assets`), ghi vào bởi workflow n8n
 * sau khi người dùng đăng nhập quét QR ở màn hình riêng.
 * Dùng Supabase Realtime để tự cập nhật danh sách khi có asset mới,
 * không cần refresh trang thủ công.
 *
 * Props:
 *  - value: asset_id đang chọn
 *  - onChange: (asset) => void, trả về { asset_id, asset_name }
 */
export default function AssetSelector({ value, onChange }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadAssets() {
      setLoading(true);
      try {
        const res = await fetch("/api/assets");
        const data = await res.json();
        if (!isMounted) return;
        if (!res.ok) {
          setLoadError(data.error || "Không tải được danh sách tài nguyên.");
        } else {
          setAssets(data.assets || []);
        }
      } catch (err) {
        if (isMounted) setLoadError("Không kết nối được máy chủ.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadAssets();

    // Lắng nghe thay đổi realtime trên bảng assets (khi n8n thêm/sửa sau khi quét QR)
    const channel = supabase
      .channel("assets-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "assets" },
        () => loadAssets()
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  function handleSelect(e) {
    const selectedId = e.target.value;
    const asset = assets.find((a) => a.asset_id === selectedId);
    onChange(asset ? { asset_id: asset.asset_id, asset_name: asset.asset_name } : null);
  }

  return (
    <section className="panel">
      <h2 className="panel-title">
        <span className="panel-number">1</span>
        Chọn tài nguyên gửi
      </h2>

      {loadError && <p className="field-error">{loadError}</p>}

      <select
        className="select-input"
        value={value || ""}
        onChange={handleSelect}
        disabled={loading || assets.length === 0}
      >
        <option value="" disabled>
          {loading
            ? "Đang tải danh sách..."
            : assets.length === 0
            ? "Chưa có tài nguyên nào — hãy đăng nhập trước"
            : "-- Chọn tài nguyên --"}
        </option>
        {assets.map((a) => (
          <option key={a.asset_id} value={a.asset_id}>
            {a.asset_name} ({a.asset_id})
          </option>
        ))}
      </select>

      {!loading && assets.length === 0 && !loadError && (
        <p className="field-hint">
          Danh sách sẽ tự động cập nhật ngay sau khi bạn đăng nhập quét QR thành công.
        </p>
      )}
    </section>
  );
}
