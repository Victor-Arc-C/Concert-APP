import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import './globals.css';
import { I18nProvider } from '@/i18n/client';
import { dictionaries } from '@/i18n/messages';
import { getLocale } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = dictionaries[await getLocale()];
  return {
    title: t.meta.appTitle,
    description: t.meta.appDescription,
    applicationName: 'Showbound',
    // Home-screen app on iPhone: full screen, light status bar over the haze.
    appleWebApp: { capable: true, title: 'Showbound', statusBarStyle: 'default' },
  };
}
export const viewport: Viewport = { themeColor: '#e4dcf8', colorScheme: 'light' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        <I18nProvider initial={locale}>{children}</I18nProvider>
        <p
          style={{
            margin: 0,
            padding: '12px 20px',
            color: 'var(--muted)',
            fontSize: '12px',
            textAlign: 'center',
            overflowWrap: 'anywhere',
          }}
        >
          Impact-Site-Verification: d68b4d7b-8500-49d4-a958-47da8bc88882
        </p>
      </body>
    </html>
  );
}
