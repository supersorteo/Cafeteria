import type { CornerDotType, CornerSquareType, DotType, Options } from 'qr-code-styling';
import { QrStyle } from './qr-style.api';

export function buildQrOptions(style: QrStyle, data: string, logoUrl: string | null, size: number, margin: number): Partial<Options> {
  const background = style.backgroundMode === 'transparent'
    ? { color: 'transparent' }
    : style.backgroundMode === 'gradient'
      ? { gradient: { type: 'linear' as const, rotation: 0, colorStops: [{ offset: 0, color: style.backgroundColor }, { offset: 1, color: '#f2c46d' }] } }
      : { color: style.backgroundColor };
  return {
    type: 'svg',
    width: size,
    height: size,
    margin,
    data,
    image: style.useLogo && logoUrl ? logoUrl : undefined,
    qrOptions: { errorCorrectionLevel: 'H' },
    imageOptions: { hideBackgroundDots: true, imageSize: .25, margin: 8, crossOrigin: 'anonymous' },
    dotsOptions: { type: style.dotType as DotType, color: style.dotColor },
    cornersSquareOptions: { type: style.cornerType as CornerSquareType, color: style.dotColor },
    cornersDotOptions: { type: style.cornerType as CornerDotType, color: style.dotColor },
    backgroundOptions: background,
  };
}
