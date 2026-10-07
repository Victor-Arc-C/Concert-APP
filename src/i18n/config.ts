/** Showbound speaks English first and French second. The choice lives in a long-lived cookie. */
export const locales = ['en', 'fr'] as const;
export type Locale = (typeof locales)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'showbound_lang';
/** BCP 47 tags for Intl: British English dates (14 Nov), French dates (14 nov.). */
export const intlTag: Record<Locale, string> = { en: 'en-GB', fr: 'fr-FR' };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

export function resolveLocale(value: string | undefined | null): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
