'use client';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cities as catalogCities } from '@/domain/catalog';
import { distanceKm, type PublicCity } from '@/domain/marketing';
import { useI18n } from '@/i18n/client';
import { useGigs } from './gigs-context';
import styles from './marketing.module.css';

const W = 1000;
type Frame = { west: number; east: number; south: number; north: number; kx: number; ky: number };

/** Equirectangular frame around Western Europe, widened to fit every plotted city. */
function fit(cities: { latitude: number; longitude: number }[]): Frame {
  let west = -12,
    east = 24,
    south = 40,
    north = 57;
  for (const c of cities) {
    west = Math.min(west, c.longitude - 2);
    east = Math.max(east, c.longitude + 2);
    south = Math.min(south, c.latitude - 1.5);
    north = Math.max(north, c.latitude + 1.5);
  }
  const kx = W / (east - west);
  const ky = kx / Math.cos((((north + south) / 2) * Math.PI) / 180);
  return { west, east, south, north, kx, ky };
}
const project = (f: Frame, lat: number, lon: number) =>
  [(lon - f.west) * f.kx, (f.north - lat) * f.ky] as const;
const range = (from: number, to: number) =>
  Array.from(
    { length: Math.floor(to / 5) - Math.ceil(from / 5) + 1 },
    (_, i) => (Math.ceil(from / 5) + i) * 5,
  );

type Box = { x0: number; y0: number; x1: number; y1: number };
type Label = { x: number; y: number; anchor: 'start' | 'end' | 'middle' };
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * Greedy label placement: most important city first (selected, then most shows), trying right,
 * left, above and below. Every node is an obstacle. A label that fits nowhere is dropped; the
 * city stays on the map and in the list, so clustered cities never print on top of each other.
 */
function placeLabels(
  points: { key: string; x: number; y: number; size: number; text: string; priority: number }[],
  fontSize: number,
  width: number,
  height: number,
) {
  const charW = fontSize * 0.62,
    h = fontSize * 1.15;
  const taken: Box[] = points.map((p) => ({
    x0: p.x - p.size / 2 - 3,
    y0: p.y - p.size / 2 - 3,
    x1: p.x + p.size / 2 + 3,
    y1: p.y + p.size / 2 + 3,
  }));
  const placed = new Map<string, Label>();
  for (const p of [...points].sort((a, b) => b.priority - a.priority)) {
    const w = p.text.length * charW,
      gap = p.size / 2 + 7,
      base = p.y + fontSize * 0.36;
    const options: (Label & { box: Box })[] = [
      {
        x: p.x + gap,
        y: base,
        anchor: 'start',
        box: { x0: p.x + gap, x1: p.x + gap + w, y0: p.y - h / 2, y1: p.y + h / 2 },
      },
      {
        x: p.x - gap,
        y: base,
        anchor: 'end',
        box: { x0: p.x - gap - w, x1: p.x - gap, y0: p.y - h / 2, y1: p.y + h / 2 },
      },
      {
        x: p.x,
        y: p.y - gap - h * 0.2,
        anchor: 'middle',
        box: { x0: p.x - w / 2, x1: p.x + w / 2, y0: p.y - gap - h, y1: p.y - gap },
      },
      {
        x: p.x,
        y: p.y + gap + h * 0.8,
        anchor: 'middle',
        box: { x0: p.x - w / 2, x1: p.x + w / 2, y0: p.y + gap, y1: p.y + gap + h },
      },
    ];
    const fit = options.find(
      (o) =>
        o.box.x0 >= 0 &&
        o.box.x1 <= width &&
        o.box.y0 >= 0 &&
        o.box.y1 <= height &&
        !taken.some((t) => overlaps(t, o.box)),
    );
    if (!fit) continue;
    taken.push(fit.box);
    placed.set(p.key, { x: fit.x, y: fit.y, anchor: fit.anchor });
  }
  return placed;
}

// SVG text is in viewBox units, so a phone-width map needs larger type to stay legible.
const phone = '(max-width: 767px)';
function useLabelSize() {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(phone);
      query.addEventListener('change', notify);
      return () => query.removeEventListener('change', notify);
    },
    () => (window.matchMedia(phone).matches ? 30 : 15),
    () => 15,
  );
}
const cityKey = (c: PublicCity) => `${c.name}|${c.country}`;


export function GigMap() {
  const { t, f, city: place } = useI18n();
  const m = t.marketing;
  const { status, data, retry, home } = useGigs();
  const reduce = useReducedMotion();
  const [picked, setPicked] = useState<string | null>(null);
  const labelSize = useLabelSize();
  const cities = useMemo(() => data?.cities ?? [], [data]);
  const origin = catalogCities.find((c) => c.name === home) ?? catalogCities[0];
  const frame = useMemo(() => fit([...cities, origin]), [cities, origin]);
  const H = Math.round((frame.north - frame.south) * frame.ky);
  const selected: PublicCity | undefined =
    cities.find((c) => cityKey(c) === picked) ?? cities[0] ?? undefined;
  const [hx, hy] = project(frame, origin.latitude, origin.longitude);
  const nodeSize = (c: PublicCity) => Math.min(30, 9 + Math.sqrt(c.total) * 5);
  const labels = useMemo(
    () =>
      placeLabels(
        cities.map((c) => {
          const [x, y] = project(frame, c.latitude, c.longitude);
          return {
            key: cityKey(c),
            x,
            y,
            size: nodeSize(c),
            text: `${place(c.name)} ${c.total}`,
            priority: (selected && cityKey(c) === cityKey(selected) ? 1e9 : 0) + c.total,
          };
        }),
        labelSize,
        W,
        H,
      ),
    [cities, frame, H, labelSize, selected, place],
  );

  return (
    <section id="shows" className={styles.mapSection} aria-labelledby="map-title">
      <header className={styles.mapHead} data-reveal>
        <h2 id="map-title">{m.mapTitle}</h2>
        <p>{data?.mode === 'sample' ? m.mapSample : m.mapLive}</p>
      </header>
      <div className={styles.mapBody} data-reveal style={{ '--i': 1 } as React.CSSProperties}>
        <div className={styles.mapCanvas}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={m.mapAria(cities.length, place(home))}
          >
            {range(frame.west, frame.east).map((lon) => {
              const [x] = project(frame, 0, lon);
              return (
                <g key={`lon${lon}`} className={styles.grid}>
                  <line x1={x} x2={x} y1={0} y2={H} />
                  <text x={x + 6} y={22}>
                    {Math.abs(lon)}°{lon < 0 ? 'W' : lon > 0 ? 'E' : ''}
                  </text>
                </g>
              );
            })}
            {range(frame.south, frame.north).map((lat) => {
              const [, y] = project(frame, lat, 0);
              return (
                <g key={`lat${lat}`} className={styles.grid}>
                  <line x1={0} x2={W} y1={y} y2={y} />
                  <text x={8} y={y - 6}>
                    {lat}°N
                  </text>
                </g>
              );
            })}
            {cities.map((city) => {
              const [x, y] = project(frame, city.latitude, city.longitude);
              const isSelected = selected && cityKey(city) === cityKey(selected);
              return (
                <line
                  key={`route-${cityKey(city)}`}
                  x1={hx}
                  y1={hy}
                  x2={x}
                  y2={y}
                  className={isSelected ? styles.routeHidden : styles.routeLine}
                />
              );
            })}
            {selected &&
              (() => {
                const [x, y] = project(frame, selected.latitude, selected.longitude);
                return (
                  <motion.path
                    key={`${home}-${selected.name}`}
                    d={`M ${hx} ${hy} L ${x} ${y}`}
                    className={styles.routeActive}
                    initial={reduce ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                  />
                );
              })()}
            <rect x={hx - 18} y={hy - 18} width={36} height={36} className={styles.homeRing} />
            {cities.map((city, i) => {
              const [x, y] = project(frame, city.latitude, city.longitude);
              const size = nodeSize(city);
              const key = cityKey(city);
              const label = labels.get(key);
              return (
                <motion.g
                  key={key}
                  role="button"
                  tabIndex={-1}
                  aria-label={`${place(city.name)}, ${m.showCount(city.total)}`}
                  className={styles.node}
                  data-selected={(selected && key === cityKey(selected)) || undefined}
                  onClick={() => setPicked(key)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') setPicked(key);
                  }}
                  initial={reduce ? false : { opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.04, duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                >
                  <rect x={x - size / 2} y={y - size / 2} width={size} height={size} />
                  {label && (
                    <text
                      x={label.x}
                      y={label.y}
                      textAnchor={label.anchor}
                      style={{ fontSize: labelSize, strokeWidth: labelSize / 3 }}
                    >
                      {place(city.name)} {city.total}
                    </text>
                  )}
                </motion.g>
              );
            })}
          </svg>
        </div>
        <aside className={styles.mapPanel} aria-label={m.byCity}>
          {status === 'loading' && (
            <div className={styles.skeletonList} aria-hidden="true">
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} />
              ))}
            </div>
          )}
          {status === 'error' && (
            <p className={styles.mapState}>
              {m.mapError}{' '}
              <button type="button" onClick={retry}>
                {t.common.tryAgain}
              </button>
            </p>
          )}
          {status === 'ready' && !cities.length && (
            <p className={styles.mapState}>{m.mapEmpty}</p>
          )}
          {status === 'ready' && cities.length > 0 && (
            <>
              <p className={styles.cityCount}>{m.cityCount(cities.length)}</p>
              <ul className={styles.cityList}>
                {cities.map((city) => {
                  const km = distanceKm(origin, city);
                  return (
                    <li key={cityKey(city)}>
                      <button
                        type="button"
                        aria-pressed={!!selected && cityKey(city) === cityKey(selected)}
                        onClick={() => setPicked(cityKey(city))}
                      >
                        <span>{place(city.name)}</span>
                        <span>{km < 40 ? m.home : `${f.number(km)} km`}</span>
                        <data value={city.total}>{city.total}</data>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {selected && (
                <div className={styles.cityDetail} aria-live="polite">
                  <h3>{place(selected.name)}</h3>
                  <ul>
                    {selected.gigs.map((gig, i) => (
                      <li key={`${gig.artist}-${i}`}>
                        <strong>{gig.artist}</strong>
                        <span>
                          {gig.venue}
                          {gig.date && <time dateTime={gig.date}> {f.dateShort(gig.date)}</time>}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {selected.total > selected.gigs.length && (
                    <p>{m.moreShows(selected.total - selected.gigs.length)}</p>
                  )}
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
