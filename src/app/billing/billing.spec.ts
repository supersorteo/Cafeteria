import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '../core/auth.service';
import { vi } from 'vitest';
import { BillingOptions, OrderReceipt, guessRegion } from '../core/billing.api';
import { answer, settle } from '../testing/http';
import { BuyPage } from './buy.page';
import { OrderResultPage } from './order-result.page';
import { PricingPage } from './pricing.page';

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

    async function open(url = '/comprar') {
      await harness.navigateByUrl(url);
      await answer(http, `${API}/options`, OPTIONS);
      await ui();
    }

    afterEach(() => localStorage.removeItem('deliora.lastOrder'));

    it('should start by asking for the plan, with the most popular one preselected', async () => {
      await open();
      expect(root().querySelector('[data-steps]')).not.toBeNull();
      expect((root().querySelector('[data-plan="PROFESIONAL"]') as HTMLInputElement).checked).toBe(true);
    });

    it('should skip the plan step when it comes from a pricing link and preselect a country', async () => {
      await open('/comprar?plan=EMPRENDEDOR');
      expect(root().querySelector('[data-plan]')).toBeNull();
      expect(root().querySelectorAll('[data-region]:checked').length).toBe(1);
    });

    it('should guess the country from the time zone', () => {
      const zone = vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions');
      zone.mockReturnValue({ timeZone: 'America/Montevideo' } as Intl.ResolvedDateTimeFormatOptions);
      expect(guessRegion()).toBe('UY');
      zone.mockReturnValue({ timeZone: 'America/Argentina/Buenos_Aires' } as Intl.ResolvedDateTimeFormatOptions);
      expect(guessRegion()).toBe('AR');
      zone.mockRestore();
    });

    it('should go back to the previous step', async () => {
      await open('/comprar?plan=EMPRENDEDOR');
      (root().querySelector('[data-back]') as HTMLElement).click();
      await ui();
      expect(root().querySelector('[data-plan="EMPRENDEDOR"]')).not.toBeNull();
    });

    it('should ask how to pay after the country, with WhatsApp available and the online methods marked as coming soon', async () => {
      await open('/comprar?plan=EMPRENDEDOR');
      submit();
      await ui();
      expect(root().querySelector('[data-method="WHATSAPP"]')).not.toBeNull();
      expect((root().querySelector('[data-method="WHATSAPP"]') as HTMLInputElement).checked).toBe(true);
      expect((root().querySelector('[data-method="PAYPAL"]') as HTMLInputElement).disabled).toBe(true);
      expect(root().querySelectorAll('[data-soon]').length).toBeGreaterThan(0);
    });

    it('should show Mercado Pago only for Argentina', async () => {
      await open('/comprar?plan=EMPRENDEDOR');
      (root().querySelector('[data-region="AR"]') as HTMLInputElement).dispatchEvent(new Event('change'));
      submit();
      await ui();
      expect(root().querySelector('[data-method="MERCADOPAGO"]')).not.toBeNull();

      (root().querySelector('[data-back]') as HTMLElement).click();
      await ui();
      (root().querySelector('[data-region="UY"]') as HTMLInputElement).dispatchEvent(new Event('change'));
      submit();
      await ui();
      expect(root().querySelector('[data-method="MERCADOPAGO"]')).toBeNull();
    });

    it('should ask for a valid email on the last step without calling the server', async () => {
      await open('/comprar?plan=EMPRENDEDOR');
      submit();
      await ui();
      submit();
      await ui();
      set('[data-email]', 'no-es-correo');
      submit();
      await ui();
      expect(root().querySelector('[data-error]')?.textContent).toContain('correo válido');
    });

    it('should create the order with the chosen plan, country and method, remember it and go to the result page', async () => {
      await open('/comprar?plan=EMPRENDEDOR');
      (root().querySelector('[data-region="UY"]') as HTMLInputElement).dispatchEvent(new Event('change'));
      await ui();
      submit();
      await ui();
      submit();
      await ui();
      expect(root().querySelector('[data-summary]')?.textContent).toContain('Plan Emprendedor · US$ 9 al mes · Uruguay · WhatsApp');
      set('[data-name]', 'Ana');
      set('[data-email]', 'ana@ejemplo.test');
      await ui();
      submit();
      const request = await answer(http, `${API}/orders`, receipt({ planName: 'Emprendedor' }), { status: 201, statusText: 'Created' }, 'POST');
      await answer(http, `${API}/orders/PED-ABCD2345`, receipt({ planName: 'Emprendedor' }));
      await ui();

      expect(request.request.body).toEqual({ planCode: 'EMPRENDEDOR', region: 'UY', email: 'ana@ejemplo.test', name: 'Ana', method: 'WHATSAPP' });
      expect(router.url).toBe('/pago/resultado?ref=PED-ABCD2345');
      expect(localStorage.getItem('deliora.lastOrder')).toBe('PED-ABCD2345');
    });

    it('should explain when the country has no payment method available', async () => {
      await open('/comprar?plan=EMPRENDEDOR');
      submit();
      await ui();
      submit();
      await ui();
      set('[data-email]', 'ana@ejemplo.test');
      await ui();
      submit();
      await answer(http, `${API}/orders`, { code: 'method_unavailable' }, { status: 409, statusText: 'Conflict' }, 'POST');
      await ui();
      expect(root().querySelector('[data-error]')?.textContent).toContain('no está disponible en tu país');
    });

    it('should offer to resume a pending order from a previous visit', async () => {
      localStorage.setItem('deliora.lastOrder', 'PED-ABCD2345');
      await harness.navigateByUrl('/comprar');
      await answer(http, `${API}/options`, OPTIONS);
      await answer(http, `${API}/orders/PED-ABCD2345`, receipt());
      await ui();
      expect(root().querySelector('[data-resume]')?.textContent).toContain('PED-ABCD2345');
      expect(root().querySelector('[data-resume-link]')?.getAttribute('href')).toBe('/pago/resultado?ref=PED-ABCD2345');
    });

    it('should not offer to resume an order that was already paid', async () => {
      localStorage.setItem('deliora.lastOrder', 'PED-ABCD2345');
      await harness.navigateByUrl('/comprar');
      await answer(http, `${API}/options`, OPTIONS);
      await answer(http, `${API}/orders/PED-ABCD2345`, receipt({ status: 'PAID' }));
      await ui();
      expect(root().querySelector('[data-resume]')).toBeNull();
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
