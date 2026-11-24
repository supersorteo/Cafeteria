import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export type CouponType = 'DESCUENTO' | 'VIGENCIA' | 'CAMBIO' | 'REGALO' | 'OTRO';
export type CouponStatus = 'ACTIVE' | 'INACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'EXHAUSTED';

export interface Coupon {
  id: string;
  code: string;
  type: CouponType;
  title: string;
  benefit: string;
  validityText: string | null;
  startsOn: string | null;
  endsOn: string | null;
  weekdays: string | null;
  timeFrom: string | null;
  timeTo: string | null;
  maxRedemptions: number | null;
  redemptions: number;
  featured: boolean;
  active: boolean;
  version: number;
  status: CouponStatus;
  counted: boolean;
}

export interface CouponPayload {
  code: string;
  type: CouponType;
  title: string;
  benefit: string;
  validityText: string | null;
  startsOn: string | null;
  endsOn: string | null;
  weekdays: string | null;
  timeFrom: string | null;
  timeTo: string | null;
  maxRedemptions: number | null;
  featured: boolean;
  active: boolean;
  version: number | null;
}

const API = '/api/v1/admin/coupons';

@Injectable({ providedIn: 'root' })
export class CouponsApi {
  private readonly http = inject(HttpClient);

  list(): Observable<Coupon[]> {
    return this.http.get<Coupon[]>(API);
  }

  create(payload: CouponPayload): Observable<Coupon> {
    return this.http.post<Coupon>(API, payload);
  }

  update(id: string, payload: CouponPayload): Observable<Coupon> {
    return this.http.put<Coupon>(`${API}/${id}`, payload);
  }

  redeem(id: string): Observable<Coupon> {
    return this.http.post<Coupon>(`${API}/${id}/redeem`, null);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API}/${id}`);
  }
}
