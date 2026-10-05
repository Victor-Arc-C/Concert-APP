import { Encore } from '@/components/encore';
import { Suspense } from 'react';
export default function Page() {
  return (
    <Suspense fallback={<main className="loading-page">Loading Encore…</main>}>
      <Encore />
    </Suspense>
  );
}
