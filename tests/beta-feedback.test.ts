import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
vi.mock('../src/server/db', () => ({ query: vi.fn() }));
import { query } from '../src/server/db';
import { exportBetaFeedback, saveBetaFeedback } from '../src/server/beta-feedback';
import { migrations } from '../src/server/schema';
import { betaFeedbackSchema } from '../src/domain/validation';
import { defaults } from '../src/domain/catalog';
import type { User } from '../src/domain/types';

const db = new PGlite();
const user = (id: string): User => ({
  id,
  name: 'Test',
  email: `${id}@example.test`,
  mode: 'live',
  onboarded: true,
  preferences: defaults,
});
const alice = user('alice'),
  bob = user('bob');
beforeAll(async () => {
  for (const m of migrations) await db.exec(m.sql);
  for (const u of [alice, bob])
    await db.query(
      'INSERT INTO users(id,email,name,password_hash,preferences) VALUES($1,$2,$3,$4,$5)',
      [u.id, u.email, u.name, 'test-only', JSON.stringify(u.preferences)],
    );
  vi.mocked(query).mockImplementation(
    async (sql, params) => (await db.query(sql, params)).rows as never[],
  );
});
afterAll(async () => {
  await db.close();
});

describe('beta feedback validation', () => {
  it('accepts trimmed text, an optional 1–5 rating and an in-app path', () => {
    expect(betaFeedbackSchema.parse({ message: '  Great  ', screen: '/app' })).toEqual({
      message: 'Great',
      rating: null,
      screen: '/app',
    });
    expect(
      betaFeedbackSchema.parse({ message: 'ok', rating: 5, screen: '/app/events/tm-1' }).rating,
    ).toBe(5);
  });
  it.each([
    { message: '   ', screen: '/app' },
    { message: 'x'.repeat(2001), screen: '/app' },
    { message: 'ok', rating: 0, screen: '/app' },
    { message: 'ok', rating: 6, screen: '/app' },
    { message: 'ok', rating: 2.5, screen: '/app' },
    { message: 'ok', screen: 'https://evil.test/app' },
    { message: 'ok', screen: '/app?email=someone@example.test' },
    { message: 'ok', screen: '/app', userId: 'bob' },
  ])('rejects %j', (input) => {
    expect(betaFeedbackSchema.safeParse(input).success).toBe(false);
  });
});

describe('beta feedback storage', () => {
  it('stores feedback with screen and mode and exports only the owner’s rows', async () => {
    await saveBetaFeedback(alice, { message: 'Missing my artist', rating: 3, screen: '/app' });
    await saveBetaFeedback(bob, { message: 'Bob only', rating: null, screen: '/app/settings' });
    const exported = await exportBetaFeedback(alice.id);
    expect(exported).toHaveLength(1);
    expect(exported[0]).toMatchObject({
      message: 'Missing my artist',
      rating: 3,
      screen: '/app',
      mode: 'live',
    });
    expect(JSON.stringify(exported)).not.toContain('Bob only');
  });
  it('rate-limits a user to five messages per hour', async () => {
    const carol = user('carol');
    await db.query(
      'INSERT INTO users(id,email,name,password_hash,preferences) VALUES($1,$2,$3,$4,$5)',
      [carol.id, carol.email, carol.name, 'test-only', '{}'],
    );
    for (let i = 0; i < 5; i++)
      await saveBetaFeedback(carol, { message: `n${i}`, rating: null, screen: '/app' });
    await expect(
      saveBetaFeedback(carol, { message: 'too many', rating: null, screen: '/app' }),
    ).rejects.toMatchObject({ status: 429 });
    expect(await exportBetaFeedback(carol.id)).toHaveLength(5);
  });
  it('is deleted with the account (same statement as account deletion)', async () => {
    await db.query('DELETE FROM users WHERE id=$1', [alice.id]);
    expect(await exportBetaFeedback(alice.id)).toEqual([]);
    const remaining = await db.query<{ user_id: string }>('SELECT user_id FROM beta_feedback');
    expect(remaining.rows.every((row) => row.user_id !== alice.id)).toBe(true);
    expect(await exportBetaFeedback(bob.id)).toHaveLength(1);
  });
});
