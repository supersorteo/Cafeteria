import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface PlanOption {
  code: string;
  name: string;
  months: number;
  usdCents: number;
  maxMenuItems: number;
  maxActiveCoupons: number;
  maxGallery: number;
  maxTableQr: number;
  fullBranding: boolean;
  advancedCoupons: boolean;
  tableQr: boolean;
  prioritySupport: boolean;
  stats: boolean;
}

export interface MethodOption {
  code: 'WHATSAPP' | 'MERCADOPAGO' | 'PAYPAL' | string;
  name: string;
  available: boolean;
}

export interface RegionOption {
  code: string;
  name: string;
  whatsapp: boolean;
  whatsappNumber: string;
  methods: MethodOption[];
}

export interface BillingOptions {
  plans: PlanOption[];
  regions: RegionOption[];
}

export interface NewOrder {
  planCode: string;
  region: string;
  email: string;
  name: string;
  method: string;
}

export type OrderStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED';

export interface OrderReceipt {
  reference: string;
  status: OrderStatus;
  planName: string;
  months: number;
  usdCents: number;
  region: string;
  whatsappNumber: string;
  message: string;
  expiresAt: string;
  emailHint: string;
}

export function guessRegion(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
    if (zone.includes('Montevideo')) {
      return 'UY';
    }
    if (zone.includes('Argentina') || zone.includes('Buenos_Aires')) {
      return 'AR';
    }
    const language = (navigator.language ?? '').toUpperCase();
    return language.endsWith('-UY') ? 'UY' : language.endsWith('-AR') ? 'AR' : '';
  } catch {
    return '';
  }
}

export function formatUsd(cents: number): string {
  const value = cents / 100;
  return `US$ ${Number.isInteger(value) ? value : value.toFixed(2)}`;
}

export function whatsappMessage(plan: Pick<PlanOption, 'name' | 'usdCents'>, region: Pick<RegionOption, 'name'>): string {
  return `Hola, quiero contratar el plan *${plan.name}* de Deliora (${formatUsd(plan.usdCents)} por mes).\n`
    + `Estoy en ${region.name}. ¿Me indican cómo realizar el pago para recibir mi código de activación?\n`
    + 'Gracias.';
}

export function whatsappUrl(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export function whatsappLink(receipt: Pick<OrderReceipt, 'whatsappNumber' | 'message'>): string {
  return `https://wa.me/${receipt.whatsappNumber}?text=${encodeURIComponent(receipt.message)}`;
}

const API = '/api/v1/public/billing';

@Injectable({ providedIn: 'root' })
export class BillingApi {
  private readonly http = inject(HttpClient);

  options(): Observable<BillingOptions> {
    return this.http.get<BillingOptions>(`${API}/options`);
  }

  createOrder(body: NewOrder): Observable<OrderReceipt> {
    return this.http.post<OrderReceipt>(`${API}/orders`, body);
  }

  order(reference: string): Observable<OrderReceipt> {
    return this.http.get<OrderReceipt>(`${API}/orders/${encodeURIComponent(reference)}`);
  }
}
