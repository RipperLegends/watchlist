"use client";

import { ImageUp, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { avatarImageUrl, coverImageUrl } from "@/lib/image-urls";

type ProfileMediaUploadProps = {
  avatarUrl: string;
  coverUrl: string;
  storageReady: boolean;
  labels: {
    storageMissing: string;
    pickFirst: string;
    uploadFailed: string;
    avatarUpdated: string;
    coverUpdated: string;
    avatar: string;
    cover: string;
  };
};

type UploadKind = "avatar" | "cover";

export function ProfileMediaUpload({ avatarUrl, coverUrl, storageReady, labels }: ProfileMediaUploadProps) {
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState({ avatar: avatarUrl, cover: coverUrl });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState<UploadKind | null>(null);

  async function upload(kind: UploadKind) {
    const input = kind === "avatar" ? avatarInputRef.current : coverInputRef.current;
    const file = input?.files?.[0];
    if (!file) {
      setMessage(labels.pickFirst);
      return;
    }

    setLoading(kind);
    setMessage("");

    const formData = new FormData();
    formData.set("kind", kind);
    formData.set("file", file);

    const response = await fetch("/api/profile/images", {
      method: "POST",
      body: formData
    });
    const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };

    setLoading(null);

    if (!response.ok || !data.url) {
      setMessage(data.error ?? labels.uploadFailed);
      return;
    }

    setPreview((current) => ({ ...current, [kind]: data.url ?? "" }));
    setMessage(kind === "avatar" ? labels.avatarUpdated : labels.coverUpdated);
    if (input) input.value = "";
  }

  return (
    <div className="flex flex-col gap-5">
      {!storageReady ? (
        <div className="rounded-md border border-dashed bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
          {labels.storageMissing}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[140px_1fr_auto] md:items-center">
        <div
          className="flex size-28 items-center justify-center rounded-full bg-secondary text-3xl font-black text-secondary-foreground"
          style={preview.avatar ? { backgroundImage: `url(${avatarImageUrl(preview.avatar, 160)})`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}
        >
          {!preview.avatar ? <ImageUp className="size-8" /> : null}
        </div>
        <Input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp" disabled={!storageReady || loading !== null} />
        <Button type="button" onClick={() => upload("avatar")} disabled={!storageReady || loading !== null}>
          {loading === "avatar" ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />}
          {labels.avatar}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-[220px_1fr_auto] md:items-center">
        <div
          className="flex aspect-[16/7] min-h-24 items-center justify-center rounded-md bg-secondary text-secondary-foreground"
          style={preview.cover ? { backgroundImage: `url(${coverImageUrl(preview.cover, 900)})`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}
        >
          {!preview.cover ? <ImageUp className="size-8" /> : null}
        </div>
        <Input ref={coverInputRef} type="file" accept="image/png,image/jpeg,image/webp" disabled={!storageReady || loading !== null} />
        <Button type="button" onClick={() => upload("cover")} disabled={!storageReady || loading !== null}>
          {loading === "cover" ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />}
          {labels.cover}
        </Button>
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
