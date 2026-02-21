/**
 * File Storage Service — Azure Blob Storage / local filesystem
 */

import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { UPLOAD } from "@/lib/constants";

const IS_DEV = process.env.NODE_ENV === "development";
const LOCAL_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

/** Process and store an uploaded image */
export async function processAndStoreImage(
  buffer: Buffer,
  filename: string
): Promise<{
  url: string;
  thumbnailUrl: string;
}> {
  // Strip EXIF metadata and convert to WebP
  const processedBuffer = await sharp(buffer)
    .rotate() // Auto-rotate based on EXIF
    .resize(UPLOAD.DETAIL_SIZE.width, UPLOAD.DETAIL_SIZE.height, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 85 })
    .toBuffer();

  // Generate thumbnail
  const thumbnailBuffer = await sharp(buffer)
    .rotate()
    .resize(UPLOAD.THUMBNAIL_SIZE.width, UPLOAD.THUMBNAIL_SIZE.height, {
      fit: "cover",
    })
    .webp({ quality: 75 })
    .toBuffer();

  const baseName = path.parse(filename).name;
  const imageFilename = `${baseName}-${Date.now()}.webp`;
  const thumbFilename = `${baseName}-${Date.now()}-thumb.webp`;

  if (IS_DEV) {
    return storeLocal(processedBuffer, thumbnailBuffer, imageFilename, thumbFilename);
  }

  return storeAzureBlob(processedBuffer, thumbnailBuffer, imageFilename, thumbFilename);
}

/** Store files locally (development) */
async function storeLocal(
  imageBuffer: Buffer,
  thumbBuffer: Buffer,
  imageFilename: string,
  thumbFilename: string
) {
  await fs.mkdir(LOCAL_UPLOAD_DIR, { recursive: true });

  await fs.writeFile(path.join(LOCAL_UPLOAD_DIR, imageFilename), imageBuffer);
  await fs.writeFile(path.join(LOCAL_UPLOAD_DIR, thumbFilename), thumbBuffer);

  return {
    url: `/uploads/${imageFilename}`,
    thumbnailUrl: `/uploads/${thumbFilename}`,
  };
}

/** Store files in Azure Blob Storage (production) */
async function storeAzureBlob(
  imageBuffer: Buffer,
  thumbBuffer: Buffer,
  imageFilename: string,
  thumbFilename: string
) {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const _containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || "listings";

  if (!connectionString) {
    console.warn("[Storage] Azure Blob not configured, falling back to local");
    return storeLocal(imageBuffer, thumbBuffer, imageFilename, thumbFilename);
  }

  // In production would use @azure/storage-blob SDK
  // For now, fall back to local
  return storeLocal(imageBuffer, thumbBuffer, imageFilename, thumbFilename);
}

/** Validate file upload */
export function validateUpload(file: {
  type: string;
  size: number;
}): { valid: boolean; error?: string } {
  if (!(UPLOAD.ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return { valid: false, error: "Only JPEG, PNG, and WebP images are allowed" };
  }
  if (file.size > UPLOAD.MAX_FILE_SIZE) {
    return { valid: false, error: "File size must be under 10MB" };
  }
  return { valid: true };
}
