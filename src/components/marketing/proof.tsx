'use client';
import { useRef } from 'react';
import { useInView } from 'motion/react';
import { useGigs } from './gigs-context';
import { SplitFlap } from './split-flap';
import styles from './marketing.module.css';

/**
 * Real quotes from pilot testers only, published with their permission. The quote row stays
 * hidden while this is empty; never fill it with invented reviews.
 */
const pilotQuotes: { quote: string; name: string; detail: string }[] = [];

export function Proof() {
  const { status, data } = useGigs();
  const grid = useRef<HTMLDListElement>(null);
  // Flip the numbers in when the board is actually on screen, not while it is below the fold.
  const seen = useInView(grid, { once: true, amount: 0.4 });
  const stats = data?.stats;
  const value = (n: number | undefined) =>
    seen && status === 'ready' && n != null ? String(n) : '';
  const cells = [
    { label: 'Upcoming shows on the board', value: value(stats?.shows), big: true },
    { label: 'Artists playing', value: value(stats?.artists) },
    { label: 'Cities', value: value(stats?.cities) },
    data?.waitlist != null
      ? { label: 'Fans on the waitlist', value: value(data.waitlist) }
      : { label: 'Countries', value: value(stats?.countries) },
  ];
  // Zeros are not proof: the section waits until there is something on the board.
  if (status === 'ready' && !stats?.shows) return null;
  return (
    <section className={styles.proof} aria-labelledby="proof-title">
      <h2 id="proof-title" data-reveal>
        On the board right now.
      </h2>
      <p className={styles.proofNote} data-reveal style={{ '--i': 1 } as React.CSSProperties}>
        {data?.mode === 'sample'
          ? 'Counted from sample listings until live data is connected.'
          : 'Counted from the same listings the app uses, refreshed every night.'}
      </p>
      <dl ref={grid} className={styles.stats}>
        {cells.map((cell, i) => (
          <div
            // Keyed by slot, not label: the last label changes once the waitlist is public, and a
            // remount would drop the reveal state the observer set.
            key={i}
            className={cell.big ? styles.statBig : styles.stat}
            data-reveal
            style={
              {
                '--i': i,
                '--digits': Math.max(cell.big ? 4 : 3, cell.value.length),
              } as React.CSSProperties
            }
          >
            <dt>{cell.label}</dt>
            <dd>
              <SplitFlap
                text={cell.value}
                width={Math.max(cell.big ? 4 : 3, cell.value.length)}
                delay={i * 160}
                align="right"
              />
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
