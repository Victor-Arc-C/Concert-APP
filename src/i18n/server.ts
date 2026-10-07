import { cookies } from 'next/headers';
import { LOCALE_COOKIE, resolveLocale, type Locale } from './config';

/** The visitor's language from the long-lived cookie; English when none is set. */
export async function getLocale(): Promise<Locale> {
  return resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
}
