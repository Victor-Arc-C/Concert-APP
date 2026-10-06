import { randomUUID } from 'node:crypto';
import { normalizeArtistName } from '../domain/normalization';
import { query } from './db';
import type { Artist } from '../domain/types';

export async function recordNormalizationReview(
  kind: 'artist' | 'event',
  provider: string,
  externalId: string,
  reason: string,
  candidates: string[],
  details: Record<string, unknown> = {},
) {
  await query(
    `INSERT INTO normalization_reviews(id,kind,provider,external_id,reason,candidates,details)
     VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)
     ON CONFLICT(kind,provider,external_id,reason)
     DO UPDATE SET candidates=EXCLUDED.candidates,details=EXCLUDED.details,updated_at=NOW()`,
    [
      randomUUID(),
      kind,
      provider,
      externalId,
      reason,
      JSON.stringify([...new Set(candidates)].sort()),
      JSON.stringify(details),
    ],
  );
}

export async function resolveArtistIdentity(provider: string, externalId: string, name: string) {
  const [mapped] = await query<{ artist_id: string }>(
    'SELECT artist_id FROM artist_provider_records WHERE provider=$1 AND external_id=$2',
    [provider, externalId],
  );
  if (mapped)
    return {
      artistId: mapped.artist_id,
      source: 'provider' as const,
      candidates: [mapped.artist_id],
    };

  const rows = await query<{ id: string; name: string | null }>(
    `SELECT DISTINCT a.id,a.data->>'name' AS name
     FROM artists a
     JOIN artist_provider_records p ON p.artist_id=a.id`,
  );
  const key = normalizeArtistName(name);
  const candidates = [
    ...new Set(
      rows.filter((row) => row.name && normalizeArtistName(row.name) === key).map((row) => row.id),
    ),
  ].sort();

  if (candidates.length === 1)
    return { artistId: candidates[0], source: 'name' as const, candidates };
  if (candidates.length > 1) {
    await recordNormalizationReview(
      'artist',
      provider,
      externalId,
      'normalized_name_collision',
      candidates,
      { normalizedName: key },
    );
    return { artistId: null, source: 'ambiguous' as const, candidates };
  }
  return { artistId: null, source: 'none' as const, candidates: [] };
}

export async function materializeSpotifyArtist(externalId: string, name: string) {
  const identity = await resolveArtistIdentity('spotify', externalId, name);
  if (identity.artistId) return { artistId: identity.artistId, source: identity.source };

  const artistId = `spotify-${externalId}`;
  const artist: Artist = {
    id: artistId,
    name,
    genre: 'Spotify artist',
    color: '#3f6b56',
    initials: name.slice(0, 2).toLowerCase(),
  };
  await query('INSERT INTO artists(id,data) VALUES($1,$2) ON CONFLICT(id) DO NOTHING', [
    artistId,
    JSON.stringify(artist),
  ]);
  await query(
    'INSERT INTO artist_provider_records(provider,external_id,artist_id) VALUES($1,$2,$3) ON CONFLICT(provider,external_id) DO NOTHING',
    ['spotify', externalId, artistId],
  );
  const [mapped] = await query<{ artist_id: string }>(
    'SELECT artist_id FROM artist_provider_records WHERE provider=$1 AND external_id=$2',
    ['spotify', externalId],
  );
  if (!mapped) throw new Error('Spotify artist identity could not be materialized.');
  return { artistId: mapped.artist_id, source: 'spotify' as const };
}
