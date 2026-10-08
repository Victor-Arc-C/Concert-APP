'use client';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LOCALE_COOKIE, resolveLocale, type Locale } from './config';
import { formatters, type Formatters } from './format';
import { dictionaries, type Messages } from './messages';
import { cityName, genreName } from './names';
import { translate, translateAlertTitle } from './server-text';

type I18n = {
  locale: Locale;
  t: Messages;
  f: Formatters;
  /** Server-written English (reasons, provider notes, errors) in the current language. */
  s: (text: string | null | undefined) => string;
  alertTitle: (title: string) => string;
  /** Catalogue city and genre names as people read them in this language. */
  city: (name: string) => string;
  genre: (name: string) => string;
  setLocale: (next: Locale) => void;
};
const I18nContext = createContext<I18n | null>(null);

const YEAR = 60 * 60 * 24 * 365;

/** Read straight from the cookie so code outside React (api()) always uses the current choice. */
export function clientLocale(): Locale {
  if (typeof document === 'undefined') return 'en';
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
  return resolveLocale(match?.[1]);
}

export function I18nProvider({
  initial,
  children,
}: {
  initial: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState(initial);
  const router = useRouter();
  const setLocale = useCallback(
    (next: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${YEAR}; samesite=lax`;
      document.documentElement.lang = next;
      setLocaleState(next);
      // Server-rendered parts (marketing copy, metadata) pick up the new cookie.
      router.refresh();
    },
    [router],
  );
  const value = useMemo<I18n>(
    () => ({
      locale,
      t: dictionaries[locale],
      f: formatters(locale),
      s: (text) => translate(text, locale),
      alertTitle: (title) => translateAlertTitle(title, locale),
      city: (name) => cityName(name, locale),
      genre: (name) => genreName(name, locale),
      setLocale,
    }),
    [locale, setLocale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('I18nProvider missing');
  return value;
}
