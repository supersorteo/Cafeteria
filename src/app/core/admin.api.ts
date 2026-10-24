import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface Dashboard {
  slug: string;
  name: string;
  published: boolean;
  categories: number;
  activeItems: number;
  inactiveItems: number;
  images: number;
}

@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);

  dashboard(): Observable<Dashboard> {
    return this.http.get<Dashboard>('/api/v1/admin/dashboard');
  }
}
