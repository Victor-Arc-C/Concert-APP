type Dated = { id: string; artistIds: string[]; date: string; localTime?: string | null };

export type ArtistDates<T> = { artistId: string; next: T; later: T[] };

const when = (event: Dated) => `${event.date}T${event.localTime ?? '23:59'}`;

/**
 * One group per artist: their soonest date first, the rest in date order. Groups keep the order
 * in which each artist first appears (the feed's ranking), so a second artist comes right after
 * the first instead of after their whole tour.
 */
export function groupByArtist<T extends Dated>(events: T[]): ArtistDates<T>[] {
  const groups = new Map<string, T[]>();
  for (const event of events) {
    const key = event.artistIds[0] ?? event.id;
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return [...groups.entries()].map(([artistId, dates]) => {
    const sorted = [...dates].sort((a, b) => when(a).localeCompare(when(b)));
    return { artistId, next: sorted[0], later: sorted.slice(1) };
  });
}
