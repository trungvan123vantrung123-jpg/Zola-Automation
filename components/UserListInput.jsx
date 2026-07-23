"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  MAX_USER_COUNT,
  parseTextUserList,
  validateUserList,
  extractNumbersFromExcelRows,
} from "@/lib/userListParser";

const MAX_EXCEL_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_EXCEL_ROWS = 1000;

/**
 * Vùng 2 - Danh sách người nhận.
 * Hỗ trợ 2 cách nhập, kết quả cuối cùng luôn quy về mảng userList (string[])
 * để component cha build thành { user_number_list: [...] } khi submit.
 *
 * Props:
 *  - userList: string[]
 *  - onChange: (list: string[]) => void
 */
export default function UserListInput({ userList, onChange }) {
  const [mode, setMode] = useState("text"); // "text" | "excel"
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState("");
  const [validation, setValidation] = useState({ valid: true });
  const fileInputRef = useRef(null);

  function handleTextChange(e) {
    const text = e.target.value;
    setRawText(text);
    const list = parseTextUserList(text);
    const result = validateUserList(list);
    setValidation(result);
    onChange(result.cleaned);
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    if (file.size > MAX_EXCEL_SIZE_BYTES) {
      setValidation({ valid: false, error: "File Excel vượt quá 2MB.", cleaned: [] });
      onChange([]);
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "", range: 0 }).slice(0, MAX_EXCEL_ROWS);

      const numbers = extractNumbersFromExcelRows(rows);

      if (numbers.length === 0) {
        setValidation({
          valid: false,
          error: 'Không tìm thấy cột "Number" trong file, hoặc cột đang trống.',
          cleaned: [],
        });
        onChange([]);
        return;
      }

      const result = validateUserList(numbers);
      setValidation(result);
      onChange(result.cleaned);
    } catch (err) {
      setValidation({
        valid: false,
        error: "Không đọc được file Excel. Vui lòng kiểm tra định dạng file.",
        cleaned: [],
      });
      onChange([]);
    }
  }

  function switchMode(newMode) {
    setMode(newMode);
    // Đổi chế độ nhập -> reset danh sách để tránh lẫn dữ liệu giữa 2 nguồn
    setRawText("");
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setValidation({ valid: true });
    onChange([]);
  }

  function downloadTemplate() {
    window.location.href = "/api/template-excel";
  }

  return (
    <section className="panel">
      <h2 className="panel-title">
        <span className="panel-number">2</span>
        Danh sách người nhận
        <span className="panel-limit">tối đa {MAX_USER_COUNT} số</span>
      </h2>

      <div className="tab-switch">
        <button
          type="button"
          className={`tab-btn ${mode === "text" ? "tab-btn-active" : ""}`}
          onClick={() => switchMode("text")}
        >
          Nhập trực tiếp
        </button>
        <button
          type="button"
          className={`tab-btn ${mode === "excel" ? "tab-btn-active" : ""}`}
          onClick={() => switchMode("excel")}
        >
          Tải lên file Excel
        </button>
      </div>

      {mode === "text" && (
        <textarea
          className="textarea-input"
          rows={4}
          placeholder="0987000001|0987000002|0987000003|..."
          value={rawText}
          onChange={handleTextChange}
        />
      )}

      {mode === "excel" && (
        <div className="excel-upload-box">
          <div className="excel-upload-row">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="file-input"
            />
            <button type="button" className="btn btn-ghost" onClick={downloadTemplate}>
              Tải file mẫu
            </button>
          </div>
          <p className="field-hint">
            File cần có cột <strong>Number</strong> chứa số điện thoại/ID người nhận.
            {fileName && <> Đã chọn: <strong>{fileName}</strong></>}
          </p>
        </div>
      )}

      <div className="list-status-row">
        <span className={`count-badge ${userList.length > MAX_USER_COUNT ? "count-badge-error" : ""}`}>
          {userList.length} / {MAX_USER_COUNT}
        </span>
        {validation.error && <p className="field-error">{validation.error}</p>}
        {validation.warning && <p className="field-warning">{validation.warning}</p>}
      </div>
    </section>
  );
}
