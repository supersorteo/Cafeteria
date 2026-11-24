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
  planExpiresAt: string | null;
  planStatus: 'ACTIVE' | 'EXPIRED';
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

export type CodeStatus = 'AVAILABLE' | 'REDEEMED' | 'DISABLED';
export type CodeStatusFilter = 'all' | CodeStatus;
export const PLAN_OPTIONS = [
  { code: 'EMPRENDEDOR', label: 'Emprendedor' },
  { code: 'PROFESIONAL', label: 'Profesional' },
] as const;

export const DURATIONS = [
  { months: 1, label: '1 mes' },
  // Por ahora solo se venden planes de 1 mes; reactivar estas opciones cuando se ofrezcan.
  // { months: 3, label: '3 meses' },
  // { months: 6, label: '6 meses' },
  // { months: 12, label: '1 año' },
] as const;

export const DURATION_LABELS: Record<number, string> = { 1: '1 mes', 3: '3 meses', 6: '6 meses', 12: '1 año' };

export interface ActivationCode {
  id: string;
  code: string;
  durationMonths: number;
  status: CodeStatus;
  batchId: string;
  batchLabel: string;
  createdAt: string;
  redeemedAt: string | null;
  redeemedByEmail: string | null;
  tenantSlug: string | null;
  tenantName: string | null;
  tenantCreatedAt: string | null;
  planExpiresAt: string | null;
  planStatus: 'ACTIVE' | 'EXPIRED' | null;
  planCode?: string | null;
}

export interface CodePage {
  content: ActivationCode[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface CodeBatch {
  id: string;
  label: string;
  durationMonths: number;
  quantity: number;
  note: string | null;
  createdBy: string;
  createdAt: string;
  available: number;
  redeemed: number;
  disabled: number;
  planCode?: string | null;
}

export interface CodeStats {
  available: number;
  redeemed: number;
  disabled: number;
  plansExpiringSoon: number;
  plansExpired: number;
}

export interface GeneratedBatch {
  id: string;
  label: string;
  durationMonths: number;
  planCode?: string | null;
  codes: string[];
}

export interface CodeFilters {
  status: CodeStatusFilter;
  durationMonths: number | null;
  batchId: string;
  query: string;
}

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

  codeStats(): Observable<CodeStats> {
    return this.http.get<CodeStats>(`${API}/codes/stats`);
  }

  codeBatches(): Observable<CodeBatch[]> {
    return this.http.get<CodeBatch[]>(`${API}/codes/batches`);
  }

  codes(filters: CodeFilters, page: number, size = 12): Observable<CodePage> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (filters.status !== 'all') {
      params = params.set('status', filters.status);
    }
    if (filters.durationMonths !== null) {
      params = params.set('durationMonths', filters.durationMonths);
    }
    if (filters.batchId) {
      params = params.set('batchId', filters.batchId);
    }
    if (filters.query.trim()) {
      params = params.set('query', filters.query.trim());
    }
    return this.http.get<CodePage>(`${API}/codes`, { params });
  }

  createBatch(body: { label: string; durationMonths: number; quantity: number; note: string; planCode?: string }): Observable<GeneratedBatch> {
    return this.http.post<GeneratedBatch>(`${API}/codes/batches`, body);
  }

  disableCode(id: string): Observable<void> {
    return this.http.post<void>(`${API}/codes/${id}/disable`, null);
  }

  enableCode(id: string): Observable<void> {
    return this.http.post<void>(`${API}/codes/${id}/enable`, null);
  }

  deleteCode(id: string, confirmSlug?: string): Observable<void> {
    return this.http.request<void>('DELETE', `${API}/codes/${id}`, confirmSlug ? { body: { confirmSlug } } : {});
  }

  audit(limit = 50): Observable<SuperAdminAudit[]> {
    return this.http.get<SuperAdminAudit[]>(`${API}/audit`, { params: { limit } });
  }
}
