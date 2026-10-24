import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { ApiProblem, isConnectionProblem, toProblem } from '../../core/api-error';
import { CatalogApi } from '../../core/catalog.api';
import { Category, ItemPayload, MenuItem, SiteSettings, UploadEvent } from '../../core/catalog.models';
import { NoticeService } from '../../core/notice.service';

export type Result<T = void> = { ok: true; value: T } | { ok: false; problem: ApiProblem };
export type ItemFilter = 'all' | 'active' | 'inactive';
export type ImageAction = { imageId: string } | { removeImage: true } | Record<string, never>;

export interface ItemValues {
  categoryId: string;
  name: string;
  description: string;
  price: number;
  tag: string;
  active: boolean;
}

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return 'Usa una imagen JPEG, PNG o WebP.';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'La imagen supera los 5 MB permitidos.';
  }
  return null;
}

@Injectable()
export class MenuStore {
  private readonly api = inject(CatalogApi);
  private readonly notices = inject(NoticeService);
  private itemsRequest = 0;

  readonly pageSize = 10;

  readonly settings = signal<SiteSettings | null>(null);
  readonly categories = signal<Category[]>([]);
  readonly categoriesState = signal<'loading' | 'ready' | 'error'>('loading');
  readonly selectedId = signal<string | null>(null);
  readonly selected = computed(() => this.categories().find(category => category.id === this.selectedId()) ?? null);

  readonly filter = signal<ItemFilter>('all');
  readonly page = signal(0);
  readonly items = signal<MenuItem[]>([]);
  readonly totalItems = signal(0);
  readonly totalPages = signal(0);
  readonly itemsState = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');

  readonly editor = signal<{ item: MenuItem | null } | null>(null);

  readonly priceFormatter = computed(() => {
    const settings = this.settings();
    if (!settings) {
      return null;
    }
    try {
      return new Intl.NumberFormat(settings.locale, {
        style: 'currency',
        currency: settings.currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    } catch {
      return null;
    }
  });

  async init(): Promise<void> {
    this.api.site().subscribe({ next: settings => this.settings.set(settings), error: () => undefined });
    await this.loadCategories();
  }

  formatPrice(value: number): string {
    return this.priceFormatter()?.format(value) ?? value.toFixed(2);
  }

  async loadCategories(): Promise<void> {
    if (this.categories().length === 0) {
      this.categoriesState.set('loading');
    }
    try {
      const categories = await firstValueFrom(this.api.categories());
      this.categories.set(categories);
      this.categoriesState.set('ready');
      if (!categories.some(category => category.id === this.selectedId())) {
        this.selectedId.set(categories[0]?.id ?? null);
        this.page.set(0);
      }
      await this.loadItems();
    } catch {
      this.categoriesState.set('error');
    }
  }

  async select(id: string): Promise<void> {
    if (id === this.selectedId()) {
      return;
    }
    this.selectedId.set(id);
    this.page.set(0);
    await this.loadItems();
  }

  async setFilter(filter: ItemFilter): Promise<void> {
    this.filter.set(filter);
    this.page.set(0);
    await this.loadItems();
  }

  async goToPage(page: number): Promise<void> {
    this.page.set(Math.max(0, page));
    await this.loadItems();
  }

  async loadItems(): Promise<void> {
    const categoryId = this.selectedId();
    if (!categoryId) {
      this.items.set([]);
      this.totalItems.set(0);
      this.totalPages.set(0);
      this.itemsState.set('idle');
      return;
    }
    const request = ++this.itemsRequest;
    this.itemsState.set('loading');
    try {
      const result = await firstValueFrom(this.api.items(categoryId, this.activeParam(), this.page(), this.pageSize));
      if (request !== this.itemsRequest) {
        return;
      }
      if (result.content.length === 0 && result.totalPages > 0 && this.page() > 0) {
        this.page.set(result.totalPages - 1);
        await this.loadItems();
        return;
      }
      this.items.set(result.content);
      this.totalItems.set(result.totalElements);
      this.totalPages.set(result.totalPages);
      this.itemsState.set('ready');
    } catch {
      if (request === this.itemsRequest) {
        this.itemsState.set('error');
      }
    }
  }

  async createCategory(name: string): Promise<Result<Category>> {
    return this.run(async () => {
      const created = await firstValueFrom(this.api.createCategory(name.trim()));
      this.categories.update(list => [...list, created]);
      if (!this.selectedId()) {
        this.selectedId.set(created.id);
        await this.loadItems();
      }
      return created;
    });
  }

  async renameCategory(category: Category, name: string): Promise<Result<Category>> {
    return this.run(async () => {
      const updated = await firstValueFrom(this.api.renameCategory(category.id, name.trim(), category.version));
      this.categories.update(list => list.map(c => (c.id === updated.id ? updated : c)));
      return updated;
    });
  }

  async deleteCategory(category: Category): Promise<Result> {
    return this.run(async () => {
      await firstValueFrom(this.api.deleteCategory(category.id));
      const remaining = this.categories().filter(c => c.id !== category.id);
      this.categories.set(remaining);
      if (this.selectedId() === category.id) {
        this.selectedId.set(remaining[0]?.id ?? null);
        this.page.set(0);
        await this.loadItems();
      }
    });
  }

  async moveCategory(category: Category, delta: -1 | 1): Promise<Result> {
    const ids = this.categories().map(c => c.id);
    const index = ids.indexOf(category.id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= ids.length) {
      return { ok: true, value: undefined };
    }
    [ids[index], ids[target]] = [ids[target], ids[index]];
    return this.run(async () => {
      this.categories.set(await firstValueFrom(this.api.reorderCategories(ids)));
    });
  }

  openEditor(item: MenuItem | null): void {
    this.editor.set({ item });
  }

  closeEditor(): void {
    this.editor.set(null);
  }

  async saveItem(editing: MenuItem | null, values: ItemValues, image: ImageAction): Promise<Result<MenuItem>> {
    const payload: ItemPayload = {
      categoryId: values.categoryId,
      name: values.name.trim(),
      description: values.description.trim() || null,
      price: values.price,
      tag: values.tag.trim() || null,
      active: values.active,
      version: editing?.version ?? null,
      ...image,
    };
    return this.run(async () => {
      const saved = editing
        ? await firstValueFrom(this.api.updateItem(editing.id, payload))
        : await firstValueFrom(this.api.createItem(payload));
      if (saved.categoryId !== this.selectedId()) {
        this.selectedId.set(saved.categoryId);
        this.page.set(0);
      }
      await this.loadItems();
      return saved;
    });
  }

  async toggleActive(item: MenuItem): Promise<Result<MenuItem>> {
    const payload: ItemPayload = {
      categoryId: item.categoryId,
      name: item.name,
      description: item.description,
      price: item.price,
      tag: item.tag,
      active: !item.active,
      version: item.version,
    };
    return this.run(async () => {
      const updated = await firstValueFrom(this.api.updateItem(item.id, payload));
      if (this.filter() === 'all') {
        this.items.update(list => list.map(i => (i.id === updated.id ? updated : i)));
      } else {
        await this.loadItems();
      }
      return updated;
    });
  }

  async deleteItem(item: MenuItem): Promise<Result> {
    return this.run(async () => {
      await firstValueFrom(this.api.deleteItem(item.id));
      await this.loadItems();
    });
  }

  async moveItem(item: MenuItem, delta: -1 | 1): Promise<Result> {
    return this.run(async () => {
      const ids = await this.allItemIds(item.categoryId);
      const index = ids.indexOf(item.id);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= ids.length) {
        return;
      }
      [ids[index], ids[target]] = [ids[target], ids[index]];
      await firstValueFrom(this.api.reorderItems(item.categoryId, ids));
      await this.loadItems();
    });
  }

  uploadImage(file: File): Observable<UploadEvent> {
    return this.api.upload(file);
  }

  async discardUpload(mediaId: string): Promise<void> {
    try {
      await firstValueFrom(this.api.deleteMedia(mediaId));
    } catch {
      // Una imagen sin uso la limpia el backend pasadas 24 horas.
    }
  }

  private activeParam(): boolean | null {
    return this.filter() === 'all' ? null : this.filter() === 'active';
  }

  private async allItemIds(categoryId: string): Promise<string[]> {
    const ids: string[] = [];
    for (let page = 0; ; page++) {
      const result = await firstValueFrom(this.api.items(categoryId, null, page, 100));
      ids.push(...result.content.map(item => item.id));
      if (page + 1 >= result.totalPages) {
        return ids;
      }
    }
  }

  private async run<T>(action: () => Promise<T>): Promise<Result<T>> {
    try {
      return { ok: true, value: await action() };
    } catch (error) {
      const problem = toProblem(error);
      if (isConnectionProblem(problem)) {
        this.notices.show('error', 'No pudimos conectar con el servidor. Inténtalo de nuevo.');
      }
      return { ok: false, problem };
    }
  }
}
