import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '../core/auth.service';
import { vi } from 'vitest';
import { BillingOptions, OrderReceipt } from '../core/billing.api';
import { answer, settle } from '../testing/http';
import { BuyPage } from './buy.page';
import { OrderResultPage } from './order-result.page';
import { PricingPage } from './pricing.page';

@Component({ template: '' })
class RegisterStub {}

const API = '/api/v1/public/billing';
const OPTIONS: BillingOptions = {
  plans: [
    { code: 'EMPRENDEDOR', name: 'Emprendedor', months: 1, usdCents: 900, maxMenuItems: 50, maxActiveCoupons: 15, maxGallery: 6, maxTableQr: 0, fullBranding: false, advancedCoupons: false, tableQr: false, prioritySupport: false, stats: false },
    { code: 'PROFESIONAL', name: 'Profesional', months: 1, usdCents: 1900, maxMenuItems: 100, maxActiveCoupons: 35, maxGallery: 15, maxTableQr: 30, fullBranding: true, advancedCoupons: true, tableQr: true, prioritySupport: true, stats: false },
  ],
  regions: [
    { code: 'AR', name: 'Argentina', whatsapp: true, whatsappNumber: '5491100000001', methods: [
      { code: 'WHATSAPP', name: 'WhatsApp', available: true }, { code: 'MERCADOPAGO', name: 'Mercado Pago', available: false }, { code: 'PAYPAL', name: 'PayPal', available: false }] },
    { code: 'UY', name: 'Uruguay', whatsapp: true, whatsappNumber: '59899000002', methods: [
      { code: 'WHATSAPP', name: 'WhatsApp', available: true }, { code: 'PAYPAL', name: 'PayPal', available: false }] },
  ],
};
const receipt = (overrides: Partial<OrderReceipt> = {}): OrderReceipt => ({
  reference: 'PED-ABCD2345', status: 'PENDING', planName: 'Profesional', months: 1, usdCents: 1900, region: 'UY',
  whatsappNumber: '59899000002', message: 'Hola, quiero el plan Profesional. Mi pedido es PED-ABCD2345.', expiresAt: '2026-12-01T12:00:00Z', emailHint: 'a***@ejemplo.test', ...overrides,
});

describe('billing', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let router: Router;

  const root = () => harness.routeNativeElement as HTMLElement;
  const text = () => root().textContent ?? '';
  const ui = async () => {
    await settle();
    harness.detectChanges();
    await settle();
    harness.detectChanges();
  };
  const set = (selector: string, value: string) => {
    const field = root().querySelector(selector) as HTMLInputElement;
    field.value = value;
    field.dispatchEvent(new Event('input'));
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'precios', component: PricingPage },
          { path: 'comprar', component: BuyPage },
          { path: 'pago/resultado', component: OrderResultPage },
          { path: 'auth/register', component: RegisterStub },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { ensureCsrf: () => Promise.resolve() } },
      ],
    });
    harness = await RouterTestingHarness.create();
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => http.verify());

  it('should show both plans with price and what changes between them', async () => {
    await harness.navigateByUrl('/precios');
    await answer(http, `${API}/options`, OPTIONS);
    await ui();

    const cards = root().querySelectorAll('[data-plan]');
    expect(cards.length).toBe(2);
    expect(text()).toContain('US$ 9');
    expect(text()).toContain('US$ 19');
    expect(text()).toContain('Hasta 50 platos');
    expect(text()).toContain('Hasta 100 platos');
    expect(text()).toContain('Tu logo y 2 colores');
    expect(text()).toContain('Marca completa: 7 colores y 8 fuentes');
    expect(text()).toContain('QR por mesa');
    expect(text()).toContain('Más elegido');
    expect(root().querySelector('[data-plan="EMPRENDEDOR"] [data-choose]')?.getAttribute('href')).toBe('/comprar?plan=EMPRENDEDOR');
  });

  it('should offer a retry when the plans cannot be loaded', async () => {
    await harness.navigateByUrl('/precios');
    await answer(http, `${API}/options`, {}, { status: 500, statusText: 'Error' });
    await ui();
    expect(root().querySelector('[role="alert"]')?.textContent).toContain('No pudimos cargar los planes');

    (root().querySelector('[data-retry]') as HTMLElement).click();
    await answer(http, `${API}/options`, OPTIONS);
    await ui();
    expect(root().querySelectorAll('[data-plan]').length).toBe(2);
  });

  describe('buy page', () => {
    const submit = () => (root().querySelector('[data-buy-form]') as HTMLFormElement).dispatchEvent(new Event('submit'));
    const choose = async (selector: string) => {
      (root().querySelector(selector) as HTMLInputElement).dispatchEvent(new Event('change'));
      await ui();
    };
    const button = () => root().querySelector('[data-submit]') as HTMLButtonElement;

    async function open(url = '/comprar') {
      await harness.navigateByUrl(url);
      await answer(http, `${API}/options`, OPTIONS);
      await ui();
    }

    it('should start with nothing selected and not let the customer continue until choosing a plan', async () => {
      await open();
      expect(root().querySelectorAll('[data-steps] li').length).toBe(3);
      expect(root().querySelectorAll('[data-plan]:checked').length).toBe(0);
      expect(button().disabled).toBe(true);

      await choose('[data-plan="PROFESIONAL"]');
      expect(button().disabled).toBe(false);
    });

    it('should preselect only the plan that comes from a pricing link and skip to the country', async () => {
      await open('/comprar?plan=EMPRENDEDOR');
      expect(root().querySelector('[data-plan]')).toBeNull();
      expect(root().querySelectorAll('[data-region]:checked').length).toBe(0);
      expect(button().disabled).toBe(true);
    });

    it('should not choose a country or a payment method by itself', async () => {
      await open('/comprar?plan=EMPRENDEDOR');
      await choose('[data-region="UY"]');
      expect(button().disabled).toBe(false);
      submit();
      await ui();

      expect(root().querySelectorAll('[data-method]:checked').length).toBe(0);
      expect(button().disabled).toBe(true);
      expect(button().textContent).toContain('Continuar');
    });

    it('should go back to the previous step', async () => {
      await open('/comprar?plan=EMPRENDEDOR');
      await choose('[data-region="UY"]');
      submit();
      await ui();
      (root().querySelector('[data-back]') as HTMLElement).click();
      await ui();
      expect((root().querySelector('[data-region="UY"]') as HTMLInputElement).checked).toBe(true);
    });

    it('should offer WhatsApp and show the online methods as coming soon', async () => {
      await open('/comprar?plan=EMPRENDEDOR');
      await choose('[data-region="UY"]');
      submit();
      await ui();
      expect((root().querySelector('[data-method="WHATSAPP"]') as HTMLInputElement).disabled).toBe(false);
      expect((root().querySelector('[data-method="PAYPAL"]') as HTMLInputElement).disabled).toBe(true);
      expect(root().querySelectorAll('[data-soon]').length).toBeGreaterThan(0);

      await choose('[data-method="WHATSAPP"]');
      expect(button().disabled).toBe(false);
      expect(button().textContent).toContain('Abrir WhatsApp');
    });

    it('should show Mercado Pago only for Argentina and forget the method when the country changes', async () => {
      await open('/comprar?plan=EMPRENDEDOR');
      await choose('[data-region="AR"]');
      submit();
      await ui();
      expect(root().querySelector('[data-method="MERCADOPAGO"]')).not.toBeNull();
      await choose('[data-method="WHATSAPP"]');

      (root().querySelector('[data-back]') as HTMLElement).click();
      await ui();
      await choose('[data-region="UY"]');
      submit();
      await ui();
      expect(root().querySelector('[data-method="MERCADOPAGO"]')).toBeNull();
      expect(root().querySelectorAll('[data-method]:checked').length).toBe(1);
    });

    it('should open WhatsApp with a ready message and take the customer to the registration without creating any order', async () => {
      const open$ = vi.spyOn(window, 'open').mockReturnValue(null);
      await open('/comprar?plan=EMPRENDEDOR');
      await choose('[data-region="UY"]');
      submit();
      await ui();
      expect(root().querySelector('[data-summary]')?.textContent).toContain('Plan Emprendedor · US$ 9 al mes · Uruguay');
      await choose('[data-method="WHATSAPP"]');
      submit();
      await ui();

      const url = open$.mock.calls[0][0] as string;
      expect(url.startsWith('https://wa.me/59899000002?text=')).toBe(true);
      expect(decodeURIComponent(url.split('text=')[1])).toBe(
        'Hola, quiero contratar el plan *Emprendedor* de Deliora (US$ 9 por mes).' + String.fromCharCode(10)
        + 'Estoy en Uruguay. ¿Me indican cómo realizar el pago para recibir mi código de activación?' + String.fromCharCode(10) + 'Gracias.');
      expect(decodeURIComponent(url)).not.toContain('PED-');
      expect(open$.mock.calls[0][1]).toBe('_blank');
      expect(router.url).toBe('/auth/register?from=whatsapp&plan=EMPRENDEDOR');
      http.expectNone(`${API}/orders`);
      open$.mockRestore();
    });
  });

  describe('result page', () => {
    async function open(order: OrderReceipt | null) {
      await harness.navigateByUrl('/pago/resultado?ref=PED-ABCD2345');
      if (order) {
        await answer(http, `${API}/orders/PED-ABCD2345`, order);
      } else {
        await answer(http, `${API}/orders/PED-ABCD2345`, { code: 'not_found' }, { status: 404, statusText: 'Not Found' });
      }
      await ui();
    }

    it('should show the reference and a WhatsApp link with the prepared message while pending', async () => {
      await open(receipt());
      expect(root().querySelector('[data-reference]')?.textContent).toContain('PED-ABCD2345');
      const href = root().querySelector('[data-whatsapp]')?.getAttribute('href') ?? '';
      expect(href.startsWith('https://wa.me/59899000002?text=')).toBe(true);
      expect(decodeURIComponent(href)).toContain('PED-ABCD2345');
    });

    it('should tell the customer the code was sent once the payment is confirmed', async () => {
      await open(receipt({ status: 'PAID' }));
      expect(root().querySelector('[data-paid]')?.textContent).toContain('Pago confirmado');
      expect(root().querySelector('[data-email-hint]')?.textContent).toContain('a***@ejemplo.test');
      expect(root().querySelectorAll('[data-tracker] li').length).toBe(4);
      expect(root().querySelector('[data-whatsapp]')).toBeNull();
    });

    it('should say the order was not found', async () => {
      await open(null);
      expect(root().querySelector('[data-missing]')).not.toBeNull();
    });
  });
});
