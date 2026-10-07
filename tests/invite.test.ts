import { afterEach, expect, it, vi } from 'vitest';
import { inviteRequired, inviteValid, parseInviteCodes } from '../src/server/invite';

afterEach(() => vi.unstubAllEnvs());

it('parses comma-separated codes and ignores blanks', () => {
  expect(parseInviteCodes(undefined)).toEqual([]);
  expect(parseInviteCodes('')).toEqual([]);
  expect(parseInviteCodes(' AIDAMS-2026 , ,friends ')).toEqual(['AIDAMS-2026', 'FRIENDS']);
  // Pasted into a hosting dashboard with quotes, or one code per line.
  expect(parseInviteCodes('"AIDAMS-2026,friends"')).toEqual(['AIDAMS-2026', 'FRIENDS']);
  expect(parseInviteCodes('AIDAMS-2026\nfriends;crew')).toEqual(['AIDAMS-2026', 'FRIENDS', 'CREW']);
});
it('keeps signup open when no codes are configured', () => {
  vi.stubEnv('APP_ENV', 'local');
  vi.stubEnv('BETA_INVITE_CODES', '');
  expect(inviteRequired()).toBe(false);
  expect(inviteValid(undefined, [])).toBe(true);
});
it('requires an exact configured code when the gate is on', () => {
  vi.stubEnv('APP_ENV', 'local');
  vi.stubEnv('BETA_INVITE_CODES', 'AIDAMS-2026,friends');
  expect(inviteRequired()).toBe(true);
  const codes = parseInviteCodes('AIDAMS-2026,friends');
  expect(inviteValid('AIDAMS-2026', codes)).toBe(true);
  expect(inviteValid('  friends ', codes)).toBe(true);
  expect(inviteValid(undefined, codes)).toBe(false);
  expect(inviteValid('', codes)).toBe(false);
  expect(inviteValid('AIDAMS-202', codes)).toBe(false);
  expect(inviteValid('-', codes)).toBe(false);
  expect(inviteValid('AIDAMS-2026,friends', codes)).toBe(false);
});
it('accepts what phones and copy-paste do to a genuine code', () => {
  const codes = parseInviteCodes('AIDAMS-2026,friends');
  expect(inviteValid('aidams-2026', codes)).toBe(true); // lower case
  expect(inviteValid('Friends', codes)).toBe(true); // iOS auto-capitalised first letter
  expect(inviteValid('AIDAMS–2026', codes)).toBe(true); // en dash from smart punctuation
  expect(inviteValid('AIDAMS - 2026', codes)).toBe(true); // stray spaces
  expect(inviteValid('“friends”', codes)).toBe(true); // pasted with curly quotes
  expect(inviteValid('ＡＩＤＡＭＳ-2026', codes)).toBe(true); // full-width characters
  expect(inviteValid('AIDAMS2026', codes)).toBe(false); // the dash is still part of the code
});
