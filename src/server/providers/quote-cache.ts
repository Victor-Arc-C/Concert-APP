// Short-lived, bounded cache for live travel quotes. Entries keep the time they were fetched,
// so a cached answer is never re-stamped as newer than it is (CON-32 freshness rule).
export const QUOTE_CACHE_MS = 60 * 1000;
const MAX_ENTRIES = 200;

export class QuoteCache<T> {
  private entries = new Map<string, { at: number; value: T }>();
  get(key: string, now: number) {
    const hit = this.entries.get(key);
    return hit && now - hit.at < QUOTE_CACHE_MS ? hit : null;
  }
  set(key: string, value: T, now: number) {
    for (const [entry, { at }] of this.entries)
      if (now - at >= QUOTE_CACHE_MS) this.entries.delete(entry);
    while (this.entries.size >= MAX_ENTRIES)
      this.entries.delete(this.entries.keys().next().value as string);
    this.entries.set(key, { at: now, value });
    return { at: now, value };
  }
}
