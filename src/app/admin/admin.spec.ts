import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { authInterceptor } from '../core/auth.interceptor';
import { NoticeService } from '../core/notice.service';
import { ME_URL, answer, answerCsrf, fail, makeMe, restoreSession, settle, submit, type } from '../testing/http';

const DASHBOARD = '/api/v1/admin/dashboard';
const dashboard = (name: string, overrides: object = {}) => ({
  slug: 'negocio-a', name, published: true, categories: 5, activeItems: 28, inactiveItems: 3, images: 13, ...overrides,
});

describe('admin panel', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let router: Router;
  let notices: NoticeService;

  const root = () => harness.routeNativeElement as HTMLElement;
  const text = () => root().textContent ?? '';

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
    http.verify();
  });

  async function openPanel(me = makeMe(), name = 'Negocio A'): Promise<void> {
    const navigation = harness.navigateByUrl('/admin');
    await restoreSession(http, me);
    await navigation;
    await answer(http, DASHBOARD, dashboard(name));
    await settle();
    harness.detectChanges();
  }

  it('should restore the session on a deep link and show the shell with the dashboard', async () => {
    await openPanel();

    expect(router.url).toBe('/admin');
    expect(text()).toContain('Negocio A');
    expect(text()).toContain('Propietario');
    expect(text()).toContain('owner@a.test');
    expect(text()).toContain('Resumen');
    expect(text()).toContain('publicado');
    const figures = Array.from(root().querySelectorAll('section[aria-label="Cifras"] p.font-display')).map(el => el.textContent?.trim());
    expect(figures).toEqual(['5', '28', '3', '13']);
  });

  it('should only link screens that exist', async () => {
    await openPanel();
    const links = Array.from(root().querySelectorAll('nav a')).map(a => a.textContent?.trim());
    expect(links).toEqual(['Resumen', 'Carta', 'Mi sitio', 'Ver mi sitio ↗']);
    expect((root().querySelector('nav a[target="_blank"]') as HTMLAnchorElement).getAttribute('href')).toBe('/negocio-a');
  });

  it('should show editors with their own role label', async () => {
    await openPanel(makeMe({ role: 'EDITOR', email: 'editor@a.test' }));
    expect(text()).toContain('Editor');
    expect(text()).not.toContain('Propietario');
  });

  it('should redirect anonymous visitors to the login keeping the destination', async () => {
    const navigation = harness.navigateByUrl('/admin');
    await restoreSession(http, null);
    await navigation;
    expect(router.url).toBe('/auth/login?returnUrl=%2Fadmin');
  });

  it('should send unknown panel paths to the dashboard', async () => {
    const navigation = harness.navigateByUrl('/admin/no-existe');
    await restoreSession(http, makeMe());
    await navigation;
    await answer(http, DASHBOARD, dashboard('Negocio A'));
    await settle();
    expect(router.url).toBe('/admin');
  });

  it('should offer a retry, not a logout, when the session cannot be verified', async () => {
    const navigation = harness.navigateByUrl('/admin');
    await answerCsrf(http);
    await fail(http, ME_URL, 503);
    await navigation;
    harness.detectChanges();
    expect(text()).toContain('No pudimos verificar tu sesión');
    expect(router.url).toBe('/admin');

    (root().querySelector('button') as HTMLButtonElement).click();
    await restoreSession(http, makeMe());
    await answer(http, DASHBOARD, dashboard('Negocio A'));
    await settle();
    harness.detectChanges();
    expect(text()).toContain('Negocio A');
  });

  it('should show a recoverable error when the dashboard fails', async () => {
    const navigation = harness.navigateByUrl('/admin');
    await restoreSession(http, makeMe());
    await navigation;
    await fail(http, DASHBOARD, 500);
    await settle();
    harness.detectChanges();
    expect(root().querySelector('[role="alert"]')?.textContent).toContain('No pudimos cargar el resumen');

    const retry = Array.from(root().querySelectorAll('button')).find(b => b.textContent?.includes('Reintentar')) as HTMLButtonElement;
    retry.click();
    await answer(http, DASHBOARD, dashboard('Negocio A'));
    await settle();
    harness.detectChanges();
    expect(text()).toContain('Negocio A');
  });

  it('should redirect to the login with a notice when the session expires while the panel is open', async () => {
    const navigation = harness.navigateByUrl('/admin');
    await restoreSession(http, makeMe());
    await navigation;
    await fail(http, DASHBOARD, 401, { code: 'unauthenticated' });
    await settle();
    await settle();

    expect(router.url).toBe('/auth/login?returnUrl=%2Fadmin');
    expect(notices.notice()?.text).toContain('sesión expiró');
  });

  it('should log out, and a different account must not see the previous account content', async () => {
    await openPanel();
    expect(text()).toContain('Negocio A');

    (Array.from(root().querySelectorAll('button')).find(b => b.textContent?.includes('Cerrar sesión')) as HTMLButtonElement).click();
    await answerCsrf(http);
    await answer(http, '/api/v1/auth/logout', null, { status: 204, statusText: 'No Content' }, 'POST');
    await answerCsrf(http);
    await settle();
    harness.detectChanges();
    expect(router.url).toBe('/auth/login');
    expect(text()).not.toContain('Negocio A');

    type(root(), '#login-email', 'owner@b.test');
    type(root(), '#login-password', 'Clave-Segura-1');
    submit(root());
    await answerCsrf(http);
    await answer(http, '/api/v1/auth/login', { authenticated: true }, {}, 'POST');
    await answer(http, ME_URL, makeMe({ email: 'owner@b.test', tenant: { id: 't2', slug: 'negocio-b', name: 'Negocio B', published: false } }));
    await answer(http, DASHBOARD, dashboard('Negocio B', { slug: 'negocio-b', published: false, categories: 1 }));
    await settle();
    harness.detectChanges();

    expect(router.url).toBe('/admin');
    expect(text()).toContain('Negocio B');
    expect(text()).toContain('borrador');
    expect(text()).not.toContain('Negocio A');
    expect(text()).not.toContain('owner@a.test');
  });
});
