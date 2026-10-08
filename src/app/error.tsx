'use client';
import { useI18n } from '@/i18n/client';

export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t } = useI18n();
  return (
    <main className="failure">
      <h1>{t.shell.errorTitle}</h1>
      <p>{t.shell.errorBody}</p>
      <button className="button primary" onClick={reset}>
        {t.common.tryAgain}
      </button>
    </main>
  );
}
