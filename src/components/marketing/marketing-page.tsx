import Image from 'next/image';
import Link from 'next/link';
import '@fontsource/barlow-condensed/800.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import { Brand } from '@/components/ui';
import { GigsProvider } from './gigs-context';
import { HeroBoard } from './hero-board';
import { WaitlistForm } from './waitlist-form';
import { Journey } from './journey';
import { GigMap } from './gig-map';
import { Proof } from './proof';
import { RevealObserver } from './reveal-observer';
import { DataToggle } from './data-toggle';
import styles from './marketing.module.css';

const order = (i: number) => ({ '--i': i }) as React.CSSProperties;

export function MarketingPage() {
  return (
    <div className={styles.root} data-marketing-root>
      <RevealObserver />
      <GigsProvider>
        <a href="#main" className={styles.skip}>
          Skip to content
        </a>
        <header className={styles.nav}>
          <Brand />
          <nav aria-label="Site">
            <a href="#how">How it works</a>
            <a href="#shows">Shows</a>
            <Link href="/login">Sign in</Link>
            <a href="#join" className={styles.navCta}>
              Join the waitlist
            </a>
          </nav>
        </header>
        <main id="main">
          <section className={styles.hero} aria-labelledby="hero-title">
            <div className={styles.heroMain}>
              <h1 id="hero-title" className={styles.heroTitle}>
                <span>
                  <span>Every show</span>
                </span>{' '}
                <span>
                  <span>
                    worth the <em>trip.</em>
                  </span>
                </span>
              </h1>
              <p className={styles.heroSub}>
                Follow the artists you love. Encore finds their dates across Europe, links the
                tickets and shows how to get there.
              </p>
              <WaitlistForm />
              <HeroBoard />
            </div>
            <div className={styles.heroVisual}>
              <div className={styles.phone}>
                <Image
                  src="/screens/feed.png"
                  alt="The Encore feed recommending Fred again.. at Accor Arena in Paris"
                  width={780}
                  height={1688}
                  priority
                  sizes="(min-width: 1024px) 360px, 70vw"
                />
              </div>
            </div>
          </section>
          <Journey />
          <GigMap />
          <Proof />
          <section id="join" className={styles.join} aria-labelledby="join-title">
            <div className={styles.joinInner}>
              <h2 id="join-title" data-reveal>
                Boarding soon.
              </h2>
              <p data-reveal style={order(1)}>
                Encore is in a small invite-only pilot. Leave your email and home city and we will
                send your invite when there is room.
              </p>
              <div data-reveal style={order(2)}>
                <WaitlistForm withCity />
              </div>
            </div>
          </section>
        </main>
        <footer className={styles.footer}>
          <div className={styles.footerTop}>
            <Brand />
            <nav aria-label="Footer">
              <Link href="/login">Sign in</Link>
              <Link href="/app">Try the sample</Link>
              <Link href="/privacy">Privacy and sources</Link>
            </nav>
          </div>
          <p>
            Concert listings via the Ticketmaster Discovery API. Encore is an independent pilot and
            is not affiliated with the artists shown.
          </p>
          <p>© 2026 Encore</p>
        </footer>
      </GigsProvider>
      <DataToggle />
    </div>
  );
}
