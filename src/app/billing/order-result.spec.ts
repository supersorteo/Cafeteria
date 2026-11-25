import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { AuthService } from '../core/auth.service';
import { OrderState, rememberCheckout } from '../core/billing.api';
import { answer, settle } from '../testing/http';
import { OrderResultPage, RESULT_TIMINGS } from './order-result.page';

@Component({ template: '' })
class AdminStub {}

const API = '/api/v1/public/billing';
const state = (overrides: Partial<OrderState> = {}): OrderState => ({ reference: 'PED-ABCD2345', status: 'PENDING', method: 'PAYPAL', ready: false, failure: null, ...overrides });

describe('OrderResultPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let router: Router;
  const refreshUser = vi.fn().mockResolvedValue(undefined);

  const root = () => harness.routeNativeElement as HTMLElement;
  const view = () => root().querySelector('[data-view]')?.getAttribute('data-view');
  const ui = async () => {
    await settle();
    harness.detectChanges();
    await settle();
    harness.detectChanges();
  };

  beforeEach(async () => {
    refreshUser.mockClear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'pago/resultado', component: OrderResultPage }, { path: 'admin', component: AdminStub }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { refreshUser } },
        { provide: RESULT_TIMINGS, useValue: { pollMs: 20, maxPolls: 3 } },
      ],
    });
    harness = await RouterTestingHarness.create();
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  it('should enter the panel by itself once the payment is confirmed and the account exists', async () => {
    rememberCheckout('PED-ABCD2345', 'claim-secreto');
    await harness.navigateByUrl('/pago/resultado?ref=PED-ABCD2345');
    await answer(http, `${API}/orders/PED-ABCD2345/state`, state({ status: 'PAID', ready: true }));
    const session = await answer(http, `${API}/orders/PED-ABCD2345/session`, { status: 'ok' }, {}, 'POST');
    await ui();

    expect(session.request.body).toEqual({ claimToken: 'claim-secreto' });
    expect(refreshUser).toHaveBeenCalledTimes(1);
    expect(router.url).toBe('/admin');
    expect(sessionStorage.getItem('deliora.checkout')).toBeNull();
  });

  it('should ask to log in when the payment was confirmed but this browser has no claim to start the session', async () => {
    await harness.navigateByUrl('/pago/resultado?ref=PED-ABCD2345');
    await answer(http, `${API}/orders/PED-ABCD2345/state`, state({ status: 'PAID', ready: true }));
    await ui();

    expect(view()).toBe('login');
    expect(root().querySelector('[data-go-login]')?.getAttribute('href')).toBe('/auth/login');
  });

  it('should fall back to the login when the automatic session cannot start', async () => {
    rememberCheckout('PED-ABCD2345', 'vencido');
    await harness.navigateByUrl('/pago/resultado?ref=PED-ABCD2345');
    await answer(http, `${API}/orders/PED-ABCD2345/state`, state({ status: 'PAID', ready: true }));
    await answer(http, `${API}/orders/PED-ABCD2345/session`, { code: 'claim_invalid' }, { status: 403, statusText: 'Forbidden' }, 'POST');
    await ui();

    expect(view()).toBe('login');
    expect(router.url).toBe('/pago/resultado?ref=PED-ABCD2345');
  });

  it('should keep checking while the payment is pending and then move on when it is accredited', async () => {
    rememberCheckout('PED-ABCD2345', 'claim');
    await harness.navigateByUrl('/pago/resultado?ref=PED-ABCD2345');
    await answer(http, `${API}/orders/PED-ABCD2345/state`, state());
    await ui();
    expect(view()).toBe('pending');

    await answer(http, `${API}/orders/PED-ABCD2345/state`, state({ status: 'PAID' }));
    await ui();
    expect(view()).toBe('creating');

    await answer(http, `${API}/orders/PED-ABCD2345/state`, state({ status: 'PAID', ready: true }));
    await answer(http, `${API}/orders/PED-ABCD2345/session`, { status: 'ok' }, {}, 'POST');
    await ui();
    expect(router.url).toBe('/admin');
  });

  it('should verify the Mercado Pago payment that comes back in the address', async () => {
    await harness.navigateByUrl('/pago/resultado?ref=PED-ABCD2345&payment_id=777&status=approved');
    const verify = await answer(http, `${API}/orders/PED-ABCD2345/mercadopago/verify`, state({ method: 'MERCADOPAGO', status: 'PAID', ready: true }), {}, 'POST');
    await ui();

    expect(verify.request.body).toEqual({ paymentId: '777' });
    expect(view()).toBe('login');
  });

  it('should explain a failed or expired payment and a missing order', async () => {
    await harness.navigateByUrl('/pago/resultado?ref=PED-ABCD2345');
    await answer(http, `${API}/orders/PED-ABCD2345/state`, state({ status: 'FAILED', failure: 'El pago no se pudo completar.' }));
    await ui();
    expect(view()).toBe('failed');
    expect(root().textContent).toContain('El pago no se pudo completar.');
  });

  it('should show expired orders', async () => {
    await harness.navigateByUrl('/pago/resultado?ref=PED-ABCD2345');
    await answer(http, `${API}/orders/PED-ABCD2345/state`, state({ status: 'EXPIRED' }));
    await ui();
    expect(view()).toBe('expired');
  });

  it('should say the order does not exist, with or without a reference', async () => {
    await harness.navigateByUrl('/pago/resultado?ref=PED-NOEXISTE');
    await answer(http, `${API}/orders/PED-NOEXISTE/state`, { code: 'not_found' }, { status: 404, statusText: 'Not Found' });
    await ui();
    expect(view()).toBe('missing');

    await harness.navigateByUrl('/admin');
    await harness.navigateByUrl('/pago/resultado');
    await ui();
    expect(view()).toBe('missing');
  });

  it('should offer a retry when the connection fails', async () => {
    await harness.navigateByUrl('/pago/resultado?ref=PED-ABCD2345');
    await answer(http, `${API}/orders/PED-ABCD2345/state`, {}, { status: 500, statusText: 'Error' });
    await ui();
    expect(view()).toBe('error');

    (root().querySelector('[data-retry]') as HTMLElement).click();
    await answer(http, `${API}/orders/PED-ABCD2345/state`, state({ status: 'EXPIRED' }));
    await ui();
    expect(view()).toBe('expired');
  });
});
