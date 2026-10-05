export class ProviderError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryAfter: number | null = null,
  ) {
    super(message);
  }
}
export function retryAfterSeconds(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  if (/^\d+$/.test(value.trim())) return Number(value);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, Math.ceil((date - now) / 1000)) : null;
}
export async function providerJson(
  url: string,
  init: RequestInit = {},
  fetcher: typeof fetch = fetch,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetcher(url, {
      ...init,
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    });
  } catch {
    throw new ProviderError('The provider did not respond. Try again later.', 504);
  }
  if (!response.ok) {
    const wait = response.headers.get('retry-after');
    throw new ProviderError(
      response.status === 429
        ? 'The provider has reached its request limit. Try again later.'
        : response.status === 401
          ? 'The music connection expired. Reconnect your account.'
          : response.status === 403
            ? 'The provider has not authorised this account or API access.'
            : 'The provider is unavailable. Try again later.',
      response.status,
      retryAfterSeconds(wait),
    );
  }
  try {
    return await response.json();
  } catch {
    throw new ProviderError('The provider returned an unreadable response.', 502);
  }
}
