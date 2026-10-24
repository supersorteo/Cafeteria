import { HttpEventType } from '@angular/common/http';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Category, MenuItem } from '../../core/catalog.models';
import { NoticeService } from '../../core/notice.service';
import { answer, answerMatching, settle } from '../../testing/http';
import { MenuPage } from './menu.page';

const ADMIN = '/api/v1/admin';
const C1: Category = { id: 'c1', name: 'Cocteles', sortOrder: 0, version: 3 };
const C2: Category = { id: 'c2', name: 'Postres', sortOrder: 1, version: 0 };

function item(id: string, overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id, categoryId: 'c1', name: `Producto ${id}`, description: `Desc ${id}`, price: 180, tag: null, active: true,
    sortOrder: 0, version: 2, imageId: null, imageUrl: null, ...overrides,
  };
}

function pageOf(content: MenuItem[], extra: { page?: number; totalElements?: number; totalPages?: number } = {}) {
  return {
    content, page: extra.page ?? 0, size: 10,
    totalElements: extra.totalElements ?? content.length,
    totalPages: extra.totalPages ?? (content.length ? 1 : 0),
  };
}

describe('MenuPage', () => {
  let fixture: ComponentFixture<MenuPage>;
  let http: HttpTestingController;
  let notices: NoticeService;

  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => (root().textContent ?? '').replace(/ /g, ' ');
  const ui = async () => {
    await settle();
    fixture.detectChanges();
  };
  const click = (selector: string) => (root().querySelector(selector) as HTMLElement).click();
  const clickLabel = (label: string) => click(`[aria-label="${label}"]`);
  const clickText = (label: string) =>
    (Array.from(root().querySelectorAll('button')).find(b => b.textContent?.includes(label)) as HTMLButtonElement).click();
  const type = (selector: string, value: string) => {
    const field = root().querySelector(selector) as HTMLInputElement;
    field.value = value;
    field.dispatchEvent(new Event('input'));
    field.dispatchEvent(new Event('change'));
  };
  const submitOf = (selector: string) => (root().querySelector(selector) as HTMLFormElement).dispatchEvent(new Event('submit'));

  const itemsUrl = (categoryId: string, page = 0, size = 10, active?: string) => (r: { url: string; params: { get(n: string): string | null } }) =>
    r.url === `${ADMIN}/menu-items` && r.params.get('categoryId') === categoryId && r.params.get('page') === String(page)
    && r.params.get('size') === String(size) && (active === undefined || r.params.get('active') === active);
  const answerItems = (categoryId: string, body: object, page = 0, size = 10, active?: string) =>
    answerMatching(http, itemsUrl(categoryId, page, size, active), `items ${categoryId} p${page}`, body);

  async function start(categories = [C1, C2], items = [item('i1'), item('i2', { name: 'Spritz', price: 150.5, active: false })]) {
    fixture = TestBed.createComponent(MenuPage);
    fixture.detectChanges();
    await answer(http, `${ADMIN}/site`, { currency: 'UYU', locale: 'es-UY', slug: 'negocio-a' });
    await answer(http, `${ADMIN}/categories`, categories);
    if (categories.length > 0) {
      await answerItems(categories[0].id, pageOf(items));
    }
    await ui();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    notices = TestBed.inject(NoticeService);
  });

  afterEach(() => {
    notices.dismiss();
    http.verify();
  });

  describe('loading', () => {
    it('should show the categories and the products of the first one with the tenant currency', async () => {
      await start();
      expect(text()).toContain('Cocteles');
      expect(text()).toContain('Postres');
      expect(text()).toContain('Producto i1');
      expect(text()).toMatch(/\$\s?180/);
      expect(text()).toMatch(/150[,.]5/);
      expect(root().querySelector('[role="switch"][aria-label="Activo: Spritz"]')?.getAttribute('aria-checked')).toBe('false');
    });

    it('should guide a new business with no categories', async () => {
      await start([], []);
      expect(text()).toContain('Aún no tienes categorías');
      expect(text()).toContain('Crea una categoría para empezar');
    });

    it('should offer a retry when the categories fail to load', async () => {
      fixture = TestBed.createComponent(MenuPage);
      fixture.detectChanges();
      await answer(http, `${ADMIN}/site`, {}, { status: 500, statusText: 'Error' });
      await answer(http, `${ADMIN}/categories`, {}, { status: 500, statusText: 'Error' });
      await ui();
      expect(root().querySelector('[role="alert"]')?.textContent).toContain('No pudimos cargar tu carta');

      click('[data-retry]');
      await answer(http, `${ADMIN}/categories`, [C1]);
      await answerItems('c1', pageOf([item('i1')]));
      await ui();
      expect(text()).toContain('Producto i1');
    });

    it('should offer a retry when the products fail to load', async () => {
      fixture = TestBed.createComponent(MenuPage);
      fixture.detectChanges();
      await answer(http, `${ADMIN}/site`, { currency: 'UYU', locale: 'es-UY', slug: 'a' });
      await answer(http, `${ADMIN}/categories`, [C1]);
      await answerMatching(http, itemsUrl('c1'), 'items', {}, { status: 500, statusText: 'Error' });
      await ui();
      expect(text()).toContain('No pudimos cargar los productos');

      clickText('Reintentar');
      await answerItems('c1', pageOf([item('i1')]));
      await ui();
      expect(text()).toContain('Producto i1');
    });

    it('should show the empty state of a category', async () => {
      await start([C1], []);
      expect(text()).toContain('Esta categoría aún no tiene productos');
    });
  });

  describe('categories', () => {
    it('should validate a blank name without calling the server', async () => {
      await start();
      submitOf('app-category-panel section > form');
      await ui();
      expect(text()).toContain('Escribe un nombre');
    });

    it('should create a category and list it', async () => {
      await start();
      type('#new-category', '  Entrantes ');
      submitOf('app-category-panel section > form');
      const request = await answer(http, `${ADMIN}/categories`, { id: 'c3', name: 'Entrantes', sortOrder: 2, version: 0 }, { status: 201, statusText: 'Created' }, 'POST');
      await ui();
      expect(request.request.body).toEqual({ name: 'Entrantes' });
      expect(text()).toContain('Entrantes');
      expect((root().querySelector('#new-category') as HTMLInputElement).value).toBe('');
    });

    it('should explain the category limit', async () => {
      await start();
      type('#new-category', 'Una más');
      submitOf('app-category-panel section > form');
      await answer(http, `${ADMIN}/categories`, { code: 'limit_reached' }, { status: 409, statusText: 'Conflict' }, 'POST');
      await ui();
      expect(text()).toContain('máximo de 30 categorías');
    });

    it('should rename a category with its version', async () => {
      await start();
      clickLabel('Renombrar Cocteles');
      await ui();
      type('#rename-c1', 'Tragos');
      submitOf('app-category-panel form');
      const request = await answer(http, `${ADMIN}/categories/c1`, { ...C1, name: 'Tragos', version: 4 }, {}, 'PUT');
      await ui();
      expect(request.request.body).toEqual({ name: 'Tragos', version: 3 });
      expect(text()).toContain('Tragos');
      expect(root().querySelector('#rename-c1')).toBeNull();
    });

    it('should offer a reload instead of overwriting when someone else renamed it', async () => {
      await start();
      clickLabel('Renombrar Cocteles');
      await ui();
      type('#rename-c1', 'Mi nombre');
      submitOf('app-category-panel form');
      await answer(http, `${ADMIN}/categories/c1`, { code: 'version_conflict' }, { status: 409, statusText: 'Conflict' }, 'PUT');
      await ui();
      expect(text()).toContain('Otra persona cambió esta categoría');

      click('[data-reload]');
      await answer(http, `${ADMIN}/categories`, [{ ...C1, name: 'Nombre de la otra persona', version: 4 }, C2]);
      await answerItems('c1', pageOf([item('i1')]));
      await ui();
      expect(text()).toContain('Nombre de la otra persona');
      expect(text()).not.toContain('Mi nombre');
    });

    it('should cancel an edit without sending anything', async () => {
      await start();
      clickLabel('Renombrar Cocteles');
      await ui();
      click('[data-cancel-edit]');
      await ui();
      expect(root().querySelector('#rename-c1')).toBeNull();
    });

    it('should reorder categories and show the order returned by the server', async () => {
      await start();
      clickLabel('Bajar Cocteles');
      const request = await answer(http, `${ADMIN}/categories/order`, [{ ...C2, sortOrder: 0 }, { ...C1, sortOrder: 1 }], {}, 'PUT');
      await ui();
      expect(request.request.body).toEqual({ ids: ['c2', 'c1'] });
      const names = Array.from(root().querySelectorAll('app-category-panel li button:first-child')).map(b => b.textContent?.trim());
      expect(names.slice(0, 2)).toEqual(['Postres', 'Cocteles']);
    });

    it('should disable moving the first category up and the last one down', async () => {
      await start();
      expect((root().querySelector('[aria-label="Subir Cocteles"]') as HTMLButtonElement).disabled).toBe(true);
      expect((root().querySelector('[aria-label="Bajar Postres"]') as HTMLButtonElement).disabled).toBe(true);
    });

    it('should ask for confirmation before deleting and send nothing when cancelled', async () => {
      await start();
      clickLabel('Eliminar Postres');
      await ui();
      expect(root().querySelector('[role="dialog"]')?.textContent).toContain('Eliminar categoría');
      click('[data-cancel]');
      await ui();
      expect(root().querySelector('[role="dialog"]')).toBeNull();
    });

    it('should close the confirmation with Escape', async () => {
      await start();
      clickLabel('Eliminar Postres');
      await ui();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await ui();
      expect(root().querySelector('[role="dialog"]')).toBeNull();
    });

    it('should delete an empty category and select another', async () => {
      await start();
      clickLabel('Eliminar Cocteles');
      await ui();
      click('[data-confirm]');
      await answer(http, `${ADMIN}/categories/c1`, null, { status: 204, statusText: 'No Content' }, 'DELETE');
      await answerItems('c2', pageOf([item('p1', { categoryId: 'c2', name: 'Flan' })]));
      await ui();
      expect(text()).not.toContain('Eliminar Cocteles');
      expect(text()).toContain('Flan');
    });

    it('should explain that a category with products cannot be deleted', async () => {
      await start();
      clickLabel('Eliminar Cocteles');
      await ui();
      click('[data-confirm]');
      await answer(http, `${ADMIN}/categories/c1`, { code: 'category_not_empty' }, { status: 409, statusText: 'Conflict' }, 'DELETE');
      await ui();
      expect(notices.notice()?.text).toContain('tiene productos');
      expect(text()).toContain('Cocteles');
    });
  });

  describe('products list', () => {
    it('should load the products of another category when selected', async () => {
      await start();
      clickText('Postres');
      await answerItems('c2', pageOf([item('p1', { categoryId: 'c2', name: 'Flan' })]));
      await ui();
      expect(text()).toContain('Flan');
      expect(text()).not.toContain('Producto i1');
    });

    it('should ignore a late response from a category the user already left', async () => {
      await start();
      clickText('Postres');
      await settle();
      const late = http.expectOne(itemsUrl('c2'));
      clickText('Cocteles');
      await answerItems('c1', pageOf([item('i1')]));
      late.flush(pageOf([item('p1', { categoryId: 'c2', name: 'Flan' })]));
      await ui();
      expect(text()).toContain('Producto i1');
      expect(text()).not.toContain('Flan');
    });

    it('should filter by state and go back to the first page', async () => {
      await start();
      clickText('Activos');
      await answerItems('c1', pageOf([item('i1')]), 0, 10, 'true');
      await ui();
      expect(root().querySelector('[aria-pressed="true"]')?.textContent).toContain('Activos');

      clickText('Inactivos');
      await answerItems('c1', pageOf([]), 0, 10, 'false');
      await ui();
      expect(text()).toContain('No hay productos inactivos');
    });

    it('should paginate', async () => {
      await start([C1, C2], [item('i1')]);
      // la primera respuesta ya se consumió; simulamos varias páginas recargando con otra respuesta
      clickText('Postres');
      await answerItems('c2', pageOf([item('p1', { categoryId: 'c2' })], { totalElements: 25, totalPages: 3 }));
      await ui();
      expect(text()).toContain('Página 1 de 3');
      expect((root().querySelector('[data-prev]') as HTMLButtonElement).disabled).toBe(true);

      click('[data-next]');
      await answerItems('c2', pageOf([item('p2', { categoryId: 'c2', name: 'Segunda página' })], { page: 1, totalElements: 25, totalPages: 3 }), 1);
      await ui();
      expect(text()).toContain('Página 2 de 3');
      expect(text()).toContain('Segunda página');
    });

    it('should toggle a product keeping its version', async () => {
      await start();
      clickLabel('Activo: Producto i1');
      const request = await answer(http, `${ADMIN}/menu-items/i1`, item('i1', { active: false, version: 3 }), {}, 'PUT');
      await ui();
      expect(request.request.body).toMatchObject({ active: false, version: 2, name: 'Producto i1', price: 180, categoryId: 'c1' });
      expect(request.request.body).not.toHaveProperty('imageId');
      expect(request.request.body).not.toHaveProperty('removeImage');
      expect(root().querySelector('[aria-label="Activo: Producto i1"]')?.getAttribute('aria-checked')).toBe('false');
    });

    it('should reload the list and warn when the toggle hits a version conflict', async () => {
      await start();
      clickLabel('Activo: Producto i1');
      await answer(http, `${ADMIN}/menu-items/i1`, { code: 'version_conflict' }, { status: 409, statusText: 'Conflict' }, 'PUT');
      await answerItems('c1', pageOf([item('i1', { active: false, version: 5 })]));
      await ui();
      expect(notices.notice()?.text).toContain('Otra persona modificó este producto');
    });

    it('should confirm before deleting a product and reload afterwards', async () => {
      await start();
      clickLabel('Eliminar Producto i1');
      await ui();
      click('[data-cancel]');
      await ui();
      expect(root().querySelector('[role="dialog"]')).toBeNull();

      clickLabel('Eliminar Producto i1');
      await ui();
      click('[data-confirm]');
      await answer(http, `${ADMIN}/menu-items/i1`, null, { status: 204, statusText: 'No Content' }, 'DELETE');
      await answerItems('c1', pageOf([item('i2', { name: 'Spritz' })]));
      await ui();
      expect(text()).not.toContain('Producto i1');
      expect(text()).toContain('Spritz');
    });

    it('should reorder a product using the complete order of the category', async () => {
      await start();
      clickLabel('Bajar Producto i1');
      await answerItems('c1', pageOf([item('i1'), item('i2')]), 0, 100);
      const request = await answer(http, `${ADMIN}/categories/c1/item-order`, [item('i2'), item('i1')], {}, 'PUT');
      await answerItems('c1', pageOf([item('i2'), item('i1')]));
      await ui();
      expect(request.request.body).toEqual({ ids: ['i2', 'i1'] });
      const names = Array.from(root().querySelectorAll('app-product-panel li p.font-bold')).map(p => p.textContent?.trim());
      expect(names).toEqual(['Producto i2', 'Producto i1']);
    });

    it('should not allow reordering while a filter is active', async () => {
      await start();
      clickText('Activos');
      await answerItems('c1', pageOf([item('i1')]), 0, 10, 'true');
      await ui();
      expect((root().querySelector('[aria-label="Bajar Producto i1"]') as HTMLButtonElement).disabled).toBe(true);
    });

    it('should handle the product disappearing while it is being toggled', async () => {
      await start();
      clickLabel('Activo: Producto i1');
      await answer(http, `${ADMIN}/menu-items/i1`, { code: 'not_found' }, { status: 404, statusText: 'Not Found' }, 'PUT');
      await answerItems('c1', pageOf([]));
      await ui();
      expect(notices.notice()?.text).toContain('ya no existe');
    });
  });

  describe('product form', () => {
    const valid = () => {
      type('#item-name', '  Negroni  ');
      type('#item-price', '180.5');
    };
    const save = () => submitOf('app-product-form form');

    it('should validate required fields and the price without calling the server', async () => {
      await start();
      click('[data-new-item]');
      await ui();
      save();
      await ui();
      expect(text()).toContain('Escribe un nombre');
      expect(text()).toContain('Escribe un precio');

      type('#item-name', 'Negroni');
      type('#item-price', '10.123');
      save();
      await ui();
      expect(text()).toContain('como máximo dos decimales');

      type('#item-price', '-1');
      save();
      await ui();
      expect(text()).toContain('Escribe un precio entre 0');
    });

    it('should create a product with the category selected in the list and reload', async () => {
      await start();
      click('[data-new-item]');
      await ui();
      valid();
      save();
      const request = await answer(http, `${ADMIN}/menu-items`, item('n1', { name: 'Negroni', price: 180.5 }), { status: 201, statusText: 'Created' }, 'POST');
      await answerItems('c1', pageOf([item('n1', { name: 'Negroni', price: 180.5 })]));
      await ui();

      expect(request.request.body).toEqual({
        categoryId: 'c1', name: 'Negroni', description: null, price: 180.5, tag: null, active: true, version: null,
      });
      expect(root().querySelector('[role="dialog"]')).toBeNull();
      expect(text()).toContain('Negroni');
    });

    it('should send a single request when the user double-submits', async () => {
      await start();
      click('[data-new-item]');
      await ui();
      valid();
      save();
      save();
      await ui();
      expect((root().querySelector('[data-save]') as HTMLButtonElement).disabled).toBe(true);
      await answer(http, `${ADMIN}/menu-items`, item('n1'), { status: 201, statusText: 'Created' }, 'POST');
      await answerItems('c1', pageOf([item('n1')]));
    });

    it('should cancel without changing the list', async () => {
      await start();
      clickLabel('Editar Producto i1');
      await ui();
      type('#item-name', 'Nombre cambiado en el formulario');
      click('[data-cancel]');
      await ui();
      expect(root().querySelector('[role="dialog"]')).toBeNull();
      expect(text()).toContain('Producto i1');
      expect(text()).not.toContain('Nombre cambiado en el formulario');
    });

    it('should prefill an edit and send the version without touching the image', async () => {
      await start();
      clickLabel('Editar Producto i1');
      await ui();
      expect((root().querySelector('#item-name') as HTMLInputElement).value).toBe('Producto i1');
      expect((root().querySelector('#item-price') as HTMLInputElement).value).toBe('180');
      type('#item-name', 'Renombrado');
      save();
      const request = await answer(http, `${ADMIN}/menu-items/i1`, item('i1', { name: 'Renombrado', version: 3 }), {}, 'PUT');
      await answerItems('c1', pageOf([item('i1', { name: 'Renombrado', version: 3 })]));
      await ui();
      expect(request.request.body).toMatchObject({ name: 'Renombrado', version: 2, description: 'Desc i1' });
      expect(request.request.body).not.toHaveProperty('imageId');
      expect(request.request.body).not.toHaveProperty('removeImage');
    });

    it('should show a conflict, not overwrite, and let the user reload fresh data', async () => {
      await start();
      clickLabel('Editar Producto i1');
      await ui();
      type('#item-name', 'Mi cambio');
      save();
      await answer(http, `${ADMIN}/menu-items/i1`, { code: 'version_conflict' }, { status: 409, statusText: 'Conflict' }, 'PUT');
      await ui();
      expect(root().querySelector('[role="alert"]')?.textContent).toContain('no se guardaron para no pisar');

      click('[data-reload]');
      await answerItems('c1', pageOf([item('i1', { name: 'Cambio de la otra persona', version: 7 })]));
      await ui();
      expect((root().querySelector('#item-name') as HTMLInputElement).value).toBe('Cambio de la otra persona');
      expect(root().querySelector('[data-reload]')).toBeNull();

      save();
      const retry = await answer(http, `${ADMIN}/menu-items/i1`, item('i1', { version: 8 }), {}, 'PUT');
      await answerItems('c1', pageOf([item('i1', { version: 8 })]));
      expect(retry.request.body).toMatchObject({ version: 7 });
    });

    describe('image', () => {
      function choose(file: File): void {
        const input = root().querySelector('#item-image') as HTMLInputElement;
        Object.defineProperty(input, 'files', { value: [file], configurable: true });
        input.dispatchEvent(new Event('change'));
      }
      const jpeg = () => new File([new Uint8Array(1024)], 'foto.jpg', { type: 'image/jpeg' });

      async function openCreate(): Promise<void> {
        await start();
        click('[data-new-item]');
        await ui();
        valid();
      }

      it('should reject unsupported or oversized files before uploading', async () => {
        await openCreate();
        choose(new File(['hola'], 'nota.txt', { type: 'text/plain' }));
        await ui();
        expect(text()).toContain('Usa una imagen JPEG, PNG o WebP');

        const big = new File([new Uint8Array(6 * 1024 * 1024)], 'grande.jpg', { type: 'image/jpeg' });
        choose(big);
        await ui();
        expect(text()).toContain('supera los 5 MB');
      });

      it('should upload with progress, preview it and save the reference', async () => {
        await openCreate();
        choose(jpeg());
        await ui();
        const upload = http.expectOne(`${ADMIN}/media`);
        expect(upload.request.body instanceof FormData).toBe(true);
        expect((upload.request.body as FormData).get('file')).toBeInstanceOf(File);
        upload.event({ type: HttpEventType.UploadProgress, loaded: 40, total: 100 });
        await ui();
        expect(root().querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('40');
        expect((root().querySelector('[data-save]') as HTMLButtonElement).disabled).toBe(true);

        upload.flush({ id: 'm1', url: '/media/m1', mimeType: 'image/jpeg', width: 10, height: 10, byteSize: 1024 }, { status: 201, statusText: 'Created' });
        await ui();
        expect(root().querySelector('img[alt="Vista previa del producto"]')?.getAttribute('src')).toBe('/media/m1');

        save();
        const request = await answer(http, `${ADMIN}/menu-items`, item('n1', { imageId: 'm1', imageUrl: '/media/m1' }), { status: 201, statusText: 'Created' }, 'POST');
        await answerItems('c1', pageOf([item('n1')]));
        expect(request.request.body).toMatchObject({ imageId: 'm1' });
      });

      it('should report an upload failure and allow trying again', async () => {
        await openCreate();
        choose(jpeg());
        await ui();
        http.expectOne(`${ADMIN}/media`).flush({ code: 'invalid_image' }, { status: 400, statusText: 'Bad Request' });
        await ui();
        expect(root().querySelector('[role="alert"]')?.textContent).toContain('no es una imagen JPEG, PNG o WebP válida');
        expect((root().querySelector('[data-save]') as HTMLButtonElement).disabled).toBe(false);

        choose(jpeg());
        await ui();
        http.expectOne(`${ADMIN}/media`).flush({ code: 'file_too_large' }, { status: 413, statusText: 'Payload Too Large' });
        await ui();
        expect(text()).toContain('supera los 5 MB permitidos');
      });

      it('should keep the uploaded image when saving fails, and reuse it without uploading again', async () => {
        await openCreate();
        choose(jpeg());
        await ui();
        http.expectOne(`${ADMIN}/media`).flush({ id: 'm1', url: '/media/m1', mimeType: 'image/jpeg', width: 1, height: 1, byteSize: 1 }, { status: 201, statusText: 'Created' });
        await ui();

        save();
        await answer(http, `${ADMIN}/menu-items`, 'boom', { status: 503, statusText: 'Unavailable' }, 'POST');
        await ui();
        expect(text()).toContain('problema de conexión');
        expect(root().querySelector('img[alt="Vista previa del producto"]')).not.toBeNull();

        save();
        const retry = await answer(http, `${ADMIN}/menu-items`, item('n1'), { status: 201, statusText: 'Created' }, 'POST');
        await answerItems('c1', pageOf([item('n1')]));
        expect(retry.request.body).toMatchObject({ imageId: 'm1' });
        http.expectNone(`${ADMIN}/media`);
      });

      it('should delete the uploaded image when the form is cancelled', async () => {
        await openCreate();
        choose(jpeg());
        await ui();
        http.expectOne(`${ADMIN}/media`).flush({ id: 'm1', url: '/media/m1', mimeType: 'image/jpeg', width: 1, height: 1, byteSize: 1 }, { status: 201, statusText: 'Created' });
        await ui();

        click('[data-cancel]');
        await answer(http, `${ADMIN}/media/m1`, null, { status: 204, statusText: 'No Content' }, 'DELETE');
        await ui();
        expect(root().querySelector('[role="dialog"]')).toBeNull();
      });

      it('should replace an existing image with imageId and never send removeImage', async () => {
        await start([C1, C2], [item('i1', { imageId: 'old', imageUrl: '/media/old' })]);
        clickLabel('Editar Producto i1');
        await ui();
        expect(root().querySelector('img[alt="Vista previa del producto"]')?.getAttribute('src')).toBe('/media/old');
        choose(jpeg());
        await ui();
        http.expectOne(`${ADMIN}/media`).flush({ id: 'm2', url: '/media/m2', mimeType: 'image/jpeg', width: 1, height: 1, byteSize: 1 }, { status: 201, statusText: 'Created' });
        await ui();
        save();
        const request = await answer(http, `${ADMIN}/menu-items/i1`, item('i1', { imageId: 'm2' }), {}, 'PUT');
        await answerItems('c1', pageOf([item('i1')]));
        expect(request.request.body).toMatchObject({ imageId: 'm2' });
        expect(request.request.body).not.toHaveProperty('removeImage');
      });

      it('should remove an existing image explicitly', async () => {
        await start([C1, C2], [item('i1', { imageId: 'old', imageUrl: '/media/old' })]);
        clickLabel('Editar Producto i1');
        await ui();
        click('[data-remove-image]');
        await ui();
        expect(root().querySelector('img[alt="Vista previa del producto"]')).toBeNull();
        save();
        const request = await answer(http, `${ADMIN}/menu-items/i1`, item('i1'), {}, 'PUT');
        await answerItems('c1', pageOf([item('i1')]));
        expect(request.request.body).toMatchObject({ removeImage: true });
        expect(request.request.body).not.toHaveProperty('imageId');
      });
    });

    it('should show server validation errors on their fields', async () => {
      await start();
      click('[data-new-item]');
      await ui();
      valid();
      save();
      await answer(http, `${ADMIN}/menu-items`, { code: 'validation_error', fieldErrors: [{ field: 'name', message: 'tamaño inválido' }] }, { status: 400, statusText: 'Bad Request' }, 'POST');
      await ui();
      expect(text()).toContain('tamaño inválido');
    });
  });
});
