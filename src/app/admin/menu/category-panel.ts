import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Category } from '../../core/catalog.models';
import { NoticeService } from '../../core/notice.service';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { MenuStore, Result } from './menu.store';

@Component({
  imports: [ReactiveFormsModule, ConfirmDialog],
  selector: 'app-category-panel',
  template: `
    <section aria-labelledby="categories-title" class="bg-white rounded-3xl p-5 shadow-lg">
      <h2 id="categories-title" class="font-display text-xl font-black" style="color:var(--plum)">Categorías</h2>

      <ul class="mt-4 space-y-2">
        @for (category of store.categories(); track category.id; let first = $first; let last = $last) {
          <li class="rounded-2xl border-2 p-2"
              [style.borderColor]="category.id === store.selectedId() ? 'var(--coral)' : 'rgba(61,29,46,.1)'">
            @if (editingId() === category.id) {
              <form (submit)="$event.preventDefault(); saveEdit(category)" class="space-y-2">
                <label class="sr-only" [for]="'rename-' + category.id">Nombre de la categoría</label>
                <input [id]="'rename-' + category.id" [formControl]="editControl" maxlength="120"
                       class="field w-full px-3 py-2 text-sm font-medium">
                @if (editError(); as message) {
                  <p role="alert" class="text-xs font-bold" style="color:#E63946">{{ message }}</p>
                }
                @if (conflict()) {
                  <div role="alert" class="rounded-xl p-3 text-xs font-bold" style="background:#FFF1D6;color:var(--plum)">
                    Otra persona cambió esta categoría mientras la editabas.
                    <button type="button" data-reload (click)="reload()" class="underline ml-1">Recargar</button>
                  </div>
                }
                <div class="flex gap-2">
                  <button type="submit" [disabled]="busy()"
                          class="rounded-full bg-coral text-white px-4 py-1.5 text-xs font-bold uppercase tracking-widest disabled:opacity-60">Guardar</button>
                  <button type="button" data-cancel-edit (click)="cancelEdit()"
                          class="rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-widest" style="color:var(--plum)">Cancelar</button>
                </div>
              </form>
            } @else {
              <div class="flex items-center gap-1">
                <button type="button" (click)="store.select(category.id)" [attr.aria-current]="category.id === store.selectedId() ? 'true' : null"
                        class="flex-1 text-left px-2 py-1.5 font-bold text-sm break-words" style="color:var(--plum)">{{ category.name }}</button>
                <button type="button" (click)="move(category, -1)" [disabled]="first || busy()" [attr.aria-label]="'Subir ' + category.name"
                        class="px-2 py-1 text-sm disabled:opacity-30">↑</button>
                <button type="button" (click)="move(category, 1)" [disabled]="last || busy()" [attr.aria-label]="'Bajar ' + category.name"
                        class="px-2 py-1 text-sm disabled:opacity-30">↓</button>
                <button type="button" (click)="startEdit(category)" [attr.aria-label]="'Renombrar ' + category.name"
                        class="px-2 py-1 text-sm">✎</button>
                <button type="button" (click)="deleting.set(category)" [attr.aria-label]="'Eliminar ' + category.name"
                        class="px-2 py-1 text-sm" style="color:#E63946">🗑</button>
              </div>
            }
          </li>
        } @empty {
          <li class="text-sm font-medium" style="color:#5b4150">Aún no tienes categorías. Crea la primera para empezar tu carta.</li>
        }
      </ul>

      <form (submit)="$event.preventDefault(); add()" class="mt-5 space-y-2">
        <label for="new-category" class="text-xs font-bold uppercase tracking-widest text-teal">Nueva categoría</label>
        <div class="flex gap-2">
          <input id="new-category" [formControl]="newName" maxlength="120" placeholder="Ej. Postres"
                 class="field flex-1 min-w-0 px-3 py-2 text-sm font-medium">
          <button type="submit" [disabled]="busy()"
                  class="rounded-full bg-coral text-white px-4 text-xs font-bold uppercase tracking-widest hover:brightness-110 disabled:opacity-60">Crear</button>
        </div>
        @if (addError(); as message) {
          <p role="alert" class="text-xs font-bold" style="color:#E63946">{{ message }}</p>
        }
      </form>
    </section>

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

  protected readonly newName = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(120)] });
  protected readonly editControl = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(120)] });
  protected readonly editingId = signal<string | null>(null);
  protected readonly conflict = signal(false);
  protected readonly editError = signal<string | null>(null);
  protected readonly addError = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly deleting = signal<Category | null>(null);

  protected async add(): Promise<void> {
    if (this.busy()) {
      return;
    }
    if (this.newName.invalid || !this.newName.value.trim()) {
      this.addError.set('Escribe un nombre (máximo 120 caracteres).');
      return;
    }
    this.addError.set(null);
    const result = await this.guard(() => this.store.createCategory(this.newName.value));
    if (result.ok) {
      this.newName.reset('');
    } else {
      this.addError.set(this.message(result.problem.code, 'No se pudo crear la categoría.'));
    }
  }

  protected startEdit(category: Category): void {
    this.editingId.set(category.id);
    this.editControl.setValue(category.name);
    this.editError.set(null);
    this.conflict.set(false);
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.conflict.set(false);
    this.editError.set(null);
  }

  protected async saveEdit(category: Category): Promise<void> {
    if (this.busy()) {
      return;
    }
    if (this.editControl.invalid || !this.editControl.value.trim()) {
      this.editError.set('Escribe un nombre (máximo 120 caracteres).');
      return;
    }
    this.editError.set(null);
    const result = await this.guard(() => this.store.renameCategory(category, this.editControl.value));
    if (result.ok) {
      this.cancelEdit();
    } else if (result.problem.code === 'version_conflict') {
      this.conflict.set(true);
    } else if (result.problem.status === 404) {
      this.editError.set('La categoría ya no existe.');
      await this.store.loadCategories();
    } else {
      this.editError.set(this.message(result.problem.code, 'No se pudo guardar el cambio.'));
    }
  }

  protected async reload(): Promise<void> {
    await this.store.loadCategories();
    this.cancelEdit();
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
