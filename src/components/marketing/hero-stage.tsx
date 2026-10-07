'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';
import { ArtistPhoto } from '@/components/ui';
import { gelFor } from '@/components/stage/gel';
import { Spring } from '@/components/stage/spring';
import { useGigs } from './gigs-context';
import { WaitlistForm } from './waitlist-form';
import styles from './marketing.module.css';

/** Six moving heads: three light the acts on the floor, three sweep the haze. */
const LAMPS = [
  { x: 0.12, color: '#a58bff', kind: 'ambient', rest: 22 },
  { x: 0.29, color: '#ff3d7f', kind: 'act', act: 0 },
  { x: 0.46, color: '#1fb6ff', kind: 'act', act: 1 },
  { x: 0.62, color: '#ffaa00', kind: 'act', act: 2 },
  { x: 0.78, color: '#ff6a3d', kind: 'ambient', rest: -14 },
  { x: 0.93, color: '#1fb6ff', kind: 'ambient', rest: -30 },
] as const;
const BEAM_TOP = 52;

type Act = { artist: string; city: string; date: string | null };

/**
 * The signature moment: the promise on a lit stage. Lamps power on in turn, their beams find the
 * three acts on the floor, lean towards the visitor's pointer, spotlight the act they point at,
 * and all swing onto the confirmation when someone joins the waitlist.
 */
export function HeroStage() {
  const { t, f, city } = useI18n();
  const m = t.marketing;
  const { status, data, retry } = useGigs();
  const stage = useRef<HTMLElement>(null);
  const beams = useRef<(HTMLSpanElement | null)[]>([]);
  const heads = useRef<(HTMLSpanElement | null)[]>([]);
  const lamps = useRef<(HTMLSpanElement | null)[]>([]);
  const acts = useRef<(HTMLButtonElement | null)[]>([]);
  const springs = useRef<Spring[]>([]);
  const aimState = useRef({ lean: 0, powered: false });
  const [focus, setFocus] = useState<number | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [converge, setConverge] = useState<HTMLElement | null>(null);

  // Three distinct artists from the busiest cities: real listings when live, labelled samples otherwise.
  const floor = useMemo<Act[]>(() => {
    const seen = new Set<string>();
    const picked: Act[] = [];
    for (const place of data?.cities ?? [])
      for (const gig of place.gigs) {
        if (picked.length === 3 || seen.has(gig.artist)) continue;
        seen.add(gig.artist);
        picked.push({ artist: gig.artist, city: place.name, date: gig.date });
      }
    return picked;
  }, [data]);

  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const angleTo = useCallback((i: number, el: Element, extra = 0) => {
    const box = stage.current!.getBoundingClientRect();
    const target = el.getBoundingClientRect();
    const dx = target.left + target.width / 2 - (box.left + LAMPS[i].x * box.width);
    const dy = target.top + target.height * 0.42 - (box.top + BEAM_TOP);
    const beam = beams.current[i];
    if (beam) beam.style.height = `${Math.hypot(dx, dy) + target.height * 0.6}px`;
    return (Math.atan2(dx, dy) * -180) / Math.PI + extra;
  }, []);

  const aim = useCallback(() => {
    if (!aimState.current.powered || !stage.current) return;
    const { lean } = aimState.current;
    const target: number | 'form' | null = converge ? 'form' : (preview ?? focus);
    LAMPS.forEach((lamp, i) => {
      const spring = springs.current[i];
      const beam = beams.current[i];
      if (!spring || !beam) return;
      let angle: number;
      if (lamp.kind === 'ambient') {
        angle = lamp.rest + lean * 1.6;
        beam.dataset.dim = target !== null ? 'true' : 'false';
      } else {
        const el = converge ?? acts.current[typeof target === 'number' ? target : lamp.act];
        if (!el) {
          beam.style.removeProperty('height');
          angle = (lamp.act - 1) * -12 + lean * 0.35;
        } else angle = angleTo(i, el, lean * 0.35);
        beam.dataset.dim =
          target !== null && target !== 'form' && target !== lamp.act ? 'true' : 'false';
      }
      if (reduced()) spring.set(angle);
      else spring.to(angle);
    });
  }, [angleTo, converge, focus, preview]);

  const aimRef = useRef(aim);
  // Springs, then the power-on sequence.
  useEffect(() => {
    springs.current = LAMPS.map(
      (_, i) =>
        new Spring({
          value: 0,
          response: 0.75,
          damping: 0.72,
          precision: 0.05,
          onUpdate: (angle) => {
            const beam = beams.current[i];
            const head = heads.current[i];
            if (beam) beam.style.transform = `rotate(${angle}deg)`;
            if (head) head.style.transform = `rotate(${angle * 0.7}deg)`;
          },
        }),
    );
    const timers = LAMPS.map((_, i) =>
      window.setTimeout(
        () => {
          lamps.current[i]?.classList.add(styles.on);
          beams.current[i]?.classList.add(styles.on);
          if (i === LAMPS.length - 1) {
            aimState.current.powered = true;
            aimRef.current();
          }
        },
        reduced() ? 0 : 200 + i * 150,
      ),
    );
    const running = springs.current;
    return () => {
      timers.forEach(clearTimeout);
      running.forEach((spring) => spring.stop());
    };
  }, []);
  useEffect(() => {
    aimRef.current = aim;
    aim();
  }, [aim, floor.length, status]);
  useEffect(() => {
    const onResize = () => aimRef.current();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Pointer lean (fine pointers only): the rig follows the visitor a little.
  useEffect(() => {
    const el = stage.current;
    if (!el || !window.matchMedia('(hover: hover) and (pointer: fine)').matches || reduced()) return;
    let frame = 0;
    const move = (event: PointerEvent) => {
      const box = el.getBoundingClientRect();
      const next = ((event.clientX - box.left) / box.width - 0.5) * -10;
      if (Math.abs(next - aimState.current.lean) < 0.4) return;
      aimState.current.lean = next;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => aimRef.current());
    };
    const leave = () => {
      aimState.current.lean = 0;
      setPreview(null);
      aimRef.current();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
    };
  }, []);

  // Joining: every act beam swings onto the confirmation, then back to the acts.
  const joined = useCallback((el: HTMLElement) => {
    setConverge(el);
    window.setTimeout(() => setConverge(null), 2200);
  }, []);

  const target = converge ? null : (preview ?? focus);
  return (
    <section ref={stage} className={styles.stage} aria-labelledby="promise">
      <span className={styles.truss} aria-hidden="true" />
      <div aria-hidden="true">
        {LAMPS.map((lamp, i) => (
          <span key={`lamp-${lamp.x}`}>
            <span
              ref={(el) => {
                lamps.current[i] = el;
              }}
              className={styles.lamp}
              style={{ left: `${lamp.x * 100}%`, '--c': lamp.color } as React.CSSProperties}
            >
              <span
                className={styles.head}
                ref={(el) => {
                  heads.current[i] = el;
                }}
              >
                <span className={styles.lens} />
              </span>
            </span>
            <span
              ref={(el) => {
                beams.current[i] = el;
              }}
              className={`${styles.beam} ${lamp.kind === 'ambient' ? styles.ambient : ''}`}
              style={{ left: `${lamp.x * 100}%`, '--c': lamp.color } as React.CSSProperties}
            />
          </span>
        ))}
      </div>
      <div className={styles.copy}>
        <h1 id="promise">{m.promise}</h1>
        <p className={styles.lead}>{m.lead}</p>
        <WaitlistForm onJoined={joined} />
        <p className={styles.more}>
          {m.beta} {m.invited} <Link href="/login">{m.signIn}</Link>
          <span aria-hidden="true"> · </span>
          <Link href="/app">{m.trySample}</Link>
        </p>
      </div>
      <div className={styles.floor} role="group" aria-label={m.actsLabel}>
        {status === 'ready' && floor.length > 0
          ? floor.map((act, i) => (
              <button
                key={`${act.artist}-${i}`}
                ref={(el) => {
                  acts.current[i] = el;
                }}
                type="button"
                className={styles.act}
                data-lit={target === null || target === i ? 'true' : 'false'}
                aria-pressed={focus === i}
                style={{ '--gel': gelFor(act.artist), '--i': i } as React.CSSProperties}
                onPointerEnter={(e) => e.pointerType === 'mouse' && setPreview(i)}
                onPointerLeave={(e) => e.pointerType === 'mouse' && setPreview(null)}
                onFocus={() => setPreview(i)}
                onBlur={() => setPreview(null)}
                onClick={() => {
                  setFocus(focus === i ? null : i);
                  setPreview(null);
                }}
              >
                <span className={styles.pool} aria-hidden="true" />
                <ArtistPhoto name={act.artist} className={styles.actPhoto} />
                <b>{act.artist}</b>
                <small>
                  {act.date ? f.dateWithDay(act.date) : m.sampleAct} · {city(act.city)}
                </small>
              </button>
            ))
          : [0, 1, 2].map((i) => (
              <span
                key={i}
                ref={(el) => {
                  acts.current[i] = el as unknown as HTMLButtonElement;
                }}
                className={`${styles.act} ${styles.actWaiting}`}
                aria-hidden="true"
              >
                <span className={styles.actPhoto} />
              </span>
            ))}
      </div>
      <p className={styles.hint} aria-live="polite">
        {status === 'error' ? (
          <>
            {m.actsError}{' '}
            <button type="button" onClick={retry}>
              {t.common.tryAgain}
            </button>
          </>
        ) : status === 'loading' ? (
          m.actsLoading
        ) : data?.mode === 'live' ? (
          m.actsHintLive
        ) : (
          m.actsHintSample
        )}
      </p>
    </section>
  );
}
