import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { answer, answerCsrf, fail, settle, submit, type } from '../testing/http';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CrossTab, CrossTabMessage } from '../core/cross-tab.service';
import { NoticeService } from '../core/notice.service';
import { RegisterPage } from './register.page';

@Component({ template: '' })
class LoginStub {}

class FakeCrossTab {
  sent: CrossTabMessage[] = [];
  handler: ((message: CrossTabMessage) => void) | null = null;
  send(message: CrossTabMessage): void {
    this.sent.push(message);
  }
  listen(handler: (message: CrossTabMessage) => void): () => void {
    this.handler = handler;
    return () => (this.handler = null);
  }
}

describe('RegisterPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  const root = () => harness.routeNativeElement as HTMLElement;
  const text = () => root().textContent ?? '';
  const value = (selector: string) => (root().querySelector(selector) as HTMLInputElement).value;

  let crossTab: FakeCrossTab;

  beforeEach(async () => {
    crossTab = new FakeCrossTab();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'auth/register', component: RegisterPage }, { path: 'auth/login', component: LoginStub }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CrossTab, useValue: crossTab },
      ],
    });
    harness = await RouterTestingHarness.create();
    http = TestBed.inject(HttpTestingController);
    await harness.navigateByUrl('/auth/register');
  });

  afterEach(() => http.verify());

  function fill(overrides: Partial<Record<'business' | 'slug' | 'email' | 'password' | 'code', string>> = {}): void {
    type(root(), '#reg-code', overrides.code ?? 'dlr abcd 2345');
    type(root(), '#reg-business', overrides.business ?? 'Café Nuevo');
    if (overrides.slug !== undefined) {
      type(root(), '#reg-slug', overrides.slug);
    }
    type(root(), '#reg-email', overrides.email ?? ' nuevo@cafe.test ');
    type(root(), '#reg-password', overrides.password ?? 'Clave-Segura-1');
    submit(root());
    harness.detectChanges();
  }

  it('should suggest the address from the business name until the user edits it', () => {
    type(root(), '#reg-business', 'Café La Terraza & Cocina');
    expect(value('#reg-slug')).toBe('cafe-la-terraza-cocina');

    const slug = root().querySelector('#reg-slug') as HTMLInputElement;
    slug.value = 'mi-direccion';
    slug.dispatchEvent(new Event('input'));
    type(root(), '#reg-business', 'Otro nombre');
    expect(value('#reg-slug')).toBe('mi-direccion');
  });

  it('should block a short password and reserved or malformed addresses without calling the server', () => {
    fill({ password: 'corta' });
    expect(text()).toContain('entre 10 y 72 caracteres');

    fill({ slug: 'admin' });
    expect(text()).toContain('no está disponible');

    fill({ slug: 'Mal Slug' });
    expect(text()).toContain('letras minúsculas');
    http.expectNone(() => true);
  });

  it('should register and ask the user to check their email', async () => {
    fill();
    await answerCsrf(http);
    const request = await answer(http, '/api/v1/auth/register', { message: 'ok' }, { status: 202, statusText: 'Accepted' }, 'POST');
    await settle();
    harness.detectChanges();

    expect(request.request.body).toEqual({
      businessName: 'Café Nuevo',
      slug: 'cafe-nuevo',
      email: 'nuevo@cafe.test',
      password: 'Clave-Segura-1',
      activationCode: 'DLR-ABCD-2345',
    });
    expect(text()).toContain('Revisa tu correo');
    expect(text()).toContain('Enviado a nuevo@cafe.test');
    expect(localStorage.getItem('terraza-login-email')).toBe('nuevo@cafe.test');
    expect(root().querySelector('[data-resend]')).not.toBeNull();
    expect(root().querySelector('[data-open-mail]')).toBeNull();
  });

  it('should offer a button that opens the inbox of the email provider in a new tab', async () => {
    fill({ email: 'Ana@Gmail.com' });
    await answerCsrf(http);
    await answer(http, '/api/v1/auth/register', { message: 'ok' }, { status: 202, statusText: 'Accepted' }, 'POST');
    await settle();
    harness.detectChanges();

    const link = root().querySelector('[data-open-mail]') as HTMLAnchorElement;
    expect(link.textContent).toContain('Abrir Gmail');
    expect(link.getAttribute('href')).toBe('https://mail.google.com/mail/?authuser=ana%40gmail.com');
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
  });

  it('should format the activation code as the user types and require it before sending anything', async () => {
    type(root(), '#reg-code', 'dlr abcd2345 extra');
    expect(value('#reg-code')).toBe('DLR-ABCD-2345');
    type(root(), '#reg-code', 'abcd');
    expect(value('#reg-code')).toBe('DLR-ABCD');

    fill({ code: '' });
    expect(text()).toContain('formato DLR-XXXX-XXXX');
    http.expectNone(() => true);
  });

  it('should explain that the activation code is not valid, without creating anything', async () => {
    fill();
    await answerCsrf(http);
    await fail(http, '/api/v1/auth/register', 400, { code: 'invalid_code' });
    await settle();
    harness.detectChanges();

    expect(text()).toContain('El código no es válido o ya fue usado.');
    expect(text()).not.toContain('Revisa tu correo');
  });

  it('should report a taken address on the slug field and keep the form', async () => {
    fill();
    await answerCsrf(http);
    await fail(http, '/api/v1/auth/register', 409, { code: 'slug_taken' });
    await settle();
    harness.detectChanges();

    expect(text()).toContain('Esa dirección ya está en uso');
    expect(root().querySelector('form')).not.toBeNull();
  });

  it('should show server validation errors on their fields', async () => {
    fill();
    await answerCsrf(http);
    await fail(http, '/api/v1/auth/register', 400, { code: 'validation_error', fieldErrors: [{ field: 'email', message: 'no es una dirección de correo válida' }] });
    await settle();
    harness.detectChanges();
    expect(text()).toContain('no es una dirección de correo válida');
  });

  it('should explain when registration is disabled', async () => {
    fill();
    await answerCsrf(http);
    await fail(http, '/api/v1/auth/register', 403, { code: 'registration_disabled' });
    await settle();
    harness.detectChanges();
    expect(root().querySelector('[role="alert"]')?.textContent).toContain('no está disponible por ahora');
  });

  it('should explain the rate limit', async () => {
    fill();
    await answerCsrf(http);
    await fail(http, '/api/v1/auth/register', 429, { code: 'too_many_attempts' });
    await settle();
    harness.detectChanges();
    expect(root().querySelector('[role="alert"]')?.textContent).toContain('Demasiados intentos');
  });

  it('should move to the login with a notice when the email is confirmed in another tab', async () => {
    fill();
    await answerCsrf(http);
    await answer(http, '/api/v1/auth/register', {}, { status: 201, statusText: 'Created' }, 'POST');
    await settle();
    harness.detectChanges();
    expect(text()).toContain('Revisa tu correo');
    expect(crossTab.handler).not.toBeNull();

    crossTab.handler!('email-verified');
    await settle();
    expect(TestBed.inject(Router).url).toBe('/auth/login');
    expect(crossTab.sent).toEqual(['ack']);
    expect(TestBed.inject(NoticeService).notice()?.text).toContain('Correo confirmado');
    TestBed.inject(NoticeService).dismiss();
  });

  it('should not listen for confirmations before the account is created', () => {
    expect(crossTab.handler).toBeNull();
  });

  describe('arriving from the WhatsApp purchase', () => {
    it('should explain that the code will arrive by WhatsApp and clean the address', async () => {
      await harness.navigateByUrl('/auth/login');
      await harness.navigateByUrl('/auth/register?from=whatsapp&plan=PROFESIONAL');
      harness.detectChanges();

      expect(root().querySelector('[data-waiting-code]')?.textContent).toContain('Te abrimos WhatsApp');
      expect(TestBed.inject(Router).url).toBe('/auth/register');
      expect(value('#reg-code')).toBe('');
    });

    it('should offer WhatsApp Web as a fallback when the native app did not open', async () => {
      sessionStorage.setItem('deliora.whatsappWeb', 'https://wa.me/59899000002?text=Hola');
      await harness.navigateByUrl('/auth/login');
      await harness.navigateByUrl('/auth/register?from=whatsapp');
      harness.detectChanges();

      const link = root().querySelector('[data-whatsapp-web]') as HTMLAnchorElement;
      expect(link.getAttribute('href')).toBe('https://wa.me/59899000002?text=Hola');
      expect(link.getAttribute('target')).toBe('_blank');
      sessionStorage.removeItem('deliora.whatsappWeb');
    });

    it('should not show the notice on a regular visit', () => {
      expect(root().querySelector('[data-waiting-code]')).toBeNull();
    });
  });

  describe('arriving from the payment email', () => {
    async function openFromEmail() {
      await harness.navigateByUrl('/auth/login');
      await harness.navigateByUrl('/auth/register?code=dlr-abcd-2345&email=cliente%40cafe.test');
      harness.detectChanges();
    }

    it('should prefill the code and the email, say the payment is confirmed and clean the address', async () => {
      await openFromEmail();
      expect(value('#reg-code')).toBe('DLR-ABCD-2345');
      expect(value('#reg-email')).toBe('cliente@cafe.test');
      expect(text()).toContain('Tu pago está confirmado');
      expect(TestBed.inject(Router).url).toBe('/auth/register');
    });

    it('should go straight to the login when the server already verified the email', async () => {
      await openFromEmail();
      type(root(), '#reg-business', 'Café Nuevo');
      type(root(), '#reg-password', 'Clave-Segura-1');
      submit(root());
      await answerCsrf(http);
      await answer(http, '/api/v1/auth/register', { message: 'Cuenta creada', verified: true }, { status: 202, statusText: 'Accepted' }, 'POST');
      await settle();
      harness.detectChanges();

      expect(TestBed.inject(Router).url).toBe('/auth/login?verified=1');
      expect(TestBed.inject(NoticeService).notice()?.text).toContain('Cuenta creada');
      TestBed.inject(NoticeService).dismiss();
    });
  });
});
