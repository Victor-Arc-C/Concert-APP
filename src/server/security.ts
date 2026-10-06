import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createCipheriv,
  createDecipheriv,
} from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { query } from './db';
import { env } from './env';
import type { User } from '../domain/types';
const scrypt = promisify(scryptCallback);
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [salt, key] = stored.split(':');
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(key, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function checkOrigin(request: Request) {
  const settings = env();
  const allowedOrigins = new Set([new URL(settings.APP_URL).origin]);
  if (settings.VERCEL_ENV === 'preview') {
    for (const vercelUrl of [settings.VERCEL_URL, settings.VERCEL_BRANCH_URL])
      if (vercelUrl) allowedOrigins.add(`https://${vercelUrl}`);
  }
  if (!allowedOrigins.has(request.headers.get('origin') ?? ''))
    throw new HttpError(403, 'This request did not come from this app. Reload and try again.');
}
export async function rateLimit(key: string, limit: number, seconds: number) {
  const rows = await query<{ count: number }>(
    `INSERT INTO rate_limits(bucket,count,window_at) VALUES($1,1,NOW()) ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN rate_limits.window_at < NOW()-($2 * INTERVAL '1 second') THEN 1 ELSE rate_limits.count+1 END, window_at=CASE WHEN rate_limits.window_at < NOW()-($2 * INTERVAL '1 second') THEN NOW() ELSE rate_limits.window_at END RETURNING count`,
    [hash(key), seconds],
  );
  if (rows[0].count > limit) throw new HttpError(429, 'Too many attempts. Please try again later.');
}
export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  await query(
    "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES ($1,$2,NOW()+INTERVAL '7 days')",
    [hash(token), userId],
  );
  (await cookies()).set('encore_session', token, {
    httpOnly: true,
    secure: env().APP_URL.startsWith('https:'),
    sameSite: 'lax',
    path: '/',
    maxAge: 604800,
  });
}
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get('encore_session')?.value;
  if (!token) return null;
  const rows = await query<User>(
    'SELECT u.id,u.name,u.email,u.mode,u.onboarded,u.preferences FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW()',
    [hash(token)],
  );
  return rows[0] ?? null;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new HttpError(401, 'Sign in to continue.');
  return user;
}
export async function logout() {
  const jar = await cookies();
  const token = jar.get('encore_session')?.value;
  if (token) await query('DELETE FROM sessions WHERE token_hash=$1', [hash(token)]);
  jar.delete('encore_session');
}
function encryptionKey() {
  const value = Buffer.from(env().TOKEN_ENCRYPTION_KEY ?? '', 'base64');
  if (value.length !== 32)
    throw new HttpError(503, 'Music connection encryption is not configured.');
  return value;
}
export function encrypt(value: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}
export function decrypt(value: string) {
  const data = Buffer.from(value, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8');
}
