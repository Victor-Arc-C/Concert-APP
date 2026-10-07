'use client';
import { useLayoutEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import styles from './marketing.module.css';

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const BLANK = '\u00a0';

/**
 * Split-flap readout. React renders the final characters; the scramble writes straight to the
 * DOM so a board of a few hundred cells never re-renders per frame.
 */
export function SplitFlap({
  text,
  width,
  delay = 0,
  align = 'left',
  label,
  className,
}: {
  text: string;
  /** Full value for screen readers when `text` is an abbreviation. */
  label?: string;
  width: number;
  delay?: number;
  /** Numbers read right-aligned, like an odometer. */
  align?: 'left' | 'right';
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const clipped = text.toUpperCase().slice(0, width);
  const padded = align === 'right' ? clipped.padStart(width, ' ') : clipped.padEnd(width, ' ');
  // Layout effect: scramble before paint so the final text never flashes first.
  useLayoutEffect(() => {
    const cells = ref.current?.children;
    if (!cells || reduce) return;
    const timers: number[] = [];
    Array.from(cells).forEach((cell, i) => {
      const target = padded[i] === ' ' ? BLANK : padded[i];
      if (cell.textContent === target && target === BLANK) return;
      const steps = 3 + ((i * 7) % 5);
      const start = delay + i * 22;
      cell.textContent = GLYPHS[(i * 11) % GLYPHS.length];
      for (let s = 0; s < steps; s++)
        timers.push(
          window.setTimeout(
            () => {
              cell.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
            },
            start + s * 55,
          ),
        );
      timers.push(
        window.setTimeout(
          () => {
            cell.textContent = target;
          },
          start + steps * 55,
        ),
      );
    });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [padded, reduce, delay]);
  return (
    <span className={`${styles.flapRow} ${className ?? ''}`}>
      <span className={styles.srOnly}>{label ?? text}</span>
      <span ref={ref} aria-hidden="true" className={styles.flapCells}>
        {[...padded].map((char, i) => (
          <span key={i} className={styles.flap}>
            {char === ' ' ? BLANK : char}
          </span>
        ))}
      </span>
    </span>
  );
}
