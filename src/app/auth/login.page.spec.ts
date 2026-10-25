import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { answer, answerCsrf, fail, makeMe, settle, submit, type } from '../testing/http';
import { NoticeService } from '../core/notice.service';
import { LoginPage } from './login.page';

@Component({ template: '' })
class Stub {}

describe('LoginPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let router: Router;

  const root = () => harness.routeNativeElement as HTMLElement;
  const text = () => root().textContent ?? '';
  const button = () => root().querySelector('button[type="submit"]') as HTMLButtonElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'auth/login', component: LoginPage },
          { path: 'admin', component: Stub },
          { path: 'admin/menu', component: Stub },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    harness = await RouterTestingHarness.create();
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => http.verify());

  function fillAndSubmit(email = 'owner@a.test', password = 'Clave-Segura-1'): void {
    type(root(), '#login-email', email);
    type(root(), '#login-password', password);
    submit(root());
    harness.detectChanges();
  }

  async function completeLogin(): Promise<void> {
    await answerCsrf(http);
    await answer(http, '/api/v1/auth/login', { authenticated: true }, {}, 'POST');
    await answer(http, '/api/v1/auth/me', makeMe());
    await settle();
  }

  it('should validate the form without calling the server', async () => {
    await harness.navigateByUrl('/auth/login');
    submit(root());
    harness.detectChanges();
    expect(text()).toContain('Escribe un correo válido.');
    expect(text()).toContain('Escribe tu contraseña.');
    http.expectNone(() => true);
  });

  it('should log in and go to the panel, blocking double submits', async () => {
    await harness.navigateByUrl('/auth/login');
    fillAndSubmit();
    submit(root());
    expect(button().disabled).toBe(true);
    expect(text()).toContain('Entrando');

    await completeLogin();
    expect(router.url).toBe('/admin');
  });

  it('should return to the page the user came from', async () => {
    await harness.navigateByUrl('/auth/login?returnUrl=%2Fadmin%2Fmenu');
    fillAndSubmit();
    await completeLogin();
    expect(router.url).toBe('/admin/menu');
  });

  it('should ignore a return url that points outside the panel', async () => {
    await harness.navigateByUrl('/auth/login?returnUrl=https%3A%2F%2Fevil.example');
    fillAndSubmit();
    await completeLogin();
    expect(router.url).toBe('/admin');
  });

  it('should show a generic message for wrong credentials and allow another try', async () => {
    await harness.navigateByUrl('/auth/login');
    fillAndSubmit('owner@a.test', 'mala');
    await answerCsrf(http);
    await fail(http, '/api/v1/auth/login', 401, { code: 'invalid_credentials' });
    await settle();
    harness.detectChanges();

    expect(root().querySelector('[role="alert"]')?.textContent).toContain('Correo o contraseña incorrectos');
    expect(button().disabled).toBe(false);
    expect(router.url).toBe('/auth/login');
  });

  it('should explain the rate limit', async () => {
    await harness.navigateByUrl('/auth/login');
    fillAndSubmit();
    await answerCsrf(http);
    await fail(http, '/api/v1/auth/login', 429, { code: 'too_many_attempts' }, { 'Retry-After': '900' });
    await settle();
    harness.detectChanges();
    expect(root().querySelector('[role="alert"]')?.textContent).toContain('Demasiados intentos');
  });

  it('should report a connection problem instead of wrong credentials', async () => {
    await harness.navigateByUrl('/auth/login');
    fillAndSubmit();
    await settle();
    http.expectOne('/api/v1/auth/csrf').error(new ProgressEvent('error'));
    await settle();
    harness.detectChanges();
    expect(root().querySelector('[role="alert"]')?.textContent).toContain('No pudimos conectar');
    expect(text()).not.toContain('incorrectos');
  });

  it('should confirm the verified email with a notice and clean the url', async () => {
    const notices = TestBed.inject(NoticeService);
    await harness.navigateByUrl('/auth/login?verified=1');
    await settle();
    expect(notices.notice()?.text).toContain('Correo confirmado');
    expect(router.url).toBe('/auth/login');
    notices.dismiss();
  });
});
