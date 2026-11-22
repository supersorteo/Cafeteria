import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export type QrDotType = 'square' | 'dots' | 'rounded' | 'classy' | 'classy-rounded' | 'extra-rounded';
export type QrCornerType = 'square' | 'dot' | 'extra-rounded';
export type QrBackgroundMode = 'solid' | 'transparent' | 'gradient';

export interface QrStyle {
  dotType: QrDotType;
  cornerType: QrCornerType;
  dotColor: string;
  backgroundMode: QrBackgroundMode;
  backgroundColor: string;
  useLogo: boolean;
}

export interface QrStyleDetail extends Partial<Omit<QrStyle, 'useLogo'>> {
  useLogo: boolean;
  customizable: boolean;
}

export const DEFAULT_QR_STYLE: QrStyle = {
  dotType: 'dots',
  cornerType: 'dot',
  dotColor: '#111827',
  backgroundMode: 'solid',
  backgroundColor: '#FFFFFF',
  useLogo: false,
};

const API = '/api/v1/admin/qr';

@Injectable({ providedIn: 'root' })
export class QrStyleApi {
  private readonly http = inject(HttpClient);

  get(): Observable<QrStyleDetail> {
    return this.http.get<QrStyleDetail>(API);
  }

  save(style: QrStyle): Observable<QrStyleDetail> {
    return this.http.put<QrStyleDetail>(API, style);
  }
}
