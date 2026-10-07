'use client';
import { useId, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { api } from '@/components/context';
import { homeCities } from '@/domain/marketing';
import { useI18n } from '@/i18n/client';
import { useGigs } from './gigs-context';
import styles from './marketing.module.css';

type State =
  { kind: 'idle' } | { kind: 'sending' } | { kind: 'done' } | { kind: 'error'; message: string };

export function WaitlistForm({
  withCity = false,
  onJoined,
}: {
  withCity?: boolean;
  /** Called with the confirmation, so the stage can turn its lights on it. */
  onJoined?: (confirmation: HTMLElement) => void;
}) {
  const id = useId();
  const { t, city } = useI18n();
  const m = t.marketing;
  const { home, setHome } = useGigs();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });
  const input = useRef<HTMLInputElement>(null);
  const done = useRef<HTMLDivElement>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!input.current?.validity.valid) {
      setState({ kind: 'error', message: email ? m.emailInvalid : m.emailMissing });
      input.current?.focus();
      return;
    }
    setState({ kind: 'sending' });
    try {
      await api('waitlist', { email, homeCity: withCity ? home : undefined });
      setState({ kind: 'done' });
      requestAnimationFrame(() => {
        if (done.current) {
          done.current.focus();
          onJoined?.(done.current);
        }
      });
    } catch (error) {
      setState({ kind: 'error', message: error instanceof Error ? error.message : m.joinError });
    }
  }
  if (state.kind === 'done')
    return (
      <div ref={done} className={styles.done} role="status" tabIndex={-1}>
        {withCity ? (
          <dl>
            <div>
              <dt>{m.email}</dt>
              <dd>{email}</dd>
            </div>
            <div>
              <dt>{m.doneFrom}</dt>
              <dd>{city(home)}</dd>
            </div>
            <div>
              <dt>{m.doneTo}</dt>
              <dd>{m.doneEverywhere}</dd>
            </div>
          </dl>
        ) : null}
        <p>{m.done}</p>
      </div>
    );
  const error = state.kind === 'error' ? state.message : '';
  return (
    <form className={`${styles.form} ${withCity ? styles.formWide : ''}`} onSubmit={submit} noValidate>
      <div className={styles.field}>
        <label htmlFor={`${id}-email`}>{m.email}</label>
        <input
          ref={input}
          id={`${id}-email`}
          type="email"
          name="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="send"
          placeholder="you@example.com"
          required
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (state.kind === 'error') setState({ kind: 'idle' });
          }}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      </div>
      {withCity && (
        <div className={styles.field}>
          <label htmlFor={`${id}-city`}>{m.homeCity}</label>
          <select
            id={`${id}-city`}
            name="homeCity"
            value={home}
            onChange={(event) => setHome(event.target.value)}
          >
            {homeCities.map((name) => (
              <option key={name} value={name}>
                {city(name)}
              </option>
            ))}
          </select>
        </div>
      )}
      <button type="submit" className={styles.cta} disabled={state.kind === 'sending'}>
        {state.kind === 'sending' ? m.joining : m.join}
        <ArrowRight size={18} strokeWidth={2.4} aria-hidden="true" />
      </button>
      <p id={`${id}-error`} className={styles.formError} role="alert">
        {error}
      </p>
    </form>
  );
}
