import { Component, HostListener, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { isConnectionProblem, toProblem } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { NoticeService } from '../../core/notice.service';
import { SiteAdminApi } from '../../core/site-admin.api';
import { SiteImages, SiteSettingsDetail } from '../../core/site-admin.models';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { Modal } from '../../shared/ui/modal';
import { SiteForm, applySettings, createSiteForm, toPayload } from './site-form';
import { SiteImagesEditor } from './site-images-editor';
import { SiteBrandSection, SiteBusinessSection, SiteContactSection, SiteHighlightsSection, SiteTextsSection } from './site-sections';

const MISSING_LABELS: Record<string, string> = { whatsappNumber: 'el número de WhatsApp' };

type SectionKey = 'business' | 'contact' | 'brand' | 'texts' | 'highlights' | 'images';

interface SectionCard {
  key: SectionKey;
  title: string;
  lines: string[];
  icon: string;
  chip?: { text: string; tone: 'success' | 'warning' };
  swatches?: string[];
}

const ICONS: Record<SectionKey, string> = {
  business: 'M4 20V9l8-5 8 5v11M9 20v-6h6v6',
  contact: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  brand: 'M12 3a9 9 0 1 0 0 18c1.7 0 2-1.2 1.4-2.2-.7-1.2 0-2.3 1.3-2.3H17a4 4 0 0 0 4-4c0-5-4-9.5-9-9.5zM7.5 11h.01M10 7.5h.01M14.5 7.5h.01',
  texts: 'M5 6h14M5 12h14M5 18h9',
  highlights: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7L12 3z',
  images: 'M4 5h16v14H4V5zM4 15l4.5-4.5L13 15l3-3 4 4M9 9.5h.01',
};

const TITLES: Record<SectionKey, string> = {
  business: 'Datos del negocio',
  contact: 'Contacto y horarios',
  brand: 'Colores y marca',
  texts: 'Textos de la página',
  highlights: 'Contenido destacado',
  images: 'Imágenes del sitio',
};

@Component({
  imports: [ReactiveFormsModule, ConfirmDialog, Modal, SiteImagesEditor, SiteBusinessSection, SiteContactSection, SiteBrandSection, SiteTextsSection, SiteHighlightsSection],
  selector: 'app-site-page',
  template: `
    <h1 class="font-display text-3xl md:text-4xl font-black">Mi sitio</h1>

    @switch (state()) {
      @case ('ready') {
        @if (settings(); as site) {
          @if (!isOwner()) {
            <p role="status" class="mt-4 rounded-ui-md p-4 text-sm font-bold bg-warning/15 text-ink">
              Solo el propietario puede cambiar la configuración del sitio. Tú puedes consultarla.
            </p>
          }
          @if (conflict() && !section()) {
            <div role="alert" class="mt-4 rounded-ui-md p-4 text-sm font-bold bg-warning/15 text-ink">
              La configuración cambió mientras la editabas, así que no se guardó para no pisar el otro cambio.
              <button type="button" data-reload (click)="reload()" class="underline ml-1">Recargar los datos actuales</button>
            </div>
          }

          <section aria-labelledby="publication-title" class="mt-6 card p-6 md:p-7 status-card" [class.live]="site.published">
            <div class="flex flex-col md:flex-row md:items-center gap-5">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-3">
                  <h2 id="publication-title" class="text-xs font-bold uppercase tracking-wider text-muted">Publicación</h2>
                  <span class="badge" [class.badge-success]="site.published" [class.badge-warning]="!site.published">
                    <span class="pulse-dot" [class.live]="site.published"></span>{{ site.published ? 'Publicado' : 'Borrador' }}
                  </span>
                </div>
                <p class="mt-2 font-medium text-muted">
                  @if (site.published) {
                    Tu sitio está <strong>publicado</strong>:
                    <a [href]="publicUrl()" target="_blank" rel="noopener" class="underline underline-offset-2 font-bold hover:text-primary break-all">{{ publicUrl() }}</a>
                  } @else {
                    Tu sitio está en <strong>borrador</strong>: solo tú lo ves desde el panel. Para publicarlo necesitas guardar tu número de WhatsApp.
                  }
                </p>
                @if (missing(); as list) {
                  <p role="alert" class="mt-3 text-sm font-bold text-danger">No se puede publicar todavía: falta {{ list }}.</p>
                }
                @if (isOwner() && unsaved()) {
                  <p class="mt-3 text-xs font-bold text-warning">Guarda tus cambios antes de publicar o despublicar.</p>
                }
              </div>
              @if (isOwner()) {
                <div class="flex flex-wrap gap-2">
                  @if (site.published) {
                    <button type="button" data-copy (click)="copyLink()" class="btn btn-secondary">Copiar enlace</button>
                    <button type="button" data-unpublish (click)="askUnpublish.set(true)" [disabled]="publishing() || unsaved()" class="btn btn-secondary !text-danger !border-danger/50">Despublicar</button>
                  } @else {
                    <button type="button" data-publish (click)="publish()" [disabled]="publishing() || unsaved()" class="btn btn-primary" [class.btn-loading]="publishing()">
                      {{ publishing() ? 'Publicando…' : 'Publicar sitio' }}
                    </button>
                  }
                </div>
              }
            </div>
          </section>

          <ul class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Secciones de tu sitio">
            @for (card of cards(); track card.key; let i = $index) {
              <li class="anim-fade-up min-w-0" [style.--i]="i">
                <button type="button" class="section-card" [attr.data-section]="card.key" (click)="open(card.key)">
                  <span class="section-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path [attr.d]="card.icon"/></svg>
                  </span>
                  <span class="flex-1 min-w-0 text-left">
                    <span class="flex items-center gap-2 flex-wrap">
                      <span class="font-display text-lg font-black">{{ card.title }}</span>
                      @if (card.chip; as chip) {
                        <span class="badge" [class.badge-success]="chip.tone === 'success'" [class.badge-warning]="chip.tone === 'warning'">{{ chip.text }}</span>
                      }
                    </span>
                    @for (line of card.lines; track line) {
                      <span class="block mt-1 text-sm font-medium text-muted truncate">{{ line }}</span>
                    }
                    @if (card.swatches) {
                      <span class="mt-2 flex gap-2" aria-hidden="true">
                        @for (color of card.swatches; track color) {
                          <span class="swatch" [style.background]="color"></span>
                        }
                      </span>
                    }
                  </span>
                  <span class="section-go" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
                  </span>
                  <span class="sr-only">{{ isOwner() ? 'Editar' : 'Ver' }}</span>
                </button>
              </li>
            }
          </ul>

          @if (section(); as key) {
            @if (key === 'images') {
              <app-modal heading="Imágenes del sitio" size="lg" [dismissable]="!imagesDirty()" (closed)="closeImages()">
                @if (imagesState(); as images) {
                  <app-site-images-editor [images]="images" [readonly]="!isOwner()" (saved)="onImagesSaved($event)" />
                }
                <div modal-footer class="flex justify-end">
                  <button type="button" data-close-images class="btn btn-secondary" (click)="closeImages()">Cerrar</button>
                </div>
              </app-modal>
            } @else {
              <app-modal [heading]="titleOf(key)" size="lg" [dismissable]="!saving()" (closed)="closeSection()">
                <form id="site-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
                  @switch (key) {
                    @case ('business') { <app-site-business [form]="form" [slug]="site.slug" /> }
                    @case ('contact') { <app-site-contact [form]="form" /> }
                    @case ('brand') { <app-site-brand [form]="form" /> }
                    @case ('texts') { <app-site-texts [form]="form" /> }
                    @case ('highlights') { <app-site-highlights [form]="form" /> }
                  }
                </form>
                @if (conflict()) {
                  <div role="alert" class="mt-5 rounded-ui-md p-4 text-sm font-bold bg-warning/15 text-ink">
                    La configuración cambió mientras la editabas, así que no se guardó para no pisar el otro cambio.
                    <button type="button" data-reload (click)="reload()" class="underline ml-1">Recargar los datos actuales</button>
                  </div>
                }
                @if (serverError(); as message) {
                  <p role="alert" class="mt-5 rounded-ui-md bg-danger/10 px-4 py-3 text-sm font-bold text-danger anim-fade-in">{{ message }}</p>
                }
                <div modal-footer class="flex flex-col-reverse sm:flex-row sm:items-center gap-3">
                  <span class="sm:mr-auto text-xs font-bold text-warning">
                    @if (form.dirty) { Hay cambios sin guardar }
                  </span>
                  <button type="button" data-discard class="btn btn-secondary" [disabled]="saving()" (click)="closeSection()">{{ isOwner() ? 'Cancelar' : 'Cerrar' }}</button>
                  @if (isOwner()) {
                    <button type="submit" form="site-form" data-save class="btn btn-primary" [disabled]="saving()" [class.btn-loading]="saving()">
                      {{ saving() ? 'Guardando…' : 'Guardar cambios' }}
                    </button>
                  }
                </div>
              </app-modal>
            }
          }

          @if (askDiscardImages()) {
            <app-confirm-dialog title="Descartar cambios" message="Tienes cambios en las imágenes sin guardar. Si cierras ahora, se perderán."
                                confirmLabel="Descartar" tone="danger" (confirmed)="discardImagesAndClose()" (cancelled)="askDiscardImages.set(false)" />
          }
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
        <div role="alert" class="mt-8 card p-6">
          <p class="font-bold text-danger">No pudimos cargar la configuración de tu sitio.</p>
          <button type="button" data-retry (click)="load()" class="btn btn-primary mt-4">Reintentar</button>
        </div>
      }
      @default {
        <div class="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-busy="true" aria-label="Cargando">
          <div class="skeleton h-28 sm:col-span-2 xl:col-span-3"></div>
          @for (n of [1, 2, 3, 4, 5, 6]; track n) { <div class="skeleton h-28"></div> }
          <p class="sr-only">Cargando…</p>
        </div>
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
  protected readonly isOwner = this.auth.isOwner;

  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly settings = signal<SiteSettingsDetail | null>(null);
  protected readonly imagesState = signal<SiteImages | null>(null);
  protected readonly section = signal<SectionKey | null>(null);
  protected readonly saving = signal(false);
  protected readonly publishing = signal(false);
  protected readonly conflict = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly missing = signal<string | null>(null);
  protected readonly askCurrency = signal(false);
  protected readonly askUnpublish = signal(false);
  protected readonly askDiscardImages = signal(false);
  protected readonly publicUrl = computed(() => `${this.origin}/${this.settings()?.slug ?? ''}`);

  protected readonly form: SiteForm = createSiteForm(this.fb);

  protected readonly cards = computed<SectionCard[]>(() => {
    const s = this.settings();
    if (!s) {
      return [];
    }
    const images = this.imagesState() ?? s.images;
    const count = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`;
    return [
      { key: 'business', title: TITLES.business, icon: ICONS.business, lines: [[s.name, s.descriptor].filter(Boolean).join(' · '), `${s.currency} · ${s.timezone}`] },
      {
        key: 'contact', title: TITLES.contact, icon: ICONS.contact,
        chip: s.whatsappNumber ? { text: 'WhatsApp listo', tone: 'success' } : { text: 'Falta WhatsApp', tone: 'warning' },
        lines: [s.whatsappNumber ? `+${s.whatsappNumber}` : 'Obligatorio para publicar', s.schedule?.split('\n')[0] ?? 'Sin horarios'],
      },
      { key: 'brand', title: TITLES.brand, icon: ICONS.brand, lines: [`${s.primaryColor.toUpperCase()} · ${s.accentColor.toUpperCase()}`], swatches: [s.primaryColor, s.accentColor] },
      { key: 'texts', title: TITLES.texts, icon: ICONS.texts, lines: [s.tagline || s.heroTitle?.split('\n')[0] || 'Sin personalizar', s.aboutTitle?.split('\n')[0] ?? 'Nosotros sin título'] },
      {
        key: 'highlights', title: TITLES.highlights, icon: ICONS.highlights,
        lines: [`${count(s.marqueeItems.length, 'frase', 'frases')} · ${count(s.stats.length, 'cifra', 'cifras')}`, `${count(s.highlights.length, 'espacio', 'espacios')} · ${count(s.reservationAreas.length, 'zona', 'zonas')}`],
      },
      {
        key: 'images', title: TITLES.images, icon: ICONS.images,
        lines: [images.hero ? 'Portada lista' : 'Sin portada', `Nosotros ${images.about.length} · Galería ${images.gallery.length}`],
      },
    ];
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
    return this.form.dirty || this.imagesDirty();
  }

  protected unsaved(): boolean {
    return this.hasUnsavedChanges();
  }

  protected imagesDirty(): boolean {
    return this.imagesEditor()?.hasUnsavedChanges() ?? false;
  }

  protected titleOf(key: SectionKey): string {
    return TITLES[key];
  }

  protected open(key: SectionKey): void {
    this.serverError.set(null);
    this.section.set(key);
  }

  protected closeSection(): void {
    this.discard();
    this.section.set(null);
  }

  protected closeImages(): void {
    if (this.imagesDirty()) {
      this.askDiscardImages.set(true);
      return;
    }
    this.section.set(null);
  }

  protected discardImagesAndClose(): void {
    this.askDiscardImages.set(false);
    this.section.set(null);
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
    this.section.set(null);
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
      const saved = await firstValueFrom(this.api.update(toPayload(this.form, current.version)));
      this.askCurrency.set(false);
      this.apply(saved);
      this.section.set(null);
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
    this.section.set(null);
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
    applySettings(this.form, this.fb, settings, this.isOwner());
  }
}
