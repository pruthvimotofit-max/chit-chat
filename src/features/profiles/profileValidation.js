import { z } from "zod";

export const profileUpdateSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Display name is required")
    .max(50, "Display name is too long"),

  bio: z
    .string()
    .trim()
    .max(150, "Bio must be 150 characters or less"),

  website: z
    .string()
    .trim()
    .max(200, "Website is too long")
    .refine(
      (value) =>
        value === "" ||
        /^https?:\/\/.+/i.test(value),
      "Enter a valid website URL",
    ),

  isPrivate: z.boolean(),
});
