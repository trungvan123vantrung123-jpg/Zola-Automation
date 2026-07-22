// GET /api/template-excel
// Sinh file Excel mẫu với 2 cột bắt buộc: ID, Number -> trả về cho browser tải xuống.
// Sinh động trên server (không cần lưu sẵn file tĩnh trong /public).

import * as XLSX from "xlsx";
import { NextResponse } from "next/server";

export async function GET() {
  const sampleRows = [
    { ID: "1", Number: "0987000001" },
    { ID: "2", Number: "0987000002" },
    { ID: "3", Number: "0987000003" },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleRows);
  worksheet["!cols"] = [{ wch: 8 }, { wch: 18 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "DanhSach");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="mau_danh_sach_gui.xlsx"',
    },
  });
}
