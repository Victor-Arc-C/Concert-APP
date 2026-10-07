'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { PublicGigs } from '@/domain/marketing';

type Status = 'loading' | 'ready' | 'error';
type GigsValue = {
  status: Status;
  data: PublicGigs | null;
  retry: () => void;
  home: string;
  setHome: (city: string) => void;
};
const GigsContext = createContext<GigsValue | null>(null);

export function GigsProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [data, setData] = useState<PublicGigs | null>(null);
  const [home, setHome] = useState('Paris');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    // Dev-only stress data (?data=worst|empty|one|huge), swapped in at the same boundary as the API.
    if (process.env.NODE_ENV === 'development') {
      const name = new URLSearchParams(window.location.search).get('data');
      if (name) {
        import('./fixtures').then(({ fixtures, fixtureNames }) => {
          if (!active || !fixtureNames.includes(name as never)) return;
          setData(fixtures[name as keyof typeof fixtures]);
          setStatus('ready');
        });
        return () => {
          active = false;
        };
      }
    }
    fetch('/api/gigs')
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<PublicGigs>;
      })
      .then((result) => {
        if (!active) return;
        setData(result);
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  const retry = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);
  return (
    <GigsContext.Provider value={{ status, data, retry, home, setHome }}>
      {children}
    </GigsContext.Provider>
  );
}

export function useGigs() {
  const value = useContext(GigsContext);
  if (!value) throw new Error('useGigs must be used inside GigsProvider');
  return value;
}
