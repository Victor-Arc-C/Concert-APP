import { randomUUID } from 'node:crypto';
import { query } from './db';
import { rateLimit } from './security';
import type { BetaFeedbackInput } from '../domain/validation';
import type { User } from '../domain/types';

// Private-beta feedback (CON-36). Stored in our own database only; no third-party service.
export async function saveBetaFeedback(user: User, input: BetaFeedbackInput) {
  await rateLimit(`beta-feedback:${user.id}`, 5, 3600);
  await query(
    'INSERT INTO beta_feedback(id,user_id,message,rating,screen,mode) VALUES($1,$2,$3,$4,$5,$6)',
    [randomUUID(), user.id, input.message, input.rating, input.screen, user.mode],
  );
}

export function exportBetaFeedback(userId: string) {
  return query(
    'SELECT message,rating,screen,mode,created_at FROM beta_feedback WHERE user_id=$1 ORDER BY created_at',
    [userId],
  );
}
