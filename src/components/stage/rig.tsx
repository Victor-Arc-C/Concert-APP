'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Spring } from './spring';

/**
 * The lighting rig: a truss, three moving heads and their beams. Beams sit behind the content and
 * multiply into the haze, so they colour the page without ever covering text. Each screen and
 * filter is a lighting cue; saving a show drops a white follow spot onto it.
 */
export type Cue = 'all' | 'home' | 'away' | 'saved' | 'trips' | 'artists' | 'alerts' | 'quiet';
const CUES: Record<Cue, [number, number, number]> = {
  all: [-14, 4, 16],
  home: [-26, -6, 8],
  away: [-6, 12, 26],
  saved: [-22, 0, 22],
  trips: [-4, 16, 30],
  artists: [-30, -12, 10],
  alerts: [-18, 8, 34],
  quiet: [-8, 0, 8],
};
const LAMPS = [0.15, 0.5, 0.85];

type StageApi = {
  /** Swing a white follow spot onto an element (saving a show). */
  spot: (target: Element | null) => void;
  /** Point every beam at an element, or release them back to the cue. */
  converge: (target: Element | null) => void;
};
const StageContext = createContext<StageApi>({ spot: () => {}, converge: () => {} });
export const useStage = () => useContext(StageContext);
const CueContext = createContext<(cue: Cue) => void>(() => {});
/** Each screen calls this with its lighting cue; the rig swings to it. */
export function useCue(cue: Cue) {
  const setCue = useContext(CueContext);
  useEffect(() => setCue(cue), [cue, setCue]);
}

const reduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Stage({
  initial = 'all',
  layout = 'app',
  children,
}: {
  initial?: Cue;
  /** 'app' leaves room for the desktop sidebar; 'full' lights the whole width. */
  layout?: 'app' | 'full';
  children: React.ReactNode;
}) {
  const [cue, setCue] = useState<Cue>(initial);
  const root = useRef<HTMLDivElement>(null);
  const beams = useRef<(HTMLSpanElement | null)[]>([]);
  const heads = useRef<(HTMLSpanElement | null)[]>([]);
  const lamps = useRef<(HTMLSpanElement | null)[]>([]);
  const spotBeam = useRef<HTMLSpanElement>(null);
  const springs = useRef<Spring[]>([]);
  const state = useRef({ cue, sway: 0, target: null as Element | null, powered: false });

  /** Angle (degrees) and length for a beam from lamp i to the centre of an element. */
  const aimAt = useCallback((i: number, target: Element) => {
    const beam = beams.current[i];
    if (!beam) return 0;
    const box = beam.parentElement!.getBoundingClientRect();
    const from = { x: box.left + LAMPS[i] * box.width, y: box.top + beam.offsetTop };
    const to = target.getBoundingClientRect();
    const dx = to.left + to.width / 2 - from.x;
    const dy = to.top + to.height / 2 - from.y;
    beam.style.height = `${Math.max(120, Math.hypot(dx, dy) + to.height / 2)}px`;
    return (Math.atan2(dx, dy) * -180) / Math.PI;
  }, []);

  const aim = useCallback(() => {
    const { cue: current, sway, target, powered } = state.current;
    if (!powered) return;
    const angles = CUES[current];
    springs.current.forEach((spring, i) => {
      let angle: number;
      if (target) angle = aimAt(i, target);
      else {
        beams.current[i]?.style.removeProperty('height');
        angle = angles[i] + (i % 2 ? -sway : sway);
      }
      if (reduced()) spring.set(angle);
      else spring.to(angle);
    });
  }, [aimAt]);

  // Build the springs once; each moves its beam and tilts its head so the fixture reads as the source.
  useEffect(() => {
    springs.current = LAMPS.map(
      (_, i) =>
        new Spring({
          value: 0,
          response: 0.8,
          damping: 0.7,
          precision: 0.05,
          onUpdate: (angle) => {
            const beam = beams.current[i];
            const head = heads.current[i];
            if (beam) beam.style.transform = `rotate(${angle}deg)`;
            if (head) head.style.transform = `rotate(${angle * 0.7}deg)`;
          },
        }),
    );
    // Power on: lamps flicker on in turn and the beams tilt in from straight down.
    const timers = LAMPS.map((_, i) =>
      window.setTimeout(
        () => {
          lamps.current[i]?.classList.add('on');
          beams.current[i]?.classList.add('on');
          if (i === LAMPS.length - 1) {
            state.current.powered = true;
          }
          const angle = CUES[state.current.cue][i];
          if (reduced()) springs.current[i].set(angle);
          else springs.current[i].to(angle);
        },
        reduced() ? 0 : 250 + i * 180,
      ),
    );
    const settle = window.setTimeout(
      () => {
        state.current.powered = true;
        aim();
      },
      reduced() ? 0 : 900,
    );
    // Scrolling sways the beams a little, like an operator riding the fader.
    let frame = 0;
    const onScroll = () => {
      if (reduced()) {
        root.current?.style.setProperty('--rig-fade', window.scrollY > 8 ? '1' : '0');
        return;
      }
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.current?.style.setProperty('--rig-fade', window.scrollY > 8 ? '1' : '0');
        state.current.sway = Math.sin(window.scrollY / 240) * 7;
        aim();
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', aim);
    const running = springs.current;
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(settle);
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', aim);
      running.forEach((spring) => spring.stop());
    };
  }, [aim]);

  useEffect(() => {
    state.current.cue = cue;
    aim();
  }, [cue, aim]);

  const api = useMemo<StageApi>(
    () => ({
      spot: (target) => {
        const beam = spotBeam.current;
        if (!beam || !target) return;
        if (reduced()) {
          target.animate([{ opacity: 0.7 }, { opacity: 1 }], { duration: 200 });
          return;
        }
        const box = beam.parentElement!.getBoundingClientRect();
        const to = target.getBoundingClientRect();
        const dx = to.left + to.width / 2 - (box.left + box.width / 2);
        const dy = to.top + to.height / 2 - (box.top + beam.offsetTop);
        beam.style.height = `${Math.hypot(dx, dy) + to.height / 2}px`;
        beam.style.transform = `rotate(${(Math.atan2(dx, dy) * -180) / Math.PI}deg)`;
        beam.animate(
          [
            { opacity: 0 },
            { opacity: 0.9, offset: 0.2 },
            { opacity: 0.75, offset: 0.7 },
            { opacity: 0 },
          ],
          { duration: 1100, easing: 'ease-out' },
        );
        target.animate(
          [
            { transform: 'scale(1)' },
            { transform: 'scale(1.02)', offset: 0.3 },
            { transform: 'scale(1)' },
          ],
          { duration: 520, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
        );
      },
      converge: (target) => {
        state.current.target = target;
        aim();
      },
    }),
    [aim],
  );

  return (
    <CueContext.Provider value={setCue}>
      <StageContext.Provider value={api}>
        <div ref={root} className="stage" data-cue={cue} data-layout={layout}>
          <div className="stage-beams" aria-hidden="true">
            {LAMPS.map((x, i) => (
              <span
                key={x}
                ref={(el) => {
                  beams.current[i] = el;
                }}
                className="beam"
                style={{ left: `${x * 100}%`, '--c': `var(--g${i + 1})` } as React.CSSProperties}
              />
            ))}
            <span ref={spotBeam} className="beam beam-spot" />
          </div>
          <div className="stage-rig" aria-hidden="true">
            <span className="truss" />
            {LAMPS.map((x, i) => (
              <span
                key={x}
                ref={(el) => {
                  lamps.current[i] = el;
                }}
                className="lamp"
                style={{ left: `${x * 100}%`, '--c': `var(--g${i + 1})` } as React.CSSProperties}
              >
                <span
                  className="head"
                  ref={(el) => {
                    heads.current[i] = el;
                  }}
                >
                  <span className="lens" />
                </span>
              </span>
            ))}
          </div>
          {children}
        </div>
      </StageContext.Provider>
    </CueContext.Provider>
  );
}
