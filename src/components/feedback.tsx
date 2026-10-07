'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { api, useApp } from './context';
import { Modal } from './ui';

const MAX_LENGTH = 2000;

// CON-36: private-beta feedback, stored in Showbound's own database with the current screen.
export function FeedbackButton({
  className,
  label = true,
}: {
  className: string;
  label?: boolean;
}) {
  const { data } = useApp();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (!data.user) return null;
  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={label ? undefined : t.feedback.button}
        onClick={() => setOpen(true)}
      >
        <MessageSquare size={label ? 19 : 18} aria-hidden="true" />
        {label && t.feedback.button}
      </button>
      {open && <FeedbackDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useApp();
  const { t } = useI18n();
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
      toast(t.feedback.thanks);
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t.common.somethingWrong);
    } finally {
      setSending(false);
    }
  }
  return (
    <Modal title={t.feedback.title} onClose={onClose}>
      <p className="intro">{t.feedback.intro(screen)}</p>
      <form className="feedback-form" onSubmit={send}>
        <label htmlFor="feedback-message">
          {t.feedback.label}
          <textarea
            id="feedback-message"
            required
            rows={5}
            maxLength={MAX_LENGTH}
            aria-describedby="feedback-count"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </label>
        <small id="feedback-count" className="fineprint">
          {message.length}/{MAX_LENGTH}
        </small>
        <fieldset className="feedback-rating">
          <legend>{t.feedback.rating}</legend>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={rating === value}
              aria-label={t.feedback.outOf(value)}
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
          {sending ? t.feedback.sending : t.feedback.send}
        </button>
      </form>
    </Modal>
  );
}
