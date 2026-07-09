/**
 * useScrollReveal
 * ----------------
 * Wires up an IntersectionObserver that toggles the `cs-revealed` class on
 * any element with `class="cs-reveal"` once it becomes visible. CSS handles
 * the actual transition.
 *
 * Drop into any page with `useScrollReveal()` and decorate elements with:
 *   <h1 className="cs-reveal cs-reveal-up">…</h1>
 *   <p  className="cs-reveal cs-reveal-zoom" data-reveal-delay="120">…</p>
 *
 * Variants supported (via the second className):
 *   .cs-reveal-up    fadeInUp
 *   .cs-reveal-zoom  zoom-in
 *   .cs-reveal-scale scale + fade
 *   .cs-reveal-left  slide from the left
 *   .cs-reveal-right slide from the right
 *
 * `data-reveal-delay` (ms) staggers individual elements.
 */

import { useEffect } from 'react';

export function useScrollReveal(deps: unknown[] = []) {
  useEffect(() => {
    // If the browser doesn't support IntersectionObserver (very old), just
    // mark everything visible so content isn't trapped invisible.
    if (typeof IntersectionObserver === 'undefined') {
      document.querySelectorAll('.cs-reveal').forEach((el) => {
        el.classList.add('cs-revealed');
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const delay = parseInt(el.dataset.revealDelay || '0', 10);
            if (delay > 0) {
              window.setTimeout(() => el.classList.add('cs-revealed'), delay);
            } else {
              el.classList.add('cs-revealed');
            }
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    );

    document.querySelectorAll('.cs-reveal:not(.cs-revealed)').forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
