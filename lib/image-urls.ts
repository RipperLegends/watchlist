export type SupabaseImageTransform = {
  width?: number;
  height?: number;
  quality?: number;
  resize?: "cover" | "contain" | "fill";
};

function clampNumber(value: number | undefined, min: number, max: number) {
  if (!Number.isFinite(value)) return undefined;
  return Math.min(max, Math.max(min, Math.round(Number(value))));
}

function supabaseImageTransformsEnabled() {
  return process.env.NEXT_PUBLIC_SUPABASE_IMAGE_TRANSFORMS === "true";
}

export function getSupabaseTransformedImageUrl(src: string, transform: SupabaseImageTransform = {}) {
  if (!supabaseImageTransformsEnabled() || !src || src.startsWith("data:") || !src.includes("/storage/v1/object/public/")) return src;

  try {
    const url = new URL(src.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/"));
    const width = clampNumber(transform.width, 1, 2500);
    const height = clampNumber(transform.height, 1, 2500);
    const quality = clampNumber(transform.quality, 20, 100);

    if (width) url.searchParams.set("width", String(width));
    if (height) url.searchParams.set("height", String(height));
    if (quality) url.searchParams.set("quality", String(quality));
    if (transform.resize) url.searchParams.set("resize", transform.resize);

    return url.toString();
  } catch {
    return src;
  }
}

export function avatarImageUrl(src: string, size = 128) {
  return getSupabaseTransformedImageUrl(src, {
    width: size,
    height: size,
    quality: 76,
    resize: "cover"
  });
}

export function coverImageUrl(src: string, width = 1600) {
  return getSupabaseTransformedImageUrl(src, {
    width,
    quality: 78,
    resize: "cover"
  });
}
