import { z } from 'zod';

/** AI Vision — accepts legacy `imageBase64` or spec `image`; `productId` or `vault_id`. */
export const aiVisionBodySchema = z
  .object({
    imageBase64: z.string().min(20).optional(),
    image: z.string().min(20).optional(),
    productId: z.string().min(1).max(128).optional(),
    vault_id: z.string().min(1).max(128).optional(),
    mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']).optional(),
  })
  .superRefine((data, ctx) => {
    const img = data.image ?? data.imageBase64;
    const pid = data.productId ?? data.vault_id;
    if (!img) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'image or imageBase64 required' });
    }
    if (!pid) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'productId or vault_id required' });
    }
  });

export type AiVisionBody = z.infer<typeof aiVisionBodySchema>;

export const authEmailPasswordSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(256),
  name: z.string().max(120).optional(),
});

export const privySyncSchema = z.object({
  privyId: z.string().min(8).max(256),
  walletAddress: z.string().max(128).optional().nullable(),
  email: z.string().email().max(254).optional().nullable(),
});

export const wisdomQuerySchema = z.object({
  productId: z.string().min(1).max(128),
});

export const tradeOrderSchema = z.object({
  productId: z.string().min(1).max(128),
  side: z.enum(['buy', 'sell']),
  shares: z.number().int().positive(),
  pricePerShare: z.number().positive().optional(),
});

export const canBondSchema = z.object({
  tier: z.union([z.string(), z.number()]),
  cost: z.number().positive(),
});

export const resaleEstimateSchema = z.object({
  category: z.string().min(1).max(128),
  condition: z.string().min(1).max(64),
  originalPrice: z.number().positive(),
  ageMonths: z.number().int().min(0),
  district: z.string().min(1).max(128).optional(),
});

export const constructionBidSchema = z.object({
  projectId: z.string().min(1).max(128),
  amountLkr: z.number().positive(),
  durationDays: z.number().int().positive(),
  description: z.string().max(2000).optional(),
});
