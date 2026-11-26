import { InjectionToken } from '@angular/core';

const loading = new Map<string, Promise<void>>();

export function loadScript(src: string): Promise<void> {
  const cached = loading.get(src);
  if (cached) {
    return cached;
  }
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading.delete(src);
      script.remove();
      reject(new Error(`No se pudo cargar ${src}`));
    };
    document.head.appendChild(script);
  });
  loading.set(src, promise);
  return promise;
}

export const SDK_LOADER = new InjectionToken<(src: string) => Promise<void>>('sdk-loader', { factory: () => loadScript });

export const PAGE_REDIRECT = new InjectionToken<(url: string) => void>('page-redirect', {
  factory: () => (url: string) => window.location.assign(url),
});

export interface PaymentWindow {
  readonly closed: boolean;
  location: { href: string };
  focus(): void;
  close(): void;
}

export const PAYMENT_WINDOW = new InjectionToken<() => PaymentWindow | null>('payment-window', {
  factory: () => () => {
    const width = 520;
    const height = 760;
    const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
    const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
    const popup = window.open('', 'deliora-mercadopago', `popup=yes,width=${width},height=${height},left=${left},top=${top}`);
    if (popup) {
      try {
        popup.document.title = 'Mercado Pago';
        popup.document.body.style.cssText = 'margin:0;display:grid;place-items:center;height:100vh;font:600 16px system-ui,sans-serif;color:#334155';
        popup.document.body.textContent = 'Abriendo Mercado Pago…';
      } catch {
        // la ventana ya navegó a otro origen
      }
    }
    return popup;
  },
});

export interface CheckoutMessage {
  type: 'mp-return' | 'mp-ack' | 'email-code' | 'email-ack';
  reference?: string;
  paymentId?: string | null;
  email?: string;
  code?: string;
}

export interface CheckoutChannel {
  onmessage: ((event: MessageEvent<CheckoutMessage>) => void) | null;
  postMessage(message: CheckoutMessage): void;
  close(): void;
}

export const CHECKOUT_CHANNEL = new InjectionToken<() => CheckoutChannel | null>('checkout-channel', {
  factory: () => () => (typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('deliora-checkout')),
});
