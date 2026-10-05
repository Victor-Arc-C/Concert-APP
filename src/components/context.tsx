'use client';
import { createContext, useContext } from 'react';
import type { AppData } from '@/domain/types';
export async function api<T = { ok: boolean }>(path: string, payload?: unknown): Promise<T> {
  const response = await fetch(
    `/api/${path}`,
    payload === undefined
      ? { cache: 'no-store' }
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Something went wrong. Try again.');
  return data as T;
}
export type AppContextValue = {
  data: AppData;
  reload: () => Promise<void>;
  act: (path: string, payload: unknown, message?: string) => Promise<boolean>;
  toast: (message: string) => void;
  busy: boolean;
};
export const AppContext = createContext<AppContextValue | null>(null);
export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('App context missing');
  return context;
}
