/**
 * Ticketmaster attractions come with images licensed for display with their events. Pick one
 * real photo (not Ticketmaster's generic fallback) from its own image host, close to the size the
 * app shows, so the artist's face sits next to their name.
 */
export const ticketmasterImageHost = 'https://s1.ticketm.net';

type TicketmasterImage = {
  url?: unknown;
  ratio?: unknown;
  width?: unknown;
  fallback?: unknown;
};

export function attractionImage(images: unknown): string | null {
  if (!Array.isArray(images)) return null;
  const preferred = ['4_3', '3_2', '16_9'];
  const usable = (images as TicketmasterImage[]).filter(
    (image) =>
      typeof image?.url === 'string' &&
      image.fallback !== true &&
      image.url.startsWith(`${ticketmasterImageHost}/`),
  );
  const score = (image: TicketmasterImage) => {
    const ratio = preferred.indexOf(String(image.ratio));
    const width = typeof image.width === 'number' ? image.width : 0;
    return (ratio === -1 ? 3 : ratio) * 10000 + Math.abs(width - 640);
  };
  const best = usable.sort((a, b) => score(a) - score(b))[0];
  return best ? (best.url as string) : null;
}
