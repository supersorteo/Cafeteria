import { Injectable, computed, signal } from '@angular/core';

export type CouponType = 'DESCUENTO' | 'VIGENCIA' | 'CAMBIO' | 'REGALO' | 'OTRO';

export interface Coupon {
  id: string;
  code: string;
  type: CouponType;
  title: string;
  benefit: string;
  validity: string;
  active: boolean;
}

@Injectable({ providedIn: 'root' })
export class CouponsStore {
  readonly coupons = signal<Coupon[]>([]);
  readonly activeCoupons = computed(() => this.coupons().filter(coupon => coupon.active));
  readonly maxCoupons = 15;

  create(coupon: Omit<Coupon, 'id'>): Coupon | null {
    if (this.coupons().length >= this.maxCoupons) {
      return null;
    }
    const created = { ...coupon, id: `coupon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
    this.coupons.update(list => [...list, created]);
    return created;
  }

  update(id: string, changes: Omit<Coupon, 'id'>): void {
    this.coupons.update(list => list.map(coupon => coupon.id === id ? { ...changes, id } : coupon));
  }

  toggle(id: string): void {
    this.coupons.update(list => list.map(coupon => coupon.id === id ? { ...coupon, active: !coupon.active } : coupon));
  }

  remove(id: string): void {
    this.coupons.update(list => list.filter(coupon => coupon.id !== id));
  }
}
