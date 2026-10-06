import { expect, it } from 'vitest';
import { parseEnvironment } from '../src/server/env';
it('preserves the existing local database and separates dev/test defaults', () => {
  expect(parseEnvironment({}).LOCAL_DATABASE_PATH).toBe('.data/encore');
  expect(parseEnvironment({ APP_ENV: 'development' }).LOCAL_DATABASE_PATH).toBe(
    '.data/encore-development',
  );
  expect(parseEnvironment({ APP_ENV: 'test' }).LOCAL_DATABASE_PATH).toBe('.data/encore-test');
  expect(parseEnvironment({ DATABASE_URL: '' }).DATABASE_URL).toBeUndefined();
});
it('requires HTTPS and managed Postgres in production and forbids the local timer', () => {
  expect(() => parseEnvironment({ APP_ENV: 'production' })).toThrow('Production requires');
  const valid = {
    APP_ENV: 'production',
    APP_URL: 'https://concerts.example.com',
    DATABASE_URL: 'postgresql://user:password@db.example.com/encore',
  };
  expect(parseEnvironment(valid).APP_ENV).toBe('production');
  expect(() => parseEnvironment({ ...valid, AUTO_CONCERT_CHECKS: 'true' })).toThrow(
    'external scheduled worker',
  );
  expect(() =>
    parseEnvironment({ ...valid, DATABASE_URL: 'https://private.example/secret' }),
  ).toThrow('PostgreSQL');
  try {
    parseEnvironment({ ...valid, DATABASE_URL: 'sensitive-not-a-url' });
  } catch (e) {
    expect(String(e)).not.toContain('sensitive-not-a-url');
  }
});
it('prevents test profiles from reaching live databases, providers or scheduler', () => {
  for (const settings of [
    { DATABASE_URL: 'postgresql://db/real' },
    { TICKETMASTER_API_KEY: 'test-key' },
    { AUTO_CONCERT_CHECKS: 'true' },
    { SPOTIFY_APPROVED: 'true' },
  ])
    expect(() => parseEnvironment({ APP_ENV: 'test', ...settings })).toThrow('Tests require');
});

it('accepts an optional privacy contact and rejects a malformed one', () => {
  expect(
    parseEnvironment({
      PRIVACY_CONTROLLER: 'Encore pilot',
      PRIVACY_CONTACT_EMAIL: 'privacy@encore.test',
    }).PRIVACY_CONTACT_EMAIL,
  ).toBe('privacy@encore.test');
  expect(parseEnvironment({ PRIVACY_CONTACT_EMAIL: '' }).PRIVACY_CONTACT_EMAIL).toBeUndefined();
  expect(() => parseEnvironment({ PRIVACY_CONTACT_EMAIL: 'not-an-email' })).toThrow();
});
