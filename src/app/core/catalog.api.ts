import { HttpClient, HttpEventType, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, filter, map } from 'rxjs';
import { Category, ItemPayload, MediaAsset, MenuItem, Page, SiteSettings, UploadEvent } from './catalog.models';

const ADMIN = '/api/v1/admin';

@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private readonly http = inject(HttpClient);

  site(): Observable<SiteSettings> {
    return this.http.get<SiteSettings>(`${ADMIN}/site`);
  }

  categories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${ADMIN}/categories`);
  }

  createCategory(name: string): Observable<Category> {
    return this.http.post<Category>(`${ADMIN}/categories`, { name });
  }

  renameCategory(id: string, name: string, version: number): Observable<Category> {
    return this.http.put<Category>(`${ADMIN}/categories/${id}`, { name, version });
  }

  deleteCategory(id: string): Observable<void> {
    return this.http.delete<void>(`${ADMIN}/categories/${id}`);
  }

  reorderCategories(ids: string[]): Observable<Category[]> {
    return this.http.put<Category[]>(`${ADMIN}/categories/order`, { ids });
  }

  items(categoryId: string, active: boolean | null, page: number, size: number): Observable<Page<MenuItem>> {
    let params = new HttpParams().set('categoryId', categoryId).set('page', page).set('size', size);
    if (active !== null) {
      params = params.set('active', active);
    }
    return this.http.get<Page<MenuItem>>(`${ADMIN}/menu-items`, { params });
  }

  createItem(payload: ItemPayload): Observable<MenuItem> {
    return this.http.post<MenuItem>(`${ADMIN}/menu-items`, payload);
  }

  updateItem(id: string, payload: ItemPayload): Observable<MenuItem> {
    return this.http.put<MenuItem>(`${ADMIN}/menu-items/${id}`, payload);
  }

  deleteItem(id: string): Observable<void> {
    return this.http.delete<void>(`${ADMIN}/menu-items/${id}`);
  }

  reorderItems(categoryId: string, ids: string[]): Observable<MenuItem[]> {
    return this.http.put<MenuItem[]>(`${ADMIN}/categories/${categoryId}/item-order`, { ids });
  }

  upload(file: File): Observable<UploadEvent> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<MediaAsset>(`${ADMIN}/media`, body, { reportProgress: true, observe: 'events' }).pipe(
      map((event): UploadEvent | null => {
        if (event.type === HttpEventType.UploadProgress) {
          return { kind: 'progress', percent: event.total ? Math.round((100 * event.loaded) / event.total) : 0 };
        }
        return event.type === HttpEventType.Response && event.body ? { kind: 'done', media: event.body } : null;
      }),
      filter((event): event is UploadEvent => event !== null),
    );
  }

  deleteMedia(id: string): Observable<void> {
    return this.http.delete<void>(`${ADMIN}/media/${id}`);
  }
}
