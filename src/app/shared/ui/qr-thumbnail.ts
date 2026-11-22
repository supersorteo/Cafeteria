import { Component, computed, input, viewChild } from '@angular/core';
import type { Options } from 'qr-code-styling';
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
      <span class="side-text side-qr-hint">PNG listo para imprimir</span>
    </section>
  `,
})
export class QrThumbnail {
  readonly url = input.required<string>();
  private readonly canvas = viewChild.required(QrCanvas);

  protected readonly options = computed<Partial<Options>>(() => ({
    type: 'svg',
    width: 118,
    height: 118,
    margin: 4,
    data: this.url() || location.origin,
    qrOptions: { errorCorrectionLevel: 'H' },
    dotsOptions: { type: 'dots', color: '#2A1420' },
    cornersSquareOptions: { type: 'extra-rounded', color: '#2A1420' },
    cornersDotOptions: { type: 'dot', color: '#2A1420' },
    backgroundOptions: { color: '#ffffff' },
  }));

  protected async download(): Promise<void> {
    await this.canvas().download('qr-deliora', 'png');
  }
}
