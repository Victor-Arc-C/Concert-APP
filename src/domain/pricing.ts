// A displayed starting price needs a source, currency and recent observation.
// This is an observation freshness rule, never a guarantee of availability or fees.
export function displayPrice(
  price: number | null,
  currency: string | null,
  source: string,
  observedAt: string | Date,
  now = new Date(),
): number | null {
  const age = now.getTime() - new Date(observedAt).getTime();
  return price !== null &&
    Number.isFinite(price) &&
    price >= 0 &&
    !!currency &&
    /^[A-Z]{3}$/.test(currency) &&
    source !== '' &&
    Number.isFinite(age) &&
    age >= 0 &&
    age <= 86400000
    ? price
    : null;
}
