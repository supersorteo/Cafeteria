import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BillingOptions } from '../core/billing.api';
import { NoticeService } from '../core/notice.service';
import { SuperAdminAuth } from '../core/superadmin-auth.service';
import { AdminOrder } from '../core/superadmin.api';
import { answer, answerMatching, settle } from '../testing/http';
import { SuperAdminOrders } from './superadmin-orders';
import { SuperAdminPrices } from './superadmin-prices';

const API = '/api/v1/superadmin';
const order = (id: string, overrides: Partial<AdminOrder> = {}): AdminOrder => ({
  id, reference: `PED-${id}`, planCode: 'PROFESIONAL', planName: 'Profesional', months: 1, region: 'AR', buyerName: 'Ana', buyerEmail: 'ana@ejemplo.test',
  usdCents: 1900, status: 'PENDING', confirmedBy: null, confirmedAt: null, createdAt: '2026-11-20T12:00:00Z', expiresAt: '2026-11-27T12:00:00Z', activationCode: null, ...overrides,
});
const page = (content: AdminOrder[]) => ({ content, page: 0, size: 10, totalElements: content.length, totalPages: 1 });

describe('superadmin orders and prices', () => {
  let http: HttpTestingController;
  let notices: NoticeService;
  const admin = signal(true);

  const dialog = () => document.querySelector('dialog') as HTMLElement | null;
  const ui = async (fixture: ComponentFixture<unknown>) => {
    await settle();
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
  };

  beforeEach(() => {
    admin.set(true);
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: SuperAdminAuth, useValue: { isAdmin: admin } }],
    });
    http = TestBed.inject(HttpTestingController);
    notices = TestBed.inject(NoticeService);
  });

  afterEach(() => {
    notices.dismiss();
    document.querySelectorAll('dialog').forEach(d => d.remove());
    http.verify();
  });

  async function openOrders(list: AdminOrder[]) {
    const fixture = TestBed.createComponent(SuperAdminOrders);
    fixture.detectChanges();
    await answerMatching(http, r => r.url === `${API}/orders` && r.params.get('status') === 'PENDING', 'GET orders', page(list));
    await ui(fixture);
    return fixture;
  }

  it('should list the pending orders with buyer, plan and amount', async () => {
    const fixture = await openOrders([order('A1'), order('B2', { region: 'UY' })]);
    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('[data-order]');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('PED-A1');
    expect(rows[0].textContent).toContain('US$ 19');
    expect(rows[0].textContent).toContain('ana@ejemplo.test');
  });

  it('should confirm a payment after a confirmation and show the code that was sent', async () => {
    const fixture = await openOrders([order('A1')]);
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('[data-order-confirm]') as HTMLElement).click();
    await ui(fixture);
    expect(dialog()?.textContent).toContain('ana@ejemplo.test');

    (dialog()!.querySelector('[data-confirm]') as HTMLElement).click();
    await answer(http, `${API}/orders/A1/confirm`, order('A1', { status: 'PAID', activationCode: 'DLR-ABCD-2345' }), {}, 'POST');
    await answerMatching(http, r => r.url === `${API}/orders`, 'reload', page([order('A1', { status: 'PAID', activationCode: 'DLR-ABCD-2345', confirmedBy: 'root@plataforma.test', confirmedAt: '2026-11-21T12:00:00Z' })]));
    await ui(fixture);

    expect(notices.notice()?.text).toContain('ana@ejemplo.test');
    expect(el.querySelector('[data-order-code]')?.textContent).toContain('DLR-ABCD-2345');
    expect(el.querySelector('[data-order-confirm]')).toBeNull();
  });

  it('should cancel a pending order', async () => {
    const fixture = await openOrders([order('A1')]);
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('[data-order-cancel]') as HTMLElement).click();
    await ui(fixture);
    (dialog()!.querySelector('[data-confirm]') as HTMLElement).click();
    await answer(http, `${API}/orders/A1/cancel`, null, { status: 204, statusText: 'No Content' }, 'POST');
    await answerMatching(http, r => r.url === `${API}/orders`, 'reload', page([]));
    await ui(fixture);
    expect(el.textContent).toContain('No hay pedidos');
  });

  it('should show orders to a read-only operator without any action', async () => {
    admin.set(false);
    const fixture = await openOrders([order('A1')]);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-order]')).not.toBeNull();
    expect(el.querySelector('[data-order-confirm], [data-order-cancel]')).toBeNull();
  });

  it('should load the paid orders when the filter changes', async () => {
    const fixture = await openOrders([]);
    ((fixture.nativeElement as HTMLElement).querySelector('[data-order-filter="PAID"]') as HTMLElement).click();
    await answerMatching(http, r => r.url === `${API}/orders` && r.params.get('status') === 'PAID', 'GET paid', page([order('C3', { status: 'PAID' })]));
    await ui(fixture);
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-status="PAID"]')).not.toBeNull();
  });

  describe('prices', () => {
    const OPTIONS: BillingOptions = {
      plans: [{ code: 'PROFESIONAL', name: 'Profesional', months: 1, usdCents: 1900, maxMenuItems: 100, maxActiveCoupons: 35, maxGallery: 15, maxTableQr: 30, fullBranding: true, advancedCoupons: true, tableQr: true, prioritySupport: true, stats: false }],
      regions: [{ code: 'AR', name: 'Argentina', whatsapp: true, whatsappNumber: '5491100000001' }, { code: 'UY', name: 'Uruguay', whatsapp: false, whatsappNumber: '' }],
    };

    async function openPrices() {
      const fixture = TestBed.createComponent(SuperAdminPrices);
      fixture.detectChanges();
      await answer(http, `${API}/billing/options`, OPTIONS);
      await ui(fixture);
      return fixture;
    }

    it('should show the current price and which countries lack a WhatsApp number', async () => {
      const el = (await openPrices()).nativeElement as HTMLElement;
      expect(el.querySelector('[data-price-current]')?.textContent).toContain('US$ 19');
      expect(el.querySelector('[data-region="UY"]')?.textContent).toContain('Sin WhatsApp');
    });

    it('should save the new price in cents and reload', async () => {
      const fixture = await openPrices();
      const el = fixture.nativeElement as HTMLElement;
      const input = el.querySelector('[data-price-input]') as HTMLInputElement;
      input.value = '24.5';
      input.dispatchEvent(new Event('input'));
      await ui(fixture);
      (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
      const request = await answer(http, `${API}/billing/prices`, null, { status: 204, statusText: 'No Content' }, 'PUT');
      await answer(http, `${API}/billing/options`, { ...OPTIONS, plans: [{ ...OPTIONS.plans[0], usdCents: 2450 }] });
      await ui(fixture);

      expect(request.request.body).toEqual({ planCode: 'PROFESIONAL', months: 1, usdCents: 2450 });
      expect(el.querySelector('[data-price-current]')?.textContent).toContain('US$ 24.50');
    });

    it('should reject a price out of range without calling the server', async () => {
      const fixture = await openPrices();
      const el = fixture.nativeElement as HTMLElement;
      const input = el.querySelector('[data-price-input]') as HTMLInputElement;
      input.value = '0';
      input.dispatchEvent(new Event('input'));
      await ui(fixture);
      (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
      await ui(fixture);
      expect(el.querySelector('[data-prices-error]')?.textContent).toContain('entre US$ 1 y US$ 1000');
    });
  });
});
