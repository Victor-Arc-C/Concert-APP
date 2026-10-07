'use client';
import { useId, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { api } from '@/components/context';
import { homeCities } from '@/domain/marketing';
import { useGigs } from './gigs-context';
import styles from './marketing.module.css';

type State =
  { kind: 'idle' } | { kind: 'sending' } | { kind: 'done' } | { kind: 'error'; message: string };

export function WaitlistForm({ withCity = false }: { withCity?: boolean }) {
  const id = useId();
  const { home, setHome } = useGigs();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState({ kind: 'sending' });
    try {
      await api('waitlist', { email, homeCity: withCity ? home : undefined });
      setState({ kind: 'done' });
    } catch (error) {
      setState({
        kind: 'error',
        message: error instanceof Error ? error.message : 'That did not go through. Try again.',
      });
    }
  }
  if (state.kind === 'done')
    return withCity ? (
      <div className={styles.pass} role="status">
        <div>
          <span className={styles.label}>Passenger</span>
          <strong>{email}</strong>
        </div>
        <div>
          <span className={styles.label}>From</span>
          <strong>{home}</strong>
        </div>
        <div>
          <span className={styles.label}>To</span>
          <strong>Wherever they play</strong>
        </div>
        <p>You are on the list. We will email you when there is room on the pilot.</p>
      </div>
    ) : (
      <p className={styles.formDone} role="status">
        You are on the list. We will email you when there is room on the pilot.
      </p>
    );
  const error = state.kind === 'error' ? state.message : '';
  return (
    <form
      className={`${styles.form} ${withCity ? styles.formWide : ''}`}
      onSubmit={submit}
      noValidate
    >
      <div className={styles.field}>
        <label htmlFor={`${id}-email`}>Email</label>
        <input
          id={`${id}-email`}
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      </div>
      {withCity && (
        <div className={styles.field}>
          <label htmlFor={`${id}-city`}>Home city</label>
          <select
            id={`${id}-city`}
            name="homeCity"
            value={home}
            onChange={(event) => setHome(event.target.value)}
          >
            {homeCities.map((city) => (
              <option key={city}>{city}</option>
            ))}
          </select>
        </div>
      )}
      <button type="submit" className={styles.cta} disabled={state.kind === 'sending'}>
        {state.kind === 'sending' ? 'Joining' : 'Join the waitlist'}
        <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
      </button>
      {error && (
        <p id={`${id}-error`} className={styles.formError} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
