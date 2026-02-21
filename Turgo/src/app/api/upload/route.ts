import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { processAndStoreImage, validateUpload } from "@/server/services/storage";
import { UPLOAD } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      );
    }

    if (files.length > 10) {
      return NextResponse.json(
        { error: "Maximum 10 files per upload" },
        { status: 400 }
      );
    }

    const results: Array<{
      url: string;
      thumbnailUrl: string;
      originalName: string;
    }> = [];

    const errors: Array<{ file: string; error: string }> = [];

    for (const file of files) {
      // Validate file
      const validation = validateUpload(file);
      if (!validation.valid) {
        errors.push({ file: file.name, error: validation.error! });
        continue;
      }

      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const result = await processAndStoreImage(buffer, file.name);
        results.push({
          ...result,
          originalName: file.name,
        });
      } catch (err) {
        console.error(`[UPLOAD_ERROR] Failed to process ${file.name}:`, err);
        errors.push({ file: file.name, error: "Failed to process image" });
      }
    }

    return NextResponse.json({
      uploaded: results,
      errors: errors.length > 0 ? errors : undefined,
      total: files.length,
      successful: results.length,
    });
  } catch (error) {
    console.error("[UPLOAD_ERROR]", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
