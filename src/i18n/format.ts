import { intlTag, type Locale } from './config';

/** Calendar dates are stored as YYYY-MM-DD; read them at noon UTC so no timezone shifts the day. */
const noon = (date: string) => new Date(`${date.slice(0, 10)}T12:00:00Z`);

export type Formatters = ReturnType<typeof formatters>;

export function formatters(locale: Locale) {
  const tag = intlTag[locale];
  const dateFormat = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(tag, { timeZone: 'UTC', ...options });
  const plural = new Intl.PluralRules(tag);
  const tidy = (text: string) => text.replace(/\.$/, '');
  return {
    locale,
    tag,
    /** 14 Nov · 14 nov. */
    dateShort: (date: string) => dateFormat({ day: 'numeric', month: 'short' }).format(noon(date)),
    /** 14 November 2026 · 14 novembre 2026 */
    dateLong: (date: string) =>
      dateFormat({ day: 'numeric', month: 'long', year: 'numeric' }).format(noon(date)),
    /** 14 November · 14 novembre */
    dayMonth: (date: string) => dateFormat({ day: 'numeric', month: 'long' }).format(noon(date)),
    /** Sat 14 Nov · sam. 14 nov. */
    dateWithDay: (date: string) =>
      dateFormat({ weekday: 'short', day: 'numeric', month: 'short' }).format(noon(date)),
    /** Separate parts for date blocks. Weekday and month without the French trailing dot. */
    dayParts: (date: string) => ({
      weekday: tidy(dateFormat({ weekday: 'short' }).format(noon(date))),
      day: dateFormat({ day: 'numeric' }).format(noon(date)),
      month: tidy(dateFormat({ month: 'short' }).format(noon(date))),
    }),
    /** A month filter label from YYYY-MM: Nov 2026 · nov. 2026 */
    month: (yearMonth: string) =>
      dateFormat({ month: 'short', year: 'numeric' }).format(noon(`${yearMonth}-01`)),
    /** 20:00 in both languages; local show times are already wall-clock times. */
    time: (localTime: string | null | undefined) => (localTime ? localTime.slice(0, 5) : null),
    /** A real instant (ISO timestamp), shown in the given or local timezone. */
    dateTime: (instant: string, timeZone?: string) =>
      new Intl.DateTimeFormat(tag, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(
        new Date(instant),
      ),
    day: (instant: string) =>
      new Intl.DateTimeFormat(tag, { dateStyle: 'medium' }).format(new Date(instant)),
    clock: (instant: string) =>
      new Intl.DateTimeFormat(tag, { hour: '2-digit', minute: '2-digit' }).format(
        new Date(instant),
      ),
    /** Null when the amount is unknown or malformed: callers say "price not listed" instead. */
    money: (amount: number | null | undefined, currency: string | null | undefined) => {
      if (
        amount === null ||
        amount === undefined ||
        !Number.isFinite(amount) ||
        amount < 0 ||
        !currency ||
        !/^[A-Z]{3}$/.test(currency)
      )
        return null;
      try {
        return new Intl.NumberFormat(tag, {
          style: 'currency',
          currency,
          minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
          maximumFractionDigits: 2,
        }).format(amount);
      } catch {
        return null;
      }
    },
    number: (value: number) => new Intl.NumberFormat(tag).format(value),
    /** 3h20, 45m: the same short form reads naturally in both languages. */
    duration: (minutes: number) => {
      const h = Math.floor(minutes / 60);
      const m = Math.round(minutes % 60);
      if (!h) return `${m} min`;
      return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
    },
    /** Whole days from today to a show date (negative once it has passed). */
    daysUntil: (date: string, now = new Date()) => {
      const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      return Math.round((noon(date).getTime() - 12 * 3600000 - today) / 86400000);
    },
    plural: (count: number, one: string, other: string) =>
      plural.select(count) === 'one' ? one : other,
    list: (items: string[]) =>
      new Intl.ListFormat(tag, { style: 'long', type: 'conjunction' }).format(items),
  };
}
