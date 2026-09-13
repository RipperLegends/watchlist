import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadProfileImage, type ProfileImageKind } from "@/lib/supabase-storage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await request.formData();
    const kind = formData.get("kind") === "cover" ? "cover" : "avatar";
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json({ error: "Image file is required" }, { status: 400 });
    }

    const uploaded = await uploadProfileImage(Number(user.id), kind as ProfileImageKind, file);

    await prisma.user.update({
      where: { id: Number(user.id) },
      data: kind === "cover" ? { coverUrl: uploaded.publicUrl } : { avatarUrl: uploaded.publicUrl }
    });

    return Response.json({
      kind,
      url: uploaded.publicUrl
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image upload failed";
    const status = message.includes("not configured") ? 503 : 400;
    return Response.json({ error: message }, { status });
  }
}
