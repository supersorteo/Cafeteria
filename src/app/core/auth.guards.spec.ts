import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ME_URL, answerCsrf, fail, makeMe, restoreSession, settle } from '../testing/http';
import { authGuard, guestGuard, safeReturnUrl } from './auth.guards';

@Component({ template: 'panel' })
class Panel {}

@Component({ template: 'login' })
class LoginStub {}

describe('guards', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'admin', canActivate: [authGuard], component: Panel },
          { path: 'admin/:section', canActivate: [authGuard], component: Panel },
          { path: 'auth/login', canActivate: [guestGuard], component: LoginStub },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    harness = await RouterTestingHarness.create();
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => http.verify());

  it('should send anonymous visitors to the login keeping the deep link', async () => {
    const navigation = harness.navigateByUrl('/admin/menu');
    await restoreSession(http, null);
    await navigation;
    expect(router.url).toBe('/auth/login?returnUrl=%2Fadmin%2Fmenu');
  });

  it('should wait for the session restore before deciding, so a reload keeps the user in', async () => {
    const navigation = harness.navigateByUrl('/admin');
    await settle();
    expect(router.url).toBe('/');
    await restoreSession(http, makeMe());
    const component = await navigation;
    expect(component).toBeInstanceOf(Panel);
    expect(router.url).toBe('/admin');
  });

  it('should not log the user out when the server is unreachable', async () => {
    const navigation = harness.navigateByUrl('/admin');
    await answerCsrf(http);
    await fail(http, ME_URL, 503);
    const component = await navigation;
    expect(component).toBeInstanceOf(Panel);
    expect(router.url).toBe('/admin');
  });

  it('should keep authenticated users away from the login page', async () => {
    const navigation = harness.navigateByUrl('/auth/login');
    await restoreSession(http, makeMe());
    await navigation;
    expect(router.url).toBe('/admin');
  });

  it('should let anonymous users reach the login page', async () => {
    const navigation = harness.navigateByUrl('/auth/login');
    await restoreSession(http, null);
    const component = await navigation;
    expect(component).toBeInstanceOf(LoginStub);
  });
});

describe('safeReturnUrl', () => {
  it('should only allow paths inside the admin panel', () => {
    expect(safeReturnUrl('/admin')).toBe('/admin');
    expect(safeReturnUrl('/admin/menu?x=1')).toBe('/admin/menu?x=1');
    expect(safeReturnUrl(null)).toBe('/admin');
    expect(safeReturnUrl('https://evil.example')).toBe('/admin');
    expect(safeReturnUrl('//evil.example/admin')).toBe('/admin');
    expect(safeReturnUrl('/adminx')).toBe('/admin');
    expect(safeReturnUrl('/la-terraza')).toBe('/admin');
  });
});
