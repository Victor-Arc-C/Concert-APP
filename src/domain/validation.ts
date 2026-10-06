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
