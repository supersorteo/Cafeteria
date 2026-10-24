import { Component, ElementRef, OnDestroy, afterNextRender, inject, input, output, signal, viewChild } from '@angular/core';

let nextId = 0;

@Component({
  selector: 'app-modal',
  host: { '(document:keydown.escape)': 'onEscape()' },
  template: `
    <dialog #dialog class="modal" role="none" [attr.data-closing]="closing() ? '' : null"
            (cancel)="onCancel($event)" (click)="onBackdrop($event)">
      <div role="dialog" aria-modal="true" [attr.aria-labelledby]="titleId" class="modal-panel" [class]="'modal-' + size()"
           (pointerdown)="dragStart($event)" (pointermove)="dragMove($event)" (pointerup)="dragEnd($event)" (pointercancel)="dragEnd($event)">
        <div class="modal-grab" aria-hidden="true"><span></span></div>
        <header class="modal-header">
          <h2 [id]="titleId" class="font-display text-xl md:text-2xl font-black">{{ heading() }}</h2>
          @if (dismissable()) {
            <button type="button" class="modal-x" data-modal-close aria-label="Cerrar" (click)="requestClose()">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          }
        </header>
        <div class="modal-body"><ng-content /></div>
        <footer class="modal-footer"><ng-content select="[modal-footer]" /></footer>
      </div>
    </dialog>
  `,
})
export class Modal implements OnDestroy {
  readonly heading = input.required<string>();
  readonly size = input<'sm' | 'md' | 'lg' | 'full'>('md');
  readonly dismissable = input(true);
  readonly closed = output<void>();

  protected readonly titleId = `modal-title-${nextId++}`;
  protected readonly closing = signal(false);

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly native = typeof HTMLDialogElement !== 'undefined' && typeof HTMLDialogElement.prototype.showModal === 'function';
  private dragY: number | null = null;
  private dragFrom = 0;

  constructor() {
    afterNextRender(() => {
      const dialog = this.dialog().nativeElement;
      if (this.native) {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    });
  }

  ngOnDestroy(): void {
    const dialog = this.dialog().nativeElement;
    if (this.native && dialog.open) {
      dialog.close();
    }
  }

  requestClose(): void {
    if (this.closing()) {
      return;
    }
    const panel = this.dialog().nativeElement.querySelector<HTMLElement>('.modal-panel');
    if (!this.native || !panel || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.closed.emit();
      return;
    }
    this.closing.set(true);
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        this.closed.emit();
      }
    };
    panel.addEventListener('animationend', finish, { once: true });
    setTimeout(finish, 320);
  }

  protected onEscape(): void {
    if (!this.native && this.dismissable()) {
      this.requestClose();
    }
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    if (this.dismissable()) {
      this.requestClose();
    }
  }

  protected onBackdrop(event: MouseEvent): void {
    if (this.dismissable() && event.target === this.dialog().nativeElement) {
      this.requestClose();
    }
  }

  protected dragStart(event: PointerEvent): void {
    const target = event.target as HTMLElement;
    if (this.dismissable() && target.closest('.modal-grab, .modal-header') && !target.closest('button') && matchMedia('(max-width: 767px)').matches) {
      this.dragY = event.clientY;
      this.dragFrom = event.clientY;
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    }
  }

  protected dragMove(event: PointerEvent): void {
    if (this.dragY !== null) {
      const offset = Math.max(0, event.clientY - this.dragFrom);
      (event.currentTarget as HTMLElement).style.transform = `translateY(${offset}px)`;
    }
  }

  protected dragEnd(event: PointerEvent): void {
    if (this.dragY === null) {
      return;
    }
    const panel = event.currentTarget as HTMLElement;
    const offset = event.clientY - this.dragFrom;
    this.dragY = null;
    panel.style.transform = '';
    if (offset > 110) {
      this.requestClose();
    }
  }
}
