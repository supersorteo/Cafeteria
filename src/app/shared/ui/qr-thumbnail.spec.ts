import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth.service';
import { DEFAULT_QR_STYLE } from '../../core/qr-style.api';
import { QrStyleStore } from '../../core/qr-style.store';
import { makeMe } from '../../testing/http';

describe('QrStyleStore', () => {
  const user = signal(makeMe());

  beforeEach(() => {
    user.set(makeMe());
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: { user } }] });
  });

  it('should use the saved design so the sidebar QR matches the generator', () => {
    user.set(makeMe({ qr: { dotType: 'rounded', cornerType: 'extra-rounded', dotColor: '#AA0000', backgroundMode: 'gradient', backgroundColor: '#FFEEDD', useLogo: true } }));

    expect(TestBed.inject(QrStyleStore).style()).toEqual({
      dotType: 'rounded', cornerType: 'extra-rounded', dotColor: '#AA0000', backgroundMode: 'gradient', backgroundColor: '#FFEEDD', useLogo: true,
    });
  });

  it('should fall back to the default design when nothing was saved', () => {
    expect(TestBed.inject(QrStyleStore).style()).toEqual(DEFAULT_QR_STYLE);
    user.set(makeMe({ qr: { dotType: null, cornerType: null, dotColor: null, backgroundMode: null, backgroundColor: null, useLogo: false } }));
    expect(TestBed.inject(QrStyleStore).style()).toEqual(DEFAULT_QR_STYLE);
  });

});
