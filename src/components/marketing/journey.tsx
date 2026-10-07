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
import styles from './marketing.module.css';

const stops = [
  {
    name: 'Set home',
    body: 'Pick your city and how far you would go: a metro ride, a train, a weekend abroad.',
    image: '/screens/onboarding.png',
    alt: 'Encore onboarding screen asking for a home city and how far you would travel',
  },
  {
    name: 'Follow',
    body: 'Choose the artists you would travel for. No listening history needed, just your picks.',
    image: '/screens/artists.png',
    alt: 'Encore artists screen with Charli xcx, Fontaines D.C., Fred again.. and Kendrick Lamar followed',
  },
  {
    name: 'Get the alert',
    body: 'When one of them announces a date in reach, it lands in your Encore alerts.',
    image: '/screens/alerts.png',
    alt: 'Encore alerts screen with new dates for Charli xcx and Fred again.. in Paris',
  },
  {
    name: 'Go',
    body: 'Open the show for the ticket link and the ways to get there, from the train to a bed for the night.',
    image: '/screens/trip.png',
    alt: 'Encore trip planner for Tame Impala in Brussels, comparing train and bus options from Paris',
  },
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
      id="how"
      ref={section}
      className={styles.journey}
      style={pan ? { height: `${stops.length * 100}svh` } : undefined}
      aria-labelledby="how-title"
    >
      <div className={pan ? styles.journeySticky : styles.journeyStatic}>
        <header className={styles.journeyHead}>
          <h2 id="how-title">From your sofa to the barrier.</h2>
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
          {stops.map((stop) => (
            <li key={stop.name} className={styles.stop}>
              <div className={styles.stopText}>
                <h3>{stop.name}</h3>
                <p>{stop.body}</p>
              </div>
              <div className={styles.stopShot}>
                <Image
                  src={stop.image}
                  alt={stop.alt}
                  width={780}
                  height={1688}
                  sizes="(min-width: 1024px) 340px, 80vw"
                />
              </div>
            </li>
          ))}
        </motion.ol>
        <p className={styles.shotNote}>App screens shown in sample mode with fictional listings.</p>
      </div>
    </section>
  );
}
