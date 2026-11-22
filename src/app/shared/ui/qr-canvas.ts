import { Component, ElementRef, OnDestroy, afterNextRender, effect, input, viewChild } from '@angular/core';
import QRCodeStyling, { type FileExtension, type Options } from 'qr-code-styling';

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

  constructor() {
    afterNextRender(() => {
      this.qr = new QRCodeStyling(this.options());
      this.qr.append(this.container().nativeElement);
    });
    effect(() => {
      const options = this.options();
      this.qr?.update(options);
    });
  }

  ngOnDestroy(): void {
    this.qr = null;
  }

  async download(name: string, extension: FileExtension): Promise<void> {
    await this.qr?.download({ name, extension });
  }
}
