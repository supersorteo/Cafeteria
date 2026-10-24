import { Directive, ElementRef, OnDestroy, OnInit, inject, input, signal } from '@angular/core';
import { prefersReducedMotion } from './reveal.directive';

@Directive({
  selector: '[appCountUp]',
  host: { '[textContent]': 'display()' },
})
export class CountUpDirective implements OnInit, OnDestroy {
  readonly appCountUp = input.required<number>();

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly current = signal<number | null>(null);
  private observer?: IntersectionObserver;
  private timer?: number;

  protected display(): string {
    return `${this.current() ?? 0}+`;
  }

  ngOnInit(): void {
    if (typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) {
      this.current.set(this.appCountUp());
      return;
    }
    this.current.set(0);
    this.observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          this.observer?.disconnect();
          this.animate(this.appCountUp());
        }
      },
      { threshold: 0.5 },
    );
    this.observer.observe(this.element);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    window.clearInterval(this.timer);
  }

  private animate(end: number): void {
    let value = 0;
    const step = Math.max(1, Math.round(end / 60));
    this.timer = window.setInterval(() => {
      value = Math.min(value + step, end);
      this.current.set(value);
      if (value >= end) {
        window.clearInterval(this.timer);
      }
    }, 24);
  }
}
