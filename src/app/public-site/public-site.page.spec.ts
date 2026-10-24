import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { makeSite } from '../testing/site.fixture';
import { PublicSitePage } from './public-site.page';

const api = (slug: string) => `/api/v1/public/sites/${slug}`;

describe('PublicSitePage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  const text = () => (harness.routeNativeElement as HTMLElement).textContent ?? '';

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: ':slug', component: PublicSitePage }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    harness = await RouterTestingHarness.create();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should show a loading state and then the site', async () => {
    await harness.navigateByUrl('/cafe-demo');
    expect(text()).toContain('Cargando');

    http.expectOne(api('cafe-demo')).flush(makeSite());
    harness.detectChanges();

    expect(text()).not.toContain('Cargando');
    expect((harness.routeNativeElement as HTMLElement).querySelector('h1')?.textContent).toContain('Donde la noche');
    expect(document.title).toBe('Café Demo — Reservas por WhatsApp');
  });

  it('should show not found for a 404 and not the generic error', async () => {
    await harness.navigateByUrl('/no-existe');
    http.expectOne(api('no-existe')).flush({ code: 'not_found' }, { status: 404, statusText: 'Not Found' });
    harness.detectChanges();

    expect(text()).toContain('No encontramos');
    expect(text()).not.toContain('No pudimos cargar');
  });

  it('should show a recoverable error for a server failure, never a fake 404 or demo content', async () => {
    await harness.navigateByUrl('/cafe-demo');
    http.expectOne(api('cafe-demo')).flush('boom', { status: 500, statusText: 'Server Error' });
    harness.detectChanges();

    expect(text()).toContain('No pudimos cargar el sitio');
    expect(text()).not.toContain('No encontramos');
    expect(text()).not.toContain('Café Demo');
    expect(text()).not.toContain('Donde la noche');
  });

  it('should treat a network failure as a recoverable error and let the user retry', async () => {
    await harness.navigateByUrl('/cafe-demo');
    http.expectOne(api('cafe-demo')).error(new ProgressEvent('error'));
    harness.detectChanges();
    expect(text()).toContain('No pudimos cargar el sitio');

    const retry = (harness.routeNativeElement as HTMLElement).querySelector('button') as HTMLButtonElement;
    retry.click();
    harness.detectChanges();
    expect(text()).toContain('Cargando');

    http.expectOne(api('cafe-demo')).flush(makeSite());
    harness.detectChanges();
    expect(text()).toContain('Café Demo');
  });

  it('should cancel the previous request when navigating to another business', async () => {
    await harness.navigateByUrl('/negocio-a');
    const requestA = http.expectOne(api('negocio-a'));

    await harness.navigateByUrl('/negocio-b');
    expect(requestA.cancelled).toBe(true);
    http.expectOne(api('negocio-b')).flush(makeSite({ slug: 'negocio-b', name: 'Negocio B' }));
    harness.detectChanges();

    expect(text()).toContain('Negocio B');
    expect(text()).not.toContain('Café Demo');
  });

  it('should not keep showing the previous business while the next one loads', async () => {
    await harness.navigateByUrl('/negocio-a');
    http.expectOne(api('negocio-a')).flush(makeSite({ name: 'Negocio A' }));
    harness.detectChanges();
    expect(text()).toContain('Negocio A');

    await harness.navigateByUrl('/negocio-b');
    expect(text()).not.toContain('Negocio A');
    expect(text()).toContain('Cargando');
    http.expectOne(api('negocio-b')).flush(makeSite({ name: 'Negocio B' }), { status: 200, statusText: 'OK' });
  });

  it('should encode the slug in the request URL', async () => {
    await harness.navigateByUrl('/a%20b');
    http.expectOne(api('a%20b')).flush({}, { status: 404, statusText: 'Not Found' });
  });
});
