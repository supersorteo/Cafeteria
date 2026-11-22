import { Component, computed, inject, input, viewChild } from '@angular/core';
import type { Options } from 'qr-code-styling';
import { AuthService } from '../../core/auth.service';
import { buildQrOptions } from '../../core/qr-options';
import { QrStyleStore } from '../../core/qr-style.store';
import { QrCanvas } from './qr-canvas';

@Component({
  imports: [QrCanvas],
  selector: 'app-qr-thumbnail',
  template: `
    <section class="side-qr-card" aria-label="Código QR de tu sitio">
      <div class="side-qr-heading">
        <span class="side-text">QR de tu sitio</span>
        <span class="side-qr-badge" aria-hidden="true">↗</span>
      </div>
      <app-qr-canvas class="side-qr-image" [options]="options()" label="Código QR de tu sitio" />
      <button type="button" class="side-btn side-qr-download" (click)="download()" title="Descargar QR">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>
        <span class="side-text">Descargar QR</span>
      </button>
      <span class="side-text side-qr-hint">Con el diseño que guardaste</span>
    </section>
  `,
})
export class QrThumbnail {
  readonly url = input.required<string>();
  private readonly canvas = viewChild.required(QrCanvas);
  private readonly auth = inject(AuthService);
  private readonly store = inject(QrStyleStore);

  protected readonly options = computed<Partial<Options>>(() =>
    buildQrOptions(this.store.style(), this.url() || location.origin, this.auth.user()?.tenant.logoUrl ?? null, 118, 4));

  protected async download(): Promise<void> {
    await this.canvas().download('qr-deliora', 'png');
  }
}
