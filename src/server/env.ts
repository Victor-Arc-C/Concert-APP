import { z } from 'zod';
const optionalString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().optional(),
);
const vercelUrl = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z
    .string()
    .regex(/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i, 'Use a Vercel hostname.')
    .optional(),
);
const schema = z
  .object({
    APP_ENV: z.enum(['local', 'development', 'test', 'production']).default('local'),
    APP_URL: z.url().default('http://127.0.0.1:3000'),
    VERCEL_ENV: z.enum(['development', 'preview', 'production']).optional(),
    VERCEL_URL: vercelUrl,
    VERCEL_BRANCH_URL: vercelUrl,
    DATABASE_URL: optionalString,
    LOCAL_DATABASE_PATH: optionalString,
    TICKETMASTER_API_KEY: optionalString,
    SPOTIFY_APPROVED: z.enum(['true', 'false']).default('false'),
    SPOTIFY_CLIENT_ID: optionalString,
    SPOTIFY_CLIENT_SECRET: optionalString,
    TOKEN_ENCRYPTION_KEY: optionalString,
    CRON_SECRET: optionalString,
    BETA_INVITE_CODES: optionalString,
    AUTO_CONCERT_CHECKS: z.enum(['true', 'false']).default('false'),
  })
  .superRefine((settings, context) => {
    const issue = (path: string, message: string) =>
      context.addIssue({ code: 'custom', path: [path], message });
    if (settings.DATABASE_URL) {
      try {
        if (!['postgres:', 'postgresql:'].includes(new URL(settings.DATABASE_URL).protocol))
          issue('DATABASE_URL', 'Use a PostgreSQL connection URL.');
      } catch {
        issue('DATABASE_URL', 'Use a valid PostgreSQL connection URL.');
      }
    }
    if (settings.APP_ENV === 'production') {
      if (!settings.DATABASE_URL)
        issue('DATABASE_URL', 'Production requires a managed PostgreSQL database.');
      if (!settings.APP_URL.startsWith('https://'))
        issue('APP_URL', 'Production requires an HTTPS app URL.');
      if (settings.AUTO_CONCERT_CHECKS === 'true')
        issue(
          'AUTO_CONCERT_CHECKS',
          'Production requires a single external scheduled worker; disable the local timer.',
        );
    }
    if (
      settings.APP_ENV === 'test' &&
      (settings.AUTO_CONCERT_CHECKS === 'true' ||
        settings.DATABASE_URL ||
        settings.TICKETMASTER_API_KEY ||
        settings.SPOTIFY_APPROVED === 'true')
    )
      issue(
        'APP_ENV',
        'Tests require a disposable local database, disabled automatic checks and no live providers.',
      );
  });
export function parseEnvironment(input: Record<string, string | undefined>) {
  const result = schema.safeParse(input);
  if (!result.success) {
    // Do not include input values or connection URLs in configuration errors.
    throw new Error(
      `Invalid environment: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' ')}`,
    );
  }
  const settings = result.data;
  return {
    ...settings,
    LOCAL_DATABASE_PATH:
      settings.LOCAL_DATABASE_PATH ??
      (settings.APP_ENV === 'local' ? '.data/encore' : `.data/encore-${settings.APP_ENV}`),
  };
}
export function env() {
  return parseEnvironment(process.env);
}
export function spotifyAvailable() {
  const e = env();
  return (
    e.SPOTIFY_APPROVED === 'true' &&
    !!e.SPOTIFY_CLIENT_ID &&
    !!e.SPOTIFY_CLIENT_SECRET &&
    !!e.TOKEN_ENCRYPTION_KEY
  );
}
export function automaticConcertChecks() {
  const settings = env();
  return (
    ['local', 'development'].includes(settings.APP_ENV) &&
    settings.AUTO_CONCERT_CHECKS === 'true' &&
    !!settings.TICKETMASTER_API_KEY &&
    !settings.DATABASE_URL &&
    !process.env.VERCEL
  );
}
