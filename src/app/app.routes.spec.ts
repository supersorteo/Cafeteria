import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { NotFound } from './not-found/not-found';
import { PublicSitePage } from './public-site/public-site.page';
import { makeSite } from './testing/site.fixture';

describe('routes', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    harness = await RouterTestingHarness.create();
    http = TestBed.inject(HttpTestingController);
  });

  it('should show the platform home at the root with links to register and sign in', async () => {
    await harness.navigateByUrl('/');
    http.expectOne('/api/v1/auth/csrf').flush({});
    await new Promise(resolve => setTimeout(resolve));
    http.expectOne('/api/v1/auth/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    await new Promise(resolve => setTimeout(resolve));
    harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/');
    const root = harness.routeNativeElement as HTMLElement;
    expect(root.querySelector('#homeRegister')?.getAttribute('href')).toBe('/auth/register');
    expect(root.querySelector('#homeLogin')?.getAttribute('href')).toBe('/auth/login');
    expect(root.querySelector('#homeDemo')?.getAttribute('href')).toBe('/la-terraza');
  });

  it('should load any business by its slug', async () => {
    const component = await harness.navigateByUrl('/cafe-demo');
    expect(component).toBeInstanceOf(PublicSitePage);
    http.expectOne('/api/v1/public/sites/cafe-demo').flush(makeSite());
    harness.detectChanges();
    expect((harness.routeNativeElement as HTMLElement).querySelector('h1')?.textContent).toContain('Donde la noche');
  });

  it('should show not found for paths with more than one segment', async () => {
    const component = await harness.navigateByUrl('/uno/dos');
    expect(component).toBeInstanceOf(NotFound);
    expect((harness.routeNativeElement as HTMLElement).textContent).toContain('No encontramos');
  });
});
