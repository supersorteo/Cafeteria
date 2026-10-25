import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { AuthService } from '../../core/auth.service';
import { NoticeService } from '../../core/notice.service';
import { unsavedChangesGuard } from '../../core/unsaved-changes.guard';
import { makeSettings } from '../../testing/site-admin.fixture';
import { answer, settle, submit, type } from '../../testing/http';
import { SetupPage } from './setup.page';

@Component({ template: '' })
class Stub {}

const SITE = '/api/v1/admin/site';
const DASHBOARD = '/api/v1/admin/dashboard';
const MEDIA = '/api/v1/admin/media';
const dashboard = (overrides = {}) => ({ slug: 'negocio-a', name: 'Negocio A', published: false, categories: 2, activeItems: 3, inactiveItems: 0, images: 0, ...overrides });
const media = (id: string) => ({ id, url: `/media/${id}`, mimeType: 'image/png', width: 1, height: 1, byteSize: 1 });

describe('SetupPage (asistente)', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let router: Router;
  let notices: NoticeService;
  const owner = signal(true);

  const root = () => harness.routeNativeElement as HTMLElement;
  const text = () => (root().textContent ?? '').replace(/ /g, ' ');
  const ui = async () => {
    await settle();
    harness.detectChanges();
  };
  const click = (selector: string) => (root().querySelector(selector) as HTMLElement).click();
  const value = (selector: string) => (root().querySelector(selector) as HTMLInputElement).value;
  const title = () => root().querySelector('#wizard-title')?.textContent?.trim();
  const dialogs = () => root().querySelectorAll('[role="dialog"]');

  async function start(settings = makeSettings(), url = '/admin/setup', dash = dashboard()) {
    await harness.navigateByUrl(url);
    await answer(http, SITE, settings);
    await answer(http, DASHBOARD, dash);
    await ui();
  }

  async function saveAndContinue(response = makeSettings({ version: 5 })) {
    submit(root());
    await ui();
    return answer(http, SITE, response, {}, 'PUT');
  }

  beforeEach(async () => {
    owner.set(true);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'admin/setup', component: SetupPage, canDeactivate: [unsavedChangesGuard] },
          { path: 'admin/site', component: Stub },
          { path: 'admin', component: Stub },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { isOwner: owner } },
      ],
    });
    harness = await RouterTestingHarness.create();
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    notices = TestBed.inject(NoticeService);
  });

  afterEach(() => {
    notices.dismiss();
    http.verify();
    vi.restoreAllMocks();
  });

  describe('inicio', () => {
    it('should start at the first pending step and show the progress and the nine steps', async () => {
      await start();
      expect(title()).toBe('2. Tu marca');
      expect(root().querySelector('[data-progress-text]')?.textContent).toContain('Paso 2 de 9 · Tu marca · 7 listos');
      expect(root().querySelectorAll('[data-wizard-step]').length).toBe(9);
      expect(root().querySelector('[data-wizard-step="brand"]')?.getAttribute('aria-current')).toBe('step');
      expect(root().querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('78');
    });

    it('should start with the required step while the WhatsApp number is missing', async () => {
      await start(makeSettings({ whatsappNumber: null }));
      expect(title()).toBe('1. Tu negocio');
      expect(text()).toContain('Necesario para publicar');
      expect(root().querySelector('[data-skip]')).toBeNull();
      expect((root().querySelector('[data-prev]') as HTMLButtonElement).disabled).toBe(true);
    });

    it('should open the step requested in the url', async () => {
      await start(makeSettings(), '/admin/setup?paso=ambience');
      expect(title()).toBe('6. Tus espacios y fotos');
      expect(root().querySelector('#img-gallery')).not.toBeNull();
    });

    it('should ignore an unknown step in the url', async () => {
      await start(makeSettings(), '/admin/setup?paso=nada');
      expect(title()).toBe('2. Tu marca');
    });

    it('should land on the publish step when everything is complete', async () => {
      await start(
        makeSettings({ published: true, images: { hero: { id: 'h', url: '/m/h' }, logo: { id: 'l', url: '/m/l' }, about: [], gallery: [] } }),
      );
      expect(title()).toBe('9. Publicar tu página');
      expect(root().querySelector('[data-finish]')?.getAttribute('href')).toBe('/admin');
      expect(root().querySelector('[data-continue]')).toBeNull();
    });

    it('should offer a retry when the settings fail to load', async () => {
      await harness.navigateByUrl('/admin/setup');
      await answer(http, SITE, {}, { status: 500, statusText: 'Error' });
      await ui();
      expect(root().querySelector('[role="alert"]')?.textContent).toContain('No pudimos cargar la configuración');
      click('[data-retry]');
      await answer(http, SITE, makeSettings());
      await answer(http, DASHBOARD, dashboard());
      await ui();
      expect(title()).toBe('2. Tu marca');
    });
  });

  describe('avanzar y retroceder', () => {
    it('should save the step and move on to the next one', async () => {
      await start(makeSettings(), '/admin/setup?paso=basics');
      type(root(), '#s-name', '  Café Nuevo  ');
      const request = await saveAndContinue(makeSettings({ name: 'Café Nuevo', version: 5 }));
      await ui();
      expect(request.request.body).toMatchObject({ name: 'Café Nuevo', version: 4 });
      expect(notices.notice()?.text).toContain('Cambios guardados');
      expect(title()).toBe('2. Tu marca');
      expect(router.url).toContain('paso=brand');
    });

    it('should move on without any request when the step has nothing to save', async () => {
      await start(makeSettings(), '/admin/setup?paso=contact');
      submit(root());
      await ui();
      expect(title()).toBe('9. Publicar tu página');
      http.expectNone(SITE);
    });

    it('should skip an optional step without saving and go back with Atrás', async () => {
      await start(makeSettings(), '/admin/setup?paso=hero');
      click('[data-skip]');
      await ui();
      expect(title()).toBe('4. Tu carta');
      click('[data-prev]');
      await ui();
      expect(title()).toBe('3. Tu portada');
      http.expectNone(SITE);
    });

    it('should jump to any step from the stepper', async () => {
      await start();
      click('[data-wizard-step="booking"]');
      await ui();
      expect(title()).toBe('7. Reservas por WhatsApp');
      expect(root().querySelector('[data-wizard-step="booking"]')?.getAttribute('aria-current')).toBe('step');
    });

    it('should stay on the step when the values are invalid', async () => {
      await start(makeSettings(), '/admin/setup?paso=basics');
      type(root(), '#s-whatsapp', '+598');
      submit(root());
      await ui();
      expect(title()).toBe('1. Tu negocio');
      expect(text()).toContain('Entre 8 y 15 dígitos');
      expect(text()).toContain('Revisa los campos marcados');
      http.expectNone(SITE);
    });

    it('should stay on the step and keep the edits when the connection fails', async () => {
      await start(makeSettings(), '/admin/setup?paso=basics');
      type(root(), '#s-name', 'Mi cambio');
      submit(root());
      await ui();
      await answer(http, SITE, 'boom', { status: 503, statusText: 'Unavailable' }, 'PUT');
      await ui();
      expect(title()).toBe('1. Tu negocio');
      expect(text()).toContain('problema de conexión');
      expect(value('#s-name')).toBe('Mi cambio');
    });

    it('should show a conflict instead of overwriting', async () => {
      await start(makeSettings(), '/admin/setup?paso=basics');
      type(root(), '#s-name', 'Mi cambio');
      submit(root());
      await ui();
      await answer(http, SITE, { code: 'version_conflict' }, { status: 409, statusText: 'Conflict' }, 'PUT');
      await ui();
      expect(root().querySelector('[role="alert"]')?.textContent).toContain('no se guardó para no pisar');
      expect(title()).toBe('1. Tu negocio');

      click('[data-reload]');
      await answer(http, SITE, makeSettings({ name: 'De la otra persona', version: 9 }));
      await answer(http, DASHBOARD, dashboard());
      await ui();
      expect(value('#s-name')).toBe('De la otra persona');
    });
  });

  describe('cambios sin guardar', () => {
    async function dirtyBasics() {
      await start(makeSettings(), '/admin/setup?paso=basics');
      type(root(), '#s-name', 'Sin guardar');
      harness.detectChanges();
      expect(text()).toContain('Hay cambios sin guardar');
    }

    it('should ask before leaving the step with Atrás, Omitir or the stepper', async () => {
      await dirtyBasics();
      click('[data-wizard-step="contact"]');
      await ui();
      expect(dialogs().length).toBe(1);
      expect(root().querySelector('[role="dialog"]')?.textContent).toContain('Si continúas, se perderán');

      click('[data-cancel]');
      await ui();
      expect(dialogs().length).toBe(0);
      expect(title()).toBe('1. Tu negocio');
      expect(value('#s-name')).toBe('Sin guardar');
    });

    it('should discard the edits and continue when the user confirms', async () => {
      await dirtyBasics();
      click('[data-wizard-step="contact"]');
      await ui();
      click('[data-confirm]');
      await ui();
      expect(title()).toBe('8. Contacto y horarios');
      click('[data-wizard-step="basics"]');
      await ui();
      expect(value('#s-name')).toBe('Negocio A');
    });

    it('should report the unsaved edits to the leave guard', async () => {
      await dirtyBasics();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      const leaving = router.navigateByUrl('/admin/site');
      await ui();
      expect(await leaving).toBe(false);
      expect(confirmSpy).toHaveBeenCalled();
      expect(router.url).toContain('/admin/setup');
    });

    it('should let the user leave without asking when nothing changed', async () => {
      await start();
      const confirmSpy = vi.spyOn(window, 'confirm');
      click('[data-leave]');
      await ui();
      await ui();
      expect(router.url).toBe('/admin/site');
      expect(confirmSpy).not.toHaveBeenCalled();
    });
  });

  describe('pasos especiales', () => {
    it('should send the carta step to the menu screen and let the user continue', async () => {
      await start(makeSettings(), '/admin/setup?paso=menu');
      expect(root().querySelector('[data-open-menu]')?.getAttribute('href')).toBe('/admin/menu?from=setup');
      expect(text()).toContain('productos activos en 2 categorías');
      submit(root());
      await ui();
      expect(title()).toBe('5. Tu historia');
      http.expectNone(SITE);
    });

    it('should publish from the last step and list what is pending', async () => {
      await start(makeSettings(), '/admin/setup?paso=publish');
      expect(text()).toContain('Resumen de tu configuración');
      expect(root().querySelector('[data-toggle-preview]')).toBeNull();
      expect(root().querySelector('app-site-preview')).toBeNull();
      click('[data-publish]');
      const request = await answer(http, `${SITE}/publication`, makeSettings({ published: true, version: 5 }), {}, 'PUT');
      await ui();
      expect(request.request.body).toEqual({ published: true, version: 4 });
      expect(text()).toContain('publicado');
      expect(root().querySelector('[data-unpublish]')).not.toBeNull();
    });

    it('should jump to a pending step from the publish review', async () => {
      await start(makeSettings(), '/admin/setup?paso=publish');
      click('section[aria-label="Resumen de tu configuración"] button.btn-secondary');
      await ui();
      expect(title()).toBe('2. Tu marca');
    });

    it('should upload the logo and save it before moving on', async () => {
      await start(makeSettings(), '/admin/setup?paso=brand');
      const input = root().querySelector('#img-logo') as HTMLInputElement;
      Object.defineProperty(input, 'files', { value: [new File([new Uint8Array(10)], 'logo.png', { type: 'image/png' })], configurable: true });
      input.dispatchEvent(new Event('change'));
      await ui();
      http.expectOne(MEDIA).flush(media('l1'), { status: 201, statusText: 'Created' });
      await ui();

      submit(root());
      await ui();
      const request = await answer(
        http,
        `${SITE}/images`,
        makeSettings({ version: 5, images: { hero: null, about: [], gallery: [], logo: { id: 'l1', url: '/media/l1' } } }),
        {},
        'PUT',
      );
      await ui();
      expect(request.request.body).toMatchObject({ logo: 'l1' });
      expect(title()).toBe('3. Tu portada');
      expect(root().querySelector('[data-progress-text]')?.textContent).toContain('8 listos');
    });

    it('should upload a space photo and save its id with the step', async () => {
      await start(makeSettings(), '/admin/setup?paso=ambience');
      const input = root().querySelector('#space-img-0') as HTMLInputElement;
      Object.defineProperty(input, 'files', { value: [new File([new Uint8Array(10)], 'terraza.png', { type: 'image/png' })], configurable: true });
      input.dispatchEvent(new Event('change'));
      await ui();
      http.expectOne(MEDIA).flush(media('s9'), { status: 201, statusText: 'Created' });
      await ui();
      expect(root().querySelector('[data-space] img')?.getAttribute('src')).toBe('/media/s9');

      const request = await saveAndContinue(makeSettings({ version: 5 }));
      await ui();
      expect(request.request.body).toMatchObject({ spaces: [{ name: 'Terraza', imageId: 's9', bookable: true }] });
      expect(title()).toBe('7. Reservas por WhatsApp');
    });

    it('should ask about the currency change before saving and moving on', async () => {
      await start(makeSettings(), '/admin/setup?paso=basics');
      type(root(), '#s-currency', 'USD');
      submit(root());
      await ui();
      expect(dialogs().length).toBe(1);
      http.expectNone(SITE);
      click('[data-confirm]');
      const request = await answer(http, SITE, makeSettings({ currency: 'USD', version: 5 }), {}, 'PUT');
      await ui();
      expect(request.request.body).toMatchObject({ currency: 'USD' });
      expect(title()).toBe('2. Tu marca');
    });

    it('should not move on when the currency change is cancelled', async () => {
      await start(makeSettings(), '/admin/setup?paso=basics');
      type(root(), '#s-currency', 'USD');
      submit(root());
      await ui();
      click('[data-cancel]');
      await ui();
      expect(title()).toBe('1. Tu negocio');
      http.expectNone(SITE);
    });
  });

  describe('vista previa', () => {
    it('should offer the preview button at the top and open the phone in a side drawer', async () => {
      await start(makeSettings(), '/admin/setup?paso=about');
      expect(root().querySelector('header [data-toggle-preview]')).not.toBeNull();
      expect(root().querySelector('app-site-preview')).toBeNull();
      click('[data-toggle-preview]');
      harness.detectChanges();
      await answer(http, '/api/v1/admin/categories', []);
      await ui();
      expect(root().querySelector('.drawer .phone iframe[src="/admin/preview"]')).not.toBeNull();
      click('[data-close-preview]');
      await ui();
      expect(root().querySelector('.drawer')).toBeNull();
    });

    it('should hide the preview button in the last step', async () => {
      await start(makeSettings(), '/admin/setup?paso=publish');
      expect(root().querySelector('[data-toggle-preview]')).toBeNull();
    });

    it('should dock the phone beside the step on wide screens', async () => {
      vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => undefined, removeEventListener: () => undefined }));
      await start(makeSettings(), '/admin/setup?paso=about');
      await answer(http, '/api/v1/admin/categories', []);
      await ui();
      expect(root().querySelector('.wizard-grid.with-preview .preview-dock .phone')).not.toBeNull();
      expect(root().querySelector('.drawer')).toBeNull();
      vi.unstubAllGlobals();
    });
  });

  describe('editor role', () => {
    it('should let editors walk through the steps without saving', async () => {
      owner.set(false);
      await start(makeSettings(), '/admin/setup?paso=basics');
      expect((root().querySelector('#s-name') as HTMLInputElement).disabled).toBe(true);
      expect(root().querySelector('[data-continue]')?.textContent).toContain('Continuar');
      submit(root());
      await ui();
      expect(title()).toBe('2. Tu marca');
      http.expectNone(SITE);
    });
  });
});
