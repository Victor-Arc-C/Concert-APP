/**
 * An Apple-style spring (response in seconds, damping ratio). Interruptible: retargeting keeps
 * the current velocity, so a beam swung mid-flight bends towards its new target instead of
 * restarting. Runs on requestAnimationFrame only while moving.
 */
export class Spring {
  value: number;
  target: number;
  velocity = 0;
  private raf = 0;
  private last = 0;
  constructor(
    private options: {
      value: number;
      response: number;
      damping: number;
      precision?: number;
      onUpdate: (value: number) => void;
      onRest?: (value: number) => void;
    },
  ) {
    this.value = options.value;
    this.target = options.value;
  }
  to(target: number, velocity?: number) {
    this.target = target;
    if (velocity !== undefined) this.velocity = velocity;
    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.step);
    }
  }
  set(value: number) {
    this.stop();
    this.value = this.target = value;
    this.velocity = 0;
    this.options.onUpdate(value);
    this.options.onRest?.(value);
  }
  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
  private step = (now: number) => {
    const { response, damping, precision = 0.01 } = this.options;
    const stiffness = ((2 * Math.PI) / response) ** 2;
    const friction = (4 * Math.PI * damping) / response;
    let dt = Math.min((now - this.last) / 1000, 1 / 30);
    this.last = now;
    while (dt > 0) {
      const h = Math.min(dt, 1 / 240);
      const force = -stiffness * (this.value - this.target) - friction * this.velocity;
      this.velocity += force * h;
      this.value += this.velocity * h;
      dt -= h;
    }
    if (Math.abs(this.velocity) < precision && Math.abs(this.value - this.target) < precision) {
      this.raf = 0;
      this.value = this.target;
      this.velocity = 0;
      this.options.onUpdate(this.value);
      this.options.onRest?.(this.value);
      return;
    }
    this.options.onUpdate(this.value);
    this.raf = requestAnimationFrame(this.step);
  };
}
