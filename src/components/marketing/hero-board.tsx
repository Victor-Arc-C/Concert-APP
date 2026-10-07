'use client';
import { useMemo } from 'react';
import { cities as catalogCities } from '@/domain/catalog';
import { boardText, distanceKm, homeCities, travelHint, type PublicGigs } from '@/domain/marketing';
import { useGigs } from './gigs-context';
import { SplitFlap } from './split-flap';
import styles from './marketing.module.css';

const ROWS = 5;
type Departure = { artist: string; city: string; km: string; via: string };
const empty: Departure = { artist: '', city: '', km: '', via: '' };

/** Nearest cities first, one show per city before any city repeats. */
function departures(data: PublicGigs, home: string): Departure[] {
  const origin = catalogCities.find((city) => city.name === home) ?? catalogCities[0];
  const ranked = data.cities
    .map((city) => ({ city, km: distanceKm(origin, city) }))
    .sort((a, b) => a.km - b.km);
  const rows: Departure[] = [];
  for (let round = 0; rows.length < ROWS && round < 4; round++)
    for (const { city, km } of ranked) {
      const gig = city.gigs[round];
      if (!gig || rows.length >= ROWS) continue;
      rows.push({
        artist: gig.artist,
        city: city.name,
        km: km < 40 ? '' : String(km),
        via: travelHint(km),
      });
    }
  return rows;
}

export function HeroBoard() {
  const { status, data, retry, home, setHome } = useGigs();
  const rows = useMemo(() => {
    const filled = data ? departures(data, home) : [];
    return Array.from({ length: ROWS }, (_, i) => filled[i] ?? empty);
  }, [data, home]);
  return (
    <div className={styles.board}>
      <div className={styles.boardBar}>
        <label className={styles.boardOrigin}>
          <span>Departures from</span>
          <select value={home} onChange={(event) => setHome(event.target.value)}>
            {homeCities.map((city) => (
              <option key={city}>{city}</option>
            ))}
          </select>
        </label>
        <output className={styles.boardStatus} aria-live="polite">
          {status === 'loading' && 'Fetching shows'}
          {status === 'error' && (
            <button type="button" onClick={retry}>
              Board offline. Retry
            </button>
          )}
          {status === 'ready' &&
            (!data?.cities.length
              ? 'No departures yet'
              : data.mode === 'live'
                ? 'Live listings'
                : 'Sample listings')}
        </output>
      </div>
      <table className={styles.boardTable}>
        <caption className={styles.srOnly}>Upcoming shows nearest to {home}</caption>
        <thead>
          <tr>
            <th scope="col">Artist</th>
            <th scope="col">To</th>
            <th scope="col" className={styles.boardKm}>
              Km
            </th>
            <th scope="col">Via</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td className={styles.boardArtist}>
                <SplitFlap
                  text={boardText(row.artist, 14)}
                  label={row.artist}
                  width={14}
                  delay={i * 90}
                />
              </td>
              <td>
                <SplitFlap
                  text={boardText(row.city, 10)}
                  label={row.city}
                  width={10}
                  delay={i * 90 + 140}
                />
              </td>
              <td className={styles.boardKm}>
                <SplitFlap text={row.km} width={4} delay={i * 90 + 220} align="right" />
              </td>
              <td>
                <SplitFlap
                  text={row.via}
                  width={7}
                  delay={i * 90 + 280}
                  className={styles.flapAccent}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
