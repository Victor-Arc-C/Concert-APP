'use client';
import { useRef, useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react';
import { useI18n } from '@/i18n/client';
import styles from './marketing.module.css';

const images = [
  '/screens/onboarding.png',
  '/screens/artists.png',
  '/screens/alerts.png',
  '/screens/trip.png',
];

const wide = '(min-width: 1024px)';
function useWide() {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(wide);
      query.addEventListener('change', notify);
      return () => query.removeEventListener('change', notify);
    },
    () => window.matchMedia(wide).matches,
    () => false,
  );
}

/** Vertical scroll drives a horizontal ride through the four stops (desktop only). */
export function Journey() {
  const { t } = useI18n();
  const stops = t.marketing.stops;
  const section = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const pan = useWide() && !reduce;
  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'] });
  // Full transform strings stay on the compositor; the x/scaleX shorthands drop frames under load.
  const track = useTransform(
    scrollYProgress,
    (v) => `translate3d(${-v * (stops.length - 1) * 100}vw, 0, 0)`,
  );
  const fill = useTransform(scrollYProgress, (v) => `scaleX(${v})`);
  const [active, setActive] = useState(0);
  useMotionValueEvent(scrollYProgress, 'change', (value) =>
    setActive(Math.min(stops.length - 1, Math.floor(value * stops.length))),
  );
  return (
    <section
      id="journey"
      ref={section}
      className={styles.journey}
      style={pan ? { height: `${stops.length * 100}svh` } : undefined}
      aria-labelledby="journey-title"
    >
      <div className={pan ? styles.journeySticky : styles.journeyStatic}>
        <header className={styles.journeyHead}>
          <h2 id="journey-title">{t.marketing.journeyTitle}</h2>
          {pan && (
            <div className={styles.route} aria-hidden="true">
              <motion.span className={styles.routeFill} style={{ transform: fill }} />
              {stops.map((stop, i) => (
                <span key={stop.name} data-active={i <= active || undefined}>
                  {stop.name}
                </span>
              ))}
            </div>
          )}
        </header>
        <motion.ol className={styles.track} style={pan ? { transform: track } : undefined}>
          {stops.map((stop, i) => (
            <li key={stop.name} className={styles.stop}>
              <div className={styles.stopText}>
                <h3>{stop.name}</h3>
                <p>{stop.body}</p>
              </div>
              <div className={styles.stopShot}>
                <Image
                  src={images[i]}
                  alt={stop.alt}
                  width={780}
                  height={1688}
                  sizes="(min-width: 1024px) 340px, 80vw"
                />
              </div>
            </li>
          ))}
        </motion.ol>
        <p className={styles.shotNote}>{t.marketing.shotNote}</p>
      </div>
    </section>
  );
}
