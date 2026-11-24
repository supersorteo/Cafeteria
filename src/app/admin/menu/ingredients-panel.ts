import { Component, inject, signal } from '@angular/core';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { IngredientsStore } from './ingredients.store';
import { MenuStore } from './menu.store';

@Component({
  imports: [ConfirmDialog],
  selector: 'app-ingredients-panel',
  template: `
    <section class="card p-5 md:p-6" aria-labelledby="ingredients-title">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-xs font-bold uppercase tracking-wider text-muted">Catálogo de texto</p>
          <h2 id="ingredients-title" class="mt-1 font-display text-xl md:text-2xl font-black">Ingredientes</h2>
          <p class="mt-2 max-w-2xl text-sm font-medium text-muted">Crea ingredientes reutilizables y selecciónalos al editar cada producto. No se cargan imágenes.</p>
        </div>
        <span class="badge">{{ store.ingredients().length }} {{ store.ingredients().length === 1 ? 'ingrediente' : 'ingredientes' }}</span>
      </div>

      <form class="mt-5 flex flex-col gap-3 sm:flex-row" (submit)="save($event)">
        <label class="sr-only" for="ingredient-name">Nombre del ingrediente</label>
        <input id="ingredient-name" class="input flex-1" maxlength="80" [value]="draftName()" (input)="draftName.set(value($event))" [placeholder]="editing() ? 'Nuevo nombre' : 'Ej. Tomate cherry'" />
        <button type="submit" class="btn btn-primary" [disabled]="menu.locked() || store.busy() || !draftName().trim()">{{ editing() ? 'Guardar cambio' : 'Agregar ingrediente' }}</button>
        @if (editing()) {
          <button type="button" class="btn btn-secondary" (click)="cancelEdit()">Cancelar</button>
        }
      </form>
      @if (error()) {
        <p role="alert" class="mt-2 text-xs font-bold text-danger">{{ error() }}</p>
      }

      @if (store.ingredients().length > 0) {
        <ul class="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          @for (ingredient of store.ingredients(); track ingredient.id) {
            <li class="flex items-center justify-between gap-3 rounded-ui-md border border-line bg-surface-2/50 px-3 py-2.5">
              <span class="min-w-0 truncate text-sm font-bold">{{ ingredient.name }}</span>
              <span class="flex shrink-0 items-center gap-1">
                <button type="button" class="icon-btn !h-8 !w-8" [disabled]="menu.locked()" (click)="startEdit(ingredient)" [attr.aria-label]="'Editar ' + ingredient.name">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/></svg>
                </button>
                <button type="button" class="icon-btn !h-8 !w-8 !text-danger" [disabled]="menu.locked()" (click)="pendingDelete.set(ingredient)" [attr.aria-label]="'Eliminar ' + ingredient.name">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>
                </button>
              </span>
            </li>
          }
        </ul>
      } @else {
        <p class="mt-5 rounded-ui-md border border-dashed border-line p-4 text-sm font-medium text-muted">Todavía no hay ingredientes. Crea el primero para poder asignarlo a tus productos.</p>
      }
    </section>

    @if (pendingDelete(); as ingredient) {
      <app-confirm-dialog title="Eliminar ingrediente" [message]="'¿Eliminar «' + ingredient.name + '»? También se quitará de los productos seleccionados.'" busyLabel="Eliminando…" (confirmed)="remove(ingredient)" (cancelled)="pendingDelete.set(null)" />
    }
  `,
})
export class IngredientsPanel {
  protected readonly store = inject(IngredientsStore);
  protected readonly menu = inject(MenuStore);
  protected readonly draftName = signal('');
  protected readonly editing = signal<{ id: string; name: string } | null>(null);
  protected readonly pendingDelete = signal<{ id: string; name: string } | null>(null);
  protected readonly error = signal<string | null>(null);

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    if (this.store.busy()) {
      return;
    }
    const name = this.draftName().trim();
    if (!name) {
      this.error.set('Escribe el nombre del ingrediente.');
      return;
    }
    const duplicate = this.store.ingredients().some(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase() && item.id !== this.editing()?.id);
    if (duplicate) {
      this.error.set('Ese ingrediente ya existe.');
      return;
    }
    const current = this.editing();
    const failure = current ? await this.store.update(current.id, name) : await this.store.create(name);
    if (failure) {
      this.error.set(failure);
      return;
    }
    this.cancelEdit();
  }

  protected startEdit(ingredient: { id: string; name: string }): void {
    this.editing.set(ingredient);
    this.draftName.set(ingredient.name);
    this.error.set(null);
  }

  protected cancelEdit(): void {
    this.editing.set(null);
    this.draftName.set('');
    this.error.set(null);
  }

  protected async remove(ingredient: { id: string; name: string }): Promise<void> {
    const failure = await this.store.remove(ingredient.id);
    this.pendingDelete.set(null);
    if (failure) {
      this.error.set(failure);
      return;
    }
    if (this.editing()?.id === ingredient.id) {
      this.cancelEdit();
    }
    void this.menu.loadItems();
  }
}
