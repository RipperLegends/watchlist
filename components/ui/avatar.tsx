import * as React from "react";
import Image from "next/image";
import { avatarImageUrl } from "@/lib/image-urls";
import { cn } from "@/lib/utils";

export function Avatar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("relative flex size-10 shrink-0 overflow-hidden rounded-full", className)} {...props} />;
}

type AvatarImageProps = Omit<React.ComponentProps<typeof Image>, "width" | "height" | "fill" | "src"> & {
  src?: string | null;
};

export function AvatarImage({ className, alt = "", sizes = "128px", src, ...props }: AvatarImageProps) {
  if (!src || !src.trim()) return null;
  const url = avatarImageUrl(src);
  if (!url || !url.trim()) return null;
  return <Image fill unoptimized sizes={sizes} className={cn("aspect-square size-full object-cover", className)} alt={alt} {...props} src={url} />;
}

export function AvatarFallback({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex size-full items-center justify-center rounded-full bg-secondary text-sm font-bold", className)}
      {...props}
    />
  );
}
