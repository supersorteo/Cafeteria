import { Directive, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

@Directive({ selector: '.reveal' })
export class RevealDirective implements OnInit, OnDestroy {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private observer?: IntersectionObserver;

  ngOnInit(): void {
    if (typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) {
      this.element.classList.add('visible');
      return;
    }
    this.observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          this.element.classList.add('visible');
          this.observer?.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    this.observer.observe(this.element);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
