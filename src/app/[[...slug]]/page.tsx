import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { ShowboundApp } from '@/components/app';
import { MarketingPage } from '@/components/marketing/marketing-page';
import { dictionaries } from '@/i18n/messages';
import { getLocale } from '@/i18n/server';

type Props = { params: Promise<{ slug?: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if ((await params).slug) return {};
  const t = dictionaries[await getLocale()];
  return { title: t.meta.title, description: t.meta.description };
}

/**
 * Marketing only: paint edge to edge under the notch (content is padded back with
 * env(safe-area-inset-*)) and colour the browser chrome to match the haze. The app shell keeps
 * the defaults so its fixed bottom bar is untouched.
 */
export async function generateViewport({ params }: Props): Promise<Viewport> {
  if ((await params).slug) return {};
  return {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    themeColor: '#e4dcf8',
    colorScheme: 'light',
  };
}

export default async function Page({ params }: Props) {
  // The marketing site owns `/`; every other path is the client-rendered app.
  if (!(await params).slug) return <MarketingPage locale={await getLocale()} />;
  const t = dictionaries[await getLocale()];
  return (
    <Suspense fallback={<main className="loading-page">{t.common.loading}</main>}>
      <ShowboundApp />
    </Suspense>
  );
}
