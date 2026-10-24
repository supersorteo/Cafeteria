import { Directive, OnDestroy, OnInit, input, signal } from '@angular/core';
import { prefersReducedMotion } from '../reveal.directive';

@Directive({
  selector: '[appTick]',
  host: { '[textContent]': 'shown()' },
})
export class TickDirective implements OnInit, OnDestroy {
  readonly appTick = input.required<number>();

  protected readonly shown = signal(0);
  private frame?: number;

  ngOnInit(): void {
    const target = this.appTick();
    if (typeof requestAnimationFrame !== 'function' || typeof IntersectionObserver === 'undefined' || prefersReducedMotion() || target <= 0) {
      this.shown.set(target);
      return;
    }
    const start = performance.now();
    const duration = 700;
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      this.shown.set(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) {
        this.frame = requestAnimationFrame(step);
      }
    };
    this.frame = requestAnimationFrame(step);
  }

  ngOnDestroy(): void {
    if (this.frame !== undefined) {
      cancelAnimationFrame(this.frame);
    }
  }
}
