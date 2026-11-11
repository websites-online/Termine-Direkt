import { Directive, ElementRef, Input, OnChanges, OnDestroy, inject } from '@angular/core';

/**
 * Zählt eine Zahl hoch, sobald sie sichtbar ist.
 * <strong [countUp]="1250" countFormat="currency"></strong>
 */
@Directive({ selector: '[countUp]', standalone: true })
export class CountUpDirective implements OnChanges, OnDestroy {
  @Input('countUp') value = 0;
  @Input() countFormat: 'number' | 'currency' | 'percent' = 'number';
  @Input() countSuffix = '';

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private frame = 0;
  private observer?: IntersectionObserver;
  private started = false;

  ngOnChanges(): void {
    this.started = false;
    this.observer?.disconnect();
    this.render(0);
    if (typeof IntersectionObserver === 'undefined' || this.prefersReducedMotion()) {
      this.render(this.value);
      return;
    }
    this.observer = new IntersectionObserver((entries) => {
      if (!this.started && entries.some((entry) => entry.isIntersecting)) {
        this.started = true;
        this.observer?.disconnect();
        this.animate();
      }
    }, { threshold: 0.3 });
    this.observer.observe(this.el);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frame);
    this.observer?.disconnect();
  }

  private prefersReducedMotion(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private animate(): void {
    const target = Number(this.value) || 0;
    const duration = 1100;
    const startedAt = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      this.render(target * eased);
      if (t < 1) {
        this.frame = requestAnimationFrame(step);
      }
    };
    this.frame = requestAnimationFrame(step);
  }

  private render(current: number): void {
    const rounded = Math.round(current);
    const text =
      this.countFormat === 'currency'
        ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(rounded)
        : new Intl.NumberFormat('de-DE').format(rounded) + (this.countFormat === 'percent' ? ' %' : '');
    this.el.textContent = text + this.countSuffix;
  }
}
