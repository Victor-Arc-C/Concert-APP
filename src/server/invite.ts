import { createHash, timingSafeEqual } from 'node:crypto';
import { env } from './env';

/**
 * How a code is compared: Unicode-normalised, without spaces, quotes or case, with any dash
 * variant read as "-". Phones auto-capitalise the first letter and may turn "-" into "–", and
 * people paste codes with stray spaces; none of that should reject a genuine invite.
 */
export function normalizeInviteCode(value: string) {
  return value
    .normalize('NFKC')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/["'\u2018\u2019\u201C\u201D\s]/g, '')
    .toUpperCase();
}
/**
 * Parses `BETA_INVITE_CODES`: separated by commas, semicolons or new lines, surrounding quotes
 * ignored (a value pasted as "A,B" in the hosting dashboard keeps both codes). Empty or unset
 * means signup is open.
 */
export function parseInviteCodes(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(/[,;\n\r]+/)
    .map(normalizeInviteCode)
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
 * does not reveal which code or prefix is close. `codes` come from `parseInviteCodes`.
 */
export function inviteValid(candidate: string | undefined, codes: string[]): boolean {
  if (!codes.length) return true;
  const value = normalizeInviteCode(candidate ?? '');
  const received = digest(value);
  let matched = false;
  for (const code of codes) matched = timingSafeEqual(digest(code), received) || matched;
  return matched && !!value;
}
