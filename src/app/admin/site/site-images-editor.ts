import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { isConnectionProblem, toProblem } from '../../core/api-error';
import { CatalogApi } from '../../core/catalog.api';
import { SiteAdminApi } from '../../core/site-admin.api';
import { SiteImages, SiteSettingsDetail } from '../../core/site-admin.models';
import { ACCEPTED_IMAGE_TYPES, validateImageFile } from '../menu/menu.store';

type Block = 'hero' | 'about' | 'gallery';

interface Slot {
  id: string;
  url: string;
  alt: string;
  fresh: boolean;
}

export const MAX_ABOUT = 3;
export const MAX_GALLERY = 6;

@Component({
  selector: 'app-site-images-editor',
  template: `
    <section aria-label="Imágenes del sitio">
      <p class="text-sm font-medium text-muted">
        Las imágenes publicadas son públicas: cualquiera con su enlace puede verlas, aunque despubliques el sitio.
      </p>

      <div class="mt-6 space-y-8">
        <div>
          <h3 class="text-xs font-bold uppercase tracking-wider text-muted">Portada (1)</h3>
          <div class="mt-3 flex items-center gap-4">
            @if (hero(); as slot) {
              <img [src]="slot.url" alt="Imagen de portada" class="w-28 h-20 rounded-ui-md object-cover">
              @if (!readonly()) {
                <button type="button" data-remove-hero (click)="removeHero()" class="btn btn-ghost btn-sm text-danger">Quitar</button>
              }
            } @else {
              <div class="w-28 h-20 rounded-ui-md flex items-center justify-center text-xs font-bold bg-surface-2 text-muted">Sin imagen</div>
            }
            @if (!readonly()) {
              <label for="img-hero" class="btn btn-secondary btn-sm cursor-pointer">{{ hero() ? 'Cambiar' : 'Subir' }}</label>
              <input id="img-hero" type="file" class="sr-only" [accept]="accepted" [disabled]="uploading() !== null" (change)="choose('hero', $event)">
            }
          </div>
        </div>

        <div>
          <h3 class="text-xs font-bold uppercase tracking-wider text-muted">Nosotros ({{ about().length }}/{{ maxAbout }})</h3>
          <ul class="mt-3 flex flex-wrap gap-4">
            @for (slot of about(); track slot.id; let index = $index; let first = $first; let last = $last) {
              <li class="w-28">
                <img [src]="slot.url" [alt]="'Imagen de nosotros ' + (index + 1)" class="w-28 h-20 rounded-ui-md object-cover">
                @if (!readonly()) {
                  <div class="mt-1 flex justify-between text-sm">
                    <button type="button" (click)="move('about', index, -1)" [disabled]="first" [attr.aria-label]="'Mover nosotros ' + (index + 1) + ' a la izquierda'" class="disabled:opacity-30">←</button>
                    <button type="button" (click)="move('about', index, 1)" [disabled]="last" [attr.aria-label]="'Mover nosotros ' + (index + 1) + ' a la derecha'" class="disabled:opacity-30">→</button>
                    <button class="text-danger" type="button" (click)="removeAbout(index)" [attr.aria-label]="'Quitar nosotros ' + (index + 1)">✕</button>
                  </div>
                }
              </li>
            }
          </ul>
          @if (!readonly()) {
            <label for="img-about" class="btn btn-secondary btn-sm mt-3"
                   [class.opacity-40]="about().length >= maxAbout" [class.cursor-pointer]="about().length < maxAbout">+ Añadir imagen</label>
            <input id="img-about" type="file" class="sr-only" [accept]="accepted" [disabled]="uploading() !== null || about().length >= maxAbout" (change)="choose('about', $event)">
          }
        </div>

        <div>
          <h3 class="text-xs font-bold uppercase tracking-wider text-muted">Galería ({{ gallery().length }}/{{ maxGallery }})</h3>
          <ul class="mt-3 grid sm:grid-cols-2 gap-4">
            @for (slot of gallery(); track slot.id; let index = $index; let first = $first; let last = $last) {
              <li class="flex gap-3 items-start">
                <img [src]="slot.url" [alt]="slot.alt || 'Imagen de galería ' + (index + 1)" class="w-24 h-20 rounded-ui-md object-cover shrink-0">
                <div class="flex-1 min-w-0">
                  <label [for]="'alt-' + slot.id" class="sr-only">Texto alternativo de la imagen {{ index + 1 }}</label>
                  <input [id]="'alt-' + slot.id" [value]="slot.alt" maxlength="200" placeholder="Descripción (accesibilidad)" [disabled]="readonly()"
                         (input)="setAlt(index, $any($event.target).value)" class="input w-full px-3 py-2 text-xs font-medium">
                  @if (!readonly()) {
                    <div class="mt-1 flex gap-3 text-sm">
                      <button type="button" (click)="move('gallery', index, -1)" [disabled]="first" [attr.aria-label]="'Subir galería ' + (index + 1)" class="disabled:opacity-30">↑</button>
                      <button type="button" (click)="move('gallery', index, 1)" [disabled]="last" [attr.aria-label]="'Bajar galería ' + (index + 1)" class="disabled:opacity-30">↓</button>
                      <button class="text-danger" type="button" (click)="removeGallery(index)" [attr.aria-label]="'Quitar galería ' + (index + 1)">✕</button>
                    </div>
                  }
                </div>
              </li>
            }
          </ul>
          @if (!readonly()) {
            <label for="img-gallery" class="btn btn-secondary btn-sm mt-3"
                   [class.opacity-40]="gallery().length >= maxGallery" [class.cursor-pointer]="gallery().length < maxGallery">+ Añadir imagen</label>
            <input id="img-gallery" type="file" class="sr-only" [accept]="accepted" [disabled]="uploading() !== null || gallery().length >= maxGallery" (change)="choose('gallery', $event)">
          }
        </div>
      </div>

      @if (uploading() !== null) {
        <div class="mt-5" role="progressbar" aria-label="Subiendo imagen" aria-valuemin="0" aria-valuemax="100" [attr.aria-valuenow]="progress()">
          <div class="h-2 rounded-full bg-surface-2"><div class="h-2 rounded-full bg-primary" [style.width.%]="progress()"></div></div>
          <p class="mt-1 text-xs font-bold text-muted">Subiendo… {{ progress() }}%</p>
        </div>
      }
      @if (message(); as text) {
        <p role="alert" class="mt-4 text-sm font-bold text-danger">{{ text }}</p>
      }

      @if (!readonly()) {
        <div class="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" data-save-images (click)="save()" [disabled]="!dirty() || saving() || uploading() !== null"
                  class="btn btn-primary" [class.btn-loading]="saving()">
            {{ saving() ? 'Guardando…' : 'Guardar imágenes' }}
          </button>
          <button type="button" data-discard-images (click)="discard()" [disabled]="!dirty() || saving()"
                  class="btn btn-secondary">Descartar cambios</button>
          @if (dirty()) {
            <span class="text-xs font-bold text-warning">Hay cambios sin guardar</span>
          }
        </div>
      }
    </section>
  `,
})
export class SiteImagesEditor {
  readonly images = input.required<SiteImages>();
  readonly readonly = input(false);
  readonly saved = output<SiteSettingsDetail>();

  private readonly catalog = inject(CatalogApi);
  private readonly api = inject(SiteAdminApi);

  protected readonly accepted = ACCEPTED_IMAGE_TYPES.join(',');
  protected readonly maxAbout = MAX_ABOUT;
  protected readonly maxGallery = MAX_GALLERY;
  protected readonly hero = signal<Slot | null>(null);
  protected readonly about = signal<Slot[]>([]);
  protected readonly gallery = signal<Slot[]>([]);
  protected readonly dirty = signal(false);
  protected readonly saving = signal(false);
  protected readonly uploading = signal<Block | null>(null);
  protected readonly progress = signal(0);
  protected readonly message = signal<string | null>(null);

  readonly hasUnsavedChanges = computed(() => this.dirty());

  constructor() {
    effect(() => this.load(this.images()));
  }

  protected choose(block: Block, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    const invalid = validateImageFile(file);
    if (invalid) {
      this.message.set(invalid);
      return;
    }
    this.message.set(null);
    this.uploading.set(block);
    this.progress.set(0);
    this.catalog.upload(file).subscribe({
      next: uploadEvent => {
        if (uploadEvent.kind === 'progress') {
          this.progress.set(uploadEvent.percent);
          return;
        }
        this.place(block, { id: uploadEvent.media.id, url: uploadEvent.media.url, alt: '', fresh: true });
      },
      error: error => {
        this.uploading.set(null);
        this.message.set(this.uploadMessage(toProblem(error)));
      },
      complete: () => this.uploading.set(null),
    });
  }

  protected setAlt(index: number, alt: string): void {
    this.gallery.update(list => list.map((slot, i) => (i === index ? { ...slot, alt } : slot)));
    this.dirty.set(true);
  }

  protected move(block: 'about' | 'gallery', index: number, delta: -1 | 1): void {
    const target = index + delta;
    const signalOf = block === 'about' ? this.about : this.gallery;
    const list = [...signalOf()];
    if (target < 0 || target >= list.length) {
      return;
    }
    [list[index], list[target]] = [list[target], list[index]];
    signalOf.set(list);
    this.dirty.set(true);
  }

  protected removeHero(): void {
    this.discardIfFresh(this.hero());
    this.hero.set(null);
    this.dirty.set(true);
  }

  protected removeAbout(index: number): void {
    this.discardIfFresh(this.about()[index]);
    this.about.update(list => list.filter((_, i) => i !== index));
    this.dirty.set(true);
  }

  protected removeGallery(index: number): void {
    this.discardIfFresh(this.gallery()[index]);
    this.gallery.update(list => list.filter((_, i) => i !== index));
    this.dirty.set(true);
  }

  protected async save(): Promise<void> {
    if (this.saving() || !this.dirty()) {
      return;
    }
    this.saving.set(true);
    this.message.set(null);
    try {
      const settings = await firstValueFrom(
        this.api.saveImages({
          hero: this.hero()?.id ?? null,
          about: this.about().map(slot => slot.id),
          gallery: this.gallery().map(slot => ({ mediaId: slot.id, alt: slot.alt.trim() || null })),
        }),
      );
      this.dirty.set(false);
      this.saved.emit(settings);
    } catch (error) {
      const problem = toProblem(error);
      if (problem.status === 400) {
        this.message.set('Alguna imagen ya no está disponible. Descarta los cambios y vuelve a intentarlo.');
      } else if (isConnectionProblem(problem)) {
        this.message.set('No pudimos guardar por un problema de conexión. Tus cambios siguen aquí: inténtalo de nuevo.');
      } else if (problem.status !== 403) {
        this.message.set('No se pudieron guardar las imágenes.');
      }
    } finally {
      this.saving.set(false);
    }
  }

  protected discard(): void {
    [this.hero(), ...this.about(), ...this.gallery()].forEach(slot => this.discardIfFresh(slot));
    this.load(this.images());
    this.message.set(null);
  }

  private place(block: Block, slot: Slot): void {
    if (block === 'hero') {
      this.discardIfFresh(this.hero());
      this.hero.set(slot);
    } else if (block === 'about') {
      this.about.update(list => [...list, slot].slice(0, MAX_ABOUT));
    } else {
      this.gallery.update(list => [...list, slot].slice(0, MAX_GALLERY));
    }
    this.dirty.set(true);
  }

  private load(images: SiteImages): void {
    this.hero.set(images.hero ? { id: images.hero.id, url: images.hero.url, alt: '', fresh: false } : null);
    this.about.set(images.about.map(image => ({ id: image.id, url: image.url, alt: '', fresh: false })));
    this.gallery.set(images.gallery.map(image => ({ id: image.id, url: image.url, alt: image.alt ?? '', fresh: false })));
    this.dirty.set(false);
  }

  private discardIfFresh(slot: Slot | null | undefined): void {
    if (slot?.fresh) {
      void firstValueFrom(this.catalog.deleteMedia(slot.id)).catch(() => undefined);
    }
  }

  private uploadMessage(problem: ReturnType<typeof toProblem>): string {
    if (problem.code === 'file_too_large' || problem.status === 413) {
      return 'La imagen supera los 5 MB permitidos.';
    }
    if (problem.code === 'invalid_image') {
      return 'El archivo no es una imagen JPEG, PNG o WebP válida (máximo 20 megapíxeles).';
    }
    if (problem.code === 'limit_reached') {
      return 'Alcanzaste el máximo de imágenes del negocio.';
    }
    return isConnectionProblem(problem) ? 'Falló la subida. Revisa tu conexión e inténtalo de nuevo.' : 'No se pudo subir la imagen.';
  }
}
