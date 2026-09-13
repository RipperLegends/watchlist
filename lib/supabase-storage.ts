const DEFAULT_BUCKET = "watchlist-media";
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const MAX_SUPPORT_ATTACHMENT_SIZE = 5 * 1024 * 1024;

const mimeToExtension: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

export type ProfileImageKind = "avatar" | "cover";
export type SupportAttachmentUpload = {
  path: string;
  publicUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
};

function hasSupabaseStorageConfig() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getSupabaseStorageStatus() {
  return {
    configured: true,
    mode: hasSupabaseStorageConfig() ? "supabase-storage" : "database-inline",
    bucket: process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET
  };
}

function getStorageConfig() {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase Storage is not configured");
  }

  return { supabaseUrl, serviceRoleKey, bucket };
}

function assertImageFile(file: File) {
  if (!Object.keys(mimeToExtension).includes(file.type)) {
    throw new Error("Only JPG, PNG and WEBP images are supported");
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error("Image must be 2MB or smaller");
  }
}

export async function uploadProfileImage(userId: number, kind: ProfileImageKind, file: File) {
  assertImageFile(file);
  const fileBody = Buffer.from(await file.arrayBuffer());

  if (!hasSupabaseStorageConfig()) {
    return {
      path: `profiles/${userId}/${kind}-inline`,
      publicUrl: `data:${file.type};base64,${fileBody.toString("base64")}`
    };
  }

  const { supabaseUrl, serviceRoleKey, bucket } = getStorageConfig();
  const extension = mimeToExtension[file.type];
  const path = `profiles/${userId}/${kind}-${Date.now()}.${extension}`;
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`;

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": file.type,
      "Cache-Control": "3600",
      "x-upsert": "false"
    },
    body: fileBody
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Supabase upload failed with status ${response.status}`);
  }

  return {
    path,
    publicUrl: `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`
  };
}

export async function uploadSupportAttachment(userId: number, reportId: number, file: File): Promise<SupportAttachmentUpload | null> {
  if (!file || file.size === 0) return null;
  assertImageFile(file);
  if (file.size > MAX_SUPPORT_ATTACHMENT_SIZE) {
    throw new Error("Attachment must be 5MB or smaller");
  }

  const fileBody = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^\w.-]+/g, "-").slice(0, 90) || "attachment";
  const extension = mimeToExtension[file.type];

  if (!hasSupabaseStorageConfig()) {
    return {
      path: `reports/${reportId}/${Date.now()}-${safeName}`,
      publicUrl: `data:${file.type};base64,${fileBody.toString("base64")}`,
      fileName: safeName,
      fileType: file.type,
      fileSize: file.size
    };
  }

  const { supabaseUrl, serviceRoleKey, bucket } = getStorageConfig();
  const path = `reports/${reportId}/${Date.now()}-${safeName}.${extension}`;
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`;

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": file.type,
      "Cache-Control": "3600",
      "x-upsert": "false"
    },
    body: fileBody
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Supabase upload failed with status ${response.status}`);
  }

  return {
    path,
    publicUrl: `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`,
    fileName: safeName,
    fileType: file.type,
    fileSize: file.size
  };
}
