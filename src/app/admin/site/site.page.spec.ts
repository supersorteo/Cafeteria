import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AuthService } from '../../core/auth.service';
import { NoticeService } from '../../core/notice.service';
import { unsavedChangesGuard } from '../../core/unsaved-changes.guard';
import { makeSettings } from '../../testing/site-admin.fixture';
import { answer, settle, submit, type } from '../../testing/http';
import { SitePage } from './site.page';

const SITE = '/api/v1/admin/site';

describe('SitePage', () => {
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

  async function start(settings = makeSettings(), isOwner = true) {
    owner.set(isOwner);
    fixture = TestBed.createComponent(SitePage);
    fixture.detectChanges();
    await answer(http, SITE, settings);
    await ui();
  }

  async function open(section: string) {
    click(`[data-section="${section}"]`);
    await ui();
  }

  async function tab(id: string) {
    click(`#tab-${id}`);
    await ui();
  }

  async function saveWith(response = makeSettings({ version: 5 })) {
    submit(root());
    await ui();
    return answer(http, SITE, response, {}, 'PUT');
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: AuthService, useValue: { isOwner: owner } }],
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

  describe('loading', () => {
    it('should summarise each section on its card without any inline form', async () => {
      await start();
      expect(root().querySelectorAll('[data-section]').length).toBe(6);
      expect(root().querySelector('form')).toBeNull();
      expect(text()).toContain('Negocio A');
      expect(text()).toContain('+59899111222');
      expect(text()).toContain('#FF5C39');
      expect(text()).toContain('2 frases');
      expect(text()).toContain('Portada lista');
      expect(text()).toContain('borrador');
    });

    it('should fill every section editor with the current settings and show the address as read-only', async () => {
      await start();
      await open('business');
      expect(value('#s-name')).toBe('Negocio A');
      expect(value('#s-currency')).toBe('UYU');
      expect(text()).toContain('/negocio-a');
      expect(text()).toContain('no se puede cambiar');
      expect(root().querySelector('#s-slug')).toBeNull();
      click('[data-discard]');
      await ui();

      await open('contact');
      expect(value('#s-whatsapp')).toBe('59899111222');
      click('[data-discard]');
      await ui();

      await open('brand');
      expect(value('#s-primary')).toBe('#FF5C39');
      click('[data-discard]');
      await ui();

      await open('texts');
      expect(value('#s-tagline')).toBe('Desde 2012');
      await tab('about');
      expect(value('#s-about-title')).toBe('Tradición');
      click('[data-discard]');
      await ui();

      await open('highlights');
      expect(root().querySelectorAll('app-string-list-editor input[aria-label^="Frase"]').length).toBe(2);
    });

    it('should open the editor in a dialog and close it with Cancelar', async () => {
      await start();
      expect(dialogs().length).toBe(0);
      await open('business');
      expect(dialogs().length).toBe(1);
      expect(topDialog()?.textContent).toContain('Datos del negocio');
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
      await ui();
      expect(text()).toContain('Negocio A');
    });
  });

  describe('editor role', () => {
    it('should show the settings read-only without any action buttons', async () => {
      await start(makeSettings(), false);
      expect(text()).toContain('Solo el propietario puede cambiar');
      expect(root().querySelector('[data-publish]')).toBeNull();

      await open('business');
      expect((el('#s-name') as HTMLInputElement).disabled).toBe(true);
      expect(root().querySelector('[data-save]')).toBeNull();
      click('[data-discard]');
      await ui();

      await open('highlights');
      await tab('stats');
      expect(root().querySelector('[data-add-stat]')).toBeNull();
      click('[data-discard]');
      await ui();

      await open('images');
      expect(root().querySelector('[data-save-images]')).toBeNull();
      expect(root().querySelector('input[type="file"]')).toBeNull();
    });
  });

  describe('validation', () => {
    it('should block invalid business values without calling the server', async () => {
      await start();
      await open('business');
      type(root(), '#s-name', '   ');
      type(root(), '#s-timezone', 'Marte/Olympus');
      submit(root());
      await ui();

      expect(text()).toContain('Este campo es obligatorio');
      expect(text()).toContain('Zona horaria no válida');
      expect(text()).toContain('Revisa los campos marcados');
      http.expectNone(SITE);
    });

    it('should block invalid contact and brand values', async () => {
      await start();
      await open('contact');
      type(root(), '#s-whatsapp', '+59899111222');
      type(root(), '#s-email', 'no-es-correo');
      submit(root());
      await ui();
      expect(text()).toContain('Entre 8 y 15 dígitos');
      expect(text()).toContain('Escribe un correo válido');
      click('[data-discard]');
      await ui();

      await open('brand');
      type(root(), '#s-primary', 'rojo');
      submit(root());
      await ui();
      expect(text()).toContain('formato #FF5C39');
      http.expectNone(SITE);
    });

    it('should respect the list limits and validate each entry', async () => {
      await start();
      await open('highlights');
      await tab('stats');
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

    it('should reject out-of-range or decimal stat values', async () => {
      await start();
      await open('highlights');
      await tab('stats');
      type(root(), 'input[aria-label="Valor de la cifra 1"]', '1000000');
      submit(root());
      await ui();
      expect(text()).toContain('valor entero entre 0 y 999999');
    });
  });

  describe('saving', () => {
    it('should send trimmed business values and the current version, then close the dialog', async () => {
      await start();
      await open('business');
      type(root(), '#s-name', '  Café Nuevo  ');

      const request = await saveWith();
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

    it('should send null for blank contact values', async () => {
      await start();
      await open('contact');
      type(root(), '#s-whatsapp', '');
      type(root(), '#s-phone', '   ');
      type(root(), '#s-schedule', 'Lun 18-02\nMar 18-02');

      const request = await saveWith();
      expect(request.request.body).toMatchObject({ whatsappNumber: null, phone: null, schedule: 'Lun 18-02\nMar 18-02' });
    });

    it('should send the new colors', async () => {
      await start();
      await open('brand');
      type(root(), '#s-primary', '#112233');
      const request = await saveWith();
      expect(request.request.body).toMatchObject({ primaryColor: '#112233', accentColor: '#0E8388' });
    });

    it('should send edited highlights, trimmed', async () => {
      await start();
      await open('highlights');
      type(root(), 'app-string-list-editor input[aria-label="Frase 1"]', '  Música en vivo ');
      await tab('stats');
      type(root(), 'input[aria-label="Valor de la cifra 1"]', '20');
      const request = await saveWith();
      expect(request.request.body).toMatchObject({ marqueeItems: ['Música en vivo', 'Dos'], stats: [{ label: 'Años', value: 20 }] });
    });

    it('should use the new version on the following save', async () => {
      await start();
      await open('business');
      type(root(), '#s-name', 'Primero');
      await saveWith(makeSettings({ name: 'Primero', version: 5 }));
      await ui();
      await open('business');
      type(root(), '#s-name', 'Segundo');
      const second = await saveWith(makeSettings({ name: 'Segundo', version: 6 }));
      expect((second.request.body as { version: number }).version).toBe(5);
    });

    it('should show a conflict instead of overwriting, and reload the current data', async () => {
      await start();
      await open('business');
      type(root(), '#s-name', 'Mi cambio');
      submit(root());
      await ui();
      await answer(http, SITE, { code: 'version_conflict' }, { status: 409, statusText: 'Conflict' }, 'PUT');
      await ui();
      expect(root().querySelector('[role="alert"]')?.textContent).toContain('no se guardó para no pisar');

      click('[data-reload]');
      await answer(http, SITE, makeSettings({ name: 'Cambio de la otra persona', version: 9 }));
      await ui();
      expect(text()).toContain('Cambio de la otra persona');
      expect(root().querySelector('[data-reload]')).toBeNull();
      expect(dialogs().length).toBe(0);
    });

    it('should show server validation errors on their fields', async () => {
      await start();
      await open('contact');
      type(root(), '#s-phone', '099');
      submit(root());
      await ui();
      await answer(http, SITE, { code: 'validation_error', fieldErrors: [{ field: 'whatsappNumber', message: 'Debe tener entre 8 y 15 dígitos' }, { field: 'stats[0].label', message: 'tamaño' }] }, { status: 400, statusText: 'Bad Request' }, 'PUT');
      await ui();
      expect(text()).toContain('Debe tener entre 8 y 15 dígitos');
      expect(text()).toContain('Revisa los datos: tamaño');
    });

    it('should keep the edits when saving fails because of the connection', async () => {
      await start();
      await open('business');
      type(root(), '#s-name', 'Mi cambio');
      submit(root());
      await ui();
      await answer(http, SITE, 'boom', { status: 503, statusText: 'Unavailable' }, 'PUT');
      await ui();
      expect(text()).toContain('problema de conexión');
      expect(value('#s-name')).toBe('Mi cambio');
      expect(dialogs().length).toBe(1);
    });

    it('should discard edits when the dialog is cancelled and reopen with the saved values', async () => {
      await start();
      await open('business');
      type(root(), '#s-name', 'Borrador');
      fixture.detectChanges();
      expect(text()).toContain('Hay cambios sin guardar');
      click('[data-discard]');
      await ui();
      expect(dialogs().length).toBe(0);
      await open('business');
      expect(value('#s-name')).toBe('Negocio A');
      expect(text()).not.toContain('Hay cambios sin guardar');
    });
  });

  describe('currency change', () => {
    async function changeCurrency() {
      await start();
      await open('business');
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

  describe('publication', () => {
    it('should block publishing while there are unsaved changes', async () => {
      await start();
      await open('business');
      type(root(), '#s-name', 'Sin guardar');
      fixture.detectChanges();
      expect((el('[data-publish]') as HTMLButtonElement).disabled).toBe(true);
      expect(text()).toContain('Guarda tus cambios antes de publicar');
    });

    it('should publish with the current version and show the public link', async () => {
      await start();
      click('[data-publish]');
      const request = await answer(http, `${SITE}/publication`, makeSettings({ published: true, version: 5 }), {}, 'PUT');
      await ui();
      expect(request.request.body).toEqual({ published: true, version: 4 });
      expect(text()).toContain('publicado');
      expect(root().querySelector('a[href$="/negocio-a"]')).not.toBeNull();
      expect(notices.notice()?.text).toContain('ya está publicado');
    });

    it('should explain what is missing when publishing is not possible', async () => {
      await start(makeSettings({ whatsappNumber: null }));
      expect(text()).toContain('Falta WhatsApp');
      click('[data-publish]');
      await answer(http, `${SITE}/publication`, { code: 'cannot_publish', fieldErrors: [{ field: 'whatsappNumber', message: 'Obligatorio' }] }, { status: 400, statusText: 'Bad Request' }, 'PUT');
      await ui();
      expect(root().querySelector('[role="alert"]')?.textContent).toContain('falta el número de WhatsApp');
      expect(text()).toContain('borrador');
    });

    it('should show a conflict when the publication version is stale', async () => {
      await start();
      click('[data-publish]');
      await answer(http, `${SITE}/publication`, { code: 'version_conflict' }, { status: 409, statusText: 'Conflict' }, 'PUT');
      await ui();
      expect(text()).toContain('cambió mientras la editabas');
    });

    it('should warn about public images before unpublishing', async () => {
      await start(makeSettings({ published: true }));
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
    it('should add and remove highlights and list entries', async () => {
      await start();
      await open('highlights');
      await tab('highlights');
      click('[data-add-highlight]');
      fixture.detectChanges();
      expect(root().querySelectorAll('input[aria-label^="Título del espacio"]').length).toBe(2);

      (root().querySelector('[aria-label="Quitar espacio 2"]') as HTMLElement).click();
      fixture.detectChanges();
      expect(root().querySelectorAll('input[aria-label^="Título del espacio"]').length).toBe(1);

      await tab('marquee');
      (root().querySelector('[aria-label="Quitar frase 1"]') as HTMLElement).click();
      fixture.detectChanges();
      expect(root().querySelectorAll('app-string-list-editor input[aria-label^="Frase"]').length).toBe(1);
      expect(text()).toContain('Hay cambios sin guardar');
    });
  });

  describe('images', () => {
    it('should open the image editor in a dialog and close it when nothing changed', async () => {
      await start();
      await open('images');
      expect(topDialog()?.textContent).toContain('Imágenes del sitio');
      expect(root().querySelector('app-site-images-editor')).not.toBeNull();
      click('[data-close-images]');
      await ui();
      expect(dialogs().length).toBe(0);
    });
  });

  describe('unsaved changes', () => {
    it('should report unsaved edits and ask before leaving', async () => {
      await start();
      expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
      await open('business');
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
});
