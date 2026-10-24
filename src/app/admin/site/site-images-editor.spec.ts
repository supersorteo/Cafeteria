import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SiteImages, SiteSettingsDetail } from '../../core/site-admin.models';
import { makeSettings } from '../../testing/site-admin.fixture';
import { answer, settle } from '../../testing/http';
import { SiteImagesEditor } from './site-images-editor';

const SITE = '/api/v1/admin/site/images';
const MEDIA = '/api/v1/admin/media';
const media = (id: string) => ({ id, url: `/media/${id}`, mimeType: 'image/jpeg', width: 1, height: 1, byteSize: 1 });

describe('SiteImagesEditor', () => {
  let fixture: ComponentFixture<SiteImagesEditor>;
  let http: HttpTestingController;
  let saved: SiteSettingsDetail[];

  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => root().textContent ?? '';
  const ui = async () => {
    await settle();
    fixture.detectChanges();
  };
  const click = (selector: string) => (root().querySelector(selector) as HTMLElement).click();
  const images = (): SiteImages => makeSettings().images;

  function create(value: SiteImages = images(), readonly = false) {
    fixture = TestBed.createComponent(SiteImagesEditor);
    fixture.componentRef.setInput('images', value);
    fixture.componentRef.setInput('readonly', readonly);
    saved = [];
    fixture.componentInstance.saved.subscribe(settings => saved.push(settings));
    fixture.detectChanges();
  }

  function choose(id: string, file: File): void {
    const input = root().querySelector(`#${id}`) as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
  }
  const jpeg = () => new File([new Uint8Array(100)], 'foto.jpg', { type: 'image/jpeg' });

  async function upload(id: string, mediaId: string): Promise<void> {
    choose(id, jpeg());
    await ui();
    http.expectOne(MEDIA).flush(media(mediaId), { status: 201, statusText: 'Created' });
    await ui();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should show the current images and counters', () => {
    create();
    expect(root().querySelector('img[alt="Imagen de portada"]')?.getAttribute('src')).toBe('/media/h1');
    expect(text()).toContain('Nosotros (1/3)');
    expect(text()).toContain('Galería (1/6)');
    expect((root().querySelector('#alt-g1') as HTMLInputElement).value).toBe('Terraza');
    expect((root().querySelector('[data-save-images]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('should be read-only for editors', () => {
    create(images(), true);
    expect(root().querySelector('input[type="file"]')).toBeNull();
    expect(root().querySelector('[data-save-images]')).toBeNull();
    expect((root().querySelector('#alt-g1') as HTMLInputElement).disabled).toBe(true);
  });

  it('should save the whole set of images in one request', async () => {
    create();
    click('[data-remove-hero]');
    const alt = root().querySelector('#alt-g1') as HTMLInputElement;
    alt.value = '  Terraza de noche ';
    alt.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(text()).toContain('Hay cambios sin guardar');

    click('[data-save-images]');
    const request = await answer(http, SITE, makeSettings({ version: 5 }), {}, 'PUT');
    await ui();

    expect(request.request.body).toEqual({ hero: null, about: ['a1'], gallery: [{ mediaId: 'g1', alt: 'Terraza de noche' }] });
    expect(saved.length).toBe(1);
    expect(saved[0].version).toBe(5);
  });

  it('should reorder the gallery', async () => {
    create({ hero: null, about: [], gallery: [{ id: 'g1', url: '/media/g1', alt: 'Uno' }, { id: 'g2', url: '/media/g2', alt: 'Dos' }] });
    click('[aria-label="Bajar galería 1"]');
    fixture.detectChanges();
    click('[data-save-images]');
    const request = await answer(http, SITE, makeSettings(), {}, 'PUT');
    expect(request.request.body).toMatchObject({ gallery: [{ mediaId: 'g2', alt: 'Dos' }, { mediaId: 'g1', alt: 'Uno' }] });
  });

  it('should reject unsupported or oversized files before uploading', async () => {
    create();
    choose('img-hero', new File(['x'], 'nota.txt', { type: 'text/plain' }));
    await ui();
    expect(text()).toContain('Usa una imagen JPEG, PNG o WebP');
    choose('img-hero', new File([new Uint8Array(6 * 1024 * 1024)], 'grande.jpg', { type: 'image/jpeg' }));
    await ui();
    expect(text()).toContain('supera los 5 MB');
  });

  it('should upload with progress and place the new image in its block', async () => {
    create({ hero: null, about: [], gallery: [] });
    choose('img-gallery', jpeg());
    await ui();
    const request = http.expectOne(MEDIA);
    request.event({ type: HttpEventType.UploadProgress, loaded: 30, total: 100 });
    await ui();
    expect(root().querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('30');
    expect((root().querySelector('[data-save-images]') as HTMLButtonElement).disabled).toBe(true);

    request.flush(media('n1'), { status: 201, statusText: 'Created' });
    await ui();
    expect(text()).toContain('Galería (1/6)');
    expect((root().querySelector('[data-save-images]') as HTMLButtonElement).disabled).toBe(false);
  });

  it('should enforce the limits of each block', async () => {
    create({ hero: null, about: [{ id: 'a1', url: '/media/a1' }, { id: 'a2', url: '/media/a2' }, { id: 'a3', url: '/media/a3' }], gallery: [] });
    expect((root().querySelector('#img-about') as HTMLInputElement).disabled).toBe(true);
    expect(text()).toContain('Nosotros (3/3)');
  });

  it('should report an upload failure and allow trying again', async () => {
    create();
    choose('img-hero', jpeg());
    await ui();
    http.expectOne(MEDIA).flush({ code: 'invalid_image' }, { status: 400, statusText: 'Bad Request' });
    await ui();
    expect(text()).toContain('no es una imagen JPEG, PNG o WebP válida');
    expect((root().querySelector('#img-hero') as HTMLInputElement).disabled).toBe(false);
  });

  it('should delete an uploaded image that is removed before saving', async () => {
    create({ hero: null, about: [], gallery: [] });
    await upload('img-gallery', 'n1');
    click('[aria-label="Quitar galería 1"]');
    await answer(http, `${MEDIA}/n1`, null, { status: 204, statusText: 'No Content' }, 'DELETE');
    await ui();
    expect(text()).toContain('Galería (0/6)');
  });

  it('should not delete persisted images when they are removed', async () => {
    create();
    click('[data-remove-hero]');
    fixture.detectChanges();
    http.expectNone(`${MEDIA}/h1`);
  });

  it('should discard changes, deleting only the unsaved uploads', async () => {
    create();
    await upload('img-about', 'n2');
    click('[data-remove-hero]');
    fixture.detectChanges();
    click('[data-discard-images]');
    await answer(http, `${MEDIA}/n2`, null, { status: 204, statusText: 'No Content' }, 'DELETE');
    await ui();
    expect(text()).toContain('Nosotros (1/3)');
    expect(root().querySelector('img[alt="Imagen de portada"]')).not.toBeNull();
    expect(text()).not.toContain('Hay cambios sin guardar');
  });

  it('should replace the cover and delete the previous unsaved cover', async () => {
    create({ hero: null, about: [], gallery: [] });
    await upload('img-hero', 'n1');
    choose('img-hero', jpeg());
    await ui();
    http.expectOne(MEDIA).flush(media('n2'), { status: 201, statusText: 'Created' });
    await answer(http, `${MEDIA}/n1`, null, { status: 204, statusText: 'No Content' }, 'DELETE');
    await ui();
    click('[data-save-images]');
    const request = await answer(http, SITE, makeSettings(), {}, 'PUT');
    expect(request.request.body).toMatchObject({ hero: 'n2' });
  });

  it('should keep the changes when saving fails and explain why', async () => {
    create();
    click('[data-remove-hero]');
    fixture.detectChanges();
    click('[data-save-images]');
    await answer(http, SITE, 'boom', { status: 503, statusText: 'Unavailable' }, 'PUT');
    await ui();
    expect(text()).toContain('problema de conexión');
    expect(text()).toContain('Hay cambios sin guardar');

    click('[data-save-images]');
    await answer(http, SITE, { code: 'validation_error' }, { status: 400, statusText: 'Bad Request' }, 'PUT');
    await ui();
    expect(text()).toContain('ya no está disponible');
  });
});
