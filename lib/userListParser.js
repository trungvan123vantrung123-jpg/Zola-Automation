// Xử lý danh sách người nhận (Vùng 2).
// Hỗ trợ 2 nguồn nhập: gõ tay dạng "id1|id2|id3" hoặc upload file Excel
// với 2 cột bắt buộc: ID và Number.
// Cả 2 nguồn đều quy về cùng 1 cấu trúc chuẩn để submit lên n8n:
//   { user_number_list: ["0987xxxxxx", "0912xxxxxx", ...] }

export const MAX_USER_COUNT = 200;

/**
 * Parse chuỗi nhập tay dạng "0987xxxxxx|0912xxxxxx|0933xxxxxx"
 * Cho phép người dùng lỡ tay xuống dòng hoặc thêm dấu phẩy -> vẫn nhận diện được.
 */
export function parseTextUserList(rawText) {
  if (!rawText || !rawText.trim()) return [];

  return rawText
    .split(/[\n|,]+/) // tách theo dấu |, dấu phẩy, hoặc xuống dòng
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Validate danh sách: không rỗng, không vượt quá MAX_USER_COUNT,
 * không có dòng trống/toàn khoảng trắng.
 * Trả về { valid: boolean, error?: string, cleaned: string[] }
 */
export function validateUserList(list) {
  const cleaned = (list || []).map((s) => String(s).trim()).filter(Boolean);

  if (cleaned.length === 0) {
    return { valid: false, error: "Danh sách người nhận đang trống.", cleaned };
  }

  if (cleaned.length > MAX_USER_COUNT) {
    return {
      valid: false,
      error: `Danh sách đang có ${cleaned.length} số, vượt quá giới hạn tối đa ${MAX_USER_COUNT}. Vui lòng chia nhỏ thành nhiều lần gửi.`,
      cleaned,
    };
  }

  // Kiểm tra trùng lặp -> chỉ cảnh báo trong error nếu có, không chặn cứng
  const uniqueSet = new Set(cleaned);
  if (uniqueSet.size !== cleaned.length) {
    const duplicateCount = cleaned.length - uniqueSet.size;
    return {
      valid: true,
      warning: `Phát hiện ${duplicateCount} số bị trùng lặp trong danh sách (vẫn có thể gửi).`,
      cleaned,
    };
  }

  return { valid: true, cleaned };
}

/**
 * Parse file Excel (đã đọc bằng thư viện xlsx thành mảng object)
 * thành mảng số điện thoại từ cột "Number".
 * Chấp nhận tên cột không phân biệt hoa thường: Number, number, NUMBER.
 */
export function extractNumbersFromExcelRows(rows) {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => {
      const key = Object.keys(row).find(
        (k) => k.trim().toLowerCase() === "number"
      );
      return key ? String(row[key]).trim() : "";
    })
    .filter(Boolean);
}
