import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { SiteData } from './site.models';

@Injectable({ providedIn: 'root' })
export class SiteApi {
  private readonly http = inject(HttpClient);

  get(slug: string): Observable<SiteData> {
    return this.http.get<SiteData>(`/api/v1/public/sites/${encodeURIComponent(slug)}`);
  }
}
