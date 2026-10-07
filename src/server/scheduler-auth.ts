import { timingSafeEqual } from 'node:crypto';

/**
 * Validates the scheduler bearer token in constant time.
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` on a GET request;
 * external schedulers may POST with the same header.
 */
export function schedulerAuthorized(
  authorization: string | null | undefined,
  secret: string | undefined,
): boolean {
  if (!secret || !authorization) return false;
  // Same parsing as before CON-34: the "Bearer " prefix is stripped when present.
  const token = authorization.replace(/^Bearer /, '');
  if (!token) return false;
  const expected = Buffer.from(secret),
    received = Buffer.from(token);
  return expected.byteLength === received.byteLength && timingSafeEqual(expected, received);
}
