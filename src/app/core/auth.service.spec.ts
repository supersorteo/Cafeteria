import { HttpParams, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CSRF, ME_URL, answer, answerCsrf, fail, makeMe, restoreSession, settle } from '../testing/http';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should start initializing and restore the session from the server', async () => {
    expect(auth.state().status).toBe('initializing');
    const ready = auth.ensureInitialized();
    await restoreSession(http, makeMe());
    await ready;

    expect(auth.state().status).toBe('authenticated');
    expect(auth.user()?.tenant.name).toBe('Negocio A');
    expect(auth.isOwner()).toBe(true);
  });

  it('should be anonymous when the server answers 401', async () => {
    const ready = auth.ensureInitialized();
    await restoreSession(http, null);
    await ready;
    expect(auth.state().status).toBe('anonymous');
    expect(auth.user()).toBeNull();
  });

  it('should treat a server failure as an error, not as a logout', async () => {
    const ready = auth.ensureInitialized();
    await answerCsrf(http);
    await fail(http, ME_URL, 500);
    await ready;
    expect(auth.state().status).toBe('error');
  });

  it('should treat a network failure on the csrf request as an error', async () => {
    const ready = auth.ensureInitialized();
    await settle();
    http.expectOne(CSRF).error(new ProgressEvent('error'));
    await ready;
    expect(auth.state().status).toBe('error');
  });

  it('should initialize only once and allow an explicit retry', async () => {
    const first = auth.ensureInitialized();
    await restoreSession(http, makeMe());
    await first;
    await auth.ensureInitialized();
    http.expectNone(CSRF);

    const again = auth.retry();
    expect(auth.state().status).toBe('initializing');
    await restoreSession(http, makeMe({ email: 'otro@a.test' }));
    await again;
    expect(auth.user()?.email).toBe('otro@a.test');
  });

  it('should log in with a url-encoded form after fetching the csrf token', async () => {
    const login = auth.login('  Owner@A.test ', 'Clave-Segura-1');
    await answerCsrf(http);
    const request = await answer(http, '/api/v1/auth/login', { authenticated: true }, {}, 'POST');
    await answer(http, ME_URL, makeMe());
    await login;

    const body = request.request.body as HttpParams;
    expect(body.get('username')).toBe('Owner@A.test');
    expect(body.get('password')).toBe('Clave-Segura-1');
    expect(auth.state().status).toBe('authenticated');
  });

  it('should reject a wrong password and stay anonymous', async () => {
    const ready = auth.ensureInitialized();
    await restoreSession(http, null);
    await ready;

    const login = auth.login('a@a.test', 'mala');
    const rejection = expect(login).rejects.toBeTruthy();
    await answerCsrf(http);
    await fail(http, '/api/v1/auth/login', 401, { code: 'invalid_credentials' });
    await rejection;
    expect(auth.state().status).toBe('anonymous');
  });

  it('should log out, clear the user and refresh the csrf token', async () => {
    const ready = auth.ensureInitialized();
    await restoreSession(http, makeMe());
    await ready;

    const logout = auth.logout();
    await answerCsrf(http);
    await answer(http, '/api/v1/auth/logout', null, { status: 204, statusText: 'No Content' }, 'POST');
    await logout;
    expect(auth.state().status).toBe('anonymous');

    await answerCsrf(http);
  });

  it('should keep the session if the logout request fails', async () => {
    const ready = auth.ensureInitialized();
    await restoreSession(http, makeMe());
    await ready;

    const logout = auth.logout();
    const rejection = expect(logout).rejects.toBeTruthy();
    await answerCsrf(http);
    await fail(http, '/api/v1/auth/logout', 500);
    await rejection;
    expect(auth.state().status).toBe('authenticated');
  });

  it('should consider an expired session already logged out', async () => {
    const ready = auth.ensureInitialized();
    await restoreSession(http, makeMe());
    await ready;

    const logout = auth.logout();
    await answerCsrf(http);
    await fail(http, '/api/v1/auth/logout', 401);
    await logout;
    expect(auth.state().status).toBe('anonymous');
    await answerCsrf(http);
  });

  it('should only expire an authenticated session', async () => {
    const ready = auth.ensureInitialized();
    await restoreSession(http, null);
    await ready;
    auth.expireSession();
    expect(auth.state().status).toBe('anonymous');
  });
});
