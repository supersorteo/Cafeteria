export interface TitlePart {
  text: string;
  emphasis: boolean;
  lineBreak: boolean;
}

export function titleParts(raw: string): TitlePart[] {
  const parts: TitlePart[] = [];
  const lines = raw.split('\n');
  lines.forEach((line, lineIndex) => {
    line.split('*').forEach((segment, index) => {
      if (segment) {
        parts.push({ text: segment, emphasis: index % 2 === 1, lineBreak: false });
      }
    });
    if (lineIndex < lines.length - 1) {
      parts.push({ text: '', emphasis: false, lineBreak: true });
    }
  });
  return parts;
}

const TAG_PALETTE = ['#0E8388', '#FF5C39', '#FFB020', '#E63946', '#3D1D2E', '#7A3FA0', '#3E9B4F'];

export function tagColor(tag: string): string {
  let hash = 0;
  for (const char of tag) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}

export function todayInZone(timeZone: string, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function formatReservationDate(isoDate: string, locale: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function hexToRgb(hex: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) {
    return null;
  }
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function rgbTriplet(hex: string, fallback: string): string {
  const rgb = hexToRgb(hex);
  return rgb ? rgb.join(' ') : fallback;
}

export function readableOn(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return '255 255 255';
  }
  const [r, g, b] = rgb.map(channel => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.5 ? '42 20 32' : '255 255 255';
}
