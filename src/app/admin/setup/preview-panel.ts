import { Component, ElementRef, effect, input, model, signal, viewChild } from '@angular/core';
import { wideScreen } from '../../core/wide-screen';
import { SitePreview } from './site-preview';
import { PreviewTarget } from './setup-steps';

const CLOSE_MS = 220;

@Component({
  imports: [SitePreview],
  selector: 'app-preview-panel',
  host: { '[class.contents]': '!docked()', '[class.block]': 'docked()' },
  template: `
    @if (open()) {
      @if (docked()) {
        <aside class="preview-dock anim-fade-in" aria-label="Vista previa de tu página">
          <header class="preview-head">
            <h3 class="font-display text-lg font-black">Vista previa</h3>
            <button type="button" class="icon-btn" data-close-preview (click)="close()" aria-label="Cerrar vista previa">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          </header>
          <app-site-preview [target]="target()" />
        </aside>
      } @else {
        <div class="drawer-backdrop" [class.closing]="closing()" (click)="close()" aria-hidden="true"></div>
        <aside #drawer class="drawer" [class.closing]="closing()" role="dialog" aria-label="Vista previa de tu página" tabindex="-1" (keydown.escape)="onEscape($event)">
          <header class="preview-head">
            <h3 class="font-display text-lg font-black">Vista previa</h3>
            <button type="button" class="icon-btn" data-close-preview (click)="close()" aria-label="Cerrar vista previa">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          </header>
          <div class="drawer-body">
            <app-site-preview [target]="target()" />
          </div>
        </aside>
      }
    }
  `,
})
export class PreviewPanel {
  readonly open = model(false);
  readonly target = input<PreviewTarget>('top');

  protected readonly docked = wideScreen();
  protected readonly closing = signal(false);
  private readonly drawer = viewChild<ElementRef<HTMLElement>>('drawer');

  constructor() {
    effect(() => {
      const drawer = this.drawer();
      if (drawer) {
        queueMicrotask(() => drawer.nativeElement.focus({ preventScroll: true }));
      }
    });
  }

  protected close(): void {
    if (this.docked() || typeof matchMedia !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.open.set(false);
      return;
    }
    this.closing.set(true);
    setTimeout(() => {
      this.open.set(false);
      this.closing.set(false);
    }, CLOSE_MS);
  }

  protected onEscape(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.close();
  }
}
