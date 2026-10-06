import { createHash, timingSafeEqual } from 'node:crypto';
import { env } from './env';

/** Parses `BETA_INVITE_CODES` (comma-separated). Empty or unset means signup is open. */
export function parseInviteCodes(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean);
}
export function inviteCodes() {
  return parseInviteCodes(env().BETA_INVITE_CODES);
}
export function inviteRequired() {
  return inviteCodes().length > 0;
}
const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();
/**
 * Constant-time check against every configured code (no early exit), so response timing
 * does not reveal which code or prefix is close. Codes are compared case-sensitively.
 */
export function inviteValid(candidate: string | undefined, codes: string[]): boolean {
  if (!codes.length) return true;
  const received = digest(candidate?.trim() ?? '');
  let matched = false;
  for (const code of codes) matched = timingSafeEqual(digest(code), received) || matched;
  return matched && !!candidate?.trim();
}
