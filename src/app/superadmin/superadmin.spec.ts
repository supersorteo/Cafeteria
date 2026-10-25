import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { authInterceptor } from '../core/auth.interceptor';
import { NoticeService } from '../core/notice.service';
import { SuperAdminTenant } from '../core/superadmin.api';
import { answer, answerCsrf, answerMatching, fail, settle, type } from '../testing/http';

const API = '/api/v1/superadmin';
const tenant = (overrides: Partial<SuperAdminTenant> = {}): SuperAdminTenant => ({
  id: 't1', slug: 'negocio-a', name: 'Negocio A', published: true, suspended: false, suspendedAt: null,
  ownerEmail: 'owner@a.test', ownerVerified: true, editors: 1, createdAt: '2026-10-01T10:00:00Z', ...overrides,
});
const page = (content: SuperAdminTenant[], extra: object = {}) => ({ content, page: 0, size: 10, totalElements: content.length, totalPages: 1, ...extra });
const stats = { total: 2, active: 1, suspended: 1, published: 1, newLast7Days: 2 };

describe('superadmin', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let router: Router;
  let notices: NoticeService;

  const root = () => harness.routeNativeElement as HTMLElement;
  const text = () => root().textContent ?? '';
  const click = (selector: string) => (root().querySelector(selector) as HTMLElement).click();
  const ui = async () => {
    await settle();
    harness.detectChanges();
    await settle();
    harness.detectChanges();
  };
  const dialog = () => document.querySelector('dialog') as HTMLDialogElement | null;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    harness = await RouterTestingHarness.create();
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    notices = TestBed.inject(NoticeService);
  });

  afterEach(() => {
    notices.dismiss();
    document.querySelectorAll('dialog').forEach(d => d.remove());
    http.verify();
  });

  async function drainHomeAuth() {
    for (let i = 0; i < 6; i++) {
      await settle();
      http.match('/api/v1/auth/csrf').forEach(request => request.flush({ headerName: 'X-XSRF-TOKEN' }));
      http.match('/api/v1/auth/me').forEach(request => request.flush({ code: 'unauthenticated' }, { status: 401, statusText: 'Unauthorized' }));
    }
  }

  async function openPanel(tenants = [tenant(), tenant({ id: 't2', slug: 'bar-b', name: 'Bar B', suspended: true, ownerEmail: 'owner@b.test' })]) {
    const navigation = harness.navigateByUrl('/superadmin');
    await answerCsrf(http);
    await answer(http, `${API}/auth/me`, { email: 'root@plataforma.test' });
    await navigation;
    await answerMatching(http, r => r.url === `${API}/tenants`, 'GET tenants', page(tenants));
    await answer(http, `${API}/stats`, stats);
    await ui();
  }

  describe('acceso', () => {
    it('should send an anonymous visitor of the panel to the login page', async () => {
      const navigation = harness.navigateByUrl('/superadmin');
      await answerCsrf(http);
      await answer(http, `${API}/auth/me`, { code: 'unauthenticated' }, { status: 401, statusText: 'Unauthorized' });
      await navigation;
      await ui();
      expect(router.url).toBe('/superadmin/login');
      expect(text()).toContain('Acceso restringido');
    });

    it('should go through credentials, then the emailed code, and open the panel', async () => {
      const navigation = harness.navigateByUrl('/superadmin/login');
      await answerCsrf(http);
      await answer(http, `${API}/auth/me`, { code: 'unauthenticated' }, { status: 401, statusText: 'Unauthorized' });
      await navigation;
      await ui();

      type(root(), '#sa-email', 'root@plataforma.test');
      type(root(), '#sa-password', 'Super-Clave-De-Prueba-1');
      (root().querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
      await answerCsrf(http);
      const login = await answer(http, `${API}/auth/login`, { step: 'code', maskedEmail: 'r***@plataforma.test', expiresInSeconds: 600 }, {}, 'POST');
      await ui();
      expect(login.request.body).toEqual({ email: 'root@plataforma.test', password: 'Super-Clave-De-Prueba-1' });
      expect(root().querySelector('[data-step-code]')).not.toBeNull();
      expect(text()).toContain('r***@plataforma.test');
      expect((root().querySelector('#sa-password') as HTMLInputElement | null)).toBeNull();

      type(root(), '#sa-code', '12a3 45 6');
      await answerCsrf(http);
      const verify = await answer(http, `${API}/auth/verify`, null, { status: 204, statusText: 'No Content' }, 'POST');
      await answer(http, `${API}/auth/me`, { email: 'root@plataforma.test' });
      expect(verify.request.body).toEqual({ code: '123456' });
      await answerMatching(http, r => r.url === `${API}/tenants`, 'GET tenants', page([tenant()]));
      await answer(http, `${API}/stats`, stats);
      await ui();
      expect(router.url).toBe('/superadmin');
      expect(text()).toContain('Negocio A');
    });

    it('should show a generic message for wrong credentials, a wrong code and a lockout', async () => {
      const navigation = harness.navigateByUrl('/superadmin/login');
      await answerCsrf(http);
      await answer(http, `${API}/auth/me`, {}, { status: 401, statusText: 'Unauthorized' });
      await navigation;
      await ui();

      type(root(), '#sa-email', 'root@plataforma.test');
      type(root(), '#sa-password', 'mala');
      (root().querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
      await answerCsrf(http);
      await fail(http, `${API}/auth/login`, 401, { code: 'invalid_credentials' });
      await ui();
      expect(text()).toContain('Credenciales inválidas.');

      (root().querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
      await answerCsrf(http);
      await fail(http, `${API}/auth/login`, 429, { code: 'too_many_attempts' });
      await ui();
      expect(text()).toContain('Demasiados intentos');
    });
  });

  describe('panel', () => {
    it('should list the businesses with their owner and state, and the summary cards', async () => {
      await openPanel();

      const rows = Array.from(root().querySelectorAll('table [data-row]'));
      expect(rows.map(r => r.getAttribute('data-slug'))).toEqual(['negocio-a', 'bar-b']);
      expect(rows[0].textContent).toContain('owner@a.test');
      expect(rows[0].textContent).toContain('Activo');
      expect(rows[1].textContent).toContain('Suspendido');
      expect(root().querySelector('[data-stats]')?.textContent).toContain('Suspendidos');
      expect(root().querySelectorAll('[data-cards] [data-row]').length).toBe(2);
    });

    it('should only offer to delete a business once it is suspended', async () => {
      await openPanel();
      const active = root().querySelector('table [data-slug="negocio-a"]')!;
      const suspended = root().querySelector('table [data-slug="bar-b"]')!;

      expect(active.querySelector('[data-delete]')).toBeNull();
      expect((active.querySelector('[data-delete-locked]') as HTMLButtonElement).disabled).toBe(true);
      expect(suspended.querySelector('[data-delete]')).not.toBeNull();
      expect(suspended.querySelector('[data-activate]')).not.toBeNull();
    });

    it('should search with a debounce and filter by state from the server', async () => {
      await openPanel();
      type(root(), '[data-search]', 'bar');
      await answerMatching(http, r => r.url === `${API}/tenants` && r.params.get('query') === 'bar', 'search', page([tenant({ name: 'Bar B', slug: 'bar-b' })]));
      await ui();
      expect(root().querySelectorAll('table [data-row]').length).toBe(1);

      click('[data-filter="suspended"]');
      await answerMatching(http, r => r.url === `${API}/tenants` && r.params.get('status') === 'suspended', 'filter', page([]));
      await ui();
      expect(text()).toContain('Sin resultados');
    });

    it('should paginate through the server pages', async () => {
      const navigation = harness.navigateByUrl('/superadmin');
      await answerCsrf(http);
      await answer(http, `${API}/auth/me`, { email: 'root@plataforma.test' });
      await navigation;
      await answerMatching(http, r => r.url === `${API}/tenants`, 'first', page([tenant()], { totalElements: 11, totalPages: 2 }));
      await answer(http, `${API}/stats`, stats);
      await ui();
      expect((root().querySelector('[data-prev]') as HTMLButtonElement).disabled).toBe(true);

      click('[data-next]');
      await answerMatching(http, r => r.url === `${API}/tenants` && r.params.get('page') === '1', 'second', page([tenant({ name: 'Otro', slug: 'otro' })], { page: 1, totalElements: 11, totalPages: 2 }));
      await ui();
      expect(text()).toContain('página 2 de 2');
      expect((root().querySelector('[data-next]') as HTMLButtonElement).disabled).toBe(true);
    });

    it('should explain the consequences before suspending and then reload the list', async () => {
      await openPanel();
      click('table [data-slug="negocio-a"] [data-suspend]');
      await ui();
      expect(dialog()?.textContent).toContain('dejará de verse al público');

      (dialog()!.querySelector('[data-confirm]') as HTMLElement).click();
      await answerCsrf(http).catch(() => undefined);
      await answer(http, `${API}/tenants/t1/suspend`, null, { status: 204, statusText: 'No Content' }, 'POST');
      await answerMatching(http, r => r.url === `${API}/tenants`, 'reload', page([tenant({ suspended: true })]));
      await answer(http, `${API}/stats`, stats);
      await ui();
      expect(notices.notice()?.text).toContain('suspendido');
      expect(dialog()).toBeNull();
    });

    it('should require typing the exact address to delete and send it to the server', async () => {
      await openPanel();
      click('table [data-slug="bar-b"] [data-delete]');
      await ui();
      const confirmButton = () => dialog()!.querySelector('[data-confirm]') as HTMLButtonElement;
      expect(confirmButton().disabled).toBe(true);

      type(dialog()!, '[data-confirm-slug]', 'otra-cosa');
      await ui();
      expect(confirmButton().disabled).toBe(true);

      type(dialog()!, '[data-confirm-slug]', 'bar-b');
      await ui();
      expect(confirmButton().disabled).toBe(false);
      confirmButton().click();
      const request = await answer(http, `${API}/tenants/t2`, null, { status: 204, statusText: 'No Content' }, 'DELETE');
      expect(request.request.body).toEqual({ confirmSlug: 'bar-b' });
      await answerMatching(http, r => r.url === `${API}/tenants`, 'reload', page([tenant()]));
      await answer(http, `${API}/stats`, stats);
      await ui();
      expect(notices.notice()?.text).toContain('eliminado');
    });

    it('should show the activity log in its own tab', async () => {
      await openPanel();
      (Array.from(root().querySelectorAll('[role="tab"]')).find(t => t.textContent?.includes('Actividad')) as HTMLElement).click();
      await answerMatching(http, r => r.url === `${API}/audit`, 'audit', [
        { id: 'a1', at: '2026-10-25T12:00:00Z', action: 'TENANT_SUSPENDED', targetLabel: 'Negocio A (negocio-a)', actor: 'root@plataforma.test', ip: '127.0.0.1', detail: null },
      ]);
      await ui();
      expect(root().querySelector('[data-activity]')?.textContent).toContain('Suspendido');
      expect(root().querySelector('[data-activity]')?.textContent).toContain('Negocio A (negocio-a)');
    });

    it('should leave the panel without logging out and come back without asking for the code again', async () => {
      await openPanel();

      click('[data-exit]');
      for (let i = 0; i < 40 && router.url !== '/'; i++) {
        await ui();
      }
      expect(router.url).toBe('/');
      await drainHomeAuth();
      http.expectNone(`${API}/auth/logout`);

      const navigation = harness.navigateByUrl('/superadmin');
      await answerMatching(http, r => r.url === `${API}/tenants`, 'GET tenants', page([tenant()]));
      await answer(http, `${API}/stats`, stats);
      await navigation;
      await ui();
      expect(router.url).toBe('/superadmin');
      expect(root().querySelector('[data-step-code]')).toBeNull();
    });

    it('should not touch the business session when logging out of the superadmin', async () => {
      await openPanel();
      click('[data-logout]');
      await answerCsrf(http);
      await answer(http, `${API}/auth/logout`, null, { status: 204, statusText: 'No Content' }, 'POST');
      await settle();
      http.match('/api/v1/auth/csrf').forEach(request => request.flush({ headerName: 'X-XSRF-TOKEN' }));
      for (let i = 0; i < 40 && router.url !== '/'; i++) {
        await ui();
      }
      expect(router.url).toBe('/');
      await drainHomeAuth();
      http.expectNone('/api/v1/auth/logout');
    });

    it('should return to the login when the session expires while using the panel', async () => {
      await openPanel();
      click('[data-next], [data-filter="active"]');
      await fail(http, `${API}/tenants`, 401, { code: 'unauthenticated' });
      await ui();
      expect(router.url).toBe('/superadmin/login');
      expect(notices.notice()?.text).toContain('sesión expiró');
    });
  });
});
