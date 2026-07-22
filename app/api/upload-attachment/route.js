// POST /api/upload-attachment
// Nhận 1 file ảnh từ form-data, upload lên Supabase Storage (bucket "attachments"),
// trả về public URL. Frontend gọi route này cho từng ảnh TRƯỚC khi submit form chính,
// để lúc submit chỉ cần gửi mảng URL (nhẹ, không phải gửi binary qua n8n).

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB, nới hơn mức 500KB khuyến nghị trong ghi chú gốc

export async function POST(req) {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!file) {
    return NextResponse.json({ error: "Thiếu file." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Định dạng ${file.type} không được hỗ trợ. Chỉ nhận ảnh JPG/PNG/WEBP.` },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "Ảnh vượt quá dung lượng cho phép (tối đa 5MB)." },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const ext = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filePath = `uploads/${fileName}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("attachments")
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("[/api/upload-attachment] Lỗi upload:", uploadError.message);
    return NextResponse.json(
      { error: "Upload ảnh thất bại." },
      { status: 500 }
    );
  }

  const { data: publicUrlData } = supabaseAdmin.storage
    .from("attachments")
    .getPublicUrl(filePath);

  return NextResponse.json({
    url: publicUrlData.publicUrl,
    path: filePath,
    name: file.name,
  });
}
