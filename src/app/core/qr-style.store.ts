import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { DEFAULT_QR_STYLE, QrBackgroundMode, QrCornerType, QrDotType, QrStyle } from './qr-style.api';

@Injectable({ providedIn: 'root' })
export class QrStyleStore {
  private readonly auth = inject(AuthService);

  readonly style = computed<QrStyle>(() => {
    const saved = this.auth.user()?.qr;
    if (!saved) {
      return DEFAULT_QR_STYLE;
    }
    return {
      dotType: (saved.dotType as QrDotType | null) ?? DEFAULT_QR_STYLE.dotType,
      cornerType: (saved.cornerType as QrCornerType | null) ?? DEFAULT_QR_STYLE.cornerType,
      dotColor: saved.dotColor ?? DEFAULT_QR_STYLE.dotColor,
      backgroundMode: (saved.backgroundMode as QrBackgroundMode | null) ?? DEFAULT_QR_STYLE.backgroundMode,
      backgroundColor: saved.backgroundColor ?? DEFAULT_QR_STYLE.backgroundColor,
      useLogo: saved.useLogo,
    };
  });
}
