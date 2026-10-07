'use client';
import { useSyncExternalStore } from 'react';

const states = [
  { value: '', label: 'Demo data' },
  { value: 'worst', label: 'Worst case' },
  { value: 'empty', label: 'Empty' },
  { value: 'one', label: 'One' },
  { value: 'huge', label: 'Huge' },
];
const current = () => new URLSearchParams(window.location.search).get('data') ?? '';

/** Dev-only fixture switcher for break-ui testing. Renders nothing outside `next dev`. */
export function DataToggle() {
  const active = useSyncExternalStore(
    () => () => {},
    current,
    () => '',
  );
  if (process.env.NODE_ENV !== 'development') return null;
  return (
    <div
      role="group"
      aria-label="Test data"
      style={{
        position: 'fixed',
        bottom: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 60,
        display: 'flex',
        gap: 2,
        padding: 3,
        background: '#d4d4d8',
        borderRadius: 8,
        font: '12px system-ui, sans-serif',
      }}
    >
      {states.map((s) => (
        <button
          key={s.value}
          type="button"
          aria-pressed={active === s.value}
          onClick={() => {
            const url = new URL(window.location.href);
            if (s.value) url.searchParams.set('data', s.value);
            else url.searchParams.delete('data');
            window.location.assign(url);
          }}
          style={{
            border: 0,
            borderRadius: 6,
            padding: '5px 10px',
            background: active === s.value ? '#fff' : 'transparent',
            color: '#18181b',
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
