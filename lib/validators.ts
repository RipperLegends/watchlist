import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(40),
  email: z.string().trim().email(),
  password: z.string().min(6).max(120)
});

export const entrySchema = z.object({
  title: z.string().trim().min(1).max(120),
  type: z.enum(["movie", "series", "game"]).default("movie"),
  status: z.enum(["planned", "watching", "completed"]).default("planned"),
  rating: z.coerce.number().int().min(0).max(5).default(0),
  year: z.coerce.number().int().min(1888).max(2100).optional().nullable(),
  genre: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  mood: z.string().trim().max(80).default(""),
  posterUrl: z.string().trim().url().or(z.literal("")).default(""),
  comment: z.string().trim().max(2000).default(""),
  currentSeason: z.coerce.number().int().min(0).default(0),
  currentEpisode: z.coerce.number().int().min(0).default(0),
  isFavorite: z.boolean().default(false)
});

export const reportSchema = z.object({
  subject: z.string().trim().min(2).max(140),
  body: z.string().trim().min(5).max(3000)
});

export const messageSchema = z.object({
  body: z.string().trim().min(1).max(1200),
  contentTitle: z.string().trim().max(140).default(""),
  contentUrl: z.string().trim().url().or(z.literal("")).default("")
});
