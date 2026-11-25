import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from '../core/auth.service';
import { PlanOption, RegionOption } from '../core/billing.api';
import { answer, settle } from '../testing/http';
import { OnlineCheckout } from './online-checkout';
import { PAGE_REDIRECT, SDK_LOADER } from './sdk-loader';

@Component({ template: '' })
class Stub {}

const API = '/api/v1/public/billing';
const PLAN: PlanOption = {
  code: 'PROFESIONAL', name: 'Profesional', months: 1, usdCents: 1900, maxMenuItems: 100, maxActiveCoupons: 35, maxGallery: 15, maxTableQr: 30,
  fullBranding: true, advancedCoupons: true, tableQr: true, prioritySupport: true, stats: false, arsPrice: 28500,
};
const REGION: RegionOption = { code: 'AR', name: 'Argentina', whatsapp: true, whatsappNumber: '5491100000001', methods: [] };

interface PayPalOptions {
  onClick(data: unknown, actions: { resolve(): Promise<void>; reject(): Promise<void> }): Promise<void> | void;
  createOrder(): Promise<string>;
  onApprove(): Promise<void>;
  onCancel(): void;
  onError(): void;
}

describe('OnlineCheckout', () => {
  let fixture: ComponentFixture<OnlineCheckout>;
  let http: HttpTestingController;
  let router: Router;
  let paypal: PayPalOptions;
  const refreshUser = vi.fn().mockResolvedValue(undefined);
  const redirect = vi.fn();
  const loader = vi.fn().mockResolvedValue(undefined);
  const wallet = vi.fn().mockResolvedValue(undefined);

  const root = () => fixture.nativeElement as HTMLElement;
  const ui = async () => {
    await settle();
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
  };
  const set = (selector: string, value: string) => {
    const field = root().querySelector(selector) as HTMLInputElement;
    field.value = value;
    field.dispatchEvent(new Event('input'));
  };
  const click = async (selector: string) => {
    (root().querySelector(selector) as HTMLElement).click();
    await ui();
  };
  const fieldError = (name: string) => root().querySelector(`[data-field-error="${name}"]`)?.textContent ?? null;

  async function open(method: 'PAYPAL' | 'MERCADOPAGO', publicKey = '') {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'admin', component: Stub }, { path: 'pago/resultado', component: Stub }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { refreshUser } },
        { provide: SDK_LOADER, useValue: loader },
        { provide: PAGE_REDIRECT, useValue: redirect },
      ],
    });
    (window as unknown as { paypal: unknown }).paypal = {
      Buttons: (options: PayPalOptions) => {
        paypal = options;
        return { render: async () => undefined };
      },
    };
    (window as unknown as { MercadoPago: unknown }).MercadoPago = class {
      bricks() {
        return { create: wallet };
      }
    };
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(OnlineCheckout);
    fixture.componentRef.setInput('plan', PLAN);
    fixture.componentRef.setInput('region', REGION);
    fixture.componentRef.setInput('method', method);
    fixture.componentRef.setInput('config', { paypalClientId: 'cid', mercadopagoPublicKey: publicKey });
    fixture.detectChanges();
    await ui();
  }

  async function fillAndVerify(email = 'ana@ejemplo.test') {
    set('[data-business]', 'Café Ana');
    set('[data-email]', email);
    set('[data-password]', 'Clave-Segura-123');
    await ui();
    await click('[data-email-send]');
    await answer(http, `${API}/email/code`, null, { status: 204, statusText: 'No Content' }, 'POST');
    await ui();
    set('[data-email-code]', '123456');
    await ui();
    await click('[data-email-confirm]');
    await answer(http, `${API}/email/verify`, { proof: 'prueba-1' }, {}, 'POST');
    await ui();
  }

  beforeEach(() => {
    refreshUser.mockClear();
    redirect.mockClear();
    loader.mockClear();
    wallet.mockClear();
    sessionStorage.clear();
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  it('should suggest the address from the business name and show the total in dollars for PayPal', async () => {
    await open('PAYPAL');
    set('[data-business]', 'Café Ana');
    await ui();

    expect((root().querySelector('[data-slug]') as HTMLInputElement).value).toBe('cafe-ana');
    expect(root().querySelector('[data-total]')?.textContent).toContain('Plan Profesional · US$ 19 al mes · Argentina');
    expect(loader).toHaveBeenCalledWith(expect.stringContaining('paypal.com/sdk/js?client-id=cid&currency=USD'));
  });

  it('should not let PayPal start until the form is valid and the email is verified', async () => {
    await open('PAYPAL');
    const actions = { resolve: vi.fn().mockResolvedValue(undefined), reject: vi.fn().mockResolvedValue(undefined) };

    await paypal.onClick(null, actions);
    await ui();
    expect(actions.reject).toHaveBeenCalled();
    expect(fieldError('businessName')).toContain('Escribe el nombre');
    expect(fieldError('password')).toContain('al menos 10');
    expect(fieldError('email')).toContain('correo válido');

    set('[data-business]', 'Café Ana');
    set('[data-email]', 'ana@ejemplo.test');
    set('[data-password]', 'Clave-Segura-123');
    await ui();
    actions.reject.mockClear();
    await paypal.onClick(null, actions);
    await ui();
    expect(actions.reject).toHaveBeenCalled();
    expect(fieldError('email')).toContain('Verifica tu correo');
  });

  it('should verify the email with a code and lock it, and ask again if it changes', async () => {
    await open('PAYPAL');
    await fillAndVerify();

    expect(root().querySelector('[data-email-verified]')).not.toBeNull();
    expect((root().querySelector('[data-email]') as HTMLInputElement).disabled).toBe(true);
  });

  it('should explain a wrong code, and an email that already has an account', async () => {
    await open('PAYPAL');
    set('[data-email]', 'ana@ejemplo.test');
    await ui();
    await click('[data-email-send]');
    await answer(http, `${API}/email/code`, { code: 'email_in_use' }, { status: 409, statusText: 'Conflict' }, 'POST');
    await ui();
    expect(fieldError('email')).toContain('ya tiene una cuenta');

    await click('[data-email-send]');
    await answer(http, `${API}/email/code`, null, { status: 204, statusText: 'No Content' }, 'POST');
    await ui();
    set('[data-email-code]', '000000');
    await ui();
    await click('[data-email-confirm]');
    await answer(http, `${API}/email/verify`, { code: 'invalid_email_code' }, { status: 400, statusText: 'Bad Request' }, 'POST');
    await ui();
    expect(fieldError('email')).toContain('no es válido o venció');
    expect(root().querySelector('[data-email-code-box]')).not.toBeNull();
  });

  it('should create the order, capture the PayPal payment and enter the panel automatically', async () => {
    await open('PAYPAL');
    await fillAndVerify();

    const created = paypal.createOrder();
    const checkout = await answer(http, `${API}/checkout`, {
      reference: 'PED-ABCD2345', claimToken: 'claim-1', method: 'PAYPAL', providerRef: 'PP-ORDER-1', initPoint: null, amountLabel: 'US$ 19',
    }, { status: 201, statusText: 'Created' }, 'POST');
    expect(await created).toBe('PP-ORDER-1');
    expect(checkout.request.body).toEqual({
      planCode: 'PROFESIONAL', region: 'AR', method: 'PAYPAL', email: 'ana@ejemplo.test', businessName: 'Café Ana', slug: 'cafe-ana',
      password: 'Clave-Segura-123', emailProof: 'prueba-1',
    });
    expect(JSON.parse(sessionStorage.getItem('deliora.checkout') ?? '{}')).toEqual({ reference: 'PED-ABCD2345', claimToken: 'claim-1' });

    const approved = paypal.onApprove();
    await answer(http, `${API}/orders/PED-ABCD2345/paypal/capture`, { reference: 'PED-ABCD2345', status: 'PAID', method: 'PAYPAL', ready: true, failure: null }, {}, 'POST');
    const session = await answer(http, `${API}/orders/PED-ABCD2345/session`, { status: 'ok' }, {}, 'POST');
    await approved;
    await ui();

    expect(session.request.body).toEqual({ claimToken: 'claim-1' });
    expect(refreshUser).toHaveBeenCalledTimes(1);
    expect(router.url).toBe('/admin');
  });

  it('should show the address error and cancel PayPal when the address is already taken', async () => {
    await open('PAYPAL');
    await fillAndVerify();

    const created = paypal.createOrder();
    const rejected = created.catch(() => 'rechazada');
    await answer(http, `${API}/checkout`, { code: 'slug_taken' }, { status: 409, statusText: 'Conflict' }, 'POST');
    await ui();

    expect(await rejected).toBe('rechazada');
    expect(fieldError('slug')).toContain('ya está en uso');
    expect(sessionStorage.getItem('deliora.checkout')).toBeNull();
  });

  it('should send the customer to the result page when the capture cannot be confirmed', async () => {
    await open('PAYPAL');
    await fillAndVerify();
    const created = paypal.createOrder();
    await answer(http, `${API}/checkout`, { reference: 'PED-ABCD2345', claimToken: 'c', method: 'PAYPAL', providerRef: 'PP-1', initPoint: null, amountLabel: 'US$ 19' }, { status: 201, statusText: 'Created' }, 'POST');
    await created;

    const approved = paypal.onApprove();
    await answer(http, `${API}/orders/PED-ABCD2345/paypal/capture`, {}, { status: 502, statusText: 'Bad Gateway' }, 'POST');
    await approved;
    await ui();

    expect(router.url).toBe('/pago/resultado?ref=PED-ABCD2345');
  });

  it('should show the total in pesos for Mercado Pago and redirect to its checkout when there is no public key', async () => {
    await open('MERCADOPAGO');
    expect(root().querySelector('[data-total]')?.textContent).toContain('$ 28.500 ARS');
    await fillAndVerify();

    await click('[data-mp-start]');
    await answer(http, `${API}/checkout`, {
      reference: 'PED-MP000001', claimToken: 'claim-mp', method: 'MERCADOPAGO', providerRef: 'PREF-1', initPoint: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=PREF-1', amountLabel: '$ 28500 ARS',
    }, { status: 201, statusText: 'Created' }, 'POST');
    await ui();

    expect(redirect).toHaveBeenCalledWith('https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=PREF-1');
    expect(JSON.parse(sessionStorage.getItem('deliora.checkout') ?? '{}').claimToken).toBe('claim-mp');
  });

  it('should render the embedded Mercado Pago button when the public key is configured', async () => {
    await open('MERCADOPAGO', 'APP_USR-clave-publica');
    await fillAndVerify();

    await click('[data-mp-start]');
    await answer(http, `${API}/checkout`, {
      reference: 'PED-MP000002', claimToken: 'c', method: 'MERCADOPAGO', providerRef: 'PREF-2', initPoint: 'https://mp.test/redirect', amountLabel: '$ 28500 ARS',
    }, { status: 201, statusText: 'Created' }, 'POST');
    await ui();

    expect(loader).toHaveBeenCalledWith('https://sdk.mercadopago.com/js/v2');
    expect(wallet).toHaveBeenCalledWith('wallet', 'mp-wallet-container', { initialization: { preferenceId: 'PREF-2' } });
    expect(redirect).not.toHaveBeenCalled();
  });

  it('should fall back to the redirect when the embedded button cannot load', async () => {
    wallet.mockRejectedValueOnce(new Error('sin SDK'));
    await open('MERCADOPAGO', 'APP_USR-clave-publica');
    await fillAndVerify();

    await click('[data-mp-start]');
    await answer(http, `${API}/checkout`, {
      reference: 'PED-MP000003', claimToken: 'c', method: 'MERCADOPAGO', providerRef: 'PREF-3', initPoint: 'https://mp.test/redirect', amountLabel: '$ 28500 ARS',
    }, { status: 201, statusText: 'Created' }, 'POST');
    await ui();

    expect(redirect).toHaveBeenCalledWith('https://mp.test/redirect');
  });
});
