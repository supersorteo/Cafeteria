import { Component, ElementRef, afterNextRender, inject, input, output } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  host: { '(document:keydown.escape)': 'cancelled.emit()' },
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center px-4" style="background:rgba(61,29,46,.55)">
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" class="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl">
        <h2 id="confirm-title" class="font-display text-2xl font-black" style="color:var(--plum)">{{ title() }}</h2>
        <p class="mt-3 font-medium" style="color:#5b4150">{{ message() }}</p>
        <div class="mt-8 flex justify-end gap-3">
          <button type="button" data-cancel (click)="cancelled.emit()" [disabled]="busy()"
                  class="rounded-full border-2 px-6 py-2.5 text-xs font-bold uppercase tracking-widest disabled:opacity-60"
                  style="border-color:rgba(61,29,46,.2);color:var(--plum)">Cancelar</button>
          <button type="button" data-confirm (click)="confirmed.emit()" [disabled]="busy()"
                  class="rounded-full px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-white hover:brightness-110 disabled:opacity-60"
                  [style.background]="tone() === 'danger' ? '#E63946' : 'var(--coral)'">{{ busy() ? busyLabel() : confirmLabel() }}</button>
        </div>
      </div>
    </div>
  `,
})
export class ConfirmDialog {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input('Eliminar');
  readonly busyLabel = input('Procesando…');
  readonly tone = input<'danger' | 'primary'>('danger');
  readonly busy = input(false);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => host.querySelector<HTMLButtonElement>('[data-cancel]')?.focus());
  }
}
