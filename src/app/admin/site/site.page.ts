import { Component, HostListener, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { AbstractControl, FormArray, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { isConnectionProblem, toProblem } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { NoticeService } from '../../core/notice.service';
import { SiteAdminApi } from '../../core/site-admin.api';
import { SiteImages, SiteSettingsDetail, SiteSettingsPayload } from '../../core/site-admin.models';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { Field } from '../../shared/field';
import { HEX_COLOR, describeErrors, notBlank, supportedTimezones, timezoneValidator } from '../../shared/forms';
import { StringListEditor } from '../../shared/string-list-editor';
import { SiteImagesEditor } from './site-images-editor';

const CURRENCIES = [
  { code: 'UYU', label: 'Peso uruguayo (UYU)' },
  { code: 'USD', label: 'Dólar estadounidense (USD)' },
  { code: 'MXN', label: 'Peso mexicano (MXN)' },
  { code: 'EUR', label: 'Euro (EUR)' },
];
const LOCALES = [
  { code: 'es-UY', label: 'Español (Uruguay)' },
  { code: 'es-MX', label: 'Español (México)' },
  { code: 'es-ES', label: 'Español (España)' },
];
const MISSING_LABELS: Record<string, string> = { whatsappNumber: 'el número de WhatsApp' };

type StatGroup = FormGroup<{ label: FormControl<string>; value: FormControl<number | null> }>;
type HighlightGroup = FormGroup<{ title: FormControl<string>; description: FormControl<string> }>;

@Component({
  imports: [ReactiveFormsModule, Field, StringListEditor, SiteImagesEditor, ConfirmDialog],
  selector: 'app-site-page',
  template: `
    <h1 class="font-display text-3xl md:text-4xl font-black" style="color:var(--plum)">Mi sitio</h1>

    @switch (state()) {
      @case ('ready') {
        @if (settings(); as site) {
          @if (!isOwner()) {
            <p role="status" class="mt-4 rounded-2xl p-4 text-sm font-bold" style="background:#FFF1D6;color:var(--plum)">
              Solo el propietario puede cambiar la configuración del sitio. Tú puedes consultarla.
            </p>
          }
          @if (conflict()) {
            <div role="alert" class="mt-4 rounded-2xl p-4 text-sm font-bold" style="background:#FFF1D6;color:var(--plum)">
              La configuración cambió mientras la editabas, así que no se guardó para no pisar el otro cambio.
              <button type="button" data-reload (click)="reload()" class="underline ml-1">Recargar los datos actuales</button>
            </div>
          }

          <form [formGroup]="form" (ngSubmit)="submit()" class="mt-6 space-y-6" novalidate>
            <section aria-labelledby="business-title" class="bg-white rounded-3xl p-6 shadow-lg space-y-5">
              <h2 id="business-title" class="font-display text-xl font-black" style="color:var(--plum)">Datos del negocio</h2>
              <p class="text-sm font-medium" style="color:#5b4150">
                Dirección de tu sitio: <strong>{{ origin }}/{{ site.slug }}</strong> (no se puede cambiar).
              </p>
              <div class="grid sm:grid-cols-2 gap-5">
                <app-field label="Nombre" forId="s-name" [error]="err('name')">
                  <input id="s-name" formControlName="name" maxlength="120" class="field w-full px-4 py-3 text-sm font-medium">
                </app-field>
                <app-field label="Tipo de negocio (opcional)" forId="s-descriptor" [error]="err('descriptor')" hint="Ej. Bar &amp; Cocina">
                  <input id="s-descriptor" formControlName="descriptor" maxlength="60" class="field w-full px-4 py-3 text-sm font-medium">
                </app-field>
                <app-field label="WhatsApp" forId="s-whatsapp" [error]="err('whatsappNumber', 'Entre 8 y 15 dígitos, sin + ni espacios.')"
                           hint="Con código de país, sin + (ej. 59899123456). Obligatorio para publicar.">
                  <input id="s-whatsapp" formControlName="whatsappNumber" inputmode="numeric" class="field w-full px-4 py-3 text-sm font-medium">
                </app-field>
                <app-field label="Teléfono (opcional)" forId="s-phone" [error]="err('phone')">
                  <input id="s-phone" formControlName="phone" maxlength="30" class="field w-full px-4 py-3 text-sm font-medium">
                </app-field>
                <app-field label="Correo de contacto (opcional)" forId="s-email" [error]="err('email')">
                  <input id="s-email" type="email" formControlName="email" maxlength="254" class="field w-full px-4 py-3 text-sm font-medium">
                </app-field>
                <app-field label="Dirección (opcional)" forId="s-address" [error]="err('address')">
                  <input id="s-address" formControlName="address" maxlength="255" class="field w-full px-4 py-3 text-sm font-medium">
                </app-field>
              </div>
              <app-field label="Horarios (opcional)" forId="s-schedule" [error]="err('schedule')" hint="Una línea por franja horaria.">
                <textarea id="s-schedule" formControlName="schedule" rows="3" maxlength="500" class="field w-full px-4 py-3 text-sm font-medium resize-none"></textarea>
              </app-field>
              <div class="grid sm:grid-cols-3 gap-5">
                <app-field label="Moneda" forId="s-currency" [error]="err('currency')">
                  <select id="s-currency" formControlName="currency" class="field w-full px-4 py-3 text-sm font-medium">
                    @for (currency of currencies; track currency.code) { <option [value]="currency.code">{{ currency.label }}</option> }
                  </select>
                </app-field>
                <app-field label="Idioma y formato" forId="s-locale" [error]="err('locale')">
                  <select id="s-locale" formControlName="locale" class="field w-full px-4 py-3 text-sm font-medium">
                    @for (locale of locales; track locale.code) { <option [value]="locale.code">{{ locale.label }}</option> }
                  </select>
                </app-field>
                <app-field label="Zona horaria" forId="s-timezone" [error]="err('timezone')">
                  <input id="s-timezone" formControlName="timezone" list="timezones" maxlength="64" class="field w-full px-4 py-3 text-sm font-medium">
                  <datalist id="timezones">
                    @for (zone of timezones; track zone) { <option [value]="zone"></option> }
                  </datalist>
                </app-field>
              </div>
              <p class="text-xs font-medium" style="color:#5b4150">Cambiar la moneda no convierte los precios de tu carta: habría que actualizarlos a mano.</p>
            </section>

            <section aria-labelledby="colors-title" class="bg-white rounded-3xl p-6 shadow-lg">
              <h2 id="colors-title" class="font-display text-xl font-black" style="color:var(--plum)">Colores</h2>
              <div class="mt-4 grid sm:grid-cols-2 gap-5">
                <app-field label="Color principal" forId="s-primary" [error]="err('primaryColor', 'Usa un color con el formato #FF5C39.')">
                  <div class="flex gap-3 items-center">
                    <input type="color" [value]="form.controls.primaryColor.value" [disabled]="form.disabled" aria-label="Elegir color principal"
                           (input)="setColor('primaryColor', $event)" class="w-12 h-12 rounded-xl cursor-pointer">
                    <input id="s-primary" formControlName="primaryColor" maxlength="7" class="field flex-1 px-4 py-3 text-sm font-medium">
                  </div>
                </app-field>
                <app-field label="Color de acento" forId="s-accent" [error]="err('accentColor', 'Usa un color con el formato #0E8388.')">
                  <div class="flex gap-3 items-center">
                    <input type="color" [value]="form.controls.accentColor.value" [disabled]="form.disabled" aria-label="Elegir color de acento"
                           (input)="setColor('accentColor', $event)" class="w-12 h-12 rounded-xl cursor-pointer">
                    <input id="s-accent" formControlName="accentColor" maxlength="7" class="field flex-1 px-4 py-3 text-sm font-medium">
                  </div>
                </app-field>
              </div>
            </section>

            <section aria-labelledby="texts-title" class="bg-white rounded-3xl p-6 shadow-lg space-y-5">
              <h2 id="texts-title" class="font-display text-xl font-black" style="color:var(--plum)">Textos del sitio</h2>
              <p class="text-sm font-medium" style="color:#5b4150">
                En los títulos, pulsa Enter para cambiar de línea y rodea una palabra con *asteriscos* para resaltarla.
              </p>
              <app-field label="Frase corta de la portada (opcional)" forId="s-tagline" [error]="err('tagline')">
                <input id="s-tagline" formControlName="tagline" maxlength="160" class="field w-full px-4 py-3 text-sm font-medium">
              </app-field>
              <app-field label="Título de la portada (opcional)" forId="s-hero-title" [error]="err('heroTitle')">
                <textarea id="s-hero-title" formControlName="heroTitle" rows="2" maxlength="160" class="field w-full px-4 py-3 text-sm font-medium resize-none"></textarea>
              </app-field>
              <app-field label="Descripción de la portada (opcional)" forId="s-hero-description" [error]="err('heroDescription')">
                <textarea id="s-hero-description" formControlName="heroDescription" rows="3" maxlength="600" class="field w-full px-4 py-3 text-sm font-medium resize-none"></textarea>
              </app-field>
              <app-field label="Etiqueta sobre la foto de portada (opcional)" forId="s-hero-caption" [error]="err('heroCaption')">
                <input id="s-hero-caption" formControlName="heroCaption" maxlength="80" class="field w-full px-4 py-3 text-sm font-medium">
              </app-field>
              <app-field label="Título de «Nosotros» (opcional)" forId="s-about-title" [error]="err('aboutTitle')">
                <textarea id="s-about-title" formControlName="aboutTitle" rows="2" maxlength="120" class="field w-full px-4 py-3 text-sm font-medium resize-none"></textarea>
              </app-field>
              <app-field label="Texto de «Nosotros» (opcional)" forId="s-about-text" [error]="err('aboutText')">
                <textarea id="s-about-text" formControlName="aboutText" rows="4" maxlength="2000" class="field w-full px-4 py-3 text-sm font-medium resize-none"></textarea>
              </app-field>
              <app-field label="Texto del pie de página (opcional)" forId="s-footer" [error]="err('footerText')">
                <input id="s-footer" formControlName="footerText" maxlength="200" class="field w-full px-4 py-3 text-sm font-medium">
              </app-field>
            </section>

            <section aria-labelledby="extras-title" class="bg-white rounded-3xl p-6 shadow-lg space-y-8">
              <h2 id="extras-title" class="font-display text-xl font-black" style="color:var(--plum)">Contenido destacado</h2>

              <app-string-list-editor [array]="form.controls.marqueeItems" [max]="8" legend="Frases que se desplazan" itemLabel="Frase"
                                      addLabel="Añadir frase" [itemMaxLength]="80" [readonly]="form.disabled" />

              <fieldset>
                <legend class="text-xs font-bold uppercase tracking-widest text-teal">Cifras ({{ form.controls.stats.length }}/3)</legend>
                <ul class="mt-3 space-y-3">
                  @for (group of form.controls.stats.controls; track group; let index = $index) {
                    <li class="flex flex-wrap gap-2 items-start">
                      <input [formControl]="group.controls.label" maxlength="40" [attr.aria-label]="'Texto de la cifra ' + (index + 1)" placeholder="Años de historia"
                             class="field flex-1 min-w-[10rem] px-3 py-2 text-sm font-medium">
                      <input type="number" [formControl]="group.controls.value" min="0" max="999999" [attr.aria-label]="'Valor de la cifra ' + (index + 1)"
                             class="field w-28 px-3 py-2 text-sm font-medium">
                      @if (form.enabled) {
                        <button type="button" (click)="removeFrom(form.controls.stats, index)" [attr.aria-label]="'Quitar cifra ' + (index + 1)" class="px-2" style="color:#E63946">✕</button>
                      }
                      @if ((group.controls.label.touched || group.controls.value.touched) && group.invalid) {
                        <p role="alert" class="w-full text-xs font-bold" style="color:#E63946">Escribe un texto (máx. 40) y un valor entero entre 0 y 999999.</p>
                      }
                    </li>
                  }
                </ul>
                @if (form.enabled) {
                  <button type="button" data-add-stat (click)="addStat()" [disabled]="form.controls.stats.length >= 3"
                          class="mt-3 rounded-full border-2 px-4 py-1.5 text-xs font-bold uppercase tracking-widest disabled:opacity-40" style="border-color:var(--plum);color:var(--plum)">Añadir cifra</button>
                }
              </fieldset>

              <fieldset>
                <legend class="text-xs font-bold uppercase tracking-widest text-teal">Espacios y promociones ({{ form.controls.highlights.length }}/3)</legend>
                <ul class="mt-3 space-y-3">
                  @for (group of form.controls.highlights.controls; track group; let index = $index) {
                    <li class="grid sm:grid-cols-[1fr_2fr_auto] gap-2 items-start">
                      <input [formControl]="group.controls.title" maxlength="60" [attr.aria-label]="'Título del espacio ' + (index + 1)" placeholder="Terraza"
                             class="field px-3 py-2 text-sm font-medium">
                      <input [formControl]="group.controls.description" maxlength="200" [attr.aria-label]="'Descripción del espacio ' + (index + 1)" placeholder="Aire libre y música en vivo"
                             class="field px-3 py-2 text-sm font-medium">
                      @if (form.enabled) {
                        <button type="button" (click)="removeFrom(form.controls.highlights, index)" [attr.aria-label]="'Quitar espacio ' + (index + 1)" class="px-2" style="color:#E63946">✕</button>
                      }
                      @if ((group.controls.title.touched || group.controls.description.touched) && group.invalid) {
                        <p role="alert" class="sm:col-span-3 text-xs font-bold" style="color:#E63946">Escribe un título (máx. 60); la descripción admite hasta 200 caracteres.</p>
                      }
                    </li>
                  }
                </ul>
                @if (form.enabled) {
                  <button type="button" data-add-highlight (click)="addHighlight()" [disabled]="form.controls.highlights.length >= 3"
                          class="mt-3 rounded-full border-2 px-4 py-1.5 text-xs font-bold uppercase tracking-widest disabled:opacity-40" style="border-color:var(--plum);color:var(--plum)">Añadir espacio</button>
                }
              </fieldset>

              <app-string-list-editor [array]="form.controls.reservationAreas" [max]="8" legend="Zonas para reservar" itemLabel="Zona"
                                      addLabel="Añadir zona" [itemMaxLength]="40" [readonly]="form.disabled" />
              <app-string-list-editor [array]="form.controls.partySizes" [max]="10" legend="Opciones de personas" itemLabel="Opción"
                                      addLabel="Añadir opción" [itemMaxLength]="20" [readonly]="form.disabled" />
            </section>

            @if (serverError(); as message) {
              <p role="alert" class="text-sm font-bold" style="color:#E63946">{{ message }}</p>
            }

            @if (isOwner()) {
              <div class="flex flex-wrap items-center gap-3">
                <button type="submit" data-save [disabled]="saving()"
                        class="rounded-full bg-coral text-white px-8 py-3 text-xs font-bold uppercase tracking-widest hover:brightness-110 disabled:opacity-60">
                  {{ saving() ? 'Guardando…' : 'Guardar cambios' }}
                </button>
                <button type="button" data-discard (click)="discard()" [disabled]="!form.dirty || saving()"
                        class="rounded-full border-2 px-8 py-3 text-xs font-bold uppercase tracking-widest disabled:opacity-40"
                        style="border-color:rgba(61,29,46,.2);color:var(--plum)">Descartar cambios</button>
                @if (form.dirty) {
                  <span class="text-xs font-bold" style="color:#B7791F">Hay cambios sin guardar</span>
                }
              </div>
            }
          </form>

          @if (imagesState(); as images) {
            <div class="mt-6">
              <app-site-images-editor [images]="images" [readonly]="!isOwner()" (saved)="onImagesSaved($event)" />
            </div>
          }

          <section aria-labelledby="publication-title" class="mt-6 bg-white rounded-3xl p-6 shadow-lg border-l-8"
                   [style.borderColor]="site.published ? 'var(--teal)' : 'var(--mango)'">
            <h2 id="publication-title" class="font-display text-xl font-black" style="color:var(--plum)">Publicación</h2>
            <p class="mt-2 font-medium" style="color:#5b4150">
              @if (site.published) {
                Tu sitio está <strong>publicado</strong>:
                <a [href]="publicUrl()" target="_blank" rel="noopener" class="underline underline-offset-2 font-bold hover:text-coral">{{ publicUrl() }}</a>
              } @else {
                Tu sitio está en <strong>borrador</strong>: solo tú lo ves desde el panel. Para publicarlo necesitas guardar tu número de WhatsApp.
              }
            </p>
            @if (missing(); as list) {
              <p role="alert" class="mt-3 text-sm font-bold" style="color:#E63946">No se puede publicar todavía: falta {{ list }}.</p>
            }
            @if (isOwner()) {
              @if (unsaved()) {
                <p class="mt-3 text-xs font-bold" style="color:#B7791F">Guarda tus cambios antes de publicar o despublicar.</p>
              }
              <div class="mt-4 flex flex-wrap gap-3">
                @if (site.published) {
                  <button type="button" data-unpublish (click)="askUnpublish.set(true)" [disabled]="publishing() || unsaved()"
                          class="rounded-full border-2 px-6 py-2.5 text-xs font-bold uppercase tracking-widest disabled:opacity-40" style="border-color:#E63946;color:#E63946">Despublicar</button>
                  <button type="button" data-copy (click)="copyLink()"
                          class="rounded-full border-2 px-6 py-2.5 text-xs font-bold uppercase tracking-widest" style="border-color:var(--plum);color:var(--plum)">Copiar enlace</button>
                } @else {
                  <button type="button" data-publish (click)="publish()" [disabled]="publishing() || unsaved()"
                          class="rounded-full bg-coral text-white px-6 py-2.5 text-xs font-bold uppercase tracking-widest hover:brightness-110 disabled:opacity-50">
                    {{ publishing() ? 'Publicando…' : 'Publicar sitio' }}
                  </button>
                }
              </div>
            }
          </section>

          @if (askCurrency()) {
            <app-confirm-dialog title="Cambiar la moneda"
                                message="Cambiar la moneda no convierte los precios de tu carta: los importes actuales se conservarán tal cual y tendrás que actualizarlos a mano."
                                confirmLabel="Guardar de todos modos" busyLabel="Guardando…" tone="primary" [busy]="saving()"
                                (confirmed)="doSave()" (cancelled)="askCurrency.set(false)" />
          }
          @if (askUnpublish()) {
            <app-confirm-dialog title="Despublicar el sitio"
                                message="El sitio dejará de ser visible. Las imágenes que ya publicaste seguirán siendo accesibles para quien tenga su enlace."
                                confirmLabel="Despublicar" busyLabel="Despublicando…" [busy]="publishing()"
                                (confirmed)="unpublish()" (cancelled)="askUnpublish.set(false)" />
          }
        }
      }
      @case ('error') {
        <div role="alert" class="mt-8 bg-white rounded-3xl p-6 shadow-lg">
          <p class="font-bold" style="color:#E63946">No pudimos cargar la configuración de tu sitio.</p>
          <button type="button" data-retry (click)="load()" class="mt-4 bg-coral text-white font-bold px-6 py-2.5 rounded-full uppercase tracking-widest text-xs hover:brightness-110 transition-all">Reintentar</button>
        </div>
      }
      @default {
        <p class="mt-8 font-medium" style="color:#5b4150" role="status" aria-busy="true">Cargando…</p>
      }
    }
  `,
})
export class SitePage implements OnInit {
  private readonly api = inject(SiteAdminApi);
  private readonly auth = inject(AuthService);
  private readonly notices = inject(NoticeService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly imagesEditor = viewChild(SiteImagesEditor);

  protected readonly origin = typeof location === 'undefined' ? '' : location.origin;
  protected readonly currencies = CURRENCIES;
  protected readonly locales = LOCALES;
  protected readonly timezones = supportedTimezones();
  protected readonly isOwner = this.auth.isOwner;

  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly settings = signal<SiteSettingsDetail | null>(null);
  protected readonly imagesState = signal<SiteImages | null>(null);
  protected readonly saving = signal(false);
  protected readonly publishing = signal(false);
  protected readonly conflict = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly missing = signal<string | null>(null);
  protected readonly askCurrency = signal(false);
  protected readonly askUnpublish = signal(false);
  protected readonly publicUrl = computed(() => `${this.origin}/${this.settings()?.slug ?? ''}`);

  protected readonly form = this.fb.group({
    name: ['', [notBlank, Validators.maxLength(120)]],
    descriptor: ['', Validators.maxLength(60)],
    whatsappNumber: ['', Validators.pattern(/^\d{8,15}$/)],
    phone: ['', Validators.maxLength(30)],
    email: ['', [Validators.email, Validators.maxLength(254)]],
    address: ['', Validators.maxLength(255)],
    schedule: ['', Validators.maxLength(500)],
    currency: ['UYU', Validators.required],
    locale: ['es-UY', Validators.required],
    timezone: ['America/Montevideo', [Validators.required, Validators.maxLength(64), timezoneValidator]],
    primaryColor: ['#FF5C39', [Validators.required, Validators.pattern(HEX_COLOR)]],
    accentColor: ['#0E8388', [Validators.required, Validators.pattern(HEX_COLOR)]],
    tagline: ['', Validators.maxLength(160)],
    heroTitle: ['', Validators.maxLength(160)],
    heroDescription: ['', Validators.maxLength(600)],
    heroCaption: ['', Validators.maxLength(80)],
    aboutTitle: ['', Validators.maxLength(120)],
    aboutText: ['', Validators.maxLength(2000)],
    footerText: ['', Validators.maxLength(200)],
    marqueeItems: this.fb.array<FormControl<string>>([]),
    reservationAreas: this.fb.array<FormControl<string>>([]),
    partySizes: this.fb.array<FormControl<string>>([]),
    stats: this.fb.array<StatGroup>([]),
    highlights: this.fb.array<HighlightGroup>([]),
  });

  ngOnInit(): void {
    void this.load();
  }

  @HostListener('window:beforeunload', ['$event'])
  protected warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
    }
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty || (this.imagesEditor()?.hasUnsavedChanges() ?? false);
  }

  protected unsaved(): boolean {
    return this.hasUnsavedChanges();
  }

  protected err(name: keyof typeof this.form.controls, patternMessage?: string): string | null {
    return describeErrors(this.form.controls[name] as AbstractControl, patternMessage);
  }

  protected setColor(name: 'primaryColor' | 'accentColor', event: Event): void {
    const control = this.form.controls[name];
    control.setValue((event.target as HTMLInputElement).value.toUpperCase());
    control.markAsDirty();
  }

  protected addStat(): void {
    if (this.form.controls.stats.length >= 3) {
      return;
    }
    this.form.controls.stats.push(this.newStat('', 0));
    this.form.controls.stats.markAsDirty();
  }

  protected addHighlight(): void {
    if (this.form.controls.highlights.length >= 3) {
      return;
    }
    this.form.controls.highlights.push(this.newHighlight('', ''));
    this.form.controls.highlights.markAsDirty();
  }

  protected removeFrom(array: FormArray<StatGroup> | FormArray<HighlightGroup>, index: number): void {
    array.removeAt(index);
    array.markAsDirty();
  }

  async load(): Promise<void> {
    this.state.set('loading');
    try {
      const settings = await firstValueFrom(this.api.get());
      this.apply(settings);
      this.imagesState.set(settings.images);
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }

  protected async reload(): Promise<void> {
    this.conflict.set(false);
    await this.load();
  }

  protected discard(): void {
    const settings = this.settings();
    if (settings) {
      this.apply(settings);
      this.serverError.set(null);
      this.conflict.set(false);
    }
  }

  protected submit(): void {
    if (this.saving() || !this.isOwner()) {
      return;
    }
    this.serverError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.serverError.set('Revisa los campos marcados antes de guardar.');
      return;
    }
    if (this.form.controls.currency.value !== this.settings()?.currency) {
      this.askCurrency.set(true);
      return;
    }
    void this.doSave();
  }

  protected async doSave(): Promise<void> {
    const current = this.settings();
    if (!current || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.conflict.set(false);
    try {
      const saved = await firstValueFrom(this.api.update(this.toPayload(current.version)));
      this.askCurrency.set(false);
      this.apply(saved);
      this.notices.show('info', 'Cambios guardados.');
    } catch (error) {
      this.askCurrency.set(false);
      this.handleSaveFailure(toProblem(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected onImagesSaved(saved: SiteSettingsDetail): void {
    this.settings.update(current => (current ? { ...current, images: saved.images, version: saved.version } : saved));
    this.imagesState.set(saved.images);
    this.notices.show('info', 'Imágenes guardadas.');
  }

  protected async publish(): Promise<void> {
    await this.changePublication(true);
  }

  protected async unpublish(): Promise<void> {
    await this.changePublication(false);
    this.askUnpublish.set(false);
  }

  protected async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.publicUrl());
      this.notices.show('info', 'Enlace copiado.');
    } catch {
      this.notices.show('error', 'No se pudo copiar. Selecciona el enlace y cópialo a mano.');
    }
  }

  private async changePublication(published: boolean): Promise<void> {
    const current = this.settings();
    if (!current || this.publishing() || this.unsaved()) {
      return;
    }
    this.publishing.set(true);
    this.missing.set(null);
    try {
      const updated = await firstValueFrom(this.api.setPublication(published, current.version));
      this.settings.update(value => (value ? { ...value, published: updated.published, version: updated.version } : updated));
      this.notices.show('info', published ? 'Tu sitio ya está publicado.' : 'Tu sitio quedó en borrador.');
    } catch (error) {
      const problem = toProblem(error);
      if (problem.code === 'cannot_publish') {
        this.missing.set(problem.fieldErrors.map(f => MISSING_LABELS[f.field] ?? f.field).join(', '));
      } else if (problem.code === 'version_conflict') {
        this.conflict.set(true);
      } else if (isConnectionProblem(problem)) {
        this.notices.show('error', 'No pudimos cambiar la publicación por un problema de conexión.');
      }
    } finally {
      this.publishing.set(false);
    }
  }

  private handleSaveFailure(problem: ReturnType<typeof toProblem>): void {
    if (problem.code === 'version_conflict') {
      this.conflict.set(true);
    } else if (problem.status === 400 && problem.fieldErrors.length > 0) {
      const unmatched: string[] = [];
      for (const { field, message } of problem.fieldErrors) {
        const control = (this.form.controls as Record<string, AbstractControl>)[field];
        if (control) {
          control.setErrors({ server: message });
          control.markAsTouched();
        } else {
          unmatched.push(message);
        }
      }
      this.serverError.set(unmatched.length > 0 ? `Revisa los datos: ${unmatched.join('; ')}` : 'Revisa los campos marcados.');
    } else if (isConnectionProblem(problem)) {
      this.serverError.set('No pudimos guardar por un problema de conexión. Tus cambios siguen aquí: inténtalo de nuevo.');
    } else if (problem.status !== 403) {
      this.serverError.set('No se pudo guardar la configuración.');
    }
  }

  private apply(settings: SiteSettingsDetail): void {
    this.settings.set(settings);
    this.form.patchValue({
      name: settings.name,
      descriptor: settings.descriptor ?? '',
      whatsappNumber: settings.whatsappNumber ?? '',
      phone: settings.phone ?? '',
      email: settings.email ?? '',
      address: settings.address ?? '',
      schedule: settings.schedule ?? '',
      currency: settings.currency,
      locale: settings.locale,
      timezone: settings.timezone,
      primaryColor: settings.primaryColor.toUpperCase(),
      accentColor: settings.accentColor.toUpperCase(),
      tagline: settings.tagline ?? '',
      heroTitle: settings.heroTitle ?? '',
      heroDescription: settings.heroDescription ?? '',
      heroCaption: settings.heroCaption ?? '',
      aboutTitle: settings.aboutTitle ?? '',
      aboutText: settings.aboutText ?? '',
      footerText: settings.footerText ?? '',
    });
    this.fillStrings(this.form.controls.marqueeItems, settings.marqueeItems, 80);
    this.fillStrings(this.form.controls.reservationAreas, settings.reservationAreas, 40);
    this.fillStrings(this.form.controls.partySizes, settings.partySizes, 20);
    this.form.controls.stats.clear();
    settings.stats.forEach(stat => this.form.controls.stats.push(this.newStat(stat.label, stat.value)));
    this.form.controls.highlights.clear();
    settings.highlights.forEach(highlight => this.form.controls.highlights.push(this.newHighlight(highlight.title, highlight.description ?? '')));
    this.form.markAsPristine();
    this.form.markAsUntouched();
    if (this.isOwner()) {
      this.form.enable({ emitEvent: false });
    } else {
      this.form.disable({ emitEvent: false });
    }
  }

  private fillStrings(array: FormArray<FormControl<string>>, values: string[], maxLength: number): void {
    array.clear();
    values.forEach(value =>
      array.push(new FormControl(value, { nonNullable: true, validators: [Validators.required, Validators.maxLength(maxLength)] })),
    );
  }

  private newStat(label: string, value: number): StatGroup {
    return this.fb.group({
      label: [label, [notBlank, Validators.maxLength(40)]],
      value: [value as number | null, [Validators.required, Validators.min(0), Validators.max(999999), Validators.pattern(/^\d+$/)]],
    });
  }

  private newHighlight(title: string, description: string): HighlightGroup {
    return this.fb.group({
      title: [title, [notBlank, Validators.maxLength(60)]],
      description: [description, Validators.maxLength(200)],
    });
  }

  private toPayload(version: number): SiteSettingsPayload {
    const value = this.form.getRawValue();
    const blank = (text: string): string | null => text.trim() || null;
    return {
      name: value.name.trim(),
      descriptor: blank(value.descriptor),
      whatsappNumber: blank(value.whatsappNumber),
      phone: blank(value.phone),
      email: blank(value.email),
      address: blank(value.address),
      schedule: blank(value.schedule),
      currency: value.currency,
      locale: value.locale,
      timezone: value.timezone.trim(),
      primaryColor: value.primaryColor.trim(),
      accentColor: value.accentColor.trim(),
      tagline: blank(value.tagline),
      heroTitle: blank(value.heroTitle),
      heroDescription: blank(value.heroDescription),
      heroCaption: blank(value.heroCaption),
      aboutTitle: blank(value.aboutTitle),
      aboutText: blank(value.aboutText),
      footerText: blank(value.footerText),
      marqueeItems: value.marqueeItems.map(item => item.trim()),
      reservationAreas: value.reservationAreas.map(item => item.trim()),
      partySizes: value.partySizes.map(item => item.trim()),
      stats: value.stats.map(stat => ({ label: stat.label.trim(), value: stat.value ?? 0 })),
      highlights: value.highlights.map(highlight => ({ title: highlight.title.trim(), description: blank(highlight.description) })),
      version,
    };
  }
}
