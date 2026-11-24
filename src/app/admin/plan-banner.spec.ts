import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Me } from '../core/auth.service';
import { AuthService } from '../core/auth.service';
import { NoticeService } from '../core/notice.service';
import { PlanService, daysLeft, formatActivationCode } from '../core/plan.service';
import { answer, answerCsrf, fail, makeMe, settle } from '../testing/http';
import { PlanBanner } from './plan-banner';

describe('plan helpers', () => {
  it('should format the activation code as the user types, accepting any separator and lowercase', () => {
    expect(formatActivationCode('')).toBe('');
    expect(formatActivationCode('abcd')).toBe('DLR-ABCD');
    expect(formatActivationCode('dlr abcd2345 sobrante')).toBe('DLR-ABCD-2345');
    expect(formatActivationCode('DLR-AB')).toBe('DLR-AB');
    expect(formatActivationCode('ab!cd-23_45')).toBe('DLR-ABCD-2345');
  });

  it('should count the days left, rounding up, and return null when the plan has no expiry', () => {
    const now = new Date('2026-11-01T12:00:00Z').getTime();
    expect(daysLeft(null, now)).toBeNull();
    expect(daysLeft('2026-11-04T11:00:00Z', now)).toBe(3);
    expect(daysLeft('2026-10-30T12:00:00Z', now)).toBe(-2);
  });
});

describe('PlanBanner', () => {
  let http: HttpTestingController;
  let user: ReturnType<typeof signal<Me | null>>;
  let refresh: ReturnType<typeof vi.fn>;
  let plan: PlanService;
  let notices: NoticeService;

  const el = (fixture: ComponentFixture<PlanBanner>) => fixture.nativeElement as HTMLElement;
  const dialog = () => document.querySelector('dialog') as HTMLDialogElement | null;

  async function render(me: Me | null) {
    user.set(me);
    const fixture = TestBed.createComponent(PlanBanner);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  async function ui(fixture: ComponentFixture<PlanBanner>) {
    for (let i = 0; i < 3; i++) {
      await settle();
      fixture.detectChanges();
    }
  }

  const expired = (role: 'OWNER' | 'EDITOR' = 'OWNER') => makeMe({ role, plan: { expiresAt: '2026-10-20T12:00:00Z', status: 'EXPIRED' } });

  beforeEach(() => {
    user = signal<Me | null>(null);
    refresh = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            user,
            limits: () => user()?.plan?.limits ?? null,
            usage: () => user()?.plan?.usage ?? null,
            isOwner: () => user()?.role === 'OWNER',
            planExpired: () => user()?.plan.status === 'EXPIRED',
            ensureCsrf: () => fetch('/api/v1/auth/csrf').catch(() => undefined),
            refreshUser: refresh,
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    plan = TestBed.inject(PlanService);
    notices = TestBed.inject(NoticeService);
  });

  afterEach(() => {
    document.querySelectorAll('dialog').forEach(d => d.remove());
    notices.dismiss();
  });

  it('should show nothing for a plan without expiry or with plenty of time left', async () => {
    const fixture = await render(makeMe());
    expect(el(fixture).querySelector('.plan-banner')).toBeNull();

    const later = new Date(Date.now() + 40 * 86_400_000).toISOString();
    user.set(makeMe({ plan: { expiresAt: later, status: 'ACTIVE' } }));
    fixture.detectChanges();
    expect(el(fixture).querySelector('.plan-banner')).toBeNull();
  });

  it('should warn softly when the plan expires within a week', async () => {
    const soon = new Date(Date.now() + 3 * 86_400_000 - 3_600_000).toISOString();
    const fixture = await render(makeMe({ plan: { expiresAt: soon, status: 'ACTIVE' } }));

    expect(el(fixture).querySelector('[data-plan-soon]')?.textContent).toContain('Tu plan vence en 3 días');
    expect(el(fixture).querySelector('[data-renew]')).not.toBeNull();
  });

  it('should explain the read-only mode and offer the renewal to the owner', async () => {
    const fixture = await render(expired());

    const banner = el(fixture).querySelector('[data-plan-expired]')!;
    expect(banner.textContent).toContain('Tu plan venció el 20/10/2026');
    expect(banner.textContent).toContain('no puedes hacer cambios');
    expect(banner.getAttribute('role')).toBe('alert');
    expect(el(fixture).querySelector('[data-renew]')).not.toBeNull();
  });

  it('should tell an editor to ask the owner instead of offering the renewal', async () => {
    const fixture = await render(expired('EDITOR'));

    expect(el(fixture).querySelector('[data-renew]')).toBeNull();
    expect(el(fixture).textContent).toContain('Pide al propietario que renueve el plan');
  });

  it('should renew with a formatted code, refresh the session and close the dialog', async () => {
    const fixture = await render(expired());
    (el(fixture).querySelector('[data-renew]') as HTMLButtonElement).click();
    await ui(fixture);

    const input = dialog()!.querySelector('[data-renew-code]') as HTMLInputElement;
    input.value = 'dlr abcd2345';
    input.dispatchEvent(new Event('input'));
    await ui(fixture);
    expect(input.value).toBe('DLR-ABCD-2345');

    (dialog()!.querySelector('[data-confirm]') as HTMLButtonElement).click();
    const request = await answer(http, '/api/v1/admin/plan/redeem', { expiresAt: '2027-05-01T00:00:00Z', status: 'ACTIVE' }, {}, 'POST');
    await ui(fixture);

    expect(request.request.body).toEqual({ code: 'DLR-ABCD-2345' });
    expect(refresh).toHaveBeenCalled();
    expect(plan.renewalOpen()).toBe(false);
    expect(notices.notice()?.text).toContain('Plan renovado');
  });

  it('should keep the dialog open and explain when the code is not valid', async () => {
    const fixture = await render(expired());
    plan.openRenewal();
    await ui(fixture);
    const input = dialog()!.querySelector('[data-renew-code]') as HTMLInputElement;
    input.value = 'DLR-AAAA-BBBB';
    input.dispatchEvent(new Event('input'));
    await ui(fixture);

    (dialog()!.querySelector('[data-confirm]') as HTMLButtonElement).click();
    await fail(http, '/api/v1/admin/plan/redeem', 400, { code: 'invalid_code' });
    await ui(fixture);

    expect(dialog()?.textContent).toContain('El código no es válido o ya fue usado.');
    expect(plan.renewalOpen()).toBe(true);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('should not allow sending a code that is still incomplete', async () => {
    const fixture = await render(expired());
    plan.openRenewal();
    await ui(fixture);
    const input = dialog()!.querySelector('[data-renew-code]') as HTMLInputElement;
    input.value = 'DLR-AB';
    input.dispatchEvent(new Event('input'));
    await ui(fixture);

    expect((dialog()!.querySelector('[data-confirm]') as HTMLButtonElement).disabled).toBe(true);
    http.expectNone('/api/v1/admin/plan/redeem');
    await answerCsrf(http).catch(() => undefined);
  });
  it('should warn when the dishes or active coupons are near the plan limit', async () => {
    const limits = { code: 'EMPRENDEDOR', name: 'Emprendedor', maxMenuItems: 50, maxActiveCoupons: 15, maxGallery: 6, maxTableQr: 0, fullBranding: false, advancedCoupons: false, tableQr: false, prioritySupport: false, stats: false };
    const fixture = await render(makeMe({ plan: { expiresAt: null, status: 'ACTIVE', limits, usage: { menuItems: 41, activeCoupons: 2, gallery: 0 } } }));
    await ui(fixture);
    expect(el(fixture).querySelector('[data-plan-near-limit]')?.textContent).toContain('41 de 50 platos de tu plan Emprendedor');
  });
});
