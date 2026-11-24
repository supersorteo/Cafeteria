import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import type { Options } from 'qr-code-styling';
import { toProblem } from '../core/api-error';
import { AuthService } from '../core/auth.service';
import { NoticeService } from '../core/notice.service';
import { buildQrOptions } from '../core/qr-options';
import { DEFAULT_QR_STYLE, QrBackgroundMode, QrCornerType, QrDotType, QrStyle, QrStyleApi } from '../core/qr-style.api';
import { QrCanvas } from '../shared/ui/qr-canvas';

@Component({
  imports: [FormsModule, QrCanvas],
  selector: 'app-qr-generator-page',
  template: `
    <section class="qr-page max-w-6xl mx-auto">
      <header class="mb-5 md:mb-8">
        <p class="text-xs font-bold uppercase tracking-[.18em] text-primary">Herramienta del negocio</p>
        <h1 class="mt-1 md:mt-2 font-display text-3xl md:text-5xl font-black">Generador QR</h1>
        <p class="mt-2 md:mt-3 max-w-2xl text-sm md:text-lg font-medium text-muted">Crea un código QR para que tus clientes entren directo a tu página pública.</p>
      </header>

      <div class="qr-generator-layout">
        <section class="qr-workspace card p-4 md:p-7" aria-labelledby="qr-preview-title">
          <div class="qr-head flex items-center justify-between gap-3">
            <div>
              <p class="text-xs font-bold uppercase tracking-wider text-muted">Vista previa</p>
              <h2 id="qr-preview-title" class="qr-title mt-1 font-display text-xl md:text-2xl font-black">Tu QR listo para imprimir</h2>
            </div>
            <span class="qr-badge badge badge-success shrink-0">Activo</span>
          </div>
          <p class="qr-lead mt-3 hidden md:block text-sm font-medium text-muted">Escanéalo con tu teléfono para probar el enlace antes de colocarlo en mesas, vidrieras o tarjetas.</p>
          <div class="qr-stage mt-4 md:mt-6">
            <app-qr-canvas [options]="options()" label="Vista previa del código QR" />
          </div>
          <div class="qr-actions mt-4 md:mt-5 grid grid-cols-2 gap-3 md:flex md:flex-wrap">
            <button type="button" class="btn btn-primary w-full md:w-auto" (click)="download('png')"><span class="hidden sm:inline">Descargar&nbsp;</span>PNG</button>
            <button type="button" class="btn btn-secondary w-full md:w-auto" (click)="download('svg')"><span class="hidden sm:inline">Descargar&nbsp;</span>SVG</button>
          </div>
        </section>

        <aside class="qr-controls card p-4 md:p-7" aria-labelledby="qr-controls-title">
          <div>
            <p class="text-xs font-bold uppercase tracking-wider text-muted">Personalización</p>
            <h2 id="qr-controls-title" class="mt-1 font-display text-xl md:text-2xl font-black">Ajusta el diseño</h2>
          </div>

          <label class="qr-field mt-4 md:mt-6">
            <span>Dirección del sitio</span>
            <input class="input" type="url" inputmode="url" autocapitalize="off" [ngModel]="url()" (ngModelChange)="url.set($event)" placeholder="https://tusitio.com/mi-negocio" />
            <small class="hidden md:block">Se carga automáticamente con la dirección pública de tu comercio.</small>
          </label>

          <fieldset class="min-w-0 border-0 p-0 m-0" data-qr-style>
          <div class="grid grid-cols-2 gap-3 md:gap-4 mt-4 md:mt-5">
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

          <div class="grid grid-cols-2 gap-3 md:gap-4 mt-4 md:mt-5">
            <label class="qr-field">
              <span>Color de puntos</span>
              <input class="input qr-color-input" type="color" [ngModel]="dotColor()" (ngModelChange)="dotColor.set($event)" />
            </label>
            <label class="qr-field">
              <span>Fondo</span>
              <input class="input qr-color-input" type="color" [ngModel]="backgroundColor()" (ngModelChange)="backgroundColor.set($event)" [disabled]="backgroundMode() === 'transparent'" />
            </label>
          </div>

          <fieldset class="mt-4 md:mt-5">
            <legend class="qr-field-label">Tipo de fondo</legend>
            <div class="grid grid-cols-3 gap-2 mt-2 md:flex md:flex-wrap">
              @for (mode of backgroundModes; track mode.value) {
                <button type="button" class="qr-choice" [class.active]="backgroundMode() === mode.value" (click)="backgroundMode.set(mode.value)">{{ mode.label }}</button>
              }
            </div>
          </fieldset>

          <div class="mt-4 md:mt-6 pt-4 md:pt-5 border-t border-line">
            <label class="flex items-start gap-3">
              <input type="checkbox" class="mt-1" [checked]="useLogo()" [disabled]="!logoUrl()" (change)="useLogo.set($any($event.target).checked)" data-qr-logo>
              <span>
                <span class="qr-field-label block">Logo de tu negocio en el centro</span>
                <span class="mt-1 block text-xs font-medium text-muted">
                  {{ logoUrl() ? 'Usa el logo que ya subiste en la configuración de tu sitio.' : 'Sube primero el logo de tu negocio en Configuración.' }}
                </span>
              </span>
            </label>
          </div>
          </fieldset>

          @if (canSave()) {
            <button type="button" class="btn btn-primary mt-6 w-full" data-qr-save [disabled]="saving()" (click)="save()">{{ saving() ? 'Guardando…' : 'Guardar diseño' }}</button>
          } @else {
            <p class="mt-6 text-xs font-medium text-muted" data-qr-readonly>Solo el dueño puede guardar el diseño del QR con el plan vigente.</p>
          }
        </aside>
      </div>
    </section>
  `,
})
export class QrGeneratorPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly api = inject(QrStyleApi);
  private readonly notices = inject(NoticeService);
  private readonly canvas = viewChild.required(QrCanvas);

  protected readonly url = signal(`${location.origin}/${this.auth.user()?.tenant.slug ?? ''}?src=qr`);
  protected readonly dotType = signal<QrDotType>(DEFAULT_QR_STYLE.dotType);
  protected readonly cornerType = signal<QrCornerType>(DEFAULT_QR_STYLE.cornerType);
  protected readonly dotColor = signal(DEFAULT_QR_STYLE.dotColor);
  protected readonly backgroundColor = signal(DEFAULT_QR_STYLE.backgroundColor);
  protected readonly backgroundMode = signal<QrBackgroundMode>(DEFAULT_QR_STYLE.backgroundMode);
  protected readonly useLogo = signal(DEFAULT_QR_STYLE.useLogo);
  protected readonly saving = signal(false);

  protected readonly canSave = computed(() => this.auth.canEditSite());
  protected readonly logoUrl = computed(() => this.auth.user()?.tenant.logoUrl ?? null);
  protected readonly backgroundModes: { value: QrBackgroundMode; label: string }[] = [
    { value: 'solid', label: 'Color' },
    { value: 'transparent', label: 'Transparente' },
    { value: 'gradient', label: 'Gradiente' },
  ];

  protected readonly options = computed<Partial<Options>>(() => {
    const style: QrStyle = { dotType: this.dotType(), cornerType: this.cornerType(), dotColor: this.dotColor(), backgroundMode: this.backgroundMode(), backgroundColor: this.backgroundColor(), useLogo: this.useLogo() };
    return buildQrOptions(style, this.url().trim() || location.origin, this.logoUrl(), 360, 16);
  });

  async ngOnInit(): Promise<void> {
    try {
      const saved = await firstValueFrom(this.api.get());
      this.dotType.set(saved.dotType ?? DEFAULT_QR_STYLE.dotType);
      this.cornerType.set(saved.cornerType ?? DEFAULT_QR_STYLE.cornerType);
      this.dotColor.set(saved.dotColor ?? DEFAULT_QR_STYLE.dotColor);
      this.backgroundMode.set(saved.backgroundMode ?? DEFAULT_QR_STYLE.backgroundMode);
      this.backgroundColor.set(saved.backgroundColor ?? DEFAULT_QR_STYLE.backgroundColor);
      this.useLogo.set(saved.useLogo);
    } catch {
      this.notices.show('error', 'No pudimos cargar tu diseño guardado. Puedes seguir editando.');
    }
  }

  protected async save(): Promise<void> {
    if (this.saving() || !this.canSave()) {
      return;
    }
    this.saving.set(true);
    try {
      await firstValueFrom(this.api.save({
        dotType: this.dotType(), cornerType: this.cornerType(), dotColor: this.dotColor(),
        backgroundMode: this.backgroundMode(), backgroundColor: this.backgroundColor(), useLogo: this.useLogo(),
      }));
      await this.auth.refreshUser();
      this.notices.show('info', 'Diseño del QR guardado.');
    } catch (error) {
      const problem = toProblem(error);
      this.notices.show('error', problem.code === 'plan_feature_unavailable'
        ? 'Tu plan no incluye personalizar el QR.'
        : problem.code === 'plan_expired' ? 'Tu plan venció. Renuévalo para guardar cambios.' : 'No se pudo guardar el diseño.');
    } finally {
      this.saving.set(false);
    }
  }

  protected async download(extension: 'png' | 'svg'): Promise<void> {
    await this.canvas().download('qr-deliora', extension);
  }
}
