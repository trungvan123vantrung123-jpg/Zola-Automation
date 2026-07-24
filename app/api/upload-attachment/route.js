import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

const TYPE_EXTENSIONS = { "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_BASENAME_LENGTH = 80;
const PREVIEW_URL_TTL_SECONDS = 60 * 60;

function sanitizeFileName(originalName, extension) {
  const rawName = String(originalName || "image")
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    .replace(/\.[^.]*$/, "");

  const asciiName = rawName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, MAX_BASENAME_LENGTH);

  const safeBase = asciiName && ![".", ".."].includes(asciiName) ? asciiName : "image";
  return `${safeBase}.${extension}`;
}

function hasValidImageSignature(buffer, mimeType) {
  const bytes = new Uint8Array(buffer);
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte);
  if (mimeType === "image/webp") return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

export async function POST(req) {
  const authClient = createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  const { data: profile } = await supabaseAdmin.from("customer_profiles").select("status").eq("id", user.id).single();
  if (profile?.status !== "active") return NextResponse.json({ error: "Tài khoản không được phép upload." }, { status: 403 });

  let formData;
  try { formData = await req.formData(); } catch { return NextResponse.json({ error: "Form upload không hợp lệ." }, { status: 400 }); }
  const file = formData.get("file");
  if (!file || typeof file.arrayBuffer !== "function") return NextResponse.json({ error: "Thiếu file." }, { status: 400 });
  const extension = TYPE_EXTENSIONS[file.type];
  if (!extension) return NextResponse.json({ error: "Chỉ nhận ảnh JPG/PNG/WEBP." }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_SIZE_BYTES) return NextResponse.json({ error: "Ảnh phải có dung lượng từ 1 byte đến 5MB." }, { status: 400 });

  const rawBuffer = await file.arrayBuffer();
  if (!hasValidImageSignature(rawBuffer, file.type)) return NextResponse.json({ error: "Nội dung file không khớp với định dạng ảnh đã chọn." }, { status: 400 });

  const safeFileName = sanitizeFileName(file.name, extension);
  const safeBaseName = safeFileName.slice(0, -(extension.length + 1));
  const objectName = `${safeBaseName}-${randomUUID()}.${extension}`;
  const filePath = `uploads/${user.id}/${objectName}`;
  const buffer = Buffer.from(rawBuffer);
  const storage = supabaseAdmin.storage.from("attachments");
  const { data: uploadedObject, error: uploadError } = await storage.upload(filePath, buffer, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });
  if (uploadError || !uploadedObject?.path) {
    console.error("[/api/upload-attachment] Lỗi upload:", uploadError?.message || "Không nhận được path từ Supabase");
    return NextResponse.json({ error: "Upload ảnh thất bại." }, { status: 500 });
  }

  // getPublicUrl chỉ tạo chuỗi URL và không xác nhận object tồn tại. Download lại
  // ngay sau upload để chỉ trả URL cho n8n khi file thực sự đọc được trong bucket.
  const { data: verificationFile, error: verificationError } = await storage.download(uploadedObject.path);
  if (verificationError || !verificationFile || verificationFile.size !== file.size) {
    console.error("[/api/upload-attachment] Xác minh object thất bại:", {
      project: process.env.NEXT_PUBLIC_SUPABASE_URL,
      bucket: "attachments",
      path: uploadedObject.path,
      expectedSize: file.size,
      actualSize: verificationFile?.size,
      error: verificationError?.message,
    });
    await storage.remove([uploadedObject.path]);
    return NextResponse.json({ error: "Ảnh đã upload nhưng không xác minh được trong Supabase Storage." }, { status: 502 });
  }

  const { data: previewUrlData, error: previewUrlError } = await storage.createSignedUrl(uploadedObject.path, PREVIEW_URL_TTL_SECONDS);
  if (previewUrlError || !previewUrlData?.signedUrl) {
    await storage.remove([uploadedObject.path]);
    return NextResponse.json({ error: "Không tạo được URL xem trước ảnh." }, { status: 502 });
  }
  console.info("[/api/upload-attachment] Upload đã xác minh:", {
    bucket: "attachments",
    path: uploadedObject.path,
    size: verificationFile.size,
  });
  return NextResponse.json({
    url: previewUrlData.signedUrl,
    path: uploadedObject.path,
    bucket: "attachments",
    name: safeFileName,
    size: verificationFile.size,
  });
}
