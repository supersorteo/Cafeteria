import { Component, ElementRef, afterNextRender, inject, input, output } from '@angular/core';
import { Modal } from './ui/modal';

@Component({
  imports: [Modal],
  selector: 'app-confirm-dialog',
  template: `
    <app-modal [heading]="title()" size="sm" [dismissable]="!busy()" (closed)="cancelled.emit()">
      <p class="font-medium text-muted">{{ message() }}</p>
      <div modal-footer class="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
        <button type="button" data-cancel autofocus (click)="cancelled.emit()" [disabled]="busy()" class="btn btn-secondary">Cancelar</button>
        <button type="button" data-confirm (click)="confirmed.emit()" [disabled]="busy()" [attr.aria-busy]="busy()"
                class="btn" [class.btn-danger]="tone() === 'danger'" [class.btn-primary]="tone() !== 'danger'">{{ busy() ? busyLabel() : confirmLabel() }}</button>
      </div>
    </app-modal>
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
