import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '../core/auth.service';
import { vi } from 'vitest';
import { BillingOptions, OrderState } from '../core/billing.api';
import { answer, settle } from '../testing/http';
import { BuyPage, WHATSAPP_TIMINGS } from './buy.page';
import { OrderResultPage } from './order-result.page';
import { PricingPage } from './pricing.page';
import { SDK_LOADER } from './sdk-loader';

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
const ONLINE_OPTIONS: BillingOptions = {
  ...OPTIONS,
  checkout: { paypalClientId: 'cid', mercadopagoPublicKey: '' },
  regions: [
    { code: 'AR', name: 'Argentina', whatsapp: true, whatsappNumber: '5491100000001', methods: [
      { code: 'WHATSAPP', name: 'WhatsApp', available: true }, { code: 'MERCADOPAGO', name: 'Mercado Pago', available: true }, { code: 'PAYPAL', name: 'PayPal', available: true }] },
    { code: 'UY', name: 'Uruguay', whatsapp: true, whatsappNumber: '59899000002', methods: [
      { code: 'WHATSAPP', name: 'WhatsApp', available: true }, { code: 'PAYPAL', name: 'PayPal', available: true }] },
  ],
};
const state = (overrides: Partial<OrderState> = {}): OrderState => ({ reference: 'PED-ABCD2345', status: 'PENDING', method: 'PAYPAL', ready: false, failure: null, ...overrides });

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
        { provide: WHATSAPP_TIMINGS, useValue: { waitMs: 80, minAwayMs: 30 } },
        { provide: SDK_LOADER, useValue: () => new Promise<void>(() => undefined) },
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

    describe('online payment methods', () => {
      async function toPayment(region: string) {
        await harness.navigateByUrl('/comprar?plan=PROFESIONAL');
        await answer(http, `${API}/options`, ONLINE_OPTIONS);
        await ui();
        await choose(`[data-region="${region}"]`);
        submit();
        await ui();
      }

      it('should keep three steps for WhatsApp and add the data step only for an online method', async () => {
        await toPayment('AR');
        expect(root().querySelectorAll('[data-steps] li').length).toBe(3);

        await choose('[data-method="PAYPAL"]');
        expect(root().querySelectorAll('[data-steps] li').length).toBe(4);
        expect(button().textContent).toContain('Continuar');
      });

      it('should show the registration and payment step after choosing PayPal, and allow going back', async () => {
        await toPayment('UY');
        await choose('[data-method="PAYPAL"]');
        submit();
        await ui();

        expect(root().querySelector('[data-online-checkout]')).not.toBeNull();
        expect(root().querySelector('[data-total]')?.textContent).toContain('Plan Profesional · US$ 19 al mes · Uruguay');
        expect(root().querySelector('[data-submit]')).toBeNull();

        (root().querySelector('[data-back]') as HTMLElement).click();
        await ui();
        expect((root().querySelector('[data-method="PAYPAL"]') as HTMLInputElement).checked).toBe(true);
      });

      it('should offer Mercado Pago only to Argentina', async () => {
        await toPayment('AR');
        await choose('[data-method="MERCADOPAGO"]');
        submit();
        await ui();

        expect(root().querySelector('[data-mp-start]')).not.toBeNull();
        expect(root().querySelector('[data-total]')?.textContent).toContain('Argentina');
      });
    });

    describe('opening WhatsApp', () => {
      const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      let opened: string[];
      let click: ReturnType<typeof vi.spyOn>;
      const status = () => root().querySelector('[data-wa-status]')?.getAttribute('data-wa-status');

      async function toPayment() {
        await open('/comprar?plan=EMPRENDEDOR');
        await choose('[data-region="UY"]');
        submit();
        await ui();
        await choose('[data-method="WHATSAPP"]');
      }

      beforeEach(() => {
        opened = [];
        click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
          opened.push(this.getAttribute('href') ?? '');
        });
      });

      afterEach(() => click.mockRestore());

      it('should open the native app with a ready message but stay on the page, without creating any order', async () => {
        await toPayment();
        expect(root().querySelector('[data-summary]')?.textContent).toContain('Plan Emprendedor · US$ 9 al mes · Uruguay');
        submit();
        await ui();

        expect(opened.length).toBe(1);
        expect(opened[0].startsWith('whatsapp://send?phone=59899000002&text=')).toBe(true);
        expect(decodeURIComponent(opened[0].split('text=')[1])).toBe(
          'Hola, quiero contratar el plan *Emprendedor* de Deliora (US$ 9 por mes).' + String.fromCharCode(10)
          + 'Estoy en Uruguay. ¿Me indican cómo realizar el pago para recibir mi código de activación?' + String.fromCharCode(10) + 'Gracias.');
        expect(opened[0]).not.toContain('PED-');
        expect(status()).toBe('opening');
        expect(router.url).toBe('/comprar?plan=EMPRENDEDOR');
        http.expectNone(`${API}/orders`);
      });

      it('should not go to the registration until WhatsApp was really opened and the customer comes back', async () => {
        await toPayment();
        submit();
        await ui();
        await pause(40);
        expect(router.url).toBe('/comprar?plan=EMPRENDEDOR');

        window.dispatchEvent(new Event('blur'));
        await ui();
        expect(status()).toBe('opened');
        expect(root().querySelector('[data-wa-continue]')).not.toBeNull();
        expect(router.url).toBe('/comprar?plan=EMPRENDEDOR');

        await pause(50);
        window.dispatchEvent(new Event('focus'));
        await ui();
        expect(router.url).toBe('/auth/register?from=whatsapp&plan=EMPRENDEDOR');
      });

      it('should ignore a quick blur and focus, like closing the browser permission prompt', async () => {
        await toPayment();
        submit();
        await ui();
        window.dispatchEvent(new Event('blur'));
        window.dispatchEvent(new Event('focus'));
        await ui();

        expect(router.url).toBe('/comprar?plan=EMPRENDEDOR');
        expect(status()).toBe('opening');
      });

      it('should let the customer continue by hand once WhatsApp is open', async () => {
        await toPayment();
        submit();
        await ui();
        window.dispatchEvent(new Event('blur'));
        await ui();
        (root().querySelector('[data-wa-continue]') as HTMLElement).click();
        await ui();

        expect(router.url).toBe('/auth/register?from=whatsapp&plan=EMPRENDEDOR');
      });

      it('should say WhatsApp was not detected and offer to retry, without offering WhatsApp Web', async () => {
        await toPayment();
        submit();
        await ui();
        await pause(120);
        await ui();

        expect(status()).toBe('notOpened');
        expect(router.url).toBe('/comprar?plan=EMPRENDEDOR');
        expect(root().querySelector('[data-wa-web]')).toBeNull();
        expect(root().querySelector('a[href*="wa.me"]')).toBeNull();

        (root().querySelector('[data-wa-retry]') as HTMLElement).click();
        await ui();
        expect(opened.length).toBe(2);
        expect(status()).toBe('opening');
      });
    });
  });
});
