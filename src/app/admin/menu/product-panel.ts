import { Component, inject, signal } from '@angular/core';
import { MenuItem } from '../../core/catalog.models';
import { NoticeService } from '../../core/notice.service';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { EmptyState } from '../../shared/ui/empty-state';
import { ItemFilter, MenuStore, Result } from './menu.store';

const FILTERS: { id: ItemFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'active', label: 'Activos' },
  { id: 'inactive', label: 'Inactivos' },
];

@Component({
  imports: [ConfirmDialog, EmptyState],
  selector: 'app-product-panel',
  template: `
    <section aria-labelledby="products-title" class="card p-5 md:p-6">
      @if (store.selected(); as category) {
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 id="products-title" class="font-display text-xl md:text-2xl font-black">{{ category.name }}</h2>
          <button type="button" data-new-item (click)="store.openEditor(null)" class="btn btn-primary btn-sm">+ Nuevo producto</button>
        </div>

        <div role="group" aria-label="Filtrar productos" class="mt-4 tabs w-fit max-w-full">
          @for (option of filters; track option.id) {
            <button type="button" (click)="store.setFilter(option.id)" [attr.aria-pressed]="store.filter() === option.id" class="tab">{{ option.label }}</button>
          }
        </div>

        @switch (store.itemsState()) {
          @case ('error') {
            <div role="alert" class="mt-6 rounded-ui-md p-4 bg-danger/10">
              <p class="font-bold text-danger">No pudimos cargar los productos.</p>
              <button type="button" (click)="store.loadItems()" class="btn btn-secondary btn-sm mt-3">Reintentar</button>
            </div>
          }
          @case ('loading') {
            <div class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-busy="true">
              @for (n of [1, 2, 3]; track n) { <div class="skeleton h-64"></div> }
              <p class="sr-only">Cargando productos…</p>
            </div>
          }
          @default {
            @if (store.items().length === 0) {
              @if (store.filter() === 'all') {
                <app-empty-state title="Esta categoría aún no tiene productos" text="Añade el primero con su foto y su precio.">
                  <button type="button" (click)="store.openEditor(null)" class="btn btn-primary">Añadir producto</button>
                </app-empty-state>
              } @else {
                <app-empty-state [title]="'No hay productos ' + (store.filter() === 'active' ? 'activos' : 'inactivos') + ' en esta categoría'" />
              }
            } @else {
              <ul class="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                @for (item of store.items(); track item.id; let index = $index) {
                  <li class="pcard anim-fade-up" [class.inactive]="!item.active" [style.--i]="index">
                    <div class="pcard-media">
                      @if (item.imageUrl) {
                        <img [src]="item.imageUrl" [alt]="item.name" loading="lazy" class="w-full h-full object-cover">
                      } @else {
                        <div class="w-full h-full flex items-center justify-center text-xs font-bold bg-surface-2 text-muted" aria-label="Sin imagen">Sin foto</div>
                      }
                      @if (item.tag) {
                        <span class="pcard-tag">{{ item.tag }}</span>
                      }
                      @if (!item.active) {
                        <span class="pcard-off badge">Inactivo</span>
                      }
                    </div>
                    <div class="p-4 flex-1 flex flex-col">
                      <div class="flex items-start justify-between gap-3">
                        <p class="font-bold break-words leading-snug">{{ item.name }}</p>
                        <p class="font-display text-lg font-black text-primary shrink-0">{{ store.formatPrice(item.price) }}</p>
                      </div>
                      @if (item.description) {
                        <p class="mt-1.5 text-sm font-medium line-clamp-2 text-muted">{{ item.description }}</p>
                      }
                    </div>
                    <div class="pcard-actions">
                      <button type="button" role="switch" class="switch" [attr.aria-checked]="item.active" [attr.aria-label]="'Activo: ' + item.name"
                              (click)="toggle(item)" [disabled]="busyId() === item.id"></button>
                      <div class="flex items-center">
                        <button type="button" class="icon-btn !w-9 !h-9" (click)="move(item, -1)" [disabled]="!canMove(index, -1) || busyId() !== null" [attr.aria-label]="'Subir ' + item.name">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                        </button>
                        <button type="button" class="icon-btn !w-9 !h-9" (click)="move(item, 1)" [disabled]="!canMove(index, 1) || busyId() !== null" [attr.aria-label]="'Bajar ' + item.name">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
                        </button>
                        <button type="button" class="icon-btn !w-9 !h-9" (click)="store.openEditor(item)" [attr.aria-label]="'Editar ' + item.name">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/></svg>
                        </button>
                        <button type="button" class="icon-btn !w-9 !h-9 !text-danger" (click)="deleting.set(item)" [attr.aria-label]="'Eliminar ' + item.name">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>
                        </button>
                      </div>
                    </div>
                  </li>
                }
              </ul>

              @if (store.totalPages() > 1) {
                <nav aria-label="Paginación" class="mt-6 flex items-center justify-between gap-3 text-sm font-bold">
                  <button type="button" data-prev (click)="store.goToPage(store.page() - 1)" [disabled]="store.page() === 0" class="btn btn-secondary btn-sm">Anterior</button>
                  <span class="text-center text-muted">Página {{ store.page() + 1 }} de {{ store.totalPages() }} · {{ store.totalItems() }} productos</span>
                  <button type="button" data-next (click)="store.goToPage(store.page() + 1)" [disabled]="store.page() + 1 >= store.totalPages()" class="btn btn-secondary btn-sm">Siguiente</button>
                </nav>
              }
            }
          }
        }
      } @else {
        <p class="font-medium text-muted">Crea una categoría para empezar a añadir productos.</p>
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
