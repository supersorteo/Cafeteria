import { AfterViewInit, DestroyRef, Directive, ElementRef, inject } from '@angular/core';
import { NgControl } from '@angular/forms';

@Directive({
  selector: 'textarea[appAutosize]',
  host: { '(input)': 'fit()', style: 'overflow-y:hidden' },
})
export class AutosizeDirective implements AfterViewInit {
  private readonly element = inject<ElementRef<HTMLTextAreaElement>>(ElementRef).nativeElement;
  private readonly control = inject(NgControl, { optional: true, self: true });

  constructor() {
    const subscription = this.control?.valueChanges?.subscribe(() => queueMicrotask(() => this.fit()));
    inject(DestroyRef).onDestroy(() => subscription?.unsubscribe());
  }

  ngAfterViewInit(): void {
    this.fit();
    queueMicrotask(() => this.fit());
  }

  protected fit(): void {
    const element = this.element;
    element.style.height = 'auto';
    if (element.scrollHeight > 0) {
      element.style.height = `${element.scrollHeight + 2}px`;
    }
  }
}
