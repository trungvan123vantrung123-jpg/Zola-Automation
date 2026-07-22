"use client";

import { useRef, useState } from "react";

/**
 * Vùng 4 - Đính kèm ảnh.
 * Mỗi ảnh chọn sẽ được upload NGAY lên /api/upload-attachment (Supabase Storage),
 * component chỉ giữ lại { url, name } đã upload thành công.
 * Khi submit form chính, chỉ cần gửi mảng URL này -> payload nhẹ, n8n tự tải ảnh khi cần.
 *
 * Props:
 *  - attachments: { url: string, name: string }[]
 *  - onChange: (list) => void
 */
export default function AttachmentUploader({ attachments, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  async function handleFilesSelected(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setError(null);
    setUploading(true);

    const uploaded = [];
    const failedNames = [];

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/upload-attachment", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();

        if (!res.ok) {
          failedNames.push(file.name);
          continue;
        }

        uploaded.push({ url: data.url, name: data.name });
      } catch (err) {
        failedNames.push(file.name);
      }
    }

    if (failedNames.length > 0) {
      setError(`Upload thất bại: ${failedNames.join(", ")}`);
    }

    onChange([...attachments, ...uploaded]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeAttachment(url) {
    onChange(attachments.filter((a) => a.url !== url));
  }

  return (
    <section className="panel">
      <h2 className="panel-title">
        <span className="panel-number">4</span>
        Đính kèm ảnh
      </h2>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        multiple
        onChange={handleFilesSelected}
        disabled={uploading}
        className="file-input"
      />

      {uploading && <p className="field-hint">Đang tải ảnh lên...</p>}
      {error && <p className="field-error">{error}</p>}

      {attachments.length > 0 && (
        <div className="attachment-grid">
          {attachments.map((a) => (
            <div key={a.url} className="attachment-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt={a.name} />
              <button
                type="button"
                className="attachment-remove-btn"
                onClick={() => removeAttachment(a.url)}
                aria-label={`Xoá ${a.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
