import type { Concert } from '../domain/types';
import { safeTicketUrl } from '../domain/ticket-links';
import { query } from './db';
import { HttpError } from './security';
export type TicketSource = {
  provider: string;
  externalId: string;
  url: string | null;
  price: number | null;
  currency: string | null;
  observedAt: Date;
  disabledAt: Date | null;
};
export async function ticketSources(event: Concert, now = new Date()) {
  if (event.provider === 'sample' || ['cancelled', 'postponed'].includes(event.status)) return [];
  const rows = await query<TicketSource>(
    `SELECT provider,external_id AS "externalId",url,
    price_min::float AS price,currency,observed_at AS "observedAt",disabled_at AS "disabledAt"
    FROM ticket_sources WHERE event_id=$1 ORDER BY provider,external_id`,
    [event.id],
  );
  // Stale listings require a provider refresh; never silently fall back to a disabled snapshot.
  return rows.filter(
    (row) =>
      !row.disabledAt &&
      row.url &&
      safeTicketUrl(row.url) &&
      new Date(row.observedAt).getTime() >= now.getTime() - 7 * 86400000,
  );
}
export async function selectTicketSource(
  event: Concert,
  source?: { provider: string; externalId: string },
) {
  const available = await ticketSources(event);
  const selected = source
    ? available.find(
        (row) => row.provider === source.provider && row.externalId === source.externalId,
      )
    : available[0];
  if (!selected)
    throw new HttpError(
      422,
      'No current verified ticket link is available. Refresh concerts or check the seller directly.',
    );
  return selected;
}
