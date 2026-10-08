import { z } from 'zod';
import { cities } from './catalog';
export const preferencesSchema = z
  .object({
    home: z
      .string()
      .refine((v) => cities.some((c) => c.name === v), 'Choose a supported home city'),
    scope: z.enum(['city', 'country', 'europe']),
    maxHours: z.number().min(1).max(48).nullable(),
    radiusKm: z.number().int().min(1).max(5000).nullable().default(null),
    dateFrom: z.iso.date().nullable().optional(),
    dateTo: z.iso.date().nullable().optional(),
    budget: z.number().min(1).max(10000).nullable(),
    notifications: z.enum(['off', 'critical', 'important', 'everything']),
    analytics: z.boolean(),
    // Interface language, so notifications sent later use it too.
    locale: z.enum(['en', 'fr']).optional(),
  })
  .refine((p) => !p.dateFrom || !p.dateTo || p.dateFrom <= p.dateTo, {
    message: 'End date must be on or after start date',
    path: ['dateTo'],
  });
export const intentSchema = z.object({
  artistId: z.string().min(1).max(160),
  cities: z
    .array(z.string().refine((v) => cities.some((c) => c.name === v)))
    .min(1)
    .max(9),
  maxPrice: z.number().min(1).max(10000).nullable(),
  tickets: z.number().int().min(1).max(8),
});
export const authSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.trim().toLowerCase()),
  password: z.string().min(12, 'Use at least 12 characters').max(128),
  name: z.string().trim().min(1).max(60).optional(),
  inviteCode: z.string().trim().max(64).optional(),
});
export const analyticNames = [
  'signup_started',
  'signup_completed',
  'spotify_connected',
  'onboarding_completed',
  'concert_impression',
  'concert_opened',
  'concert_saved',
  'concert_dismissed',
  'must_see_clicked',
  'ticket_link_clicked',
  'travel_option_clicked',
  'hotel_option_clicked',
  'notification_enabled',
  'notification_opened',
] as const;
export const betaFeedbackSchema = z
  .object({
    message: z
      .string()
      .trim()
      .min(1, 'Write a few words before sending.')
      .max(2000, 'Keep feedback under 2,000 characters.')
      // PostgreSQL text cannot store NUL characters.
      .refine((value) => !value.includes('\0'), 'Remove unsupported characters.'),
    rating: z.number().int().min(1).max(5).nullable().default(null),
    // The in-app path only (no query string), so feedback can be tied to a screen.
    screen: z
      .string()
      .max(200)
      .regex(/^\/[A-Za-z0-9/_.~%:@+!(),;=-]*$/, 'Unknown screen.'),
  })
  .strict();
export type BetaFeedbackInput = z.infer<typeof betaFeedbackSchema>;
