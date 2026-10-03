import { z } from "zod";

const amount = z.string().max(20);
export const draftData = z.object({
  title: z.string().max(120),
  clientEmail: z.string().max(200),
  sharedTermsText: z.string().max(5000),
  eventDate: z.number().int().nullable(),
  acceptDeadline: z.number().int().nullable(),
  confirmDeadline: z.number().int().nullable(),
  finalExpiry: z.number().int().nullable(),
  reviewWindowHours: z.string().max(10),
  minResponseHours: z.string().max(10),
  agencyFee: amount,
  holdFeeCap: amount,
  slots: z
    .array(
      z.object({
        key: z.string().min(1).max(40),
        name: z.string().max(120),
        email: z.string().max(200),
        category: z.enum(["venue", "catering", "av", "photo", "decor", "transport", "other"]),
        required: z.boolean(),
        deposit: amount,
        holdFee: amount,
        balance: amount,
        termsText: z.string().max(5000),
      }),
    )
    .max(12),
});
