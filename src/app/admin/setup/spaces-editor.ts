import { Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { isConnectionProblem, toProblem } from '../../core/api-error';
import { CatalogApi } from '../../core/catalog.api';
import { ImageRef } from '../../core/site-admin.models';
import { ACCEPTED_IMAGE_TYPES, validateImageFile } from '../menu/menu.store';
import { MAX_SPACES, SpaceGroup, newSpace } from '../site/site-form';
import { SiteSettingsStore } from './site-settings.store';

@Component({
  imports: [ReactiveFormsModule],
  selector: 'app-spaces-editor',
  host: { class: 'block' },
  template: `
    <section aria-label="Tus espacios">
      <h3 class="text-xs font-bold uppercase tracking-wider text-muted">Tus espacios ({{ array.length }}/{{ max }})</h3>
      <p class="mt-1 text-xs font-medium text-muted">
        Cada espacio se muestra con su foto, nombre y descripción. Los que aceptan reservas aparecen como zona en el formulario de reserva.
        Ej.: Terraza · Aire libre y música en vivo
      </p>
      <ul class="mt-3 space-y-3">
        @for (group of array.controls; track group; let index = $index; let first = $first; let last = $last) {
          <li class="card p-4 grid sm:grid-cols-[7rem_1fr] gap-4 items-start anim-fade-in" data-space>
            <div>
              <div class="w-full sm:w-28 h-24 rounded-ui-md bg-surface-2 overflow-hidden grid place-items-center text-xs font-bold text-muted">
                @if (group.controls.image.value; as image) {
                  <img [src]="image.url" [alt]="'Foto del espacio ' + (index + 1)" class="w-full h-full object-cover">
                } @else {
                  Sin foto
                }
              </div>
              @if (array.enabled) {
                <label [for]="'space-img-' + index" class="btn btn-secondary btn-sm mt-2 w-full sm:w-28 cursor-pointer"
                       [class.opacity-40]="uploading() !== null">{{ group.controls.image.value ? 'Cambiar' : 'Subir foto' }}</label>
                <input [id]="'space-img-' + index" type="file" class="sr-only" [accept]="accepted" [disabled]="uploading() !== null"
                       (change)="choose(group, $event, index)">
                @if (group.controls.image.value) {
                  <button type="button" (click)="removeImage(group)" [attr.aria-label]="'Quitar foto del espacio ' + (index + 1)"
                          class="mt-1 text-xs font-bold text-danger">Quitar foto</button>
                }
              }
            </div>
            <div class="min-w-0 space-y-2">
              <input [formControl]="group.controls.name" maxlength="60" [attr.aria-label]="'Nombre del espacio ' + (index + 1)"
                     placeholder="Terraza" class="input">
              <input [formControl]="group.controls.description" maxlength="200" [attr.aria-label]="'Descripción del espacio ' + (index + 1)"
                     placeholder="Aire libre y música en vivo" class="input">
              <div class="flex items-center justify-between gap-3 flex-wrap">
                <label class="inline-flex items-center gap-2 text-sm font-bold">
                  <input type="checkbox" [formControl]="group.controls.bookable" [attr.aria-label]="'Acepta reservas ' + (index + 1)">
                  Acepta reservas
                </label>
                @if (array.enabled) {
                  <span class="flex gap-3 text-sm">
                    <button type="button" (click)="move(index, -1)" [disabled]="first" [attr.aria-label]="'Subir espacio ' + (index + 1)" class="disabled:opacity-30">↑</button>
                    <button type="button" (click)="move(index, 1)" [disabled]="last" [attr.aria-label]="'Bajar espacio ' + (index + 1)" class="disabled:opacity-30">↓</button>
                    <button type="button" (click)="remove(index)" [attr.aria-label]="'Quitar espacio ' + (index + 1)" class="text-danger font-bold">✕</button>
                  </span>
                }
              </div>
              @if (group.controls.name.touched && group.controls.name.invalid) {
                <p role="alert" class="text-xs font-bold text-danger">Escribe un nombre (máx. 60).</p>
              }
            </div>
          </li>
        }
      </ul>
      @if (array.errors?.['duplicateNames']) {
        <p role="alert" class="mt-2 text-xs font-bold text-danger">Dos espacios no pueden llamarse igual.</p>
      }
      @if (array.errors?.['server']; as problem) {
        <p role="alert" class="mt-2 text-xs font-bold text-danger">{{ problem }}</p>
      }
      @if (uploading() !== null) {
        <div class="mt-3" role="progressbar" aria-label="Subiendo foto" aria-valuemin="0" aria-valuemax="100" [attr.aria-valuenow]="progress()">
          <div class="h-2 rounded-full bg-surface-2"><div class="h-2 rounded-full bg-primary" [style.width.%]="progress()"></div></div>
          <p class="mt-1 text-xs font-bold text-muted">Subiendo… {{ progress() }}%</p>
        </div>
      }
      @if (message(); as text) {
        <p role="alert" class="mt-2 text-xs font-bold text-danger">{{ text }}</p>
      }
      @if (array.enabled) {
        <button type="button" data-add-space (click)="add()" [disabled]="array.length >= max" class="btn btn-secondary btn-sm mt-3">+ Añadir espacio</button>
      }
    </section>
  `,
})
export class SpacesEditor {
  private readonly store = inject(SiteSettingsStore);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly catalog = inject(CatalogApi);
  private readonly fresh = new Set<string>();

  protected readonly max = MAX_SPACES;
  protected readonly accepted = ACCEPTED_IMAGE_TYPES.join(',');
  protected readonly uploading = signal<number | null>(null);
  protected readonly progress = signal(0);
  protected readonly message = signal<string | null>(null);

  protected get array() {
    return this.store.form.controls.spaces;
  }

  protected add(): void {
    if (this.array.length < MAX_SPACES) {
      this.array.push(newSpace(this.fb));
      this.array.markAsDirty();
    }
  }

  protected remove(index: number): void {
    this.discardIfFresh(this.array.at(index).controls.image.value);
    this.array.removeAt(index);
    this.array.markAsDirty();
  }

  protected move(index: number, delta: -1 | 1): void {
    const target = index + delta;
    if (target < 0 || target >= this.array.length) {
      return;
    }
    const group = this.array.at(index);
    this.array.removeAt(index);
    this.array.insert(target, group);
    this.array.markAsDirty();
  }

  protected removeImage(group: SpaceGroup): void {
    this.discardIfFresh(group.controls.image.value);
    group.controls.image.setValue(null);
    this.array.markAsDirty();
  }

  protected choose(group: SpaceGroup, event: Event, index: number): void {
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
    this.uploading.set(index);
    this.progress.set(0);
    this.catalog.upload(file).subscribe({
      next: uploadEvent => {
        if (uploadEvent.kind === 'progress') {
          this.progress.set(uploadEvent.percent);
          return;
        }
        this.discardIfFresh(group.controls.image.value);
        this.fresh.add(uploadEvent.media.id);
        group.controls.image.setValue({ id: uploadEvent.media.id, url: uploadEvent.media.url });
        this.array.markAsDirty();
      },
      error: error => {
        this.uploading.set(null);
        const problem = toProblem(error);
        this.message.set(
          problem.code === 'file_too_large' || problem.status === 413
            ? 'La imagen supera los 5 MB permitidos.'
            : problem.code === 'invalid_image'
              ? 'El archivo no es una imagen JPEG, PNG o WebP válida (máximo 20 megapíxeles).'
              : problem.code === 'limit_reached'
                ? 'Alcanzaste el máximo de imágenes del negocio.'
                : isConnectionProblem(problem)
                  ? 'Falló la subida. Revisa tu conexión e inténtalo de nuevo.'
                  : 'No se pudo subir la imagen.',
        );
      },
      complete: () => this.uploading.set(null),
    });
  }

  private discardIfFresh(image: ImageRef | null): void {
    if (image && this.fresh.delete(image.id)) {
      void firstValueFrom(this.catalog.deleteMedia(image.id)).catch(() => undefined);
    }
  }
}
