"use client";

import { useRef, useState } from "react";
import {
  WORD_SPIN_PRESETS,
  ICON_SPIN_PRESETS,
  CUSTOMER_NAME_TAG,
} from "@/lib/spinPresets";

/**
 * Vùng 3 - Soạn nội dung tin nhắn.
 * Quản lý nội dung dạng "uncontrolled-ish": textarea giữ giá trị thật,
 * mọi nút chèn text đều thao tác trực tiếp qua ref để chèn đúng vị trí con trỏ,
 * sau đó đồng bộ lại state cha qua onChange.
 *
 * Props:
 *  - content: string
 *  - onChange: (content: string) => void
 */
export default function MessageComposer({
  content,
  onChange,
  aiAutoSpin,
  onAiAutoSpinChange,
}) {
  const textareaRef = useRef(null);
  const [openMenu, setOpenMenu] = useState(null); // null | "word" | "icon"

  /**
   * Chèn `text` vào đúng vị trí con trỏ hiện tại trong textarea,
   * sau đó đặt lại con trỏ ngay sau đoạn vừa chèn để người dùng gõ tiếp tự nhiên.
   */
  function insertAtCursor(text) {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;

    const newContent = content.slice(0, start) + text + content.slice(end);
    onChange(newContent);

    // Đợi React render xong giá trị mới rồi mới set lại con trỏ
    requestAnimationFrame(() => {
      el.focus();
      const newCursorPos = start + text.length;
      el.setSelectionRange(newCursorPos, newCursorPos);
    });

    setOpenMenu(null);
  }

  return (
    <section className="panel">
      <h2 className="panel-title">
        <span className="panel-number">3</span>
        Soạn nội dung tin nhắn
      </h2>

      <div className="notice-box">
        Trong nội dung nên có ít nhất 3 bộ icon spin và 10 bộ từ ngữ đồng nghĩa
        (mỗi bộ 2–3 từ đồng nghĩa) để tránh bị đánh dấu spam.
      </div>

      <div className="toolbar">
        <div className="toolbar-item">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => insertAtCursor(CUSTOMER_NAME_TAG)}
          >
            Thêm tên khách hàng
          </button>
        </div>

        <div className="toolbar-item">
          <button
            type="button"
            className="btn btn-danger-outline"
            onClick={() => setOpenMenu(openMenu === "word" ? null : "word")}
          >
            Thêm spin từ ngữ hay dùng
          </button>
          {openMenu === "word" && (
            <div className="dropdown-panel">
              {WORD_SPIN_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="dropdown-item"
                  onClick={() => insertAtCursor(preset.text)}
                >
                  <span className="dropdown-item-index">{preset.id}.</span>
                  <span className="dropdown-item-text">{preset.text}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="toolbar-item">
          <button
            type="button"
            className="btn btn-dark"
            onClick={() => setOpenMenu(openMenu === "icon" ? null : "icon")}
          >
            Thêm icon ngẫu nhiên
          </button>
          {openMenu === "icon" && (
            <div className="dropdown-panel">
              {ICON_SPIN_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="dropdown-item"
                  onClick={() => insertAtCursor(preset.text)}
                >
                  <span className="dropdown-item-index">{preset.id}</span>
                  <span className="dropdown-item-text">{preset.text}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <textarea
        ref={textareaRef}
        className="textarea-input textarea-message"
        rows={6}
        placeholder="Nhập nội dung tin nhắn..."
        value={content}
        onChange={(e) => onChange(e.target.value)}
      />

      <p className="link-warning">TUYỆT ĐỐI KHÔNG gửi nội dung chứa link (bất kể link gì)</p>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={aiAutoSpin}
          onChange={(event) => onAiAutoSpinChange(event.target.checked)}
        />
        <span>
          Tự động spin thêm kịch bản bằng AI Losa247
          <span className="field-hint-inline"> (áp dụng song song với các bộ spin đã chèn ở trên)</span>
        </span>
      </label>
    </section>
  );
}
