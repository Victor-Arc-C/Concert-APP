import { afterEach, expect, it, vi } from 'vitest';
import { inviteRequired, inviteValid, parseInviteCodes } from '../src/server/invite';

afterEach(() => vi.unstubAllEnvs());

it('parses comma-separated codes and ignores blanks', () => {
  expect(parseInviteCodes(undefined)).toEqual([]);
  expect(parseInviteCodes('')).toEqual([]);
  expect(parseInviteCodes(' AIDAMS-2026 , ,friends ')).toEqual(['AIDAMS-2026', 'friends']);
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
  expect(inviteValid('aidams-2026', codes)).toBe(false);
  expect(inviteValid('AIDAMS-202', codes)).toBe(false);
  expect(inviteValid('AIDAMS-2026,friends', codes)).toBe(false);
});
