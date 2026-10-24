import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { answer, answerCsrf, fail, settle, submit, type } from '../testing/http';
import { RegisterPage } from './register.page';

describe('RegisterPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  const root = () => harness.routeNativeElement as HTMLElement;
  const text = () => root().textContent ?? '';
  const value = (selector: string) => (root().querySelector(selector) as HTMLInputElement).value;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'auth/register', component: RegisterPage }]), provideHttpClient(), provideHttpClientTesting()],
    });
    harness = await RouterTestingHarness.create();
    http = TestBed.inject(HttpTestingController);
    await harness.navigateByUrl('/auth/register');
  });

  afterEach(() => http.verify());

  function fill(overrides: Partial<Record<'business' | 'slug' | 'email' | 'password', string>> = {}): void {
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
    });
    expect(text()).toContain('Revisa tu correo');
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
});
