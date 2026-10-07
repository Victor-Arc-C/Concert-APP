'use client';
import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'motion/react';
import { useI18n } from '@/i18n/client';
import { useGigs } from './gigs-context';
import styles from './marketing.module.css';

/**
 * Real quotes from pilot testers only, published with their permission. The quote row stays
 * hidden while this is empty; never fill it with invented reviews.
 */
const pilotQuotes: { quote: string; name: string; detail: string }[] = [];

/** Counts up once, when the figures are actually on screen. Reduced motion shows the number. */
function Count({ value, run, delay }: { value: number; run: boolean; delay: number }) {
  const { f } = useI18n();
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!run || reduce) return;
    let frame = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / 900));
      setShown(Math.round(value * (1 - (1 - p) ** 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [run, value, delay, reduce]);
  return (
    <>
      <span aria-hidden="true">{f.number(reduce ? value : run ? shown : 0)}</span>
      <span className="vh">{f.number(value)}</span>
    </>
  );
}

export function Proof() {
  const { t } = useI18n();
  const m = t.marketing;
  const { status, data } = useGigs();
  const grid = useRef<HTMLDListElement>(null);
  const seen = useInView(grid, { once: true, amount: 0.4 });
  const stats = data?.stats;
  // Zeros are not proof: the section waits until there is something on stage.
  if (status === 'ready' && !stats?.shows) return null;
  const cells = [
    { label: m.stats.shows, value: stats?.shows, big: true, color: 'var(--rose)' },
    { label: m.stats.artists, value: stats?.artists, color: 'var(--cyan)' },
    { label: m.stats.cities, value: stats?.cities, color: 'var(--amber)' },
    data?.waitlist != null
      ? { label: m.stats.waitlist, value: data.waitlist, color: 'var(--violet)' }
      : { label: m.stats.countries, value: stats?.countries, color: 'var(--violet)' },
  ];
  return (
    <section className={styles.proof} aria-labelledby="proof-title">
      <h2 id="proof-title" data-reveal>
        {m.proofTitle}
      </h2>
      <p className={styles.proofNote} data-reveal style={{ '--i': 1 } as React.CSSProperties}>
        {data?.mode === 'sample' ? m.proofSample : m.proofLive}
      </p>
      <dl ref={grid} className={styles.stats}>
        {cells.map((cell, i) => (
          <div
            key={i}
            className={cell.big ? styles.statBig : styles.stat}
            data-lit={seen && status === 'ready' ? '' : undefined}
            style={{ '--c': cell.color, '--i': i } as React.CSSProperties}
          >
            <dt>{cell.label}</dt>
            <dd>
              {status === 'ready' && cell.value != null ? (
                <Count value={cell.value} run={seen} delay={i * 140} />
              ) : (
                '·'
              )}
            </dd>
          </div>
        ))}
      </dl>
      {pilotQuotes.length > 0 && (
        <ul className={styles.quotes}>
          {pilotQuotes.map((q) => (
            <li key={q.name}>
              <blockquote>“{q.quote}”</blockquote>
              <span>
                {q.name}, {q.detail}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
