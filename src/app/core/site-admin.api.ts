import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { SiteImagesPayload, SiteSettingsDetail, SiteSettingsPayload } from './site-admin.models';

const SITE = '/api/v1/admin/site';

@Injectable({ providedIn: 'root' })
export class SiteAdminApi {
  private readonly http = inject(HttpClient);

  get(): Observable<SiteSettingsDetail> {
    return this.http.get<SiteSettingsDetail>(SITE);
  }

  update(payload: SiteSettingsPayload): Observable<SiteSettingsDetail> {
    return this.http.put<SiteSettingsDetail>(SITE, payload);
  }

  saveImages(payload: SiteImagesPayload): Observable<SiteSettingsDetail> {
    return this.http.put<SiteSettingsDetail>(`${SITE}/images`, payload);
  }

  setPublication(published: boolean, version: number): Observable<SiteSettingsDetail> {
    return this.http.put<SiteSettingsDetail>(`${SITE}/publication`, { published, version });
  }
}
