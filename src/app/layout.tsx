import type { Metadata } from 'next';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import '@fontsource/barlow-condensed/800.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import './globals.css';
export const metadata: Metadata = {
  title: 'Encore — your next great night',
  description:
    'A personal shortlist of concerts by the artists you love. Explore the Encore pilot.',
  // Home-screen app on iPhone: full screen, no Safari chrome, dark status bar over the board.
  appleWebApp: { capable: true, title: 'Encore', statusBarStyle: 'black' },
};
export const viewport = { themeColor: '#0b0d12' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
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
