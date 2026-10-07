// Shared helpers for the three direction prototypes. No dependencies.
(() => {
  const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');

  const dateParts = (iso) => {
    const d = new Date(`${iso}T12:00:00Z`);
    const f = (o) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...o }).format(d);
    return {
      dow: f({ weekday: 'short' }),
      day: f({ day: 'numeric' }),
      dd: f({ day: '2-digit' }),
      mm: f({ month: '2-digit' }),
      mon: f({ month: 'short' }),
      month: f({ month: 'long' }),
      year: f({ year: 'numeric' }),
      full: f({ weekday: 'short', day: 'numeric', month: 'short' }),
    };
  };

  const money = (price) => {
    if (price === null || price === undefined || !Number.isFinite(price)) return null;
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: Number.isInteger(price) ? 0 : 2,
    }).format(price);
  };

  // Grapheme-safe initials: first letter of the first and last words.
  const initials = (name) => {
    const seg = new Intl.Segmenter('en', { granularity: 'grapheme' });
    const words = name
      .replace(/[&+!.,]/g, ' ')
      .split(/\s+/)
      .filter((w) => w && !['de', 'the', 'and', 'of', 'et', 'la', 'le'].includes(w.toLowerCase()));
    const first = (w) => [...seg.segment(w)][0]?.segment ?? '';
    if (words.length === 0) return '?';
    if (words.length === 1) return [...seg.segment(words[0])].slice(0, 2).map((s) => s.segment).join('').toUpperCase();
    return (first(words[0]) + first(words[words.length - 1])).toUpperCase();
  };

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // Apple-style spring: response (s) and damping ratio, interruptible, carries velocity on retarget.
  class Spring {
    constructor({ value = 0, response = 0.4, damping = 1, precision = 0.01, onUpdate, onRest } = {}) {
      Object.assign(this, { value, target: value, velocity: 0, response, damping, precision, onUpdate, onRest });
      this.raf = 0;
    }
    to(target, { velocity, response, damping } = {}) {
      this.target = target;
      if (velocity !== undefined) this.velocity = velocity;
      if (response) this.response = response;
      if (damping !== undefined) this.damping = damping;
      if (reduceQuery.matches) return this.set(target);
      if (!this.raf) {
        this.last = performance.now();
        this.raf = requestAnimationFrame((t) => this.step(t));
      }
      return this;
    }
    set(value) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.value = this.target = value;
      this.velocity = 0;
      this.onUpdate?.(value);
      this.onRest?.(value);
      return this;
    }
    stop() {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    step(now) {
      const k = (2 * Math.PI / this.response) ** 2;
      const c = (4 * Math.PI * this.damping) / this.response;
      let dt = Math.min((now - this.last) / 1000, 1 / 30);
      this.last = now;
      while (dt > 0) {
        const h = Math.min(dt, 1 / 240);
        const a = -k * (this.value - this.target) - c * this.velocity;
        this.velocity += a * h;
        this.value += this.velocity * h;
        dt -= h;
      }
      this.onUpdate?.(this.value);
      if (Math.abs(this.velocity) < this.precision && Math.abs(this.value - this.target) < this.precision) {
        this.raf = 0;
        this.value = this.target;
        this.onUpdate?.(this.value);
        this.onRest?.(this.value);
        return;
      }
      this.raf = requestAnimationFrame((t) => this.step(t));
    }
  }

  // Apple's momentum projection (Designing Fluid Interfaces).
  const project = (velocity, rate = 0.998) => ((velocity / 1000) * rate) / (1 - rate);

  // A photo slot with an intentional fallback when the URL is missing or fails.
  const photo = (show, cls = '') => {
    const fallback = `<span class="ph-fallback" aria-hidden="true">${esc(initials(show.artist))}</span>`;
    if (!show.photo) return `<span class="ph ${cls} is-missing">${fallback}</span>`;
    return `<span class="ph ${cls}"><img src="${esc(show.photo)}" alt="" loading="lazy" decoding="async" onerror="this.parentNode.classList.add('is-missing');this.remove()">${fallback}</span>`;
  };

  // break-ui toggle: dev chrome only, plain on purpose, never part of the design under test.
  const mountDataToggle = () => {
    if (window.PROTO.embed) return;
    const bar = document.createElement('nav');
    bar.className = 'data-toggle';
    bar.setAttribute('aria-label', 'Prototype data');
    const labels = { demo: 'Demo data', worst: 'Worst case', empty: 'Empty', error: 'Error' };
    bar.innerHTML = Object.entries(labels)
      .map(([key, label]) => {
        const url = new URL(location.href);
        url.searchParams.set('data', key);
        return `<a href="${url.pathname}${url.search}" ${window.PROTO.mode === key ? 'aria-current="page"' : ''}>${label}</a>`;
      })
      .join('');
    document.body.append(bar);
  };

  window.P = { dateParts, money, initials, esc, Spring, project, photo, mountDataToggle, reduceQuery };
})();
