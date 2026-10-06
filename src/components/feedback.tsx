'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import { api, useApp } from './context';
import { Modal } from './ui';

const MAX_LENGTH = 2000;

// CON-36: private-beta feedback, stored in Encore's own database with the current screen.
export function FeedbackButton({
  className,
  label = true,
}: {
  className: string;
  label?: boolean;
}) {
  const { data } = useApp();
  const [open, setOpen] = useState(false);
  if (!data.user) return null;
  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={label ? undefined : 'Send feedback'}
        onClick={() => setOpen(true)}
      >
        <MessageSquare size={label ? 19 : 18} />
        {label && 'Send feedback'}
      </button>
      {open && <FeedbackDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useApp();
  const screen = usePathname();
  const [message, setMessage] = useState(''),
    [rating, setRating] = useState<number | null>(null),
    [sending, setSending] = useState(false),
    [error, setError] = useState('');
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      await api('beta-feedback', { message, rating, screen });
      toast('Thanks! Your feedback was sent to the Encore team.');
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Please try again.');
    } finally {
      setSending(false);
    }
  }
  return (
    <Modal title="Send feedback" onClose={onClose}>
      <p>
        Tell us what worked, what was missing or what went wrong. Only the Encore team reads it,
        together with the screen you are on ({screen}).
      </p>
      <form className="feedback-form" onSubmit={send}>
        <label htmlFor="feedback-message">
          Your feedback
          <textarea
            id="feedback-message"
            required
            rows={5}
            maxLength={MAX_LENGTH}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </label>
        <small className="fineprint">
          {message.length}/{MAX_LENGTH}
        </small>
        <fieldset className="feedback-rating">
          <legend>How is Encore so far? (optional)</legend>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={rating === value}
              aria-label={`${value} out of 5`}
              onClick={() => setRating(rating === value ? null : value)}
            >
              {value}
            </button>
          ))}
        </fieldset>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary full" disabled={sending || !message.trim()}>
          {sending ? 'Sending…' : 'Send feedback'}
        </button>
      </form>
    </Modal>
  );
}
