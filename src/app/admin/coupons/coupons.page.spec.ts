import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth.service';
import { Coupon } from '../../core/coupons.api';
import { answer, settle } from '../../testing/http';
import { CouponsPage } from './coupons.page';

const API = '/api/v1/admin/coupons';

function coupon(id: string, overrides: Partial<Coupon> = {}): Coupon {
  return {
    id, code: `CODE${id}`, type: 'DESCUENTO', title: `Cupón ${id}`, benefit: 'Beneficio', validityText: null, startsOn: null, endsOn: null,
    weekdays: null, timeFrom: null, timeTo: null, maxRedemptions: null, redemptions: 0, featured: false, active: true, version: 0,
    status: 'ACTIVE', counted: true, ...overrides,
  };
}

describe('CouponsPage', () => {
  let fixture: ComponentFixture<CouponsPage>;
  let http: HttpTestingController;
  const advanced = signal(false);
  const expired = signal(false);

  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => root().textContent ?? '';
  const ui = async () => {
    await settle();
    fixture.detectChanges();
  };
  const dialog = () => document.querySelector('dialog') as HTMLElement | null;

  async function open(list: Coupon[]) {
    fixture = TestBed.createComponent(CouponsPage);
    fixture.detectChanges();
    await answer(http, API, list);
    await ui();
  }

  beforeEach(() => {
    advanced.set(false);
    expired.set(false);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { planExpired: expired, limits: signal({ maxActiveCoupons: 2 }), advancedCoupons: advanced } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    document.querySelectorAll('dialog').forEach(d => d.remove());
    http.verify();
  });

  it('should list the coupons and count only the active ones against the plan limit', async () => {
    await open([coupon('1'), coupon('2', { active: false, status: 'INACTIVE', counted: false })]);

    expect(root().querySelectorAll('[data-coupon]').length).toBe(2);
    expect(root().querySelector('[data-usage]')?.textContent).toContain('1 de 2 cupones activos');
    expect(root().querySelector('[data-near-limit]')).toBeNull();
  });

  it('should warn when the active coupons reach the plan limit', async () => {
    await open([coupon('1'), coupon('2')]);

    expect(root().querySelector('[data-usage]')?.textContent).toContain('2 de 2 cupones activos');
    expect(root().querySelector('[data-near-limit]')).not.toBeNull();
  });

  it('should show the empty state when there are no coupons', async () => {
    await open([]);
    expect(text()).toContain('Aún no tienes cupones');
  });

  it('should offer a retry when loading fails', async () => {
    fixture = TestBed.createComponent(CouponsPage);
    fixture.detectChanges();
    await answer(http, API, {}, { status: 500, statusText: 'Error' });
    await ui();
    expect(root().querySelector('[role="alert"]')?.textContent).toContain('No pudimos cargar tus cupones');

    (root().querySelector('[data-retry]') as HTMLElement).click();
    await answer(http, API, [coupon('1')]);
    await ui();
    expect(root().querySelectorAll('[data-coupon]').length).toBe(1);
  });

  it('should create a coupon without the Professional options when the plan lacks them', async () => {
    await open([]);
    (root().querySelector('[data-create]') as HTMLElement).click();
    await ui();
    const set = (selector: string, value: string) => {
      const field = dialog()!.querySelector(selector) as HTMLInputElement;
      field.value = value;
      field.dispatchEvent(new Event('input'));
    };
    set('[data-code]', 'bienvenida');
    set('[data-title]', '20% de descuento');
    set('[data-benefit]', 'En tu primera compra');
    set('[data-max]', '10');
    expect((dialog()!.querySelector('[data-advanced]') as HTMLFieldSetElement).disabled).toBe(true);
    expect(dialog()!.querySelector('[data-advanced-locked]')).not.toBeNull();
    await ui();
    (dialog()!.querySelector('#coupon-form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    const request = await answer(http, API, coupon('9'), { status: 201, statusText: 'Created' }, 'POST');
    await ui();

    expect(request.request.body).toMatchObject({
      code: 'BIENVENIDA', title: '20% de descuento', maxRedemptions: null, weekdays: null, featured: false, active: true, version: null,
    });
    expect(root().querySelectorAll('[data-coupon]').length).toBe(1);
  });

  it('should send the Professional options when the plan includes them', async () => {
    advanced.set(true);
    await open([]);
    (root().querySelector('[data-create]') as HTMLElement).click();
    await ui();
    const set = (selector: string, value: string) => {
      const field = dialog()!.querySelector(selector) as HTMLInputElement;
      field.value = value;
      field.dispatchEvent(new Event('input'));
    };
    set('[data-code]', 'cena50');
    set('[data-title]', 'Cena');
    set('[data-benefit]', 'Postre gratis');
    set('[data-max]', '25');
    set('[data-time-from]', '19:00');
    set('[data-time-to]', '23:00');
    await ui();
    (dialog()!.querySelector('#coupon-form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    const request = await answer(http, API, coupon('9'), { status: 201, statusText: 'Created' }, 'POST');
    await ui();

    expect(request.request.body).toMatchObject({ code: 'CENA50', maxRedemptions: 25, timeFrom: '19:00', timeTo: '23:00' });
  });

  it('should explain the server limit error without closing the form', async () => {
    await open([coupon('1')]);
    (root().querySelector('[data-create]') as HTMLElement).click();
    await ui();
    const set = (selector: string, value: string) => {
      const field = dialog()!.querySelector(selector) as HTMLInputElement;
      field.value = value;
      field.dispatchEvent(new Event('input'));
    };
    set('[data-code]', 'EXTRA');
    set('[data-title]', 'Extra');
    set('[data-benefit]', 'Algo');
    await ui();
    (dialog()!.querySelector('#coupon-form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await answer(http, API, { code: 'plan_limit_reached' }, { status: 409, statusText: 'Conflict' }, 'POST');
    await ui();

    expect(dialog()!.querySelector('[data-error]')?.textContent).toContain('hasta 2 cupones activos');
  });

  it('should toggle a coupon keeping its version', async () => {
    await open([coupon('1', { version: 4 })]);
    (root().querySelector('[data-toggle]') as HTMLElement).click();
    const request = await answer(http, `${API}/1`, coupon('1', { active: false, status: 'INACTIVE', counted: false, version: 5 }), {}, 'PUT');
    await ui();

    expect(request.request.body).toMatchObject({ active: false, version: 4 });
    expect(root().querySelector('[data-usage]')?.textContent).toContain('0 de 2');
  });

  it('should disable every action when the plan expired', async () => {
    expired.set(true);
    await open([coupon('1')]);
    expect((root().querySelector('[data-create]') as HTMLButtonElement).disabled).toBe(true);
    expect((root().querySelector('[data-edit]') as HTMLButtonElement).disabled).toBe(true);
    expect((root().querySelector('[data-delete]') as HTMLButtonElement).disabled).toBe(true);
  });
});
