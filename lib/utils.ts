import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "W";
}

export function formatDate(value?: Date | string | null) {
  if (!value) return "немає даних";
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

export function normalizeStringList(value: string, limit = 10) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, array) => array.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === index)
    .slice(0, limit);
}
