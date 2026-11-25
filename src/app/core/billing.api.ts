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
  arsPrice?: number | null;
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

export interface CheckoutConfig {
  paypalClientId: string;
  mercadopagoPublicKey: string;
}

export interface BillingOptions {
  plans: PlanOption[];
  regions: RegionOption[];
  checkout?: CheckoutConfig;
}

export type OrderStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED' | 'FAILED';

export interface CheckoutBody {
  planCode: string;
  region: string;
  method: string;
  email: string;
  businessName: string;
  slug: string;
  password: string;
  emailProof: string;
}

export interface Checkout {
  reference: string;
  claimToken: string;
  method: string;
  providerRef: string;
  initPoint: string | null;
  amountLabel: string;
}

export interface OrderState {
  reference: string;
  status: OrderStatus;
  method: string;
  ready: boolean;
  failure: string | null;
}

export function formatUsd(cents: number): string {
  const value = cents / 100;
  return `US$ ${Number.isInteger(value) ? value : value.toFixed(2)}`;
}

export function formatArs(pesos: number): string {
  return `$ ${new Intl.NumberFormat('es-AR').format(pesos)} ARS`;
}

export function whatsappMessage(plan: Pick<PlanOption, 'name' | 'usdCents'>, region: Pick<RegionOption, 'name'>): string {
  return `Hola, quiero contratar el plan *${plan.name}* de Deliora (${formatUsd(plan.usdCents)} por mes).\n`
    + `Estoy en ${region.name}. ¿Me indican cómo realizar el pago para recibir mi código de activación?\n`
    + 'Gracias.';
}

export function nativeWhatsappUrl(number: string, message: string): string {
  return `whatsapp://send?phone=${number}&text=${encodeURIComponent(message)}`;
}

export function openWhatsApp(number: string, message: string): void {
  const link = document.createElement('a');
  link.href = nativeWhatsappUrl(number, message);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

const CHECKOUT_KEY = 'deliora.checkout';

export function rememberCheckout(reference: string, claimToken: string): void {
  try {
    sessionStorage.setItem(CHECKOUT_KEY, JSON.stringify({ reference, claimToken }));
  } catch {
    return;
  }
}

export function recalledCheckout(reference: string): string | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(CHECKOUT_KEY) ?? 'null') as { reference?: string; claimToken?: string } | null;
    return saved?.reference === reference ? (saved.claimToken ?? null) : null;
  } catch {
    return null;
  }
}

export function forgetCheckout(): void {
  try {
    sessionStorage.removeItem(CHECKOUT_KEY);
  } catch {
    return;
  }
}

const API = '/api/v1/public/billing';

@Injectable({ providedIn: 'root' })
export class BillingApi {
  private readonly http = inject(HttpClient);

  options(): Observable<BillingOptions> {
    return this.http.get<BillingOptions>(`${API}/options`);
  }

  checkout(body: CheckoutBody): Observable<Checkout> {
    return this.http.post<Checkout>(`${API}/checkout`, body);
  }

  orderState(reference: string): Observable<OrderState> {
    return this.http.get<OrderState>(`${API}/orders/${encodeURIComponent(reference)}/state`);
  }

  capturePayPal(reference: string): Observable<OrderState> {
    return this.http.post<OrderState>(`${API}/orders/${encodeURIComponent(reference)}/paypal/capture`, null);
  }

  verifyMercadoPago(reference: string, paymentId: string | null): Observable<OrderState> {
    return this.http.post<OrderState>(`${API}/orders/${encodeURIComponent(reference)}/mercadopago/verify`, { paymentId });
  }

  sendEmailCode(email: string): Observable<void> {
    return this.http.post<void>(`${API}/email/code`, { email });
  }

  verifyEmailCode(email: string, code: string): Observable<{ proof: string }> {
    return this.http.post<{ proof: string }>(`${API}/email/verify`, { email, code });
  }

  startSession(reference: string, claimToken: string): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(`${API}/orders/${encodeURIComponent(reference)}/session`, { claimToken });
  }
}
