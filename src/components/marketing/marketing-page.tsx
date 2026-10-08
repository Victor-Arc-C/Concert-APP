import Link from 'next/link';
import { Mark, LanguageSwitch } from '@/components/ui';
import type { Locale } from '@/i18n/config';
import { dictionaries } from '@/i18n/messages';
import { GigsProvider } from './gigs-context';
import { HeroStage } from './hero-stage';
import { WaitlistForm } from './waitlist-form';
import { CueSheet } from './cue-sheet';
import { Journey } from './journey';
import { GigMap } from './gig-map';
import { RevealObserver } from './reveal-observer';
import { DataToggle } from './data-toggle';
import styles from './marketing.module.css';

const order = (i: number) => ({ '--i': i }) as React.CSSProperties;

function Logo({ label }: { label: string }) {
  return (
    <Link href="/" className={styles.logo} aria-label={label}>
      <Mark />
      <span aria-hidden="true">showbound</span>
    </Link>
  );
}

export function MarketingPage({ locale }: { locale: Locale }) {
  const t = dictionaries[locale];
  const m = t.marketing;
  return (
    <div className={styles.root} data-marketing-root>
      <RevealObserver />
      <GigsProvider>
        <a href="#main" className={styles.skip}>
          {t.common.skip}
        </a>
        <header className={styles.nav}>
          <Logo label={t.common.home} />
          <nav aria-label={m.navLabel}>
            <a href="#how">{m.how}</a>
            <a href="#shows">{m.shows}</a>
            <Link href="/login" className={styles.navKeep}>
              {m.signIn}
            </Link>
            <a href="#join" className={styles.navCta}>
              {m.join}
            </a>
          </nav>
          <LanguageSwitch />
        </header>
        <main id="main">
          <HeroStage />
          <CueSheet />
          <Journey />
          <GigMap />
          <section id="join" className={styles.join} aria-labelledby="join-title">
            <div className={styles.joinBeams} aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className={styles.joinInner}>
              <h2 id="join-title" data-reveal>
                {m.joinTitle}
              </h2>
              <p data-reveal style={order(1)}>
                {m.joinBody}
              </p>
              <div data-reveal style={order(2)}>
                <WaitlistForm withCity />
              </div>
            </div>
          </section>
        </main>
        <footer className={styles.footer}>
          <div className={styles.footerTop}>
            <Logo label={t.common.home} />
            <nav aria-label="Footer">
              <Link href="/login">{m.signIn}</Link>
              <Link href="/app">{m.trySample}</Link>
              <Link href="/privacy">{m.privacy}</Link>
            </nav>
          </div>
          <p>{m.footerNote}</p>
          <p>{m.copyright}</p>
        </footer>
      </GigsProvider>
      <DataToggle />
    </div>
  );
}
