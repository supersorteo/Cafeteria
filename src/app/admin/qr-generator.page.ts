import { Component, DestroyRef, ElementRef, OnDestroy, afterNextRender, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import QRCodeStyling, { type CornerDotType, type CornerSquareType, type DotType, type Options } from 'qr-code-styling';
import { AuthService } from '../core/auth.service';

type BackgroundMode = 'solid' | 'transparent' | 'gradient';

@Component({
  imports: [FormsModule],
  selector: 'app-qr-generator-page',
  template: `
    <section class="qr-page max-w-6xl mx-auto">
      <header class="mb-8">
        <p class="text-xs font-bold uppercase tracking-[.18em] text-primary">Herramienta del negocio</p>
        <h1 class="mt-2 font-display text-3xl md:text-5xl font-black">Generador QR</h1>
        <p class="mt-3 max-w-2xl text-lg font-medium text-muted">Crea un código QR para que tus clientes entren directamente a la página pública de tu comercio.</p>
      </header>

      <div class="qr-generator-layout">
        <section class="qr-workspace card p-5 md:p-7" aria-labelledby="qr-preview-title">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-xs font-bold uppercase tracking-wider text-muted">Vista previa</p>
              <h2 id="qr-preview-title" class="mt-1 font-display text-2xl font-black">Tu QR listo para imprimir</h2>
            </div>
            <span class="badge badge-success">Activo</span>
          </div>
          <p class="mt-3 text-sm font-medium text-muted">Escanéalo con tu teléfono para probar el enlace antes de colocarlo en mesas, vidrieras o tarjetas.</p>
          <div class="qr-stage mt-6">
            <div #qrContainer class="qr-canvas" aria-label="Vista previa del código QR"></div>
          </div>
          <div class="mt-5 flex flex-wrap gap-3">
            <button type="button" class="btn btn-primary" (click)="download('png')">Descargar PNG</button>
            <button type="button" class="btn btn-secondary" (click)="download('svg')">Descargar SVG</button>
          </div>
        </section>

        <aside class="qr-controls card p-5 md:p-7" aria-labelledby="qr-controls-title">
          <div>
            <p class="text-xs font-bold uppercase tracking-wider text-muted">Personalización</p>
            <h2 id="qr-controls-title" class="mt-1 font-display text-2xl font-black">Ajusta el diseño</h2>
          </div>

          <label class="qr-field mt-6">
            <span>Dirección del sitio</span>
            <input class="input" type="url" [ngModel]="url()" (ngModelChange)="url.set($event)" placeholder="https://tusitio.com/mi-negocio" />
            <small>Se carga automáticamente con la dirección pública de tu comercio.</small>
          </label>

          <div class="grid gap-4 sm:grid-cols-2 mt-5">
            <label class="qr-field">
              <span>Estilo de puntos</span>
              <select class="input" [ngModel]="dotType()" (ngModelChange)="dotType.set($event)">
                <option value="square">Cuadrados</option>
                <option value="dots">Puntos</option>
                <option value="rounded">Redondeados</option>
                <option value="classy">Classy</option>
                <option value="classy-rounded">Classy redondeado</option>
                <option value="extra-rounded">Extra redondeados</option>
              </select>
            </label>
            <label class="qr-field">
              <span>Estilo de esquinas</span>
              <select class="input" [ngModel]="cornerType()" (ngModelChange)="cornerType.set($event)">
                <option value="square">Cuadradas</option>
                <option value="dot">Puntos</option>
                <option value="extra-rounded">Redondeadas</option>
              </select>
            </label>
          </div>

          <div class="grid gap-4 sm:grid-cols-2 mt-5">
            <label class="qr-field">
              <span>Color de puntos</span>
              <input class="input qr-color-input" type="color" [ngModel]="dotColor()" (ngModelChange)="dotColor.set($event)" />
            </label>
            <label class="qr-field">
              <span>Fondo</span>
              <input class="input qr-color-input" type="color" [ngModel]="backgroundColor()" (ngModelChange)="backgroundColor.set($event)" [disabled]="backgroundMode() === 'transparent'" />
            </label>
          </div>

          <fieldset class="mt-5">
            <legend class="qr-field-label">Tipo de fondo</legend>
            <div class="flex flex-wrap gap-2 mt-2">
              @for (mode of backgroundModes; track mode.value) {
                <button type="button" class="qr-choice" [class.active]="backgroundMode() === mode.value" (click)="backgroundMode.set(mode.value)">{{ mode.label }}</button>
              }
            </div>
          </fieldset>

          <div class="mt-6 pt-5 border-t border-line">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="qr-field-label">Imagen central</p>
                <p class="mt-1 text-xs font-medium text-muted">Agrega el logo de tu comercio en el centro del QR.</p>
              </div>
              @if (logo()) {
                <button type="button" class="btn btn-ghost btn-sm" (click)="clearLogo()">Quitar</button>
              }
            </div>
            <label class="qr-upload mt-3">
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" (change)="setLogo($event)" />
              <span class="qr-upload-icon" aria-hidden="true">＋</span>
              <span><strong>{{ logo() ? 'Cambiar imagen' : 'Cargar logo' }}</strong><small>PNG, JPG, WebP o SVG</small></span>
            </label>
            @if (logo()) {
              <div class="mt-3 flex items-center gap-3 rounded-ui-md bg-surface-2 p-3">
                <img class="qr-logo-thumb" [src]="logo()" alt="Vista previa del logo central" />
                <span class="text-xs font-bold text-muted">Logo central aplicado</span>
              </div>
            }
          </div>
        </aside>
      </div>
    </section>
  `,
})
export class QrGeneratorPage implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly qrContainer = viewChild.required<ElementRef<HTMLDivElement>>('qrContainer');
  private qr: QRCodeStyling | null = null;
  private initializedUrl = false;

  protected readonly url = signal('');
  protected readonly dotType = signal<DotType>('dots');
  protected readonly cornerType = signal<CornerSquareType>('dot');
  protected readonly dotColor = signal('#111827');
  protected readonly backgroundColor = signal('#ffffff');
  protected readonly backgroundMode = signal<BackgroundMode>('solid');
  protected readonly logo = signal<string | null>(null);
  protected readonly backgroundModes: { value: BackgroundMode; label: string }[] = [
    { value: 'solid', label: 'Color' },
    { value: 'transparent', label: 'Transparente' },
    { value: 'gradient', label: 'Gradiente' },
  ];
  private readonly options = computed<Partial<Options>>(() => {
    const background = this.backgroundMode();
    return {
      type: 'svg',
      width: 360,
      height: 360,
      margin: 16,
      data: this.url().trim() || 'https://deliora.app',
      image: this.logo() || undefined,
      qrOptions: { errorCorrectionLevel: 'H' },
      imageOptions: { hideBackgroundDots: true, imageSize: .25, margin: 8, crossOrigin: 'anonymous' },
      dotsOptions: { type: this.dotType(), color: this.dotColor() },
      cornersSquareOptions: { type: this.cornerType(), color: this.dotColor() },
      cornersDotOptions: { type: this.cornerType() as CornerDotType, color: this.dotColor() },
      backgroundOptions: background === 'transparent'
        ? { color: 'transparent' }
        : background === 'gradient'
          ? { gradient: { type: 'linear', rotation: 0, colorStops: [{ offset: 0, color: this.backgroundColor() }, { offset: 1, color: '#f2c46d' }] } }
          : { color: this.backgroundColor() },
    };
  });

  constructor() {
    effect(() => {
      const user = this.auth.user();
      if (user && !this.initializedUrl) {
        this.url.set(`${location.origin}/${user.tenant.slug}`);
        this.initializedUrl = true;
      }
    });
    effect(() => {
      const options = this.options();
      if (this.qr) {
        this.qr.update(options);
      }
    });
    afterNextRender(() => {
      this.qr = new QRCodeStyling(this.options());
      this.qr.append(this.qrContainer().nativeElement);
    });
    this.destroyRef.onDestroy(() => this.qr = null);
  }

  ngOnDestroy(): void {
    this.qr = null;
  }

  protected setLogo(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener('load', () => this.logo.set(typeof reader.result === 'string' ? reader.result : null), { once: true });
    reader.readAsDataURL(file);
  }

  protected clearLogo(): void {
    this.logo.set(null);
  }

  protected async download(extension: 'png' | 'svg'): Promise<void> {
    await this.qr?.download({ name: 'qr-deliora', extension });
  }
}
