import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from '../core/auth.service';
import { PlanOption, RegionOption } from '../core/billing.api';
import { answer, settle } from '../testing/http';
import { emailProblem, emailSuggestion, passwordProblem } from './checkout-rules';
import { MP_POLL_MS, OnlineCheckout } from './online-checkout';
import { CHECKOUT_CHANNEL, CheckoutChannel, CheckoutMessage, PAGE_REDIRECT, PAYMENT_WINDOW, SDK_LOADER } from './sdk-loader';

@Component({ template: '' })
class Stub {}

const API = '/api/v1/public/billing';
const PLAN: PlanOption = {
  code: 'PROFESIONAL', name: 'Profesional', months: 1, usdCents: 1900, maxMenuItems: 100, maxActiveCoupons: 35, maxGallery: 15, maxTableQr: 30,
  fullBranding: true, advancedCoupons: true, tableQr: true, prioritySupport: true, stats: false, arsPrice: 28500,
};
const REGION: RegionOption = { code: 'AR', name: 'Argentina', whatsapp: true, whatsappNumber: '5491100000001', methods: [] };
const MP_CHECKOUT = {
  reference: 'PED-MP000001', claimToken: 'claim-mp', method: 'MERCADOPAGO', providerRef: 'PREF-1',
  initPoint: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=PREF-1', amountLabel: '$ 28500 ARS',
};

interface PayPalOptions {
  onClick(data: unknown, actions: { resolve(): Promise<void>; reject(): Promise<void> }): Promise<void> | void;
  createOrder(): Promise<string>;
  onApprove(): Promise<void>;
  onCancel(): void;
  onError(): void;
}

interface FakePopup {
  closed: boolean;
  location: { href: string };
  focus: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

describe('checkout rules', () => {
  it('should explain what is wrong with an email and suggest the common domain', () => {
    expect(emailProblem('')).toContain('Escribe tu correo');
    expect(emailProblem('ana gmail.com')).toContain('espacios');
    expect(emailProblem('ana.gmail.com')).toContain('@');
    expect(emailProblem('ana@gmail')).toContain('dominio completo');
    expect(emailProblem('ana@gmail.c')).toContain('formato');
    expect(emailProblem('ana.perez+bar@gmail.com')).toBeNull();
    expect(emailSuggestion('ana@gmial.com')).toBe('ana@gmail.com');
    expect(emailSuggestion('ana@hotmial.com')).toBe('ana@hotmail.com');
    expect(emailSuggestion('ana@gmail.com')).toBeNull();
    expect(emailSuggestion('ana@miempresa.com.ar')).toBeNull();
  });

  it('should ask for 10 characters with a letter and a number', () => {
    expect(passwordProblem('')).toContain('Elige una contraseña');
    expect(passwordProblem('abc1')).toContain('al menos 10');
    expect(passwordProblem('solo-letras-largas')).toBe('Agrega un número.');
    expect(passwordProblem('1234567890')).toBe('Agrega una letra.');
    expect(passwordProblem('Clave-Segura-123')).toBeNull();
  });
});

describe('OnlineCheckout', () => {
  let fixture: ComponentFixture<OnlineCheckout>;
  let http: HttpTestingController;
  let router: Router;
  let paypal: PayPalOptions;
  let popup: FakePopup | null;
  let channel: CheckoutChannel & { postMessage: ReturnType<typeof vi.fn<(message: CheckoutMessage) => void>>; close: ReturnType<typeof vi.fn<() => void>> };
  const refreshUser = vi.fn().mockResolvedValue(undefined);
  const redirect = vi.fn();
  const loader = vi.fn().mockResolvedValue(undefined);
  const openWindow = vi.fn(() => popup);

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
  const blur = (selector: string) => root().querySelector(selector)!.dispatchEvent(new Event('blur'));
  const click = async (selector: string) => {
    (root().querySelector(selector) as HTMLElement).click();
    await ui();
  };
  const fieldError = (name: string) => root().querySelector(`[data-field-error="${name}"]`)?.textContent ?? null;
  const send = (message: CheckoutMessage) => channel.onmessage?.({ data: message } as MessageEvent<CheckoutMessage>);

  async function open(method: 'PAYPAL' | 'MERCADOPAGO') {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'admin', component: Stub }, { path: 'pago/resultado', component: Stub }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { refreshUser } },
        { provide: SDK_LOADER, useValue: loader },
        { provide: PAGE_REDIRECT, useValue: redirect },
        { provide: PAYMENT_WINDOW, useValue: openWindow },
        { provide: CHECKOUT_CHANNEL, useValue: () => channel },
        { provide: MP_POLL_MS, useValue: 600_000 },
      ],
    });
    (window as unknown as { paypal: unknown }).paypal = {
      Buttons: (options: PayPalOptions) => {
        paypal = options;
        return { render: async () => undefined };
      },
    };
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(OnlineCheckout);
    fixture.componentRef.setInput('plan', PLAN);
    fixture.componentRef.setInput('region', REGION);
    fixture.componentRef.setInput('method', method);
    fixture.componentRef.setInput('config', { paypalClientId: 'cid', mercadopagoPublicKey: '' });
    fixture.detectChanges();
    await ui();
  }

  async function typeCode(code: string) {
    set('[data-otp="0"]', code);
    await ui();
  }

  async function fillAndVerify(email = 'ana@ejemplo.test') {
    set('[data-business]', 'Café Ana');
    set('[data-email]', email);
    set('[data-password]', 'Clave-Segura-123');
    await ui();
    blur('[data-email]');
    await answer(http, `${API}/email/code`, null, { status: 204, statusText: 'No Content' }, 'POST');
    await ui();
    await typeCode('123456');
    await answer(http, `${API}/email/verify`, { proof: 'prueba-1' }, {}, 'POST');
    await ui();
  }

  beforeEach(() => {
    refreshUser.mockClear();
    redirect.mockClear();
    loader.mockClear();
    openWindow.mockClear();
    popup = { closed: false, location: { href: '' }, focus: vi.fn(), close: vi.fn(() => { popup!.closed = true; }) };
    channel = { onmessage: null, postMessage: vi.fn<(message: CheckoutMessage) => void>(), close: vi.fn<() => void>() };
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    fixture?.destroy();
    http.verify();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('should suggest the address from the business name and show the total in dollars for PayPal', async () => {
    await open('PAYPAL');
    set('[data-business]', 'Café Ana');
    await ui();

    expect((root().querySelector('[data-slug]') as HTMLInputElement).value).toBe('cafe-ana');
    expect(root().querySelector('[data-total]')?.textContent).toContain('Plan Profesional · US$ 19 al mes · Argentina');
    expect(loader).toHaveBeenCalledWith(expect.stringContaining('paypal.com/sdk/js?client-id=cid&currency=USD'));
  });

  it('should show every field error when trying to pay with an incomplete form', async () => {
    await open('PAYPAL');
    const actions = { resolve: vi.fn().mockResolvedValue(undefined), reject: vi.fn().mockResolvedValue(undefined) };

    await paypal.onClick(null, actions);
    await ui();

    expect(actions.reject).toHaveBeenCalled();
    expect(fieldError('businessName')).toContain('Escribe el nombre');
    expect(fieldError('slug')).toContain('de 3 a 63');
    expect(fieldError('email')).toContain('Escribe tu correo');
    expect(fieldError('password')).toContain('Elige una contraseña');
    expect(root().querySelector('[data-online-error]')?.textContent).toContain('Revisa los campos marcados');
    expect(root().querySelector('[data-business]')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('should send the verification code by itself when paying with a valid but unverified email', async () => {
    await open('PAYPAL');
    set('[data-business]', 'Café Ana');
    set('[data-email]', 'ana@ejemplo.test');
    set('[data-password]', 'Clave-Segura-123');
    await ui();
    const actions = { resolve: vi.fn().mockResolvedValue(undefined), reject: vi.fn().mockResolvedValue(undefined) };

    await paypal.onClick(null, actions);
    await answer(http, `${API}/email/code`, null, { status: 204, statusText: 'No Content' }, 'POST');
    await ui();

    expect(actions.reject).toHaveBeenCalled();
    expect(fieldError('email')).toBeNull();
    expect(root().querySelector('[data-code-pending]')?.textContent).toContain('escribe el código');
    expect(root().querySelector('[data-email-code-box]')).not.toBeNull();
  });

  it('should validate the fields as the customer leaves them, not before', async () => {
    await open('PAYPAL');
    set('[data-password]', 'solo-letras-largas');
    await ui();
    expect(fieldError('password')).toBeNull();
    expect(root().querySelector('[data-password-rule="number"]')?.getAttribute('data-ok')).toBe('false');
    expect(root().querySelector('[data-password-rule="length"]')?.getAttribute('data-ok')).toBe('true');

    blur('[data-password]');
    await ui();
    expect(fieldError('password')).toBe('Agrega un número.');

    set('[data-password]', 'solo-letras-1234');
    await ui();
    expect(fieldError('password')).toBeNull();
  });

  it('should explain a malformed email without sending any code, and offer the likely domain', async () => {
    await open('PAYPAL');
    set('[data-email]', 'ana@gmail');
    await ui();
    blur('[data-email]');
    await ui();
    expect(fieldError('email')).toContain('dominio completo');

    set('[data-email]', 'ana@gmial.com');
    await ui();
    blur('[data-email]');
    await ui();
    expect(root().querySelector('[data-email-suggestion]')?.textContent).toContain('ana@gmail.com');
    await click('[data-email-suggestion] button');
    expect((root().querySelector('[data-email]') as HTMLInputElement).value).toBe('ana@gmail.com');
    expect(root().querySelector('[data-email-suggestion]')).toBeNull();
  });

  it('should verify the email with the six boxes as soon as the code is complete, pasting included', async () => {
    await open('PAYPAL');
    set('[data-email]', 'ana@ejemplo.test');
    await ui();
    await click('[data-email-send]');
    await answer(http, `${API}/email/code`, null, { status: 204, statusText: 'No Content' }, 'POST');
    await ui();
    expect(root().querySelectorAll('[data-otp]').length).toBe(6);
    expect(root().querySelector('[data-email-countdown]')).not.toBeNull();

    const paste = new Event('paste', { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
    paste.clipboardData = { getData: () => ' 654 321 ' };
    root().querySelector('[data-otp="0"]')!.dispatchEvent(paste);
    const request = await answer(http, `${API}/email/verify`, { proof: 'prueba-1' }, {}, 'POST');
    await ui();

    expect(request.request.body).toEqual({ email: 'ana@ejemplo.test', code: '654321' });
    expect(root().querySelector('[data-email-verified]')).not.toBeNull();
    expect((root().querySelector('[data-email]') as HTMLInputElement).disabled).toBe(true);
    expect(root().querySelector('[data-email-code-box]')).toBeNull();
  });

  it('should explain a wrong code and an email that already has an account', async () => {
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
    await typeCode('000000');
    await answer(http, `${API}/email/verify`, { code: 'invalid_email_code' }, { status: 400, statusText: 'Bad Request' }, 'POST');
    await ui();

    expect(root().querySelector('[data-code-error]')?.textContent).toContain('no es correcto o venció');
    expect(root().querySelector('[data-otp="0"]')?.getAttribute('aria-invalid')).toBe('true');
    expect((root().querySelector('[data-otp="0"]') as HTMLInputElement).value).toBe('');
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

  it('should let the customer edit and retry after cancelling PayPal', async () => {
    await open('PAYPAL');
    await fillAndVerify();
    const created = paypal.createOrder();
    await answer(http, `${API}/checkout`, { reference: 'PED-ABCD2345', claimToken: 'c', method: 'PAYPAL', providerRef: 'PP-1', initPoint: null, amountLabel: 'US$ 19' }, { status: 201, statusText: 'Created' }, 'POST');
    await created;
    await ui();
    expect((root().querySelector('[data-business]') as HTMLInputElement).disabled).toBe(true);

    paypal.onCancel();
    await ui();

    expect((root().querySelector('[data-business]') as HTMLInputElement).disabled).toBe(false);
    expect(root().querySelector('[data-online-notice]')?.textContent).toContain('Cancelaste el pago');
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

  it('should not open Mercado Pago while the form has errors', async () => {
    await open('MERCADOPAGO');
    await click('[data-mp-start]');

    expect(openWindow).not.toHaveBeenCalled();
    expect(fieldError('businessName')).toContain('Escribe el nombre');
  });

  it('should open Mercado Pago in a window like PayPal and enter the panel when that window reports the payment', async () => {
    await open('MERCADOPAGO');
    expect(root().querySelector('[data-total]')?.textContent).toContain('$ 28.500 ARS');
    await fillAndVerify();

    await click('[data-mp-start]');
    expect(openWindow).toHaveBeenCalledTimes(1);
    await answer(http, `${API}/checkout`, MP_CHECKOUT, { status: 201, statusText: 'Created' }, 'POST');
    await ui();

    expect(popup!.location.href).toBe(MP_CHECKOUT.initPoint);
    expect(root().querySelector('[data-mp-waiting]')).not.toBeNull();
    expect(redirect).not.toHaveBeenCalled();

    send({ type: 'mp-return', reference: 'PED-MP000001', paymentId: '9001' });
    await ui();
    expect(channel.postMessage).toHaveBeenCalledWith({ type: 'mp-ack', reference: 'PED-MP000001' });
    expect(root().querySelector('[data-mp-checking]')).not.toBeNull();

    const verify = await answer(http, `${API}/orders/PED-MP000001/mercadopago/verify`, { reference: 'PED-MP000001', status: 'PAID', method: 'MERCADOPAGO', ready: true, failure: null }, {}, 'POST');
    const session = await answer(http, `${API}/orders/PED-MP000001/session`, { status: 'ok' }, {}, 'POST');
    await ui();

    expect(verify.request.body).toEqual({ paymentId: '9001' });
    expect(session.request.body).toEqual({ claimToken: 'claim-mp' });
    expect(popup!.close).toHaveBeenCalled();
    expect(router.url).toBe('/admin');
  });

  it('should go to Mercado Pago in the same tab when the browser blocks the window', async () => {
    popup = null;
    await open('MERCADOPAGO');
    await fillAndVerify();

    await click('[data-mp-start]');
    await answer(http, `${API}/checkout`, MP_CHECKOUT, { status: 201, statusText: 'Created' }, 'POST');
    await ui();

    expect(redirect).toHaveBeenCalledWith(MP_CHECKOUT.initPoint);
    expect(JSON.parse(sessionStorage.getItem('deliora.checkout') ?? '{}').claimToken).toBe('claim-mp');
  });

  it('should let the customer retry when they come back from Mercado Pago without paying', async () => {
    await open('MERCADOPAGO');
    await fillAndVerify();
    await click('[data-mp-start]');
    await answer(http, `${API}/checkout`, MP_CHECKOUT, { status: 201, statusText: 'Created' }, 'POST');
    await ui();

    send({ type: 'mp-return', reference: 'PED-MP000001', paymentId: null });
    await answer(http, `${API}/orders/PED-MP000001/state`, { reference: 'PED-MP000001', status: 'PENDING', method: 'MERCADOPAGO', ready: false, failure: null });
    await ui();

    expect(root().querySelector('[data-online-notice]')?.textContent).toContain('No completaste el pago');
    expect(root().querySelector('[data-mp-start]')).not.toBeNull();
    expect((root().querySelector('[data-business]') as HTMLInputElement).disabled).toBe(false);
    expect(channel.close).toHaveBeenCalled();
  });

  it('should explain a payment rejected by Mercado Pago', async () => {
    await open('MERCADOPAGO');
    await fillAndVerify();
    await click('[data-mp-start]');
    await answer(http, `${API}/checkout`, MP_CHECKOUT, { status: 201, statusText: 'Created' }, 'POST');
    await ui();

    send({ type: 'mp-return', reference: 'PED-MP000001', paymentId: '9002' });
    await answer(http, `${API}/orders/PED-MP000001/mercadopago/verify`, { reference: 'PED-MP000001', status: 'PENDING', method: 'MERCADOPAGO', ready: false, failure: 'Pago rejected: cc_rejected_other_reason' }, {}, 'POST');
    await ui();

    expect(root().querySelector('[data-online-error]')?.textContent).toContain('no aprobó el pago');
    expect(root().querySelector('[data-mp-start]')).not.toBeNull();
  });

  it('should ignore messages about other orders and let the customer cancel the wait', async () => {
    await open('MERCADOPAGO');
    await fillAndVerify();
    await click('[data-mp-start]');
    await answer(http, `${API}/checkout`, MP_CHECKOUT, { status: 201, statusText: 'Created' }, 'POST');
    await ui();

    send({ type: 'mp-return', reference: 'PED-OTRO0001', paymentId: '1' });
    await ui();
    expect(channel.postMessage).not.toHaveBeenCalled();

    await click('[data-mp-focus]');
    expect(popup!.focus).toHaveBeenCalled();

    await click('[data-mp-cancel]');
    expect(popup!.close).toHaveBeenCalled();
    expect(root().querySelector('[data-mp-start]')).not.toBeNull();
    expect(root().querySelector('[data-online-notice]')?.textContent).toContain('Cancelaste el pago');
  });

  describe('guided email verification', () => {
    async function sendCodeTo(email: string) {
      set('[data-email]', email);
      await ui();
      await click('[data-email-send]');
      await answer(http, `${API}/email/code`, null, { status: 204, statusText: 'No Content' }, 'POST');
      await ui();
    }

    it('should offer to open Gmail on the right account and then move to the second step', async () => {
      await open('PAYPAL');
      await sendCodeTo('ana.perez@gmail.com');

      const link = root().querySelector('[data-open-mailbox]') as HTMLAnchorElement;
      expect(link.textContent).toContain('Abrir Gmail');
      expect(link.href).toBe('https://mail.google.com/mail/?authuser=ana.perez%40gmail.com');
      expect(link.target).toBe('_blank');
      expect(root().querySelector('[data-code-step="1"]')?.classList).toContain('code-step-active');

      link.addEventListener('click', event => event.preventDefault());
      await click('[data-open-mailbox]');
      expect(root().querySelector('[data-code-step="1"]')?.classList).toContain('code-step-done');
      expect(root().querySelector('[data-code-step="2"]')?.classList).toContain('code-step-active');
    });

    it('should verify by itself when the customer taps the link in the email from another tab', async () => {
      await open('PAYPAL');
      await sendCodeTo('ana@ejemplo.test');

      send({ type: 'email-code', email: 'ANA@ejemplo.test', code: '246810' });
      const verify = await answer(http, `${API}/email/verify`, { proof: 'prueba-1' }, {}, 'POST');
      await ui();

      expect(channel.postMessage).toHaveBeenCalledWith({ type: 'email-ack', email: 'ANA@ejemplo.test' });
      expect(verify.request.body).toEqual({ email: 'ana@ejemplo.test', code: '246810' });
      expect(root().querySelector('[data-email-verified]')).not.toBeNull();
    });

    it('should ignore a link for another email', async () => {
      await open('PAYPAL');
      await sendCodeTo('ana@ejemplo.test');

      send({ type: 'email-code', email: 'otra@ejemplo.test', code: '246810' });
      await ui();

      expect(channel.postMessage).not.toHaveBeenCalled();
      expect(root().querySelector('[data-email-verified]')).toBeNull();
    });

    it('should paste the copied code with one tap', async () => {
      await open('PAYPAL');
      await sendCodeTo('ana@ejemplo.test');
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: () => Promise.resolve('Tu código es 135790.') } });

      await click('[data-paste-code]');
      const verify = await answer(http, `${API}/email/verify`, { proof: 'prueba-1' }, {}, 'POST');
      await ui();

      expect(verify.request.body).toEqual({ email: 'ana@ejemplo.test', code: '135790' });
      expect(root().querySelector('[data-email-verified]')).not.toBeNull();
    });

    it('should explain when the copied code cannot be read', async () => {
      await open('PAYPAL');
      await sendCodeTo('ana@ejemplo.test');
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: () => Promise.reject(new Error('denegado')) } });

      await click('[data-paste-code]');
      await ui();

      expect(root().querySelector('[data-code-error]')?.textContent).toContain('Mantén presionada');
    });

    it('should resume the purchase with the code from the email link when this tab was lost', async () => {
      localStorage.setItem('deliora.compra', JSON.stringify({
        plan: 'PROFESIONAL', region: 'AR', method: 'PAYPAL', businessName: 'Café Ana', slug: 'mi-cafe', email: 'ana@ejemplo.test', savedAt: Date.now(),
      }));
      localStorage.setItem('deliora.codigo', JSON.stringify({ email: 'ana@ejemplo.test', code: '112233', savedAt: Date.now() }));

      await open('PAYPAL');
      const verify = await answer(http, `${API}/email/verify`, { proof: 'prueba-1' }, {}, 'POST');
      await ui();

      expect(verify.request.body).toEqual({ email: 'ana@ejemplo.test', code: '112233' });
      expect((root().querySelector('[data-business]') as HTMLInputElement).value).toBe('Café Ana');
      expect((root().querySelector('[data-slug]') as HTMLInputElement).value).toBe('mi-cafe');
      expect(root().querySelector('[data-email-verified]')).not.toBeNull();
      expect(root().querySelector('[data-online-notice]')?.textContent).toContain('Retomamos tu compra');
      expect(localStorage.getItem('deliora.codigo')).toBeNull();
    });

    it('should keep what was typed so a reload does not lose it, but never the password', async () => {
      await open('PAYPAL');
      set('[data-business]', 'Café Ana');
      set('[data-email]', 'ana@ejemplo.test');
      set('[data-password]', 'Clave-Segura-123');
      await ui();

      const saved = JSON.parse(localStorage.getItem('deliora.compra') ?? '{}');
      expect(saved).toMatchObject({ plan: 'PROFESIONAL', region: 'AR', method: 'PAYPAL', businessName: 'Café Ana', slug: 'cafe-ana', email: 'ana@ejemplo.test' });
      expect(JSON.stringify(saved)).not.toContain('Clave-Segura');
    });
  });
});
