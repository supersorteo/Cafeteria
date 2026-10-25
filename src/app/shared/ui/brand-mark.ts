import { Component, computed, effect, input, signal } from '@angular/core';

export const DEFAULT_LOGO = '/logos/icon-192.png';

@Component({
  selector: 'app-brand-mark',
  host: { class: 'inline-flex shrink-0' },
  template: `<img [src]="current()" [alt]="alt()" [attr.width]="size()" [attr.height]="size()" [style.width.px]="size()" [style.height.px]="size()" class="brand-logo" (error)="failed.set(true)">`,
})
export class BrandMark {
  readonly src = input<string | null | undefined>(null);
  readonly alt = input('');
  readonly size = input(32);

  protected readonly failed = signal(false);
  protected readonly current = computed(() => (this.failed() || !this.src() ? DEFAULT_LOGO : (this.src() as string)));

  constructor() {
    effect(() => {
      this.src();
      this.failed.set(false);
    });
  }
}
