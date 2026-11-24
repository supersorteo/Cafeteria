import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Ingredient } from './catalog.models';

const API = '/api/v1/admin/ingredients';

@Injectable({ providedIn: 'root' })
export class IngredientsApi {
  private readonly http = inject(HttpClient);

  list(): Observable<Ingredient[]> {
    return this.http.get<Ingredient[]>(API);
  }

  create(name: string): Observable<Ingredient> {
    return this.http.post<Ingredient>(API, { name });
  }

  update(id: string, name: string): Observable<Ingredient> {
    return this.http.put<Ingredient>(`${API}/${id}`, { name });
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API}/${id}`);
  }
}
