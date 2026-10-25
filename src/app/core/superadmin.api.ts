import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface SuperAdminTenant {
  id: string;
  slug: string;
  name: string;
  published: boolean;
  suspended: boolean;
  suspendedAt: string | null;
  ownerEmail: string | null;
  ownerVerified: boolean;
  editors: number;
  createdAt: string;
}

export interface SuperAdminTenantPage {
  content: SuperAdminTenant[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface SuperAdminStats {
  total: number;
  active: number;
  suspended: number;
  published: number;
  newLast7Days: number;
}

export interface SuperAdminAudit {
  id: string;
  at: string;
  action: string;
  targetLabel: string | null;
  actor: string;
  ip: string | null;
  detail: string | null;
}

export type TenantStatusFilter = 'all' | 'active' | 'suspended';

const API = '/api/v1/superadmin';

@Injectable({ providedIn: 'root' })
export class SuperAdminApi {
  private readonly http = inject(HttpClient);

  stats(): Observable<SuperAdminStats> {
    return this.http.get<SuperAdminStats>(`${API}/stats`);
  }

  tenants(query: string, status: TenantStatusFilter, page: number, size = 10): Observable<SuperAdminTenantPage> {
    let params = new HttpParams().set('status', status).set('page', page).set('size', size);
    if (query.trim()) {
      params = params.set('query', query.trim());
    }
    return this.http.get<SuperAdminTenantPage>(`${API}/tenants`, { params });
  }

  suspend(id: string): Observable<void> {
    return this.http.post<void>(`${API}/tenants/${id}/suspend`, null);
  }

  activate(id: string): Observable<void> {
    return this.http.post<void>(`${API}/tenants/${id}/activate`, null);
  }

  remove(id: string, confirmSlug: string): Observable<void> {
    return this.http.request<void>('DELETE', `${API}/tenants/${id}`, { body: { confirmSlug } });
  }

  audit(limit = 50): Observable<SuperAdminAudit[]> {
    return this.http.get<SuperAdminAudit[]>(`${API}/audit`, { params: { limit } });
  }
}
