import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Category } from '../../core/catalog.models';
import { NoticeService } from '../../core/notice.service';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { EmptyState } from '../../shared/ui/empty-state';
import { Modal } from '../../shared/ui/modal';
import { MenuStore, Result } from './menu.store';

@Component({
  imports: [ReactiveFormsModule, ConfirmDialog, Modal, EmptyState],
  selector: 'app-category-panel',
  template: `
    <section aria-labelledby="categories-title" class="card p-5">
      <div class="flex items-center justify-between gap-3">
        <h2 id="categories-title" class="font-display text-xl font-black">Categorías</h2>
        <button type="button" data-new-category (click)="openCreate()" class="btn btn-primary btn-sm">+ Nueva</button>
      </div>

      <ul class="mt-4 space-y-2">
        @for (category of store.categories(); track category.id; let first = $first; let last = $last; let i = $index) {
          <li class="cat-row anim-fade-up" [class.active]="category.id === store.selectedId()" [style.--i]="i">
            <div class="flex items-center gap-0.5">
              <button type="button" (click)="store.select(category.id)" [attr.aria-current]="category.id === store.selectedId() ? 'true' : null"
                      class="flex-1 text-left px-2.5 py-2 font-bold text-sm break-words rounded-ui-sm">{{ category.name }}</button>
              <button type="button" class="icon-btn !w-8 !h-8" (click)="move(category, -1)" [disabled]="first || busy()" [attr.aria-label]="'Subir ' + category.name">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
              </button>
              <button type="button" class="icon-btn !w-8 !h-8" (click)="move(category, 1)" [disabled]="last || busy()" [attr.aria-label]="'Bajar ' + category.name">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
              </button>
              <button type="button" class="icon-btn !w-8 !h-8" (click)="openEdit(category)" [attr.aria-label]="'Renombrar ' + category.name">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/></svg>
              </button>
              <button type="button" class="icon-btn !w-8 !h-8 !text-danger" (click)="deleting.set(category)" [attr.aria-label]="'Eliminar ' + category.name">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>
              </button>
            </div>
          </li>
        } @empty {
          <li>
            <app-empty-state title="Aún no tienes categorías" text="Crea la primera para empezar tu carta.">
              <button type="button" data-new-category (click)="openCreate()" class="btn btn-primary">Crear categoría</button>
            </app-empty-state>
          </li>
        }
      </ul>
    </section>

    @if (form(); as current) {
      <app-modal [heading]="current.category ? 'Renombrar categoría' : 'Nueva categoría'" size="sm" [dismissable]="!busy()" (closed)="closeForm()">
        <form id="category-form" (submit)="$event.preventDefault(); submit()" novalidate>
          <label [for]="current.category ? 'rename-' + current.category.id : 'new-category'" class="text-xs font-bold uppercase tracking-wider text-muted">Nombre</label>
          <input [id]="current.category ? 'rename-' + current.category.id : 'new-category'" [formControl]="nameControl" maxlength="120" placeholder="Ej. Postres" class="input mt-2">
          @if (error(); as message) {
            <p role="alert" class="mt-2 text-xs font-bold text-danger anim-fade-in">{{ message }}</p>
          }
          @if (conflict()) {
            <div role="alert" class="mt-4 rounded-ui-md p-3 text-xs font-bold bg-warning/15 text-ink">
              Otra persona cambió esta categoría mientras la editabas.
              <button type="button" data-reload (click)="reload()" class="underline ml-1">Recargar</button>
            </div>
          }
        </form>
        <div modal-footer class="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button type="button" data-cancel-edit (click)="closeForm()" [disabled]="busy()" class="btn btn-secondary">Cancelar</button>
          <button type="submit" form="category-form" [disabled]="busy()" class="btn btn-primary" [class.btn-loading]="busy()">{{ current.category ? 'Guardar' : 'Crear' }}</button>
        </div>
      </app-modal>
    }

    @if (deleting(); as category) {
      <app-confirm-dialog title="Eliminar categoría"
                          [message]="'¿Eliminar «' + category.name + '»? Solo se puede si no tiene productos.'"
                          busyLabel="Eliminando…" [busy]="busy()" (confirmed)="confirmDelete(category)" (cancelled)="deleting.set(null)" />
    }
  `,
})
export class CategoryPanel {
  protected readonly store = inject(MenuStore);
  private readonly notices = inject(NoticeService);

  protected readonly nameControl = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(120)] });
  protected readonly form = signal<{ category: Category | null } | null>(null);
  protected readonly conflict = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly deleting = signal<Category | null>(null);

  protected openCreate(): void {
    this.nameControl.reset('');
    this.error.set(null);
    this.conflict.set(false);
    this.form.set({ category: null });
  }

  protected openEdit(category: Category): void {
    this.nameControl.setValue(category.name);
    this.error.set(null);
    this.conflict.set(false);
    this.form.set({ category });
  }

  protected closeForm(): void {
    this.form.set(null);
    this.conflict.set(false);
    this.error.set(null);
  }

  protected async submit(): Promise<void> {
    const current = this.form();
    if (!current || this.busy()) {
      return;
    }
    if (this.nameControl.invalid || !this.nameControl.value.trim()) {
      this.error.set('Escribe un nombre (máximo 120 caracteres).');
      return;
    }
    this.error.set(null);
    if (!current.category) {
      const result = await this.guard(() => this.store.createCategory(this.nameControl.value));
      if (result.ok) {
        this.closeForm();
      } else {
        this.error.set(this.message(result.problem.code, 'No se pudo crear la categoría.'));
      }
      return;
    }
    const category = current.category;
    const result = await this.guard(() => this.store.renameCategory(category, this.nameControl.value));
    if (result.ok) {
      this.closeForm();
    } else if (result.problem.code === 'version_conflict') {
      this.conflict.set(true);
    } else if (result.problem.status === 404) {
      this.error.set('La categoría ya no existe.');
      await this.store.loadCategories();
    } else {
      this.error.set(this.message(result.problem.code, 'No se pudo guardar el cambio.'));
    }
  }

  protected async reload(): Promise<void> {
    await this.store.loadCategories();
    this.closeForm();
  }

  protected async move(category: Category, delta: -1 | 1): Promise<void> {
    if (this.busy()) {
      return;
    }
    const result = await this.guard(() => this.store.moveCategory(category, delta));
    if (!result.ok) {
      this.notices.show('error', 'No se pudo reordenar. Se recargó la lista.');
      await this.store.loadCategories();
    }
  }

  protected async confirmDelete(category: Category): Promise<void> {
    const result = await this.guard(() => this.store.deleteCategory(category));
    this.deleting.set(null);
    if (result.ok) {
      return;
    }
    if (result.problem.code === 'category_not_empty') {
      this.notices.show('error', 'La categoría tiene productos. Muévelos o elimínalos antes de borrarla.');
    } else if (result.problem.status === 404) {
      await this.store.loadCategories();
    } else if (result.problem.status !== 403) {
      this.notices.show('error', 'No se pudo eliminar la categoría.');
    }
  }

  private async guard<T>(action: () => Promise<Result<T>>): Promise<Result<T>> {
    this.busy.set(true);
    try {
      return await action();
    } finally {
      this.busy.set(false);
    }
  }

  private message(code: string | null, fallback: string): string {
    return code === 'limit_reached' ? 'Alcanzaste el máximo de 30 categorías.' : fallback;
  }
}
