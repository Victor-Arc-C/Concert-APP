export class ProviderError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryAfter: number | null = null,
  ) {
    super(message);
  }
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
      wait ? Number(wait) || null : null,
    );
  }
  try {
    return await response.json();
  } catch {
    throw new ProviderError('The provider returned an unreadable response.', 502);
  }
}
