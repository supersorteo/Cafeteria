import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { AuthService, Me, PlanLimits, PlanUsage } from '../../core/auth.service';
import { BillingOptions } from '../../core/billing.api';
import { PlanService } from '../../core/plan.service';
import { CHECKOUT_CHANNEL, PAGE_REDIRECT, PAYMENT_WINDOW, SDK_LOADER } from '../../billing/sdk-loader';
import { MP_POLL_MS } from '../../billing/online-checkout';
import { answer, makeMe, settle } from '../../testing/http';
import { MyPlanPage } from './my-plan.page';

const LIMITS: PlanLimits = {
  code: 'EMPRENDEDOR', name: 'Emprendedor', maxMenuItems: 50, maxActiveCoupons: 15, maxGallery: 6, maxTableQr: 0,
  fullBranding: false, advancedCoupons: false, tableQr: false, prioritySupport: false, stats: false,
};
const USAGE: PlanUsage = { menuItems: 18, activeCoupons: 15, gallery: 5 };
const OPTIONS: BillingOptions = {
  checkout: { paypalClientId: 'cid', mercadopagoPublicKey: '' },
  plans: [
    { code: 'EMPRENDEDOR', name: 'Emprendedor', months: 1, usdCents: 900, maxMenuItems: 50, maxActiveCoupons: 15, maxGallery: 6, maxTableQr: 0, fullBranding: false, advancedCoupons: false, tableQr: false, prioritySupport: false, stats: false, arsPrice: 15300 },
    { code: 'PROFESIONAL', name: 'Profesional', months: 1, usdCents: 1900, maxMenuItems: 100, maxActiveCoupons: 35, maxGallery: 15, maxTableQr: 30, fullBranding: true, advancedCoupons: true, tableQr: true, prioritySupport: true, stats: false, arsPrice: 32300 },
  ],
  regions: [
    { code: 'AR', name: 'Argentina', whatsapp: true, whatsappNumber: '5491100000001', methods: [
      { code: 'WHATSAPP', name: 'WhatsApp', available: true }, { code: 'MERCADOPAGO', name: 'Mercado Pago', available: true }, { code: 'PAYPAL', name: 'PayPal', available: true }] },
    { code: 'UY', name: 'Uruguay', whatsapp: true, whatsappNumber: '59899000002', methods: [
      { code: 'WHATSAPP', name: 'WhatsApp', available: true }, { code: 'PAYPAL', name: 'PayPal', available: true }] },
  ],
};

interface PayPalOptions {
  onClick(data: unknown, actions: { resolve(): Promise<void>; reject(): Promise<void> }): Promise<void> | void;
  createOrder(): Promise<string>;
  onApprove(): Promise<void>;
}

describe('MyPlanPage', () => {
  let fixture: ComponentFixture<MyPlanPage>;
  let http: HttpTestingController;
  let paypal: PayPalOptions;
  const user = signal<Me | null>(null);
  const refreshUser = vi.fn().mockResolvedValue(undefined);

  const root = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) => root().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
  const ui = async () => {
    for (let i = 0; i < 3; i++) {
      await settle();
      fixture.detectChanges();
    }
  };
  const click = async (selector: string) => {
    (root().querySelector(selector) as HTMLElement).click();
    await ui();
  };
  const choose = async (selector: string) => {
    const input = root().querySelector(`${selector} input`) as HTMLInputElement;
    input.checked = true;
    input.dispatchEvent(new Event('change'));
    await ui();
  };
  const me = (plan: Partial<Me['plan']>, role: 'OWNER' | 'EDITOR' = 'OWNER') => makeMe({
    role, tenant: { id: 't1', slug: 'cafe-ana', name: 'Café Ana', published: true, logoUrl: null },
    plan: { expiresAt: '2026-11-25T12:00:00Z', status: 'ACTIVE', planCode: 'EMPRENDEDOR', limits: LIMITS, usage: USAGE, ...plan },
  });

  async function open(current: Me, loadsOptions = true) {
    user.set(current);
    fixture = TestBed.createComponent(MyPlanPage);
    fixture.detectChanges();
    if (loadsOptions) {
      await answer(http, '/api/v1/public/billing/options', OPTIONS);
    }
    await ui();
  }

  beforeEach(() => {
    refreshUser.mockClear();
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            user,
            limits: () => user()?.plan?.limits ?? null,
            usage: () => user()?.plan?.usage ?? null,
            isOwner: () => user()?.role === 'OWNER',
            refreshUser,
            ensureCsrf: () => Promise.resolve(),
          },
        },
        { provide: SDK_LOADER, useValue: () => Promise.resolve() },
        { provide: PAGE_REDIRECT, useValue: vi.fn() },
        { provide: PAYMENT_WINDOW, useValue: () => null },
        { provide: CHECKOUT_CHANNEL, useValue: () => null },
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
  });

  afterEach(() => {
    fixture?.destroy();
    http.verify();
    localStorage.clear();
  });

  it('should explain the grace days, show the usage and that renewing now keeps the original date', async () => {
    await open(me({ status: 'GRACE', graceEndsAt: '2026-11-28T12:00:00Z' }));

    expect(text('[data-plan-name]')).toBe('Emprendedor');
    expect(text('[data-plan-stage]')).toBe('En gracia');
    expect(text('[data-plan-expiry]')).toBe('Venció el 25/11/2026. Todo sigue funcionando hasta el 28/11/2026.');
    expect(text('[data-renew-hint]')).toContain('cuenta desde el 25/11/2026');
    expect(text('[data-meter="menu"]')).toContain('18 de 50');
    expect(root().querySelector('[data-meter="coupons"] .text-danger')?.textContent).toContain('15 de 15');
    expect(root().querySelector('[data-plan-option="EMPRENDEDOR"] [data-current-plan]')).not.toBeNull();
    expect((root().querySelector('[data-plan-option="EMPRENDEDOR"] input') as HTMLInputElement).checked).toBe(true);
  });

  it('should say the site is paused and that paying brings it back right away', async () => {
    await open(me({ status: 'EXPIRED' }));
    expect(text('[data-plan-stage]')).toBe('En pausa');
    expect(text('[data-renew-hint]')).toContain('vuelve a estar en línea al instante');
  });

  it('should renew online with PayPal on a bigger plan and confirm it without leaving the page', async () => {
    await open(me({ status: 'EXPIRED' }));
    await choose('[data-plan-option="PROFESIONAL"]');
    await click('[data-region-option="UY"]');
    expect([...root().querySelectorAll('[data-method-option]')].map(m => m.getAttribute('data-method-option'))).toEqual(['WHATSAPP', 'PAYPAL']);
    await choose('[data-method-option="PAYPAL"]');

    expect(root().querySelector('[data-online-checkout] [data-business]')).toBeNull();
    const actions = { resolve: vi.fn().mockResolvedValue(undefined), reject: vi.fn().mockResolvedValue(undefined) };
    await paypal.onClick(null, actions);
    expect(actions.resolve).toHaveBeenCalled();

    const created = paypal.createOrder();
    const request = await answer(http, '/api/v1/admin/plan/checkout', {
      reference: 'PED-REN00001', claimToken: null, method: 'PAYPAL', providerRef: 'PP-9', initPoint: null, amountLabel: 'US$ 19',
    }, { status: 201, statusText: 'Created' }, 'POST');
    expect(await created).toBe('PP-9');
    expect(request.request.body).toEqual({ planCode: 'PROFESIONAL', region: 'UY', method: 'PAYPAL' });
    expect(sessionStorage.getItem('deliora.checkout')).toBeNull();

    const approved = paypal.onApprove();
    await answer(http, '/api/v1/public/billing/orders/PED-REN00001/paypal/capture',
      { reference: 'PED-REN00001', status: 'PAID', method: 'PAYPAL', ready: true, failure: null, renewal: true }, {}, 'POST');
    await approved;
    await ui();

    expect(refreshUser).toHaveBeenCalled();
    expect(root().querySelector('[data-renewed]')).not.toBeNull();
    expect(root().querySelector('[data-online-checkout]')).toBeNull();
    expect(localStorage.getItem('deliora.renovar.pais')).toBe('UY');
  });

  it('should offer Mercado Pago only from Argentina and show the price in pesos', async () => {
    await open(me({}));
    await click('[data-region-option="AR"]');
    await choose('[data-method-option="MERCADOPAGO"]');
    expect(text('[data-total]')).toContain('$ 15.300 ARS');
    await click('[data-region-option="UY"]');
    expect(root().querySelector('[data-method-option="MERCADOPAGO"]')).toBeNull();
    expect(root().querySelector('[data-online-checkout]')).toBeNull();
  });

  it('should prepare the WhatsApp message and let the owner redeem the code that arrives', async () => {
    await open(me({}));
    await click('[data-region-option="AR"]');
    await choose('[data-method-option="WHATSAPP"]');

    const opened: string[] = [];
    const anchor = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      opened.push(this.href);
    });
    await click('[data-renew-whatsapp]');
    anchor.mockRestore();
    const message = decodeURIComponent(opened[0].split('text=')[1]);
    expect(opened[0].startsWith('whatsapp://send?phone=5491100000001')).toBe(true);
    expect(message).toContain('renovar el plan *Emprendedor*');
    expect(message).toContain('*Café Ana*');

    await click('[data-have-code]');
    expect(TestBed.inject(PlanService).renewalOpen()).toBe(true);
  });

  it('should only let the owner renew and say nothing about renewals for a plan without expiry', async () => {
    await open(me({}, 'EDITOR'), false);
    expect(root().querySelector('[data-owner-only]')).not.toBeNull();
    expect(root().querySelector('[data-renew-section]')).toBeNull();
    fixture.destroy();

    await open(me({ expiresAt: null }), false);
    expect(root().querySelector('[data-no-expiry]')).not.toBeNull();
  });
});
