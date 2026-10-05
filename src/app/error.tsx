'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="failure">
      <h1>Encore couldn’t load this page.</h1>
      <p>Try again. Your saved concerts are still in your account.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
