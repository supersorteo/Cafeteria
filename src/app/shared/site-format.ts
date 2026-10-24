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
