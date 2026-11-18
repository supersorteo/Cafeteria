import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { NoticeService } from '../core/notice.service';
import { ActivationCode } from '../core/superadmin.api';
import { answer, answerMatching, fail, settle } from '../testing/http';
import { SuperAdminCodes } from './superadmin-codes';

const API = '/api/v1/superadmin/codes';
const code = (overrides: Partial<ActivationCode> = {}): ActivationCode => ({
  id: 'c1', code: 'DLR-ABCD-2345', durationMonths: 3, status: 'AVAILABLE', batchId: 'b1', batchLabel: 'Promo', createdAt: '2026-11-01T12:00:00Z',
  redeemedAt: null, redeemedByEmail: null, tenantSlug: null, tenantName: null, tenantCreatedAt: null, planExpiresAt: null, planStatus: null, ...overrides,
});
const page = (content: ActivationCode[], extra: object = {}) => ({ content, page: 0, size: 10, totalElements: content.length, totalPages: 1, ...extra });
const stats = { available: 5, redeemed: 2, disabled: 1, plansExpiringSoon: 1, plansExpired: 0 };
const batches = [{ id: 'b1', label: 'Promo', durationMonths: 3, quantity: 6, note: null, createdBy: 'root', createdAt: '2026-11-01T12:00:00Z', available: 5, redeemed: 1, disabled: 0 }];

describe('SuperAdminCodes', () => {
  let http: HttpTestingController;
  let notices: NoticeService;
  let fixture: ComponentFixture<SuperAdminCodes>;

  const root = () => fixture.nativeElement as HTMLElement;
  const click = (selector: string) => (root().querySelector(selector) as HTMLElement).click();
  const dialog = () => document.querySelector('dialog') as HTMLDialogElement | null;
  const ui = async () => {
    for (let i = 0; i < 3; i++) {
      await settle();
      fixture.detectChanges();
    }
  };
  const set = (selector: string, value: string) => {
    const field = root().querySelector(selector) as HTMLInputElement;
    field.value = value;
    field.dispatchEvent(new Event('input'));
    field.dispatchEvent(new Event('change'));
  };

  async function open(rows = [code(), code({ id: 'c2', code: 'DLR-WXYZ-6789', status: 'REDEEMED', tenantSlug: 'bar', tenantName: 'Bar', redeemedByEmail: 'o@bar.test', redeemedAt: '2026-11-02T12:00:00Z', tenantCreatedAt: '2026-11-02T12:00:00Z', planExpiresAt: '2027-02-02T12:00:00Z', planStatus: 'ACTIVE' })]) {
    fixture = TestBed.createComponent(SuperAdminCodes);
    fixture.detectChanges();
    await answerMatching(http, r => r.url === API, 'GET codes', page(rows));
    await answer(http, `${API}/stats`, stats);
    await answer(http, `${API}/batches`, batches);
    await ui();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    notices = TestBed.inject(NoticeService);
  });

  afterEach(() => {
    document.querySelectorAll('dialog').forEach(d => d.remove());
    notices.dismiss();
    http.verify();
  });

  it('should show the summary and list the codes with who redeemed them', async () => {
    await open();

    expect(root().querySelector('[data-code-stats]')?.textContent).toContain('Disponibles');
    const rows = Array.from(root().querySelectorAll('[data-code-cards] [data-code-row]'));
    expect(rows.map(r => r.getAttribute('data-code'))).toEqual(['DLR-ABCD-2345', 'DLR-WXYZ-6789']);
    expect(rows[0].textContent).toContain('Disponible');
    expect(rows[1].textContent).toContain('Canjeado');
    expect(rows[1].textContent).toContain('o@bar.test');
    expect(root().querySelectorAll('[data-code-cards] [data-code-row]').length).toBe(2);
  });

  it('should show the business, email, registration date and expiry of every redeemed code card', async () => {
    await open();
    const row = root().querySelector('[data-code-cards] [data-code="DLR-WXYZ-6789"]')!;

    expect(row.querySelector('[data-code-business]')?.textContent).toContain('Bar');
    expect(row.querySelector('[data-code-business]')?.textContent).toContain('/bar');
    expect(row.querySelector('[data-code-email]')?.textContent).toContain('o@bar.test');
    expect(row.querySelector('[data-code-registered]')?.textContent).toContain('02/11/2026');
    expect(row.querySelector('[data-code-expires]')?.textContent).toContain('02/02/2027');
    const card = root().querySelector('[data-code-cards] [data-code="DLR-WXYZ-6789"]')!;
    expect(card.querySelector('[data-code-detail]')?.textContent).toContain('o@bar.test');
    expect(card.querySelector('[data-code-detail]')?.textContent).toContain('Vence el 02/02/2027');
    const free = root().querySelector('[data-code-cards] [data-code="DLR-ABCD-2345"]')!;
    expect(free.querySelector('[data-code-email]')).toBeNull();
    expect(free.textContent).toContain('Sin usar');
  });

  it('should mark an expired plan in red on the code row', async () => {
    await open([code({ id: 'c2', code: 'DLR-WXYZ-6789', status: 'REDEEMED', tenantSlug: 'bar', tenantName: 'Bar', redeemedByEmail: 'o@bar.test', redeemedAt: '2026-10-02T12:00:00Z', planExpiresAt: '2026-11-02T12:00:00Z', planStatus: 'EXPIRED' })]);

    const expires = root().querySelector('[data-code-cards] [data-code-expires]')!;
    expect(expires.textContent).toContain('Venció el');
    expect(expires.classList.contains('text-danger')).toBe(true);
  });

  it('should show numbered pages with ellipsis and jump to the chosen page', async () => {
    fixture = TestBed.createComponent(SuperAdminCodes);
    fixture.detectChanges();
    await answerMatching(http, r => r.url === API, 'GET codes', page([code()], { totalElements: 240, totalPages: 20, page: 9, size: 12 }));
    await answer(http, `${API}/stats`, stats);
    await answer(http, `${API}/batches`, batches);
    await ui();

    const labels = Array.from(root().querySelectorAll('[data-code-pager="top"] nav button, [data-code-pager="top"] nav span')).map(e => e.textContent?.trim());
    expect(labels).toEqual(['Anterior', '1', '…', '9', '10', '11', '…', '20', 'Siguiente']);
    expect(root().querySelectorAll('[data-code-pager]').length).toBe(2);
    expect(root().querySelector('[data-code-pager="top"] [aria-current="page"]')?.textContent?.trim()).toBe('10');

    click('[data-code-pager="top"] [data-code-page="20"]');
    const request = await answerMatching(http, r => r.url === API && r.params.get('page') === '19', 'page 20', page([code()], { totalPages: 20, page: 19 }));
    await ui();

    expect(request.request.params.get('size')).toBe('12');
  });

  it('should start with one code in the quantity field', async () => {
    await open();
    expect((root().querySelector('#gen-quantity') as HTMLInputElement).value).toBe('1');
  });

  it('should refresh by itself, without a loading flicker, so a code redeemed by a new business appears on its own', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      await open([code()]);
      expect(root().querySelectorAll('[data-code-cards] [data-code-row]').length).toBe(1);
      expect(root().querySelector('[data-updated]')?.textContent).toContain('se refresca solo');

      vi.advanceTimersByTime(5000);
      await answerMatching(http, r => r.url === API, 'auto refresh', page([
        code({ id: 'c2', code: 'DLR-WXYZ-6789', status: 'REDEEMED', tenantSlug: 'nuevo', tenantName: 'Café Nuevo', redeemedByEmail: 'nuevo@cafe.test', redeemedAt: '2026-11-17T12:00:00Z', planExpiresAt: '2027-02-17T12:00:00Z', planStatus: 'ACTIVE' }),
        code(),
      ]));
      await answer(http, `${API}/stats`, { ...stats, redeemed: 3 });
      await answer(http, `${API}/batches`, batches);
      await ui();

      expect(root().querySelectorAll('[data-code-cards] [data-code-row]').length).toBe(2);
      expect(root().querySelector('[data-code-cards] [data-code="DLR-WXYZ-6789"]')?.textContent).toContain('nuevo@cafe.test');
      expect(root().querySelector('[data-code-stats]')?.textContent).toContain('3');
      expect(root().querySelector('[data-code-cards]')?.className).not.toContain('opacity-60');
    } finally {
      vi.useRealTimers();
    }
  });

  it('should not poll while the tab is hidden or a confirmation is open', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      await open();
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      vi.advanceTimersByTime(15000);
      await settle();
      http.expectNone(r => r.url === API);

      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      click('[data-code-cards] [data-code="DLR-ABCD-2345"] [data-disable]');
      await ui();
      vi.advanceTimersByTime(15000);
      await settle();
      http.expectNone(r => r.url === API);
    } finally {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      vi.useRealTimers();
    }
  });

  it('should refresh on demand with the button', async () => {
    await open();
    click('[data-refresh]');
    await answerMatching(http, r => r.url === API, 'manual refresh', page([code()]));
    await answer(http, `${API}/stats`, stats);
    await answer(http, `${API}/batches`, batches);
    await ui();

    expect(root().querySelectorAll('[data-code-cards] [data-code-row]').length).toBe(1);
  });

  it('should offer to disable and delete redeemed codes too, since they govern the business', async () => {
    await open();
    const redeemed = root().querySelector('[data-code-cards] [data-code="DLR-WXYZ-6789"]')!;

    expect(redeemed.querySelector('[data-disable]')).not.toBeNull();
    expect(redeemed.querySelector('[data-delete-code]')).not.toBeNull();
    expect(redeemed.querySelector('[data-copy]')).not.toBeNull();
  });

  it('should warn that disabling a redeemed code suspends the business', async () => {
    await open();
    click('[data-code-cards] [data-code="DLR-WXYZ-6789"] [data-disable]');
    await ui();
    expect(dialog()?.textContent).toContain('se suspende el negocio');

    (dialog()!.querySelector('[data-confirm]') as HTMLElement).click();
    await answer(http, `${API}/c2/disable`, null, { status: 204, statusText: 'No Content' }, 'POST');
    await answerMatching(http, r => r.url === API, 'reload', page([code({ id: 'c2', status: 'DISABLED', tenantSlug: 'bar', tenantName: 'Bar' })]));
    await answer(http, `${API}/stats`, stats);
    await answer(http, `${API}/batches`, batches);
    await ui();

    expect(root().querySelector('[data-code-cards] [data-enable]')).not.toBeNull();
  });

  it('should require typing the business address before deleting a redeemed code and send it', async () => {
    await open();
    click('[data-code-cards] [data-code="DLR-WXYZ-6789"] [data-delete-code]');
    await ui();
    const confirmButton = () => dialog()!.querySelector('[data-confirm]') as HTMLButtonElement;
    expect(dialog()?.textContent).toContain('borra el negocio');
    expect(confirmButton().disabled).toBe(true);

    const input = dialog()!.querySelector('[data-confirm-slug]') as HTMLInputElement;
    input.value = 'otro';
    input.dispatchEvent(new Event('input'));
    await ui();
    expect(confirmButton().disabled).toBe(true);

    input.value = 'bar';
    input.dispatchEvent(new Event('input'));
    await ui();
    confirmButton().click();
    const request = await answer(http, `${API}/c2`, null, { status: 204, statusText: 'No Content' }, 'DELETE');
    await answerMatching(http, r => r.url === API, 'reload', page([code()]));
    await answer(http, `${API}/stats`, stats);
    await answer(http, `${API}/batches`, batches);
    await ui();

    expect(request.request.body).toEqual({ confirmSlug: 'bar' });
  });

  it('should ask for confirmation before generating and send nothing when cancelled', async () => {
    await open();
    set('#gen-quantity', '4');
    await ui();

    click('[data-generate-submit]');
    await ui();
    expect(dialog()?.textContent).toContain('Se crearán 4 códigos');

    (dialog()!.querySelector('[data-cancel]') as HTMLElement).click();
    await ui();
    http.expectNone(r => r.url === `${API}/batches` && r.method === 'POST');
    expect(dialog()).toBeNull();
  });

  it('should generate a batch, show the codes and refresh the list', async () => {
    await open();
    (root().querySelector('#gen-duration') as HTMLSelectElement).value = '12';
    (root().querySelector('#gen-duration') as HTMLSelectElement).dispatchEvent(new Event('change'));
    set('#gen-quantity', '2');
    set('#gen-label', 'Promo anual');
    await ui();

    click('[data-generate-submit]');
    await ui();
    (dialog()!.querySelector('[data-confirm]') as HTMLElement).click();
    const request = await answerMatching(http, r => r.url === `${API}/batches` && r.method === 'POST', 'POST batch',
      { id: 'b9', label: 'Promo anual', durationMonths: 12, codes: ['DLR-AAAA-1111', 'DLR-BBBB-2222'] });
    await answerMatching(http, r => r.url === API, 'reload', page([code()]));
    await answer(http, `${API}/stats`, stats);
    await answer(http, `${API}/batches`, batches);
    await ui();

    expect(request.request.body).toEqual({ label: 'Promo anual', durationMonths: 12, quantity: 2, note: '' });
    expect(root().querySelector('[data-generated-codes]')?.textContent).toContain('DLR-AAAA-1111');
    expect(root().querySelector('[data-generated]')?.textContent).toContain('2 códigos de 1 año');
  });

  it('should not send a batch with an invalid quantity', async () => {
    await open();
    for (const quantity of ['0', '501', '']) {
      set('#gen-quantity', quantity);
      await ui();
      expect((root().querySelector('[data-generate-submit]') as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it('should copy every generated code to the clipboard', async () => {
    await open();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    click('[data-generate-submit]');
    await ui();
    (dialog()!.querySelector('[data-confirm]') as HTMLElement).click();
    await answerMatching(http, r => r.url === `${API}/batches` && r.method === 'POST', 'POST batch',
      { id: 'b9', label: 'x', durationMonths: 3, codes: ['DLR-AAAA-1111', 'DLR-BBBB-2222'] });
    await answerMatching(http, r => r.url === API, 'reload', page([code()]));
    await answer(http, `${API}/stats`, stats);
    await answer(http, `${API}/batches`, batches);
    await ui();

    click('[data-copy-all]');
    await ui();

    expect(writeText).toHaveBeenCalledWith('DLR-AAAA-1111\nDLR-BBBB-2222');
    expect(notices.notice()?.text).toContain('2 códigos copiados');
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  });

  it('should filter by status, duration, batch and search with the server', async () => {
    await open();
    click('[data-code-status="AVAILABLE"]');
    await answerMatching(http, r => r.url === API && r.params.get('status') === 'AVAILABLE', 'status', page([code()]));
    await ui();

    const duration = root().querySelector('[data-code-duration]') as HTMLSelectElement;
    duration.value = '6';
    duration.dispatchEvent(new Event('change'));
    await answerMatching(http, r => r.url === API && r.params.get('durationMonths') === '6', 'duration', page([]));
    await ui();
    expect(root().textContent).toContain('Sin códigos');

    const batch = root().querySelector('[data-code-batch]') as HTMLSelectElement;
    batch.value = 'b1';
    batch.dispatchEvent(new Event('change'));
    await answerMatching(http, r => r.url === API && r.params.get('batchId') === 'b1', 'batch', page([code()]));
    await ui();

    set('[data-code-search]', 'abcd');
    await answerMatching(http, r => r.url === API && r.params.get('query') === 'abcd', 'search', page([code()]));
    await ui();
    expect(root().querySelectorAll('[data-code-cards] [data-code-row]').length).toBe(1);
  });

  it('should ask before disabling and send the request, then reload', async () => {
    await open();
    click('[data-code-cards] [data-code="DLR-ABCD-2345"] [data-disable]');
    await ui();
    expect(dialog()?.textContent).toContain('dejará de servir');

    (dialog()!.querySelector('[data-confirm]') as HTMLElement).click();
    await answer(http, `${API}/c1/disable`, null, { status: 204, statusText: 'No Content' }, 'POST');
    await answerMatching(http, r => r.url === API, 'reload', page([code({ status: 'DISABLED' })]));
    await answer(http, `${API}/stats`, stats);
    await answer(http, `${API}/batches`, batches);
    await ui();

    expect(notices.notice()?.text).toContain('Código deshabilitado');
    expect(root().querySelector('[data-code-cards] [data-enable]')).not.toBeNull();
  });

  it('should explain when the code changed state meanwhile instead of failing silently', async () => {
    await open();
    click('[data-code-cards] [data-code="DLR-ABCD-2345"] [data-delete-code]');
    await ui();

    (dialog()!.querySelector('[data-confirm]') as HTMLElement).click();
    await fail(http, `${API}/c1`, 409, { code: 'code_not_deletable' });
    await answerMatching(http, r => r.url === API, 'reload', page([]));
    await ui();

    expect(notices.notice()?.text).toContain('ya cambió de estado');
  });
});
