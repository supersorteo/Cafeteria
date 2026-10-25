import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from '../../core/auth.service';
import { NoticeService } from '../../core/notice.service';
import { unsavedChangesGuard } from '../../core/unsaved-changes.guard';
import { makeSettings } from '../../testing/site-admin.fixture';
import { answer, settle, submit, type } from '../../testing/http';
import { SiteSettingsStore } from '../setup/site-settings.store';
import { SitePage } from './site.page';

const SITE = '/api/v1/admin/site';
const DASHBOARD = '/api/v1/admin/dashboard';
const MEDIA = '/api/v1/admin/media';
const dashboard = (overrides = {}) => ({ slug: 'negocio-a', name: 'Negocio A', published: false, categories: 2, activeItems: 3, inactiveItems: 0, images: 0, ...overrides });
const media = (id: string) => ({ id, url: `/media/${id}`, mimeType: 'image/png', width: 1, height: 1, byteSize: 1 });

describe('SitePage (lista numerada)', () => {
  let fixture: ComponentFixture<SitePage>;
  let http: HttpTestingController;
  let notices: NoticeService;
  const owner = signal(true);

  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => (root().textContent ?? '').replace(/ /g, ' ');
  const ui = async () => {
    await settle();
    fixture.detectChanges();
  };
  const value = (selector: string) => (root().querySelector(selector) as HTMLInputElement).value;
  const click = (selector: string) => (root().querySelector(selector) as HTMLElement).click();
  const el = (selector: string) => root().querySelector(selector) as HTMLInputElement | HTMLButtonElement;
  const dialogs = () => root().querySelectorAll('[role="dialog"]');
  const topDialog = () => Array.from(dialogs()).at(-1);

  async function start(settings = makeSettings(), isOwner = true, dash = dashboard()) {
    owner.set(isOwner);
    fixture = TestBed.createComponent(SitePage);
    fixture.detectChanges();
    await answer(http, SITE, settings);
    await answer(http, DASHBOARD, dash);
    await ui();
  }

  async function open(step: string) {
    click(`[data-step="${step}"]`);
    await ui();
  }

  async function saveWith(response = makeSettings({ version: 5 })) {
    submit(root());
    await ui();
    return answer(http, SITE, response, {}, 'PUT');
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: AuthService, useValue: { isOwner: owner } }],
    });
    http = TestBed.inject(HttpTestingController);
    notices = TestBed.inject(NoticeService);
  });

  afterEach(() => {
    notices.dismiss();
    http.verify();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('lista de pasos', () => {
    it('should list the nine steps in order with status, purpose and where each one shows', async () => {
      await start();
      const titles = Array.from(root().querySelectorAll('ol h3')).map(h => h.textContent?.trim());
      expect(titles).toEqual(['Datos básicos', 'Logo y colores', 'Tu carta', 'Portada', 'Nosotros', 'Ambiente', 'Reservas', 'Contacto y pie de página', 'Publicar']);
      expect(text()).toContain('Dónde se ve: Sección «La carta»');
      expect(text()).toContain('7 de 9 pasos completos');
      expect(root().querySelector('form')).toBeNull();
    });

    it('should mark pending steps with their requirement and offer the next one', async () => {
      await start(makeSettings({ whatsappNumber: null }));
      expect(text()).toContain('Obligatorio');
      expect(el('[data-next-step]').textContent).toContain('Continuar: Datos básicos');
    });

    it('should send the carta step to the menu screen and keep it out of the dialogs', async () => {
      await start();
      expect(root().querySelector('[data-step="menu"]')).toBeNull();
      expect(root().querySelector('[data-open-menu]')?.getAttribute('href')).toBe('/admin/menu?from=setup');
    });

    it('should reflect an empty menu in the carta step and the progress', async () => {
      await start(makeSettings(), true, dashboard({ categories: 0, activeItems: 0 }));
      expect(text()).toContain('6 de 9 pasos completos');
      expect(root().querySelector('[data-open-menu]')?.textContent).toContain('Crear carta');
    });

    it('should open the step editor in a dialog and close it with Cancelar', async () => {
      await start();
      expect(dialogs().length).toBe(0);
      await open('basics');
      expect(dialogs().length).toBe(1);
      expect(topDialog()?.textContent).toContain('1. Datos básicos');
      click('[data-discard]');
      await ui();
      expect(dialogs().length).toBe(0);
    });

    it('should offer a retry when the settings fail to load', async () => {
      fixture = TestBed.createComponent(SitePage);
      fixture.detectChanges();
      await answer(http, SITE, {}, { status: 500, statusText: 'Error' });
      await ui();
      expect(root().querySelector('[role="alert"]')?.textContent).toContain('No pudimos cargar la configuración');

      click('[data-retry]');
      await answer(http, SITE, makeSettings());
      await answer(http, DASHBOARD, dashboard());
      await ui();
      expect(text()).toContain('Datos básicos');
    });

    it('should keep working when the dashboard counters fail to load', async () => {
      owner.set(true);
      fixture = TestBed.createComponent(SitePage);
      fixture.detectChanges();
      await answer(http, SITE, makeSettings());
      await answer(http, DASHBOARD, {}, { status: 500, statusText: 'Error' });
      await ui();
      expect(text()).toContain('Datos básicos');
      expect(text()).toContain('6 de 9 pasos completos');
    });
  });

  describe('editores por paso', () => {
    it('should fill each step editor with the current settings and show the address as read-only', async () => {
      await start();
      await open('basics');
      expect(value('#s-name')).toBe('Negocio A');
      expect(value('#s-whatsapp')).toBe('59899111222');
      expect(value('#s-currency')).toBe('UYU');
      expect(text()).toContain('/negocio-a');
      expect(text()).toContain('no se puede cambiar');
      expect(root().querySelector('#s-slug')).toBeNull();
      click('[data-discard]');
      await ui();

      await open('brand');
      expect(value('#s-primary')).toBe('#FF5C39');
      expect(root().querySelector('[data-logo-default]')).not.toBeNull();
      click('[data-discard]');
      await ui();

      await open('hero');
      expect(value('#s-tagline')).toBe('Desde 2012');
      expect(value('#s-hero-title')).toBe('Donde la noche\n*sabe mejor*');
      expect(root().querySelectorAll('app-string-list-editor input[aria-label^="Frase"]').length).toBe(2);
      expect(root().querySelector('img[alt="Imagen de portada"]')?.getAttribute('src')).toBe('/media/h1');
      expect(root().querySelector('#img-gallery')).toBeNull();
      click('[data-discard]');
      await ui();

      await open('about');
      expect(value('#s-about-title')).toBe('Tradición');
      expect(root().querySelectorAll('input[aria-label^="Valor de la cifra"]').length).toBe(1);
      click('[data-discard]');
      await ui();

      await open('ambience');
      expect(root().querySelectorAll('input[aria-label^="Título del espacio"]').length).toBe(1);
      expect(root().querySelector('#img-gallery')).not.toBeNull();
      click('[data-discard]');
      await ui();

      await open('booking');
      expect(root().querySelectorAll('app-string-list-editor input[aria-label^="Zona"]').length).toBe(1);
      click('[data-discard]');
      await ui();

      await open('contact');
      expect(value('#s-phone')).toBe('+598 99 111 222');
      expect(value('#s-footer')).toBe('Pie');
    });
  });

  describe('editor role', () => {
    it('should show the settings read-only without any action buttons', async () => {
      await start(makeSettings(), false);
      expect(text()).toContain('Solo el propietario puede cambiar');

      await open('basics');
      expect((el('#s-name') as HTMLInputElement).disabled).toBe(true);
      expect(root().querySelector('[data-save]')).toBeNull();
      click('[data-discard]');
      await ui();

      await open('about');
      expect(root().querySelector('[data-add-stat]')).toBeNull();
      click('[data-discard]');
      await ui();

      await open('brand');
      expect(root().querySelector('input[type="file"]')).toBeNull();
      click('[data-discard]');
      await ui();

      await open('publish');
      expect(root().querySelector('[data-publish]')).toBeNull();
    });
  });

  describe('validation', () => {
    it('should block invalid values in the basics step without calling the server', async () => {
      await start();
      await open('basics');
      type(root(), '#s-name', '   ');
      type(root(), '#s-whatsapp', '+59899111222');
      type(root(), '#s-timezone', 'Marte/Olympus');
      submit(root());
      await ui();

      expect(text()).toContain('Este campo es obligatorio');
      expect(text()).toContain('Entre 8 y 15 dígitos');
      expect(text()).toContain('Zona horaria no válida');
      expect(text()).toContain('Revisa los campos marcados');
      http.expectNone(SITE);
    });

    it('should block an invalid contact email', async () => {
      await start();
      await open('contact');
      type(root(), '#s-email', 'no-es-correo');
      submit(root());
      await ui();
      expect(text()).toContain('Escribe un correo válido');
      http.expectNone(SITE);
    });

    it('should block invalid colors', async () => {
      await start();
      await open('brand');
      type(root(), '#s-primary', 'rojo');
      submit(root());
      await ui();
      expect(text()).toContain('formato #FF5C39');
      http.expectNone(SITE);
    });

    it('should respect the stat limit and validate each entry', async () => {
      await start();
      await open('about');
      for (let i = 0; i < 3; i++) {
        click('[data-add-stat]');
        fixture.detectChanges();
      }
      expect((el('[data-add-stat]') as HTMLButtonElement).disabled).toBe(true);
      expect(root().querySelectorAll('input[aria-label^="Valor de la cifra"]').length).toBe(3);

      submit(root());
      await ui();
      expect(text()).toContain('Escribe un texto (máx. 40)');
      http.expectNone(SITE);
    });

    it('should reject out-of-range stat values', async () => {
      await start();
      await open('about');
      type(root(), 'input[aria-label="Valor de la cifra 1"]', '1000000');
      submit(root());
      await ui();
      expect(text()).toContain('valor entero entre 0 y 999999');
    });
  });

  describe('saving', () => {
    it('should send trimmed values and the current version, then close the dialog and refresh the list', async () => {
      await start();
      await open('basics');
      type(root(), '#s-name', '  Café Nuevo  ');

      const request = await saveWith(makeSettings({ name: 'Café Nuevo', version: 5 }));
      await ui();

      expect(request.request.body).toMatchObject({
        name: 'Café Nuevo',
        whatsappNumber: '59899111222',
        currency: 'UYU',
        timezone: 'America/Montevideo',
        marqueeItems: ['Uno', 'Dos'],
        reservationAreas: ['Barra'],
        partySizes: ['2', '4'],
        stats: [{ label: 'Años', value: 14 }],
        highlights: [{ title: 'Terraza', description: 'Aire libre' }],
        version: 4,
      });
      expect(request.request.body).not.toHaveProperty('slug');
      expect(request.request.body).not.toHaveProperty('published');
      expect(request.request.body).not.toHaveProperty('images');
      expect(notices.notice()?.text).toContain('Cambios guardados');
      expect(dialogs().length).toBe(0);
    });

    it('should send null for blank contact values and keep the schedule lines', async () => {
      await start();
      await open('contact');
      type(root(), '#s-phone', '   ');
      type(root(), '#s-schedule', 'Lun 18-02\nMar 18-02');
      const request = await saveWith();
      expect(request.request.body).toMatchObject({ phone: null, schedule: 'Lun 18-02\nMar 18-02' });
    });

    it('should send null when the WhatsApp number is cleared', async () => {
      await start();
      await open('basics');
      type(root(), '#s-whatsapp', '');
      const request = await saveWith();
      expect(request.request.body).toMatchObject({ whatsappNumber: null });
    });

    it('should send the new colors', async () => {
      await start();
      await open('brand');
      type(root(), '#s-primary', '#112233');
      const request = await saveWith();
      expect(request.request.body).toMatchObject({ primaryColor: '#112233', accentColor: '#0E8388' });
    });

    it('should send trimmed marquee phrases from the cover step', async () => {
      await start();
      await open('hero');
      type(root(), 'app-string-list-editor input[aria-label="Frase 1"]', '  Música en vivo ');
      const request = await saveWith();
      expect(request.request.body).toMatchObject({ marqueeItems: ['Música en vivo', 'Dos'] });
    });

    it('should send edited stats from the about step', async () => {
      await start();
      await open('about');
      type(root(), 'input[aria-label="Valor de la cifra 1"]', '20');
      const request = await saveWith();
      expect(request.request.body).toMatchObject({ stats: [{ label: 'Años', value: 20 }] });
    });

    it('should use the new version on the following save', async () => {
      await start();
      await open('basics');
      type(root(), '#s-name', 'Primero');
      await saveWith(makeSettings({ name: 'Primero', version: 5 }));
      await ui();
      await open('basics');
      type(root(), '#s-name', 'Segundo');
      const second = await saveWith(makeSettings({ name: 'Segundo', version: 6 }));
      expect((second.request.body as { version: number }).version).toBe(5);
    });

    it('should show a conflict instead of overwriting, and reload the current data', async () => {
      await start();
      await open('basics');
      type(root(), '#s-name', 'Mi cambio');
      submit(root());
      await ui();
      await answer(http, SITE, { code: 'version_conflict' }, { status: 409, statusText: 'Conflict' }, 'PUT');
      await ui();
      expect(root().querySelector('[role="alert"]')?.textContent).toContain('no se guardó para no pisar');

      click('[data-reload]');
      await answer(http, SITE, makeSettings({ name: 'Cambio de la otra persona', version: 9 }));
      await answer(http, DASHBOARD, dashboard());
      await ui();
      expect(dialogs().length).toBe(0);
      expect(root().querySelector('[data-reload]')).toBeNull();
      await open('basics');
      expect(value('#s-name')).toBe('Cambio de la otra persona');
    });

    it('should show server validation errors on their fields', async () => {
      await start();
      await open('basics');
      type(root(), '#s-descriptor', 'Otro');
      submit(root());
      await ui();
      await answer(http, SITE, { code: 'validation_error', fieldErrors: [{ field: 'whatsappNumber', message: 'Debe tener entre 8 y 15 dígitos' }, { field: 'stats[0].label', message: 'tamaño' }] }, { status: 400, statusText: 'Bad Request' }, 'PUT');
      await ui();
      expect(text()).toContain('Debe tener entre 8 y 15 dígitos');
      expect(text()).toContain('Revisa los datos: tamaño');
    });

    it('should keep the edits when saving fails because of the connection', async () => {
      await start();
      await open('basics');
      type(root(), '#s-name', 'Mi cambio');
      submit(root());
      await ui();
      await answer(http, SITE, 'boom', { status: 503, statusText: 'Unavailable' }, 'PUT');
      await ui();
      expect(text()).toContain('problema de conexión');
      expect(value('#s-name')).toBe('Mi cambio');
      expect(dialogs().length).toBe(1);
    });

    it('should ask before discarding edits and restore the saved values afterwards', async () => {
      await start();
      await open('basics');
      type(root(), '#s-name', 'Borrador');
      fixture.detectChanges();
      expect(text()).toContain('Hay cambios sin guardar');

      click('[data-discard]');
      await ui();
      expect(dialogs().length).toBe(2);
      expect(topDialog()?.textContent).toContain('Si cierras ahora, se perderán');

      click('[data-cancel]');
      await ui();
      expect(dialogs().length).toBe(1);
      expect(value('#s-name')).toBe('Borrador');

      click('[data-discard]');
      await ui();
      click('[data-confirm]');
      await ui();
      expect(dialogs().length).toBe(0);
      await open('basics');
      expect(value('#s-name')).toBe('Negocio A');
      expect(text()).not.toContain('Hay cambios sin guardar');
    });
  });

  describe('currency change', () => {
    async function changeCurrency() {
      await start();
      await open('basics');
      type(root(), '#s-currency', 'USD');
      submit(root());
      await ui();
    }

    it('should warn that prices are not converted and send nothing until confirmed', async () => {
      await changeCurrency();
      expect(dialogs().length).toBe(2);
      expect(topDialog()?.textContent).toContain('los importes actuales se conservarán');
      http.expectNone(SITE);

      click('[data-cancel]');
      await ui();
      expect(dialogs().length).toBe(1);
      http.expectNone(SITE);
    });

    it('should save after the user confirms', async () => {
      await changeCurrency();
      click('[data-confirm]');
      const request = await answer(http, SITE, makeSettings({ currency: 'USD', version: 5 }), {}, 'PUT');
      await ui();
      expect(request.request.body).toMatchObject({ currency: 'USD', version: 4 });
      expect(dialogs().length).toBe(0);
    });
  });

  describe('logo and photos inside a step', () => {
    const png = () => new File([new Uint8Array(100)], 'logo.png', { type: 'image/png' });

    async function uploadLogo(mediaId: string) {
      const input = root().querySelector('#img-logo') as HTMLInputElement;
      Object.defineProperty(input, 'files', { value: [png()], configurable: true });
      input.dispatchEvent(new Event('change'));
      await ui();
      http.expectOne(MEDIA).flush(media(mediaId), { status: 201, statusText: 'Created' });
      await ui();
    }

    const withLogo = (version: number) =>
      makeSettings({ version, images: { hero: null, about: [], gallery: [], logo: { id: 'l1', url: '/media/l1' } } });

    it('should upload the logo and save it with the step button, then complete the step', async () => {
      await start();
      await open('brand');
      await uploadLogo('l1');
      expect(root().querySelector('[data-logo-preview]')?.getAttribute('src')).toBe('/media/l1');
      expect(root().querySelector('[data-save-images]')).toBeNull();

      click('[data-save]');
      await ui();
      const request = await answer(http, `${SITE}/images`, withLogo(5), {}, 'PUT');
      await ui();
      expect(request.request.body).toMatchObject({ logo: 'l1' });
      expect(dialogs().length).toBe(0);
      expect(text()).toContain('8 de 9 pasos completos');
    });

    it('should save the photos first and then the form fields using the new version', async () => {
      await start();
      await open('brand');
      type(root(), '#s-primary', '#112233');
      await uploadLogo('l1');

      click('[data-save]');
      await ui();
      await answer(http, `${SITE}/images`, withLogo(5), {}, 'PUT');
      await ui();
      const form = await answer(http, SITE, makeSettings({ version: 6 }), {}, 'PUT');
      await ui();
      expect(form.request.body).toMatchObject({ primaryColor: '#112233', version: 5 });
      expect(dialogs().length).toBe(0);
    });

    it('should not send the form when the photos fail to save', async () => {
      await start();
      await open('brand');
      type(root(), '#s-primary', '#112233');
      await uploadLogo('l1');

      click('[data-save]');
      await ui();
      await answer(http, `${SITE}/images`, { code: 'validation_error' }, { status: 400, statusText: 'Bad Request' }, 'PUT');
      await ui();
      http.expectNone(SITE);
      expect(dialogs().length).toBe(1);
      expect(text()).toContain('Alguna imagen ya no está disponible');
    });
  });

  describe('publication', () => {
    it('should block publishing while there are unsaved changes', async () => {
      await start();
      const store = fixture.debugElement.injector.get(SiteSettingsStore);
      store.form.controls.name.setValue('Sin guardar');
      store.form.controls.name.markAsDirty();
      await open('publish');
      expect((el('[data-publish]') as HTMLButtonElement).disabled).toBe(true);
      expect(text()).toContain('Guarda tus cambios antes de publicar');
    });

    it('should publish with the current version and show the public link', async () => {
      await start();
      await open('publish');
      click('[data-publish]');
      const request = await answer(http, `${SITE}/publication`, makeSettings({ published: true, version: 5 }), {}, 'PUT');
      await ui();
      expect(request.request.body).toEqual({ published: true, version: 4 });
      expect(text()).toContain('publicado');
      expect(root().querySelector('a[href^="/negocio-a"]')).not.toBeNull();
      expect(notices.notice()?.text).toContain('ya está publicado');
    });

    it('should list the steps that are still pending in the review', async () => {
      await start();
      await open('publish');
      expect(text()).toContain('Resumen de tu configuración');
      expect(text()).toContain('2. Logo y colores');
      click('.modal-panel li button.btn-secondary');
      await ui();
      expect(topDialog()?.textContent).toContain('2. Logo y colores');
    });

    it('should explain what is missing when publishing is not possible', async () => {
      await start(makeSettings({ whatsappNumber: null }));
      await open('publish');
      click('[data-publish]');
      await answer(http, `${SITE}/publication`, { code: 'cannot_publish', fieldErrors: [{ field: 'whatsappNumber', message: 'Obligatorio' }] }, { status: 400, statusText: 'Bad Request' }, 'PUT');
      await ui();
      expect(root().querySelector('[role="alert"]')?.textContent).toContain('falta el número de WhatsApp');
      expect(text()).toContain('borrador');
    });

    it('should show a conflict when the publication version is stale', async () => {
      await start();
      await open('publish');
      click('[data-publish]');
      await answer(http, `${SITE}/publication`, { code: 'version_conflict' }, { status: 409, statusText: 'Conflict' }, 'PUT');
      await ui();
      expect(text()).toContain('cambió mientras la editabas');
    });

    it('should warn about public images before unpublishing', async () => {
      await start(makeSettings({ published: true }));
      await open('publish');
      click('[data-unpublish]');
      await ui();
      expect(topDialog()?.textContent).toContain('imágenes que ya publicaste seguirán siendo accesibles');
      click('[data-cancel]');
      await ui();
      http.expectNone(`${SITE}/publication`);

      click('[data-unpublish]');
      await ui();
      click('[data-confirm]');
      const request = await answer(http, `${SITE}/publication`, makeSettings({ published: false, version: 5 }), {}, 'PUT');
      await ui();
      expect(request.request.body).toEqual({ published: false, version: 4 });
      expect(text()).toContain('borrador');
    });

    it('should copy the public link', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      await start(makeSettings({ published: true }));
      await open('publish');
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      try {
        click('[data-copy]');
        await ui();
        expect(writeText).toHaveBeenCalledWith(`${location.origin}/negocio-a`);
        expect(notices.notice()?.text).toContain('Enlace copiado');
      } finally {
        Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
      }
    });
  });

  describe('list editing', () => {
    it('should add and remove highlights', async () => {
      await start();
      await open('ambience');
      click('[data-add-highlight]');
      fixture.detectChanges();
      expect(root().querySelectorAll('input[aria-label^="Título del espacio"]').length).toBe(2);

      (root().querySelector('[aria-label="Quitar espacio 2"]') as HTMLElement).click();
      fixture.detectChanges();
      expect(root().querySelectorAll('input[aria-label^="Título del espacio"]').length).toBe(1);
      expect(text()).toContain('Hay cambios sin guardar');
    });

    it('should remove marquee phrases in the cover step', async () => {
      await start();
      await open('hero');
      (root().querySelector('[aria-label="Quitar frase 1"]') as HTMLElement).click();
      fixture.detectChanges();
      expect(root().querySelectorAll('app-string-list-editor input[aria-label^="Frase"]').length).toBe(1);
    });
  });

  describe('unsaved changes', () => {
    it('should report unsaved edits and ask before leaving', async () => {
      await start();
      expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
      await open('basics');
      type(root(), '#s-name', 'Cambio');
      expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);

      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      expect(TestBed.runInInjectionContext(() => unsavedChangesGuard(fixture.componentInstance, null as never, null as never, null as never))).toBe(false);
      confirmSpy.mockReturnValue(true);
      expect(TestBed.runInInjectionContext(() => unsavedChangesGuard(fixture.componentInstance, null as never, null as never, null as never))).toBe(true);
    });

    it('should let the user leave without asking when nothing changed', async () => {
      await start();
      const confirmSpy = vi.spyOn(window, 'confirm');
      expect(TestBed.runInInjectionContext(() => unsavedChangesGuard(fixture.componentInstance, null as never, null as never, null as never))).toBe(true);
      expect(confirmSpy).not.toHaveBeenCalled();
    });
  });

  describe('vista previa', () => {
    const CATEGORIES = '/api/v1/admin/categories';
    const screen = () => root().querySelector('app-site-preview iframe') as HTMLIFrameElement | null;

    async function openPreview(step: string) {
      await open(step);
      click('[data-toggle-preview]');
      fixture.detectChanges();
      await answer(http, CATEGORIES, []);
      await ui();
    }

    function ready() {
      const frame = screen()!;
      const post = vi.spyOn(frame.contentWindow!, 'postMessage');
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'terraza-preview-ready' }, origin: location.origin, source: frame.contentWindow }));
      return post;
    }

    it('should put the preview button at the top of the dialog and keep the preview closed until asked', async () => {
      await start();
      await open('about');
      expect(root().querySelector('.modal-header [data-toggle-preview]')).not.toBeNull();
      expect(root().querySelector('app-site-preview')).toBeNull();
      expect(el('[data-toggle-preview]').getAttribute('aria-pressed')).toBe('false');
    });

    it('should open a side drawer with the phone and close it with its button', async () => {
      await start();
      await openPreview('about');
      expect(el('[data-toggle-preview]').getAttribute('aria-pressed')).toBe('true');
      expect(root().querySelector('.drawer .phone iframe[title="Vista previa de tu página"]')).not.toBeNull();
      expect(screen()?.getAttribute('src')).toBe('/admin/preview');
      click('[data-close-preview]');
      await ui();
      expect(root().querySelector('.drawer')).toBeNull();
      expect(root().querySelector('app-site-preview')).toBeNull();
    });

    it('should close the drawer with the backdrop or Escape without closing the step dialog', async () => {
      await start();
      await openPreview('about');
      click('.drawer-backdrop');
      await ui();
      expect(root().querySelector('.drawer')).toBeNull();

      click('[data-toggle-preview]');
      fixture.detectChanges();
      await answer(http, CATEGORIES, []);
      await ui();
      (root().querySelector('.drawer') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await ui();
      expect(root().querySelector('.drawer')).toBeNull();
      expect(root().querySelector('.modal-panel')).not.toBeNull();
    });

    it('should send the draft and the target section to the phone once it says it is ready', async () => {
      await start();
      await openPreview('about');
      const post = ready();
      await ui();
      expect(post).toHaveBeenCalled();
      const [message, origin] = post.mock.calls.at(-1) as [{ type: string; target: string; site: { name: string; about: { title: string } } }, string];
      expect(origin).toBe(location.origin);
      expect(message.type).toBe('terraza-preview-data');
      expect(message.target).toBe('nosotros');
      expect(message.site.name).toBe('Negocio A');
      expect(message.site.about.title).toBe('Tradición');
    });

    it('should not send anything before the phone is ready', async () => {
      await start();
      await openPreview('about');
      const post = vi.spyOn(screen()!.contentWindow!, 'postMessage');
      type(root(), '#s-about-title', 'Otro título');
      await ui();
      expect(post).not.toHaveBeenCalled();
    });

    it('should push every edit to the phone while the user types, before saving', async () => {
      await start();
      await openPreview('hero');
      const post = ready();
      await ui();
      type(root(), '#s-tagline', 'Frase recien escrita');
      await ui();
      const [message] = post.mock.calls.at(-1) as [{ site: { tagline: string } }];
      expect(message.site.tagline).toBe('Frase recien escrita');
      http.expectNone(SITE);
    });

    it('should ignore messages that do not come from the phone of this origin', async () => {
      await start();
      await openPreview('about');
      const post = vi.spyOn(screen()!.contentWindow!, 'postMessage');
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'terraza-preview-ready' }, origin: 'https://evil.test', source: screen()!.contentWindow }));
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'terraza-preview-ready' }, origin: location.origin, source: window }));
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'otra-cosa' }, origin: location.origin, source: screen()!.contentWindow }));
      await ui();
      expect(post).not.toHaveBeenCalled();
    });

    it('should explain that an empty section appears when content is added', async () => {
      await start();
      await openPreview('about');
      const frame = screen()!;
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'terraza-preview-section', missing: true }, origin: location.origin, source: frame.contentWindow }));
      await ui();
      expect(root().querySelector('[data-preview-note]')?.textContent).toContain('aparece en tu página cuando añadas contenido');
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'terraza-preview-section', missing: false }, origin: location.origin, source: frame.contentWindow }));
      await ui();
      expect(root().querySelector('[data-preview-note]')).toBeNull();
    });

    it('should not offer a preview in the publish step', async () => {
      await start();
      await open('publish');
      expect(root().querySelector('[data-toggle-preview]')).toBeNull();
      expect(root().querySelector('app-site-preview')).toBeNull();
    });

    it('should not load the catalog until the preview is opened', async () => {
      await start();
      await open('basics');
      http.expectNone(CATEGORIES);
    });

    it('should dock the phone next to the form and open by default on wide screens', async () => {
      vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => undefined, removeEventListener: () => undefined }));
      await start();
      await open('about');
      await answer(http, CATEGORIES, []);
      await ui();
      expect(root().querySelector('.preview-dock .phone iframe')).not.toBeNull();
      expect(root().querySelector('.drawer')).toBeNull();
      expect(root().querySelector('.step-split.with-preview')).not.toBeNull();
      expect(root().querySelector('.modal-full')).not.toBeNull();
      click('[data-toggle-preview]');
      await ui();
      expect(root().querySelector('.preview-dock')).toBeNull();
      expect(root().querySelector('.step-split.with-preview')).toBeNull();
    });
  });
});
