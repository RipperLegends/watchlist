import { entrySchema } from "@/lib/validators";

function csvToArray(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function optionalNumber(value: FormDataEntryValue | null) {
  const rawValue = String(value ?? "").trim();
  return rawValue ? Number(rawValue) : null;
}

export function parseEntryFormData(formData: FormData) {
  const parsed = entrySchema.safeParse({
    title: String(formData.get("title") ?? ""),
    type: String(formData.get("type") ?? "movie"),
    status: String(formData.get("status") ?? "planned"),
    rating: String(formData.get("rating") ?? "0"),
    year: optionalNumber(formData.get("year")),
    genre: csvToArray(formData.get("genre")),
    tags: csvToArray(formData.get("tags")),
    mood: String(formData.get("mood") ?? ""),
    posterUrl: String(formData.get("posterUrl") ?? ""),
    comment: String(formData.get("comment") ?? ""),
    currentSeason: String(formData.get("currentSeason") ?? "0"),
    currentEpisode: String(formData.get("currentEpisode") ?? "0"),
    isFavorite: formData.get("isFavorite") === "on"
  });

  return parsed.success ? parsed.data : null;
}
