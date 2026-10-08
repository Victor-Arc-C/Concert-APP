'use client';
import { useEffect, useRef } from 'react';
import { BedDouble, Sigma, Ticket, TrainFront } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import styles from './marketing.module.css';

const looks = [
  { icon: Ticket, color: 'var(--rose)' },
  { icon: TrainFront, color: 'var(--cyan)' },
  { icon: BedDouble, color: 'var(--amber)' },
  { icon: Sigma, color: 'var(--violet)' },
];

/**
 * How a far-away night comes together, as a lighting cue sheet. A follow spot walks down the cues
 * when the sheet scrolls into view and leaves each one lit. It explains the rules; it shows no
 * invented times or prices.
 */
export function CueSheet() {
  const { t } = useI18n();
  const m = t.marketing;
  const sheet = useRef<HTMLOListElement>(null);
  const follow = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const list = sheet.current;
    const spot = follow.current;
    if (!list || !spot) return;
    const cues = [...list.querySelectorAll<HTMLElement>('li')];
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cues.forEach((cue) => cue.setAttribute('data-lit', ''));
      return;
    }
    let cancelled = false;
    const run = async () => {
      for (const [n, cue] of cues.entries()) {
        if (cancelled) return;
        spot.style.setProperty('--c', getComputedStyle(cue).getPropertyValue('--c'));
        spot.style.height = `${cue.offsetHeight}px`;
        await spot
          .animate(
            [
              {
                transform: `translateY(${n ? cues[n - 1].offsetTop : cue.offsetTop - 40}px)`,
                opacity: n ? 1 : 0,
              },
              { transform: `translateY(${cue.offsetTop}px)`, opacity: 1 },
            ],
            {
              duration: n ? 420 : 300,
              easing: 'cubic-bezier(0.77, 0, 0.175, 1)',
              fill: 'forwards',
            },
          )
          .finished.catch(() => {});
        cue.setAttribute('data-lit', '');
        await new Promise((resolve) => setTimeout(resolve, 260));
      }
      spot.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' });
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          void run();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(list);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);
  return (
    <section id="how" className={styles.cues} aria-labelledby="cues-title">
      <h2 id="cues-title">{m.cuesTitle}</h2>
      <p className={styles.intro}>{m.cuesIntro}</p>
      <div className={styles.sheet}>
        <span ref={follow} className={styles.follow} aria-hidden="true" />
        <ol ref={sheet}>
          {m.cues.map((cue, i) => {
            const { icon: Icon, color } = looks[i];
            return (
              <li
                key={cue.title}
                className={styles.cue}
                style={{ '--c': color } as React.CSSProperties}
              >
                <span className={styles.q} aria-hidden="true">
                  Q{i + 1}
                </span>
                <span className={styles.cueIcon} aria-hidden="true">
                  <Icon size={22} />
                </span>
                <span>
                  <b>{cue.title}</b>
                  <small>{cue.body}</small>
                </span>
                <span className={styles.val}>{cue.value}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
