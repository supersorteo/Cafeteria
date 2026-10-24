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

  it('should redirect the root to the La Terraza site', async () => {
    await harness.navigateByUrl('/');
    expect(TestBed.inject(Router).url).toBe('/la-terraza');
    http.expectOne('/api/v1/public/sites/la-terraza');
  });

  it('should preserve the fragment when redirecting from the root', async () => {
    await harness.navigateByUrl('/#menu');
    expect(TestBed.inject(Router).url).toBe('/la-terraza#menu');
    http.expectOne('/api/v1/public/sites/la-terraza');
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
