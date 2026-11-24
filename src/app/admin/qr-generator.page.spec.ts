import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '../core/auth.service';
import { NoticeService } from '../core/notice.service';
import { answer, settle } from '../testing/http';
import { makeMe } from '../testing/http';
import { QrGeneratorPage } from './qr-generator.page';

const QR = '/api/v1/admin/qr';

describe('QrGeneratorPage', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<QrGeneratorPage>;
  let notices: NoticeService;
  const canEdit = signal(true);
  const refreshUser = vi.fn().mockResolvedValue(undefined);
  const user = signal(makeMe({ tenant: { id: 't1', slug: 'negocio-a', name: 'Negocio A', published: true, logoUrl: '/media/logo' } }));

  const root = () => fixture.nativeElement as HTMLElement;
  const ui = async () => {
    for (let i = 0; i < 3; i++) {
      await settle();
      fixture.detectChanges();
    }
  };

  async function open(saved: object = { useLogo: false, customizable: true }) {
    fixture = TestBed.createComponent(QrGeneratorPage);
    fixture.detectChanges();
    await answer(http, QR, saved);
    await ui();
  }

  beforeEach(() => {
    canEdit.set(true);
    refreshUser.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { user, canEditSite: canEdit, refreshUser } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    notices = TestBed.inject(NoticeService);
  });

  afterEach(() => {
    notices.dismiss();
    http.verify();
  });

  it('should load the saved design from the server when it opens', async () => {
    await open({ dotType: 'rounded', cornerType: 'extra-rounded', dotColor: '#AA0000', backgroundMode: 'gradient', backgroundColor: '#FFEEDD', useLogo: true, customizable: true });

    const selects = root().querySelectorAll<HTMLSelectElement>('[data-qr-style] select');
    expect(selects[0].value).toBe('rounded');
    expect(selects[1].value).toBe('extra-rounded');
    expect((root().querySelector('[data-qr-logo]') as HTMLInputElement).checked).toBe(true);
  });

  it('should keep the defaults when nothing was saved yet', async () => {
    await open();

    expect(root().querySelector<HTMLSelectElement>('[data-qr-style] select')!.value).toBe('dots');
    expect((root().querySelector('[data-qr-logo]') as HTMLInputElement).checked).toBe(false);
  });

  it('should save the chosen design and confirm it', async () => {
    await open({ dotType: 'classy', cornerType: 'square', dotColor: '#111827', backgroundMode: 'solid', backgroundColor: '#FFFFFF', useLogo: false, customizable: true });

    (root().querySelector('[data-qr-save]') as HTMLElement).click();
    const request = await answer(http, QR, { useLogo: false, customizable: true }, {}, 'PUT');
    await ui();

    expect(request.request.body).toEqual({
      dotType: 'classy', cornerType: 'square', dotColor: '#111827', backgroundMode: 'solid', backgroundColor: '#FFFFFF', useLogo: false,
    });
    expect(refreshUser).toHaveBeenCalledTimes(1);
    expect(notices.notice()?.text).toContain('Diseño del QR guardado');
  });

  it('should let an editor try the design but not save it', async () => {
    canEdit.set(false);
    await open();

    expect(root().querySelector('[data-qr-save]')).toBeNull();
    expect(root().querySelector('[data-qr-readonly]')).not.toBeNull();
  });

  it('should report that the plan does not allow it when the server refuses to save', async () => {
    await open();

    (root().querySelector('[data-qr-save]') as HTMLElement).click();
    await answer(http, QR, { code: 'plan_feature_unavailable' }, { status: 403, statusText: 'Forbidden' }, 'PUT');
    await ui();

    expect(notices.notice()?.text).toContain('no incluye personalizar el QR');
  });

  it('should not offer the business logo when none was uploaded', async () => {
    user.update(me => ({ ...me, tenant: { ...me.tenant, logoUrl: null } }));
    await open();

    expect((root().querySelector('[data-qr-logo]') as HTMLInputElement).disabled).toBe(true);
    user.update(me => ({ ...me, tenant: { ...me.tenant, logoUrl: '/media/logo' } }));
  });
});
