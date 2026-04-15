import { z } from "zod";

export const generateVideoSchema = z.object({
  prompt: z
    .string({ error: "Prompt is required." })
    .trim()
    .min(10, "Prompt must be at least 10 characters.")
    .max(500, "Prompt must be 500 characters or fewer."),
});

export type GenerateVideoInput = z.infer<typeof generateVideoSchema>;
