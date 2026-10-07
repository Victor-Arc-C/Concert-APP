'use client';
import { useEffect } from 'react';

/**
 * One IntersectionObserver for the whole page. Elements marked `data-reveal` are only hidden once
 * this runs (it sets `data-motion` on the root), so content is never stuck invisible without JS.
 */
export function RevealObserver() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-marketing-root]');
    if (!root) return;
    const targets = root.querySelectorAll<HTMLElement>('[data-reveal]');
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute('data-revealed', '');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.15 },
    );
    // Anything already on screen (deep links, restored scroll) is shown without a reveal.
    for (const target of targets) {
      if (target.getBoundingClientRect().top < window.innerHeight * 0.88)
        target.setAttribute('data-revealed', '');
      else observer.observe(target);
    }
    root.setAttribute('data-motion', '');
    return () => observer.disconnect();
  }, []);
  return null;
}
