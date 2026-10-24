import { Component, inject, signal } from '@angular/core';
import { MenuItem } from '../../core/catalog.models';
import { NoticeService } from '../../core/notice.service';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { ItemFilter, MenuStore, Result } from './menu.store';

const FILTERS: { id: ItemFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'active', label: 'Activos' },
  { id: 'inactive', label: 'Inactivos' },
];

@Component({
  imports: [ConfirmDialog],
  selector: 'app-product-panel',
  template: `
    <section aria-labelledby="products-title" class="bg-white rounded-3xl p-5 md:p-6 shadow-lg">
      @if (store.selected(); as category) {
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 id="products-title" class="font-display text-xl font-black" style="color:var(--plum)">{{ category.name }}</h2>
          <button type="button" data-new-item (click)="store.openEditor(null)"
                  class="rounded-full bg-coral text-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:brightness-110">
            Nuevo producto
          </button>
        </div>

        <div role="group" aria-label="Filtrar productos" class="mt-4 flex gap-2">
          @for (option of filters; track option.id) {
            <button type="button" (click)="store.setFilter(option.id)" [attr.aria-pressed]="store.filter() === option.id"
                    class="rounded-full border-2 px-4 py-1.5 text-xs font-bold uppercase tracking-widest"
                    [style.background]="store.filter() === option.id ? 'var(--plum)' : '#fff'"
                    [style.color]="store.filter() === option.id ? '#fff' : 'var(--plum)'"
                    [style.borderColor]="'var(--plum)'">{{ option.label }}</button>
          }
        </div>

        @switch (store.itemsState()) {
          @case ('error') {
            <div role="alert" class="mt-6 rounded-2xl p-4" style="background:#FDECEE">
              <p class="font-bold" style="color:#E63946">No pudimos cargar los productos.</p>
              <button type="button" (click)="store.loadItems()" class="mt-3 underline text-sm font-bold" style="color:var(--plum)">Reintentar</button>
            </div>
          }
          @case ('loading') {
            <p class="mt-6 font-medium" style="color:#5b4150" role="status" aria-busy="true">Cargando productos…</p>
          }
          @default {
            @if (store.items().length === 0) {
              <p class="mt-6 font-medium" style="color:#5b4150">
                @if (store.filter() === 'all') {
                  Esta categoría aún no tiene productos.
                } @else {
                  No hay productos {{ store.filter() === 'active' ? 'activos' : 'inactivos' }} en esta categoría.
                }
              </p>
            } @else {
              <ul class="mt-5 divide-y" style="border-color:rgba(61,29,46,.1)">
                @for (item of store.items(); track item.id; let index = $index) {
                  <li class="py-4 flex flex-wrap items-center gap-4" [class.opacity-60]="!item.active">
                    @if (item.imageUrl) {
                      <img [src]="item.imageUrl" [alt]="item.name" class="w-16 h-16 rounded-xl object-cover shrink-0">
                    } @else {
                      <div class="w-16 h-16 rounded-xl shrink-0 flex items-center justify-center text-xs font-bold"
                           style="background:var(--cream2);color:#5b4150" aria-label="Sin imagen">Sin foto</div>
                    }
                    <div class="flex-1 min-w-[10rem]">
                      <p class="font-bold break-words" style="color:var(--plum)">{{ item.name }}</p>
                      @if (item.tag) {
                        <span class="inline-block mt-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white"
                              style="background:var(--teal)">{{ item.tag }}</span>
                      }
                      @if (item.description) {
                        <p class="mt-1 text-sm font-medium line-clamp-2" style="color:#5b4150">{{ item.description }}</p>
                      }
                    </div>
                    <p class="font-display text-lg font-black text-coral">{{ store.formatPrice(item.price) }}</p>
                    <button type="button" role="switch" [attr.aria-checked]="item.active" [attr.aria-label]="'Activo: ' + item.name"
                            (click)="toggle(item)" [disabled]="busyId() === item.id"
                            class="relative w-12 h-7 rounded-full transition-colors disabled:opacity-60"
                            [style.background]="item.active ? 'var(--teal)' : '#c9bcc3'">
                      <span class="absolute top-1 w-5 h-5 rounded-full bg-white transition-all" [style.left]="item.active ? '1.5rem' : '0.25rem'"></span>
                    </button>
                    <div class="flex items-center gap-1">
                      <button type="button" (click)="move(item, -1)" [disabled]="!canMove(index, -1) || busyId() !== null"
                              [attr.aria-label]="'Subir ' + item.name" class="px-2 py-1 disabled:opacity-30">↑</button>
                      <button type="button" (click)="move(item, 1)" [disabled]="!canMove(index, 1) || busyId() !== null"
                              [attr.aria-label]="'Bajar ' + item.name" class="px-2 py-1 disabled:opacity-30">↓</button>
                      <button type="button" (click)="store.openEditor(item)" [attr.aria-label]="'Editar ' + item.name" class="px-2 py-1">✎</button>
                      <button type="button" (click)="deleting.set(item)" [attr.aria-label]="'Eliminar ' + item.name"
                              class="px-2 py-1" style="color:#E63946">🗑</button>
                    </div>
                  </li>
                }
              </ul>

              @if (store.totalPages() > 1) {
                <nav aria-label="Paginación" class="mt-5 flex items-center justify-between text-sm font-bold" style="color:var(--plum)">
                  <button type="button" data-prev (click)="store.goToPage(store.page() - 1)" [disabled]="store.page() === 0"
                          class="rounded-full border-2 px-4 py-1.5 text-xs uppercase tracking-widest disabled:opacity-30">Anterior</button>
                  <span>Página {{ store.page() + 1 }} de {{ store.totalPages() }} · {{ store.totalItems() }} productos</span>
                  <button type="button" data-next (click)="store.goToPage(store.page() + 1)" [disabled]="store.page() + 1 >= store.totalPages()"
                          class="rounded-full border-2 px-4 py-1.5 text-xs uppercase tracking-widest disabled:opacity-30">Siguiente</button>
                </nav>
              }
            }
          }
        }
      } @else {
        <p class="font-medium" style="color:#5b4150">Crea una categoría para empezar a añadir productos.</p>
      }
    </section>

    @if (deleting(); as item) {
      <app-confirm-dialog title="Eliminar producto" [message]="'¿Eliminar «' + item.name + '»? Esta acción no se puede deshacer.'"
                          busyLabel="Eliminando…" [busy]="busy()" (confirmed)="confirmDelete(item)" (cancelled)="deleting.set(null)" />
    }
  `,
})
export class ProductPanel {
  protected readonly store = inject(MenuStore);
  private readonly notices = inject(NoticeService);

  protected readonly filters = FILTERS;
  protected readonly deleting = signal<MenuItem | null>(null);
  protected readonly busy = signal(false);
  protected readonly busyId = signal<string | null>(null);

  protected canMove(index: number, delta: -1 | 1): boolean {
    if (this.store.filter() !== 'all') {
      return false;
    }
    const position = this.store.page() * this.store.pageSize + index + delta;
    return position >= 0 && position < this.store.totalItems();
  }

  protected async toggle(item: MenuItem): Promise<void> {
    const result = await this.withItem(item, () => this.store.toggleActive(item));
    if (!result.ok) {
      await this.handleFailure(result, 'No se pudo cambiar el estado del producto.');
    }
  }

  protected async move(item: MenuItem, delta: -1 | 1): Promise<void> {
    const result = await this.withItem(item, () => this.store.moveItem(item, delta));
    if (!result.ok) {
      await this.handleFailure(result, 'No se pudo reordenar los productos.');
    }
  }

  protected async confirmDelete(item: MenuItem): Promise<void> {
    this.busy.set(true);
    const result = await this.store.deleteItem(item);
    this.busy.set(false);
    this.deleting.set(null);
    if (!result.ok) {
      await this.handleFailure(result, 'No se pudo eliminar el producto.');
    }
  }

  private async withItem<T>(item: MenuItem, action: () => Promise<Result<T>>): Promise<Result<T>> {
    this.busyId.set(item.id);
    try {
      return await action();
    } finally {
      this.busyId.set(null);
    }
  }

  private async handleFailure(result: Extract<Result<unknown>, { ok: false }>, fallback: string): Promise<void> {
    const { problem } = result;
    if (problem.code === 'version_conflict') {
      this.notices.show('error', 'Otra persona modificó este producto. Se recargó la lista con los datos actuales.');
    } else if (problem.status === 404) {
      this.notices.show('error', 'El producto ya no existe. Se recargó la lista.');
    } else if (problem.status !== 403 && problem.status !== 0 && problem.status < 500) {
      this.notices.show('error', fallback);
    }
    await this.store.loadItems();
  }
}
