import type { Locale } from './config';
import { en, type Messages } from './en';
import { fr } from './fr';

export const dictionaries: Record<Locale, Messages> = { en, fr };
export type { Messages };
