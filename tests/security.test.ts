import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  encrypt,
  decrypt,
  hashPassword,
  verifyPassword,
  checkOrigin,
} from '../src/server/security';
import { providerJson, retryAfterSeconds } from '../src/server/providers/http';
afterEach(() => vi.unstubAllEnvs());
describe('credentials and request boundaries', () => {
  it('hashes passwords with distinct salts and verifies without storing plaintext', async () => {
    const hash = await hashPassword('a secure passphrase');
    expect(hash).not.toContain('a secure passphrase');
    expect(await verifyPassword('a secure passphrase', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
    expect(await hashPassword('a secure passphrase')).not.toBe(hash);
  });
  it('encrypts tokens with authenticated random IVs and rejects tampering', () => {
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', randomBytes(32).toString('base64'));
    const a = encrypt('secret-token');
    expect(decrypt(a)).toBe('secret-token');
    expect(encrypt('secret-token')).not.toBe(a);
    const changed = Buffer.from(a, 'base64');
    changed[20] ^= 1;
    expect(() => decrypt(changed.toString('base64'))).toThrow();
  });
  it('rejects invalid encryption configuration', () => {
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', 'short');
    expect(() => encrypt('token')).toThrow();
  });
  it('rejects foreign and missing origins for mutations', () => {
    vi.stubEnv('APP_URL', 'http://127.0.0.1:3000');
    expect(() =>
      checkOrigin(
        new Request('http://127.0.0.1:3000/api/intent', {
          headers: { origin: 'https://attacker.test' },
        }),
      ),
    ).toThrow();
    expect(() => checkOrigin(new Request('http://127.0.0.1:3000/api/intent'))).toThrow();
    expect(() =>
      checkOrigin(
        new Request('http://127.0.0.1:3000/api/intent', {
          headers: { origin: 'http://127.0.0.1:3000' },
        }),
      ),
    ).not.toThrow();
  });
  it('accepts app and Vercel preview origins only in the appropriate environment', () => {
    vi.stubEnv('APP_URL', 'https://concerts.example.com');
    vi.stubEnv('VERCEL_URL', 'encore-git-feature-123.vercel.app');
    vi.stubEnv('VERCEL_BRANCH_URL', 'encore-feature.vercel.app');
    vi.stubEnv('VERCEL_ENV', 'production');

    expect(() =>
      checkOrigin(
        new Request('https://concerts.example.com/api/auth/login', {
          headers: { origin: 'https://concerts.example.com' },
        }),
      ),
    ).not.toThrow();
    expect(() =>
      checkOrigin(
        new Request('https://concerts.example.com/api/auth/login', {
          headers: { origin: 'https://encore-git-feature-123.vercel.app' },
        }),
      ),
    ).toThrow();
    expect(() =>
      checkOrigin(
        new Request('https://concerts.example.com/api/auth/login', {
          headers: { origin: 'https://encore-feature.vercel.app' },
        }),
      ),
    ).toThrow();

    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(() =>
      checkOrigin(
        new Request('https://encore-git-feature-123.vercel.app/api/auth/login', {
          headers: { origin: 'https://encore-git-feature-123.vercel.app' },
        }),
      ),
    ).not.toThrow();
    expect(() =>
      checkOrigin(
        new Request('https://encore-feature.vercel.app/api/auth/login', {
          headers: { origin: 'https://encore-feature.vercel.app' },
        }),
      ),
    ).not.toThrow();
    expect(() =>
      checkOrigin(
        new Request('https://encore-git-feature-123.vercel.app/api/auth/login', {
          headers: { origin: 'https://attacker.test' },
        }),
      ),
    ).toThrow();
  });
});
describe('provider failures', () => {
  it('parses delta and HTTP-date retry delays without accepting malformed values', () => {
    const now = Date.parse('2026-10-05T12:00:00Z');
    expect(retryAfterSeconds('3600', now)).toBe(3600);
    expect(retryAfterSeconds('Mon, 05 Oct 2026 13:00:00 GMT', now)).toBe(3600);
    expect(retryAfterSeconds('Mon, 05 Oct 2026 11:00:00 GMT', now)).toBe(0);
    expect(retryAfterSeconds('unknown', now)).toBeNull();
  });
  it('preserves rate-limit retry information without leaking a credential URL', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{}', { status: 429, headers: { 'Retry-After': '30' } }));
    await expect(
      providerJson('https://example.test?key=secret', {}, fetcher),
    ).rejects.toMatchObject({ status: 429, retryAfter: 30 });
  });
  it('reports expired permissions and network failures', async () => {
    await expect(
      providerJson(
        'https://example.test',
        {},
        vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 403 })),
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      providerJson(
        'https://example.test',
        {},
        vi.fn<typeof fetch>().mockRejectedValue(new Error('key=secret')),
      ),
    ).rejects.toThrow('did not respond');
  });
  it('rejects malformed JSON', async () => {
    await expect(
      providerJson(
        'https://example.test',
        {},
        vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>')),
      ),
    ).rejects.toMatchObject({ status: 502 });
  });
});
