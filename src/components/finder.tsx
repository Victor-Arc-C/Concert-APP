'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, RotateCcw } from 'lucide-react';
import type { OnboardingProgress } from '@/domain/onboarding';
import { useI18n } from '@/i18n/client';
import { api } from './context';
import { ArtistPhoto } from './ui';
import { gelFor } from './stage/gel';
import { Stage, useStage } from './stage/rig';

export type FinderArtist = { id: string; name: string; image?: string; live: boolean };

/**
 * The wait after choosing artists, made visible. The first concert check runs one artist at a
 * time on the server; this polls its real progress, lights each artist as it is checked and
 * keeps a few lines turning so a long import never looks stuck.
 */
export function Finder(props: {
  artists: FinderArtist[];
  city: string;
  submit: () => Promise<void>;
  onReady: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="finder" role="dialog" aria-modal="true" aria-labelledby="finder-title">
      <Stage layout="full" initial="all">
        <FinderBody {...props} />
      </Stage>
    </div>
  );
}

function FinderBody({
  artists,
  city,
  submit,
  onReady,
  onCancel,
}: {
  artists: FinderArtist[];
  city: string;
  submit: () => Promise<void>;
  onReady: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const stage = useStage();
  const [state, setState] = useState<'running' | 'ready' | 'failed'>('running');
  const [error, setError] = useState('');
  const [done, setDone] = useState<string[]>([]);
  const [line, setLine] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const ring = useRef<HTMLDivElement>(null);
  const items = useRef(new Map<string, HTMLLIElement | null>());
  const cta = useRef<HTMLButtonElement>(null);
  const live = artists.filter((a) => a.live);
  const checked = live.filter((a) => done.includes(a.id)).length;
  // Without live artists (the demo) there is nothing to count: the ring waits, then completes.
  const percent =
    state === 'ready' ? 100 : live.length ? Math.round((checked / live.length) * 100) : 0;
  const current = live.find((a) => !done.includes(a.id)) ?? null;

  // Run the onboarding request and, for live artists, poll its progress until it answers.
  useEffect(() => {
    let active = true;
    let timer = 0;
    const poll = async () => {
      try {
        const progress = await api<OnboardingProgress>('onboarding/progress');
        if (active) setDone((previous) => [...new Set([...previous, ...progress.done])]);
      } catch {
        // Progress is a nicety; the request itself decides success.
      }
      if (active) timer = window.setTimeout(poll, 800);
    };
    if (live.length) timer = window.setTimeout(poll, 500);
    submit()
      .then(() => {
        if (!active) return;
        setDone(artists.map((a) => a.id));
        setState('ready');
      })
      .catch((e: Error) => {
        if (!active) return;
        setError(e.message);
        setState('failed');
      })
      .finally(() => clearTimeout(timer));
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // Re-run only on an explicit retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // Lines keep turning while the check runs. The demo checks nothing, so it says less.
  const lines = live.length ? t.loader.lines : [t.loader.lines[0], t.loader.demo];
  useEffect(() => {
    if (state !== 'running') return;
    const timer = window.setInterval(() => setLine((n) => n + 1), 2600);
    return () => clearInterval(timer);
  }, [state]);

  // The rig follows the artist being checked, then every beam lands on the ring.
  useEffect(() => {
    if (state === 'ready') {
      stage.converge(ring.current);
      cta.current?.focus();
      const timer = window.setTimeout(onReady, 1800);
      return () => clearTimeout(timer);
    }
    stage.converge(current ? (items.current.get(current.id) ?? null) : null);
  }, [state, current, stage, onReady]);

  const text =
    state === 'ready'
      ? t.loader.ready
      : state === 'failed'
        ? t.loader.failed
        : lines[line % lines.length]
            .replace('{artist}', current?.name ?? artists[0]?.name ?? '')
            .replace('{city}', city);
  const announce =
    state === 'ready'
      ? t.loader.readyLive
      : live.length && checked && checked % 3 === 0
        ? t.loader.countFull(checked, live.length)
        : '';
  return (
    <div className="finder-body">
      <h1 id="finder-title" className="vh">
        {t.loader.label}
      </h1>
      <div
        ref={ring}
        className={`ring ${state === 'running' && !live.length ? 'is-waiting' : ''}`}
        role="progressbar"
        aria-label={t.loader.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={live.length ? t.loader.countFull(checked, live.length) : undefined}
        style={{ '--p': percent } as React.CSSProperties}
      >
        <b>
          {percent}
          <small>%</small>
        </b>
        {live.length > 0 && <span>{t.loader.count(state === 'ready' ? live.length : checked, live.length)}</span>}
      </div>
      <div className="say" aria-hidden="true">
        <p key={`${state}-${line}-${current?.id ?? ''}`}>{text}</p>
      </div>
      <p className="vh" aria-live="polite">
        {announce}
      </p>
      <ol className="finder-lineup" aria-label={t.feed.yourArtists}>
        {artists.map((artist) => {
          const isDone = done.includes(artist.id);
          const isNow = state === 'running' && current?.id === artist.id;
          return (
            <li
              key={artist.id}
              ref={(el) => {
                items.current.set(artist.id, el);
              }}
              className={`${isDone ? 'done' : ''} ${isNow ? 'now' : ''}`}
              style={{ '--gel': gelFor(artist.name) } as React.CSSProperties}
            >
              <ArtistPhoto name={artist.name} image={artist.image} />
              <span className="tick" aria-hidden="true">
                <Check size={12} strokeWidth={3} />
              </span>
              <span className="name">{artist.name}</span>
            </li>
          );
        })}
      </ol>
      {state === 'ready' && (
        <div className="finder-ready">
          <button ref={cta} className="button primary" onClick={onReady}>
            {t.loader.see} <ArrowUpRight size={18} aria-hidden="true" />
          </button>
        </div>
      )}
      {state === 'failed' && (
        <div className="finder-ready" role="alert">
          <p>{error}</p>
          <div className="button-row">
            <button
              className="button primary"
              onClick={() => {
                setError('');
                setState('running');
                setAttempt((n) => n + 1);
              }}
            >
              <RotateCcw size={17} aria-hidden="true" />
              {t.loader.retry}
            </button>
            <button className="button secondary" onClick={onCancel}>
              {t.onboarding.back}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
