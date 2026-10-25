import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { answer, settle } from '../../testing/http';
import { MenuPage } from './menu.page';

const ADMIN = '/api/v1/admin';

describe('MenuPage (vuelta al asistente)', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  async function open(url: string) {
    await harness.navigateByUrl(url);
    await answer(http, `${ADMIN}/site`, { currency: 'UYU', locale: 'es-UY', slug: 'negocio-a' });
    await answer(http, `${ADMIN}/categories`, []);
    await settle();
    harness.detectChanges();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'admin/menu', component: MenuPage }]), provideHttpClient(), provideHttpClientTesting()],
    });
    harness = await RouterTestingHarness.create();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should offer to go back to the setup assistant when the user came from it', async () => {
    await open('/admin/menu?from=setup');
    const link = (harness.routeNativeElement as HTMLElement).querySelector('[data-back-setup]');
    expect(link?.getAttribute('href')).toBe('/admin/setup?paso=menu');
    expect(link?.textContent).toContain('Volver a la configuración');
  });

  it('should not show the link on a regular visit', async () => {
    await open('/admin/menu');
    expect((harness.routeNativeElement as HTMLElement).querySelector('[data-back-setup]')).toBeNull();
  });
});
