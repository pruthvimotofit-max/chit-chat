import { z } from "zod";

export const createPostSchema = z.object({
  caption: z
    .string()
    .trim()
    .max(2200, "Caption must be 2200 characters or less"),

  location: z
    .string()
    .trim()
    .max(100, "Location must be 100 characters or less"),

  mediaUrl: z
    .string()
    .trim()
    .url("Enter a valid media URL"),

  visibility: z.enum(["public", "followers", "private"]),
});
