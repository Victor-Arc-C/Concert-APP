import type { Metadata, Viewport } from 'next';
import { Encore } from '@/components/encore';
import { MarketingPage } from '@/components/marketing/marketing-page';
import { Suspense } from 'react';

type Props = { params: Promise<{ slug?: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if ((await params).slug) return {};
  return {
    title: 'Encore | Every show worth the trip',
    description:
      'Follow the artists you love. Encore finds their dates across Europe, links the tickets and shows how to get there. Join the waitlist.',
  };
}

/**
 * Marketing only: paint edge to edge under the notch (content is padded back with
 * env(safe-area-inset-*)) and colour the browser chrome to match the page. The app shell keeps
 * the defaults so its fixed bottom bar is untouched.
 */
export async function generateViewport({ params }: Props): Promise<Viewport> {
  if ((await params).slug) return {};
  return {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    themeColor: '#0b0d12',
    colorScheme: 'dark',
  };
}

export default async function Page({ params }: Props) {
  // The marketing site owns `/`; every other path is the client-rendered app.
  if (!(await params).slug) return <MarketingPage />;
  return (
    <Suspense fallback={<main className="loading-page">Loading Encore…</main>}>
      <Encore />
    </Suspense>
  );
}
