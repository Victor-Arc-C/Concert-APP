import { query } from './db';
import { reportError } from './monitoring';
import { env } from './env';
import { syncArtists } from './providers/ticketmaster';
import { evaluateAlerts, userLists } from './data';
import type { Concert, User } from '../domain/types';

const state = globalThis as typeof globalThis & {
  encoreChecks?: Promise<{ evaluated: number; failures: number }>;
};
export function runConcertChecks() {
  if (state.encoreChecks) return state.encoreChecks;
  state.encoreChecks = performChecks().finally(() => {
    state.encoreChecks = undefined;
  });
  return state.encoreChecks;
}
async function performChecks() {
  const users = await query<User>(
    'SELECT id,name,email,mode,onboarded,preferences FROM users WHERE onboarded=TRUE',
  );
  let evaluated = 0,
    failures = 0;
  for (const user of users) {
    try {
      if (user.mode === 'live' && env().TICKETMASTER_API_KEY) {
        const result = await syncArtists(user.id);
        if (result.failed) failures++;
      }
      const lists = await userLists(user.id);
      const events = await query<{ data: Concert }>('SELECT data FROM events WHERE sample=$1', [
        user.mode === 'sample',
      ]);
      await evaluateAlerts(
        user,
        events.map((e) => e.data),
        lists.affinities,
        lists.intents,
        lists.feedback,
      );
      evaluated++;
    } catch {
      failures++;
      reportError('job_account_failed');
      // No provider URLs or credentials in logs. Keep processing other accounts.
    }
  }
  await query('DELETE FROM sessions WHERE expires_at<NOW()');
  await query('DELETE FROM oauth_attempts WHERE expires_at<NOW()');
  await query("DELETE FROM analytics WHERE created_at<NOW()-INTERVAL '30 days'");
  await query("DELETE FROM rate_limits WHERE window_at<NOW()-INTERVAL '2 days'");
  return { evaluated, failures };
}
