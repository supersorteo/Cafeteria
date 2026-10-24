import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { CSRF, answerCsrf, fail, makeMe, restoreSession, settle } from '../testing/http';
import { AuthService } from './auth.service';
import { authInterceptor } from './auth.interceptor';
import { NoticeService } from './notice.service';

@Component({ template: '' })
class Stub {}

describe('authInterceptor', () => {
  let http: HttpTestingController;
  let client: HttpClient;
  let auth: AuthService;
  let notices: NoticeService;
  let router: Router;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'admin', component: Stub },
          { path: 'auth/login', component: Stub },
        ]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
    auth = TestBed.inject(AuthService);
    notices = TestBed.inject(NoticeService);
    router = TestBed.inject(Router);
    await router.navigateByUrl('/admin');
  });

  afterEach(() => {
    notices.dismiss();
    http.verify();
  });

  async function authenticate(): Promise<void> {
    const ready = auth.ensureInitialized();
    await restoreSession(http, makeMe());
    await ready;
  }

  it('should send the user to the login with the current page when the session expired', async () => {
    await authenticate();
    const rejected = expect(new Promise((_, reject) => client.get('/api/v1/admin/dashboard').subscribe({ error: reject }))).rejects.toBeTruthy();
    await fail(http, '/api/v1/admin/dashboard', 401, { code: 'unauthenticated' });
    await rejected;
    await settle();

    expect(auth.state().status).toBe('anonymous');
    expect(router.url).toBe('/auth/login?returnUrl=%2Fadmin');
    expect(notices.notice()?.text).toContain('sesión expiró');
  });

  it('should not treat auth endpoints as an expired session', async () => {
    await authenticate();
    const rejected = expect(new Promise((_, reject) => client.get('/api/v1/auth/me').subscribe({ error: reject }))).rejects.toBeTruthy();
    await fail(http, '/api/v1/auth/me', 401);
    await rejected;

    expect(auth.state().status).toBe('authenticated');
    expect(router.url).toBe('/admin');
    expect(notices.notice()).toBeNull();
  });

  it('should explain a forbidden action without retrying the write', async () => {
    await authenticate();
    const rejected = expect(new Promise((_, reject) => client.put('/api/v1/admin/site', {}).subscribe({ error: reject }))).rejects.toBeTruthy();
    await fail(http, '/api/v1/admin/site', 403, { code: 'forbidden' });
    await rejected;
    await settle();

    http.expectNone('/api/v1/admin/site');
    http.expectNone(CSRF);
    expect(notices.notice()?.text).toContain('No tienes permiso');
    expect(auth.state().status).toBe('authenticated');
    expect(router.url).toBe('/admin');
  });

  it('should refresh the csrf token once on a csrf failure but never resend the write', async () => {
    await authenticate();
    const rejected = expect(new Promise((_, reject) => client.post('/api/v1/admin/categories', {}).subscribe({ error: reject }))).rejects.toBeTruthy();
    await fail(http, '/api/v1/admin/categories', 403, { code: 'csrf_invalid' });
    await rejected;

    await answerCsrf(http);
    await settle();
    http.expectNone('/api/v1/admin/categories');
    expect(notices.notice()?.text).toContain('verificación de seguridad');
  });

  it('should ignore failures of requests that are not ours', async () => {
    const rejected = expect(new Promise((_, reject) => client.get('/media/x').subscribe({ error: reject }))).rejects.toBeTruthy();
    await settle();
    http.expectOne('/media/x').flush('', { status: 403, statusText: 'Forbidden' });
    await rejected;
    expect(notices.notice()).toBeNull();
  });
});
