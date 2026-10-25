import { Component, OnDestroy, OnInit, inject, input, output, signal } from '@angular/core';
import { AutosizeDirective } from '../../shared/ui/autosize.directive';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { isConnectionProblem, toProblem } from '../../core/api-error';
import { MenuItem } from '../../core/catalog.models';
import { NoticeService } from '../../core/notice.service';
import { notBlank } from '../../shared/forms';
import { Modal } from '../../shared/ui/modal';
import { ACCEPTED_IMAGE_TYPES, ImageAction, MenuStore, validateImageFile } from './menu.store';

function twoDecimals(control: AbstractControl<number | null>): ValidationErrors | null {
  const value = control.value;
  return value === null || Math.round(value * 100) / 100 === value ? null : { decimals: true };
}

@Component({
  imports: [AutosizeDirective, ReactiveFormsModule, Modal],
  selector: 'app-product-form',
  template: `
    <app-modal [heading]="base() ? 'Editar producto' : 'Nuevo producto'" size="md" [dismissable]="!saving() && !uploading()" (closed)="cancel()">
        <form id="product-form" [formGroup]="form" (ngSubmit)="submit()" class="space-y-5" novalidate>
          @if (conflict()) {
            <div role="alert" class="rounded-ui-md p-4 text-sm font-bold bg-warning/15 text-ink">
              Este producto cambió mientras lo editabas, así que tus cambios no se guardaron para no pisar los de la otra persona.
              <button type="button" data-reload (click)="reloadAfterConflict()" class="underline ml-1">Recargar y editar de nuevo</button>
            </div>
          }

          <div>
            <label for="item-category" class="text-xs font-bold uppercase tracking-wider text-muted">Categoría</label>
            <select id="item-category" formControlName="categoryId" class="input mt-2">
              @for (category of store.categories(); track category.id) {
                <option [value]="category.id">{{ category.name }}</option>
              }
            </select>
            @if (error('categoryId'); as message) { <p class="mt-1 text-xs font-bold text-danger">{{ message }}</p> }
          </div>

          <div>
            <label for="item-name" class="text-xs font-bold uppercase tracking-wider text-muted">Nombre</label>
            <input id="item-name" formControlName="name" maxlength="120" class="input mt-2">
            @if (error('name'); as message) { <p class="mt-1 text-xs font-bold text-danger">{{ message }}</p> }
          </div>

          <div>
            <label for="item-description" class="text-xs font-bold uppercase tracking-wider text-muted">Descripción (opcional)</label>
            <textarea appAutosize id="item-description" formControlName="description" rows="3" maxlength="2000"
                      class="input mt-2 resize-none"></textarea>
            @if (error('description'); as message) { <p class="mt-1 text-xs font-bold text-danger">{{ message }}</p> }
          </div>

          <div class="grid sm:grid-cols-2 gap-5">
            <div>
              <label for="item-price" class="text-xs font-bold uppercase tracking-wider text-muted">Precio</label>
              <input id="item-price" type="number" inputmode="decimal" step="0.01" min="0" formControlName="price"
                     class="input mt-2">
              @if (error('price'); as message) { <p class="mt-1 text-xs font-bold text-danger">{{ message }}</p> }
            </div>
            <div>
              <label for="item-tag" class="text-xs font-bold uppercase tracking-wider text-muted">Etiqueta (opcional)</label>
              <input id="item-tag" formControlName="tag" maxlength="40" placeholder="Ej. Clásico" class="input mt-2">
              @if (error('tag'); as message) { <p class="mt-1 text-xs font-bold text-danger">{{ message }}</p> }
            </div>
          </div>

          <label class="flex items-center gap-3 text-sm font-bold text-ink">
            <input type="checkbox" formControlName="active" class="w-5 h-5 accent-[rgb(var(--primary))]"> Visible en el sitio (activo)
          </label>

          <fieldset class="rounded-ui-lg border border-line p-4">
            <legend class="px-2 text-xs font-bold uppercase tracking-wider text-muted">Imagen</legend>
            <div class="flex items-center gap-4">
              @if (image().url; as url) {
                <img [src]="url" alt="Vista previa del producto" class="w-20 h-20 rounded-ui-md object-cover">
              } @else {
                <div class="w-20 h-20 rounded-ui-md flex items-center justify-center text-xs font-bold bg-surface-2 text-muted">Sin foto</div>
              }
              <div class="flex flex-wrap gap-2">
                <label for="item-image" class="btn btn-secondary btn-sm cursor-pointer"
                       [class.opacity-60]="uploading()">
                  {{ image().url ? 'Cambiar imagen' : 'Subir imagen' }}
                </label>
                <input id="item-image" type="file" class="sr-only" [accept]="acceptedTypes" [disabled]="uploading()" (change)="onFile($event)">
                @if (image().url) {
                  <button type="button" data-remove-image (click)="removeCurrentImage()" [disabled]="uploading()"
                          class="btn btn-ghost btn-sm text-danger">Quitar imagen</button>
                }
              </div>
            </div>
            @if (uploading()) {
              <div class="mt-3" role="progressbar" aria-label="Subiendo imagen" aria-valuemin="0" aria-valuemax="100" [attr.aria-valuenow]="progress()">
                <div class="h-2 rounded-full bg-surface-2"><div class="h-2 rounded-full bg-primary" [style.width.%]="progress()"></div></div>
                <p class="mt-1 text-xs font-bold text-muted">Subiendo… {{ progress() }}%</p>
              </div>
            }
            @if (uploadError(); as message) {
              <p role="alert" class="mt-3 text-xs font-bold text-danger">{{ message }}</p>
            }
            <p class="mt-3 text-xs font-medium text-muted">JPEG, PNG o WebP, hasta 5 MB. Las imágenes publicadas son públicas.</p>
          </fieldset>

          @if (serverError(); as message) {
            <p role="alert" class="text-sm font-bold text-danger">{{ message }}</p>
          }

        </form>
      <div modal-footer class="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
        <button type="button" data-cancel (click)="cancel()" [disabled]="saving()" class="btn btn-secondary">Cancelar</button>
        <button type="submit" form="product-form" data-save [disabled]="saving() || uploading()" class="btn btn-primary" [class.btn-loading]="saving()">
          {{ saving() ? 'Guardando…' : 'Guardar' }}
        </button>
      </div>
    </app-modal>
  `,
})
export class ProductForm implements OnInit, OnDestroy {
  readonly item = input<MenuItem | null>(null);
  readonly closed = output<void>();

  protected readonly store = inject(MenuStore);
  private readonly notices = inject(NoticeService);

  protected readonly acceptedTypes = ACCEPTED_IMAGE_TYPES.join(',');
  protected readonly base = signal<MenuItem | null>(null);
  protected readonly form = inject(NonNullableFormBuilder).group({
    categoryId: ['', Validators.required],
    name: ['', [notBlank, Validators.maxLength(120)]],
    description: ['', Validators.maxLength(2000)],
    price: [null as number | null, [Validators.required, Validators.min(0), Validators.max(99999999.99), twoDecimals]],
    tag: ['', Validators.maxLength(40)],
    active: [true],
  });
  protected readonly image = signal<{ url: string | null }>({ url: null });
  protected readonly removeImage = signal(false);
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  protected readonly progress = signal(0);
  protected readonly conflict = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly uploadError = signal<string | null>(null);

  private pendingUploadId: string | null = null;
  private pendingUploadUrl: string | null = null;
  private upload?: Subscription;

  ngOnInit(): void {
    const item = this.item();
    this.base.set(item);
    this.fill(item);
  }

  ngOnDestroy(): void {
    this.upload?.unsubscribe();
  }

  protected error(name: 'categoryId' | 'name' | 'description' | 'price' | 'tag'): string | null {
    const control = this.form.controls[name];
    if (!control.touched || !control.errors) {
      return null;
    }
    if (control.errors['server']) {
      return String(control.errors['server']);
    }
    switch (name) {
      case 'categoryId':
        return 'Elige una categoría.';
      case 'name':
        return 'Escribe un nombre (máximo 120 caracteres).';
      case 'description':
        return 'La descripción admite hasta 2000 caracteres.';
      case 'tag':
        return 'La etiqueta admite hasta 40 caracteres.';
      case 'price':
        return control.errors['decimals']
          ? 'Usa como máximo dos decimales.'
          : 'Escribe un precio entre 0 y 99.999.999,99.';
    }
  }

  protected onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    const invalid = validateImageFile(file);
    if (invalid) {
      this.uploadError.set(invalid);
      return;
    }
    this.uploadError.set(null);
    this.uploading.set(true);
    this.progress.set(0);
    this.upload?.unsubscribe();
    this.upload = this.store.uploadImage(file).subscribe({
      next: uploadEvent => {
        if (uploadEvent.kind === 'progress') {
          this.progress.set(uploadEvent.percent);
          return;
        }
        this.discardPending();
        this.pendingUploadId = uploadEvent.media.id;
        this.pendingUploadUrl = uploadEvent.media.url;
        this.image.set({ url: uploadEvent.media.url });
        this.removeImage.set(false);
      },
      error: error => {
        this.uploading.set(false);
        this.uploadError.set(this.uploadMessage(toProblem(error)));
      },
      complete: () => this.uploading.set(false),
    });
  }

  protected removeCurrentImage(): void {
    this.discardPending();
    this.image.set({ url: null });
    this.removeImage.set(!!this.base()?.imageId);
  }

  protected async submit(): Promise<void> {
    if (this.saving() || this.uploading()) {
      return;
    }
    this.conflict.set(false);
    this.serverError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const values = this.form.getRawValue();
    const image: ImageAction = this.pendingUploadId
      ? { imageId: this.pendingUploadId }
      : this.removeImage()
        ? { removeImage: true }
        : {};
    this.saving.set(true);
    const result = await this.store.saveItem(this.base(), { ...values, price: values.price ?? 0 }, image);
    this.saving.set(false);
    if (result.ok) {
      this.pendingUploadId = null;
      this.closed.emit();
      return;
    }
    await this.handleFailure(result.problem);
  }

  protected async reloadAfterConflict(): Promise<void> {
    await this.store.loadItems();
    const fresh = this.store.items().find(item => item.id === this.base()?.id);
    if (!fresh) {
      this.notices.show('error', 'El producto cambió de lugar o fue eliminado. Revisa la lista.');
      this.cancel();
      return;
    }
    this.base.set(fresh);
    this.fill(fresh);
    this.conflict.set(false);
    this.serverError.set(null);
  }

  protected cancel(): void {
    this.upload?.unsubscribe();
    this.discardPending();
    this.closed.emit();
  }

  private fill(item: MenuItem | null): void {
    this.form.reset({
      categoryId: item?.categoryId ?? this.store.selectedId() ?? this.store.categories()[0]?.id ?? '',
      name: item?.name ?? '',
      description: item?.description ?? '',
      price: item?.price ?? null,
      tag: item?.tag ?? '',
      active: item?.active ?? true,
    });
    if (this.pendingUploadId) {
      this.image.set({ url: this.pendingUploadUrl });
      this.removeImage.set(false);
    } else {
      this.image.set({ url: item?.imageUrl ?? null });
      this.removeImage.set(false);
    }
  }

  private discardPending(): void {
    if (this.pendingUploadId) {
      void this.store.discardUpload(this.pendingUploadId);
      this.pendingUploadId = null;
      this.pendingUploadUrl = null;
    }
  }

  private async handleFailure(problem: ReturnType<typeof toProblem>): Promise<void> {
    if (problem.code === 'version_conflict') {
      this.conflict.set(true);
    } else if (problem.code === 'invalid_category') {
      this.serverError.set('La categoría elegida ya no existe. Elige otra.');
      await this.store.loadCategories();
    } else if (problem.status === 404) {
      this.serverError.set('Este producto ya no existe.');
      await this.store.loadItems();
    } else if (problem.code === 'limit_reached') {
      this.serverError.set('Alcanzaste el máximo de 500 productos.');
    } else if (problem.status === 400 && problem.fieldErrors.length > 0) {
      for (const { field, message } of problem.fieldErrors) {
        if (field === 'imageId') {
          this.serverError.set('La imagen ya no está disponible. Sube otra.');
          this.pendingUploadId = null;
          this.pendingUploadUrl = null;
          this.image.set({ url: this.base()?.imageUrl ?? null });
          continue;
        }
        const control = (this.form.controls as Record<string, AbstractControl>)[field];
        control?.setErrors({ server: message });
        control?.markAsTouched();
      }
    } else if (!isConnectionProblem(problem) && problem.status !== 403) {
      this.serverError.set('No se pudo guardar el producto.');
    } else if (isConnectionProblem(problem)) {
      this.serverError.set('No pudimos guardar por un problema de conexión. Tu imagen y tus datos siguen aquí: inténtalo de nuevo.');
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
    return isConnectionProblem(problem)
      ? 'Falló la subida. Revisa tu conexión e inténtalo de nuevo.'
      : 'No se pudo subir la imagen.';
  }
}
