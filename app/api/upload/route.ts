import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { applyRateLimit } from "@/server/middleware/apply-rate-limit";

export async function POST(req: NextRequest) {
  // Auth check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 5 uploads per minute
  try {
    applyRateLimit(session.user.id, "upload");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Rate limit exceeded";
    return NextResponse.json({ error: msg }, { status: 429 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 });
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Ukuran file maksimal 10MB." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validate magic bytes (binary signatures) to prevent file type spoofing
    let detectedType = "";
    if (buffer.length >= 4) {
      const hex = buffer.subarray(0, 4).toString("hex").toUpperCase();
      if (hex.startsWith("89504E47")) {
        detectedType = "image/png";
      } else if (hex.startsWith("FFD8FF")) {
        detectedType = "image/jpeg"; // jpeg & jpg
      } else if (hex.startsWith("52494646") && buffer.length >= 12 && buffer.subarray(8, 12).toString("hex").toUpperCase() === "57454250") {
        detectedType = "image/webp";
      } else {
        const sampleText = buffer.subarray(0, Math.min(100, buffer.length)).toString("utf-8").toLowerCase();
        if (sampleText.includes("<svg") || sampleText.includes("<?xml")) {
          detectedType = "image/svg+xml";
        }
      }
    }

    const fileType = detectedType || file.type;
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];

    if (!allowedTypes.includes(fileType)) {
      return NextResponse.json({ error: "Tipe berkas tidak valid atau tidak didukung. Gunakan PNG, JPG, SVG, atau WebP yang valid." }, { status: 400 });
    }

    // Safe extension mapping based on validated MIME type
    const mimeToExt: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/webp": "webp",
      "image/svg+xml": "svg",
    };
    const ext = mimeToExt[fileType] || "png";
    const filename = `siteplan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || "property-files";

    if (supabaseUrl && serviceRoleKey) {
      // Clean up URL format
      const cleanedUrl = supabaseUrl.replace(/\/$/, "");
      const uploadUrl = `${cleanedUrl}/storage/v1/object/${bucketName}/${filename}`;

      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${serviceRoleKey}`,
          "Content-Type": fileType,
          "x-upsert": "true",
        },
        body: buffer,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Supabase Storage upload failed: ${errorText}`);
      }

      // Supabase public URL
      const publicUrl = `${cleanedUrl}/storage/v1/object/public/${bucketName}/${filename}`;
      return NextResponse.json({ url: publicUrl, filename, size: file.size });
    }

    // Fallback: Save to public/uploads/siteplans/ for local development
    const uploadDir = join(process.cwd(), "public", "uploads", "siteplans");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, filename), buffer);

    const url = `/uploads/siteplans/${filename}`;
    return NextResponse.json({ url, filename, size: file.size });

  } catch (err) {
    console.error("Upload error:", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Upload gagal: ${detail}` }, { status: 500 });
  }
}
