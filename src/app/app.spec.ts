import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';
import { answer, answerCsrf, answerMatching, settle } from './testing/http';

const ME = '/api/v1/superadmin/auth/me';

describe('App (atajo del superadmin)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    document.querySelectorAll('dialog').forEach(d => d.remove());
    http.verify();
  });

  function press(init: KeyboardEventInit): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    document.dispatchEvent(event);
    return event;
  }

  async function render() {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  async function ui(fixture: Awaited<ReturnType<typeof render>>) {
    for (let i = 0; i < 4; i++) {
      await settle();
      fixture.detectChanges();
    }
  }

  it('should open the restricted access modal with Ctrl+Alt+P', async () => {
    const fixture = await render();

    const event = press({ code: 'KeyP', ctrlKey: true, altKey: true });
    expect(event.defaultPrevented).toBe(true);
    await answerCsrf(http);
    await answer(http, ME, { code: 'unauthenticated' }, { status: 401, statusText: 'Unauthorized' });
    let dialog: HTMLDialogElement | null = null;
    for (let attempt = 0; attempt < 100 && !dialog; attempt++) {
      await ui(fixture);
      dialog = document.querySelector('dialog');
    }

    expect(dialog).not.toBeNull();
    expect(dialog!.textContent).toContain('Acceso restringido');
    expect(dialog!.querySelector('[data-step-credentials]')).not.toBeNull();
  });

  it('should ignore every other key combination', async () => {
    const fixture = await render();

    for (const init of [
      { code: 'KeyP', ctrlKey: true },
      { code: 'KeyP', altKey: true },
      { code: 'KeyP', ctrlKey: true, altKey: true, shiftKey: true },
      { code: 'KeyO', ctrlKey: true, altKey: true },
    ]) {
      expect(press(init).defaultPrevented).toBe(false);
    }
    await ui(fixture);
    expect(document.querySelector('dialog')).toBeNull();
  });

  it('should go straight to the panel when the superadmin already has a session', async () => {
    const fixture = await render();
    const router = TestBed.inject(Router);

    press({ code: 'KeyP', ctrlKey: true, altKey: true });
    await answerCsrf(http);
    await answer(http, ME, { email: 'root@plataforma.test' });
    await answerMatching(http, r => r.url === '/api/v1/superadmin/tenants', 'tenants', { content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 });
    await answer(http, '/api/v1/superadmin/stats', { total: 0, active: 0, suspended: 0, published: 0, newLast7Days: 0 });
    await ui(fixture);

    expect(router.url).toBe('/superadmin');
    expect(document.querySelector('dialog')).toBeNull();
  });
});
