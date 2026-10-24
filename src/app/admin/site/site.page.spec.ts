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
  const text = () => (root().textContent ?? '').replace(/ /g, ' ');
  const ui = async () => {
    await settle();
    fixture.detectChanges();
  };
  const value = (selector: string) => (root().querySelector(selector) as HTMLInputElement).value;
  const click = (selector: string) => (root().querySelector(selector) as HTMLElement).click();
  const el = (selector: string) => root().querySelector(selector) as HTMLInputElement | HTMLButtonElement;

  async function start(settings = makeSettings(), isOwner = true) {
    owner.set(isOwner);
    fixture = TestBed.createComponent(SitePage);
    fixture.detectChanges();
    await answer(http, SITE, settings);
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
    it('should fill the form with the current settings and show the address as read-only', async () => {
      await start();
      expect(value('#s-name')).toBe('Negocio A');
      expect(value('#s-whatsapp')).toBe('59899111222');
      expect(value('#s-currency')).toBe('UYU');
      expect(value('#s-primary')).toBe('#FF5C39');
      expect(value('#s-hero-title')).toBe('Donde la noche\n*sabe mejor*');
      expect(root().querySelectorAll('app-string-list-editor input[aria-label^="Frase"]').length).toBe(2);
      expect(text()).toContain('/negocio-a');
      expect(text()).toContain('no se puede cambiar');
      expect(root().querySelector('#s-slug')).toBeNull();
      expect(text()).toContain('borrador');
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
      expect(value('#s-name')).toBe('Negocio A');
    });
  });

  describe('editor role', () => {
    it('should show the settings read-only without any action buttons', async () => {
      await start(makeSettings(), false);
      expect(text()).toContain('Solo el propietario puede cambiar');
      expect((el('#s-name') as HTMLInputElement).disabled).toBe(true);
      expect(root().querySelector('[data-save]')).toBeNull();
      expect(root().querySelector('[data-publish]')).toBeNull();
      expect(root().querySelector('[data-save-images]')).toBeNull();
      expect(root().querySelector('input[type="file"]')).toBeNull();
      expect(root().querySelector('[data-add-stat]')).toBeNull();
    });
  });

  describe('validation', () => {
    it('should block invalid values without calling the server', async () => {
      await start();
      type(root(), '#s-name', '   ');
      type(root(), '#s-whatsapp', '+59899111222');
      type(root(), '#s-email', 'no-es-correo');
      type(root(), '#s-timezone', 'Marte/Olympus');
      type(root(), '#s-primary', 'rojo');
      submit(root());
      await ui();

      expect(text()).toContain('Este campo es obligatorio');
      expect(text()).toContain('Entre 8 y 15 dígitos');
      expect(text()).toContain('Escribe un correo válido');
      expect(text()).toContain('Zona horaria no válida');
      expect(text()).toContain('formato #FF5C39');
      expect(text()).toContain('Revisa los campos marcados');
    });

    it('should respect the list limits and validate each entry', async () => {
      await start();
      for (let i = 0; i < 3; i++) {
        click('[data-add-stat]');
      }
      fixture.detectChanges();
      expect((el('[data-add-stat]') as HTMLButtonElement).disabled).toBe(true);
      expect(root().querySelectorAll('input[aria-label^="Valor de la cifra"]').length).toBe(3);

      submit(root());
      await ui();
      expect(text()).toContain('Escribe un texto (máx. 40)');
      http.expectNone(SITE);
    });

    it('should reject out-of-range or decimal stat values', async () => {
      await start();
      type(root(), 'input[aria-label="Valor de la cifra 1"]', '1000000');
      submit(root());
      await ui();
      expect(text()).toContain('valor entero entre 0 y 999999');
    });
  });

  describe('saving', () => {
    it('should send trimmed values, null for blanks and the current version', async () => {
      await start();
      type(root(), '#s-name', '  Café Nuevo  ');
      type(root(), '#s-whatsapp', '');
      type(root(), '#s-phone', '   ');
      type(root(), '#s-schedule', 'Lun 18-02\nMar 18-02');
      type(root(), '#s-primary', '#112233');
      type(root(), 'app-string-list-editor input[aria-label="Frase 1"]', '  Música en vivo ');
      type(root(), 'input[aria-label="Valor de la cifra 1"]', '20');

      const request = await saveWith();
      await ui();

      expect(request.request.body).toMatchObject({
        name: 'Café Nuevo',
        whatsappNumber: null,
        phone: null,
        schedule: 'Lun 18-02\nMar 18-02',
        primaryColor: '#112233',
        currency: 'UYU',
        timezone: 'America/Montevideo',
        marqueeItems: ['Música en vivo', 'Dos'],
        reservationAreas: ['Barra'],
        partySizes: ['2', '4'],
        stats: [{ label: 'Años', value: 20 }],
        highlights: [{ title: 'Terraza', description: 'Aire libre' }],
        version: 4,
      });
      expect(request.request.body).not.toHaveProperty('slug');
      expect(request.request.body).not.toHaveProperty('published');
      expect(request.request.body).not.toHaveProperty('images');
      expect(notices.notice()?.text).toContain('Cambios guardados');
      expect(text()).not.toContain('Hay cambios sin guardar');
    });

    it('should use the new version on the following save', async () => {
      await start();
      type(root(), '#s-name', 'Primero');
      await saveWith(makeSettings({ name: 'Primero', version: 5 }));
      await ui();
      type(root(), '#s-name', 'Segundo');
      const second = await saveWith(makeSettings({ name: 'Segundo', version: 6 }));
      expect((second.request.body as { version: number }).version).toBe(5);
    });

    it('should show a conflict instead of overwriting, and reload the current data', async () => {
      await start();
      type(root(), '#s-name', 'Mi cambio');
      submit(root());
      await ui();
      await answer(http, SITE, { code: 'version_conflict' }, { status: 409, statusText: 'Conflict' }, 'PUT');
      await ui();
      expect(root().querySelector('[role="alert"]')?.textContent).toContain('no se guardó para no pisar');

      click('[data-reload]');
      await answer(http, SITE, makeSettings({ name: 'Cambio de la otra persona', version: 9 }));
      await ui();
      expect(value('#s-name')).toBe('Cambio de la otra persona');
      expect(root().querySelector('[data-reload]')).toBeNull();
    });

    it('should show server validation errors on their fields', async () => {
      await start();
      type(root(), '#s-name', 'Otro');
      submit(root());
      await ui();
      await answer(http, SITE, { code: 'validation_error', fieldErrors: [{ field: 'whatsappNumber', message: 'Debe tener entre 8 y 15 dígitos' }, { field: 'stats[0].label', message: 'tamaño' }] }, { status: 400, statusText: 'Bad Request' }, 'PUT');
      await ui();
      expect(text()).toContain('Debe tener entre 8 y 15 dígitos');
      expect(text()).toContain('Revisa los datos: tamaño');
    });

    it('should keep the edits when saving fails because of the connection', async () => {
      await start();
      type(root(), '#s-name', 'Mi cambio');
      submit(root());
      await ui();
      await answer(http, SITE, 'boom', { status: 503, statusText: 'Unavailable' }, 'PUT');
      await ui();
      expect(text()).toContain('problema de conexión');
      expect(value('#s-name')).toBe('Mi cambio');
    });

    it('should discard edits and go back to the saved values', async () => {
      await start();
      type(root(), '#s-name', 'Borrador');
      fixture.detectChanges();
      expect(text()).toContain('Hay cambios sin guardar');
      click('[data-discard]');
      await ui();
      expect(value('#s-name')).toBe('Negocio A');
      expect(text()).not.toContain('Hay cambios sin guardar');
    });
  });

  describe('currency change', () => {
    async function changeCurrency() {
      await start();
      type(root(), '#s-currency', 'USD');
      submit(root());
      await ui();
    }

    it('should warn that prices are not converted and send nothing until confirmed', async () => {
      await changeCurrency();
      expect(root().querySelector('[role="dialog"]')?.textContent).toContain('no convierte los precios');
      http.expectNone(SITE);

      click('[data-cancel]');
      await ui();
      expect(root().querySelector('[role="dialog"]')).toBeNull();
      http.expectNone(SITE);
    });

    it('should save after the user confirms', async () => {
      await changeCurrency();
      click('[data-confirm]');
      const request = await answer(http, SITE, makeSettings({ currency: 'USD', version: 5 }), {}, 'PUT');
      await ui();
      expect(request.request.body).toMatchObject({ currency: 'USD', version: 4 });
      expect(root().querySelector('[role="dialog"]')).toBeNull();
    });
  });

  describe('publication', () => {
    it('should block publishing while there are unsaved changes', async () => {
      await start();
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
      expect(root().querySelector('[role="dialog"]')?.textContent).toContain('imágenes que ya publicaste seguirán siendo accesibles');
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
      click('[data-add-highlight]');
      fixture.detectChanges();
      expect(root().querySelectorAll('input[aria-label^="Título del espacio"]').length).toBe(2);

      (root().querySelector('[aria-label="Quitar espacio 2"]') as HTMLElement).click();
      fixture.detectChanges();
      expect(root().querySelectorAll('input[aria-label^="Título del espacio"]').length).toBe(1);

      (root().querySelector('[aria-label="Quitar frase 1"]') as HTMLElement).click();
      fixture.detectChanges();
      expect(root().querySelectorAll('app-string-list-editor input[aria-label^="Frase"]').length).toBe(1);
      expect(text()).toContain('Hay cambios sin guardar');
    });
  });

  describe('unsaved changes', () => {
    it('should report unsaved edits and ask before leaving', async () => {
      await start();
      expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
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
