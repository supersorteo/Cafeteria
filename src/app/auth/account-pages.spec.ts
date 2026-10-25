import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Component } from '@angular/core';
import { CrossTab, CrossTabMessage } from '../core/cross-tab.service';
import { answer, answerCsrf, fail, settle, submit, type } from '../testing/http';
import { EmailFormPage } from './email-form.page';
import { ResetPasswordPage } from './reset-password.page';
import { VERIFY_TIMINGS, VerifyEmailPage } from './verify-email.page';

@Component({ template: '' })
class Stub {}

class FakeCrossTab {
  sent: CrossTabMessage[] = [];
  handler: ((message: CrossTabMessage) => void) | null = null;
  otherTabOpen = false;
  send(message: CrossTabMessage): void {
    this.sent.push(message);
    if (this.otherTabOpen && message === 'email-verified') {
      queueMicrotask(() => this.handler?.('ack'));
    }
  }
  listen(handler: (message: CrossTabMessage) => void): () => void {
    this.handler = handler;
    return () => (this.handler = null);
  }
}

describe('account pages', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let router: Router;
  let crossTab: FakeCrossTab;

  const root = () => harness.routeNativeElement as HTMLElement;
  const text = () => root().textContent ?? '';

  beforeEach(async () => {
    crossTab = new FakeCrossTab();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'auth/verify-email', component: VerifyEmailPage },
          { path: 'auth/login', component: Stub },
          { path: 'auth/reset-password', component: ResetPasswordPage },
          { path: 'auth/forgot-password', data: { mode: 'forgot' }, component: EmailFormPage },
          { path: 'auth/resend-verification', data: { mode: 'resend' }, component: EmailFormPage },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CrossTab, useValue: crossTab },
        { provide: VERIFY_TIMINGS, useValue: { ackWaitMs: 40, countdownSeconds: 3, tickMs: 60 } },
      ],
    });
    harness = await RouterTestingHarness.create();
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => http.verify());

  describe('verify email', () => {
    it('should remove the token from the url and confirm the account', async () => {
      await harness.navigateByUrl('/auth/verify-email?token=abc123');
      await settle();
      expect(router.url).toBe('/auth/verify-email');

      await answerCsrf(http);
      const request = await answer(http, '/api/v1/auth/verify-email', null, { status: 204, statusText: 'No Content' }, 'POST');
      await settle();
      harness.detectChanges();

      expect(request.request.body).toEqual({ token: 'abc123' });
      expect(text()).toContain('Correo confirmado');
      expect(root().querySelector('a[href="/auth/login?verified=1"]')).not.toBeNull();
    });

    async function confirm(): Promise<void> {
      await harness.navigateByUrl('/auth/verify-email?token=abc123');
      await answerCsrf(http);
      await answer(http, '/api/v1/auth/verify-email', null, { status: 204, statusText: 'No Content' }, 'POST');
      await settle();
      harness.detectChanges();
    }

    it('should announce the confirmation to other tabs and let the original tab continue', async () => {
      crossTab.otherTabOpen = true;
      await confirm();
      await new Promise(resolve => setTimeout(resolve, 120));
      harness.detectChanges();

      expect(crossTab.sent).toEqual(['email-verified']);
      expect(root().querySelector('[data-other-tab]')?.textContent).toContain('Tu otra pestaña ya continuó');
      expect(root().querySelector('[data-close-tab]')).not.toBeNull();
      expect(root().querySelector('[data-countdown]')).toBeNull();
      expect(router.url).toBe('/auth/verify-email');
    });

    it('should count down and go to the login in the same tab when no other tab answers', async () => {
      await confirm();
      await new Promise(resolve => setTimeout(resolve, 70));
      harness.detectChanges();
      expect(root().querySelector('[data-countdown]')?.textContent).toContain('3');

      await new Promise(resolve => setTimeout(resolve, 400));
      expect(router.url).toBe('/auth/login?verified=1');
    });

    it('should not announce anything when the confirmation fails', async () => {
      await harness.navigateByUrl('/auth/verify-email?token=viejo');
      await answerCsrf(http);
      await fail(http, '/api/v1/auth/verify-email', 400, { code: 'invalid_token' });
      await settle();
      expect(crossTab.sent).toEqual([]);
    });

    it('should show an invalid link message and offer a new one', async () => {
      await harness.navigateByUrl('/auth/verify-email?token=viejo');
      await answerCsrf(http);
      await fail(http, '/api/v1/auth/verify-email', 400, { code: 'invalid_token' });
      await settle();
      harness.detectChanges();

      expect(text()).toContain('Enlace no válido');
      expect(root().querySelector('a[href="/auth/resend-verification"]')).not.toBeNull();
    });

    it('should allow retrying after a connection problem without losing the token', async () => {
      await harness.navigateByUrl('/auth/verify-email?token=abc123');
      await answerCsrf(http);
      await fail(http, '/api/v1/auth/verify-email', 503);
      await settle();
      harness.detectChanges();
      expect(text()).toContain('No pudimos verificar');

      (root().querySelector('button.btn') as HTMLButtonElement).click();
      await answerCsrf(http);
      const retry = await answer(http, '/api/v1/auth/verify-email', null, { status: 204, statusText: 'No Content' }, 'POST');
      await settle();
      harness.detectChanges();
      expect(retry.request.body).toEqual({ token: 'abc123' });
      expect(text()).toContain('Correo confirmado');
    });

    it('should not call the server when the link has no token', async () => {
      await harness.navigateByUrl('/auth/verify-email');
      await settle();
      harness.detectChanges();
      expect(text()).toContain('Falta el enlace');
      http.expectNone(() => true);
    });
  });

  describe('forgot password and resend verification', () => {
    it('should send the request and always answer with a generic message', async () => {
      await harness.navigateByUrl('/auth/forgot-password');
      type(root(), '#email-form-email', ' dueno@a.test ');
      submit(root());
      await answerCsrf(http);
      const request = await answer(http, '/api/v1/auth/forgot-password', { message: 'ok' }, { status: 202, statusText: 'Accepted' }, 'POST');
      await settle();
      harness.detectChanges();

      expect(request.request.body).toEqual({ email: 'dueno@a.test' });
      expect(text()).toContain('Si existe una cuenta con ese correo');
    });

    it('should use the resend endpoint in resend mode', async () => {
      await harness.navigateByUrl('/auth/resend-verification');
      expect(text()).toContain('Reenviar verificación');
      type(root(), '#email-form-email', 'dueno@a.test');
      submit(root());
      await answerCsrf(http);
      await answer(http, '/api/v1/auth/resend-verification', { message: 'ok' }, { status: 202, statusText: 'Accepted' }, 'POST');
      await settle();
      harness.detectChanges();
      expect(text()).toContain('te enviamos un nuevo enlace');
    });

    it('should reject an invalid email locally and explain the rate limit', async () => {
      await harness.navigateByUrl('/auth/forgot-password');
      type(root(), '#email-form-email', 'no-es-correo');
      submit(root());
      harness.detectChanges();
      expect(text()).toContain('Escribe un correo válido');
      http.expectNone(() => true);

      type(root(), '#email-form-email', 'dueno@a.test');
      submit(root());
      await answerCsrf(http);
      await fail(http, '/api/v1/auth/forgot-password', 429, { code: 'too_many_attempts' });
      await settle();
      harness.detectChanges();
      expect(root().querySelector('[role="alert"]')?.textContent).toContain('Demasiados intentos');
    });
  });

  describe('reset password', () => {
    function fill(password: string, confirm: string): void {
      type(root(), '#reset-password', password);
      type(root(), '#reset-confirm', confirm);
      submit(root());
      harness.detectChanges();
    }

    it('should remove the token from the url and block mismatching passwords', async () => {
      await harness.navigateByUrl('/auth/reset-password?token=tok');
      await settle();
      expect(router.url).toBe('/auth/reset-password');

      fill('Clave-Nueva-12345', 'Otra-Distinta-1');
      expect(text()).toContain('no coinciden');
      http.expectNone(() => true);
    });

    it('should block a short password', async () => {
      await harness.navigateByUrl('/auth/reset-password?token=tok');
      fill('corta', 'corta');
      expect(text()).toContain('entre 10 y 72 caracteres');
      http.expectNone(() => true);
    });

    it('should change the password with the captured token', async () => {
      await harness.navigateByUrl('/auth/reset-password?token=tok');
      fill('Clave-Nueva-12345', 'Clave-Nueva-12345');
      await answerCsrf(http);
      const request = await answer(http, '/api/v1/auth/reset-password', null, { status: 204, statusText: 'No Content' }, 'POST');
      await settle();
      harness.detectChanges();

      expect(request.request.body).toEqual({ token: 'tok', newPassword: 'Clave-Nueva-12345' });
      expect(text()).toContain('Contraseña actualizada');
    });

    it('should show an invalid link state when the token is rejected', async () => {
      await harness.navigateByUrl('/auth/reset-password?token=viejo');
      fill('Clave-Nueva-12345', 'Clave-Nueva-12345');
      await answerCsrf(http);
      await fail(http, '/api/v1/auth/reset-password', 400, { code: 'invalid_token' });
      await settle();
      harness.detectChanges();
      expect(text()).toContain('Enlace no válido');
      expect(root().querySelector('a[href="/auth/forgot-password"]')).not.toBeNull();
    });

    it('should show an invalid link state when there is no token', async () => {
      await harness.navigateByUrl('/auth/reset-password');
      expect(text()).toContain('Enlace no válido');
      http.expectNone(() => true);
    });
  });
});
