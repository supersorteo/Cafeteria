import { Component, ElementRef, OnDestroy, afterNextRender, effect, input, viewChild } from '@angular/core';
import type QRCodeStyling from 'qr-code-styling';
import type { FileExtension, Options } from 'qr-code-styling';

@Component({
  selector: 'app-qr-canvas',
  host: { class: 'block' },
  template: `<div #container class="qr-canvas" role="img" [attr.aria-label]="label()"></div>`,
})
export class QrCanvas implements OnDestroy {
  readonly options = input.required<Partial<Options>>();
  readonly label = input('Código QR');
  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('container');
  private qr: QRCodeStyling | null = null;
  private destroyed = false;

  constructor() {
    afterNextRender(async () => {
      const { default: Styling } = await import('qr-code-styling');
      if (this.destroyed) {
        return;
      }
      this.qr = new Styling(this.options());
      this.qr.append(this.container().nativeElement);
    });
    effect(() => {
      const options = this.options();
      this.qr?.update(options);
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.qr = null;
  }

  async download(name: string, extension: FileExtension): Promise<void> {
    await this.qr?.download({ name, extension });
  }
}
