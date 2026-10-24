import { formatReservationDate, tagColor, titleParts, todayInZone } from './site-format';

describe('titleParts', () => {
  it('should mark emphasized segments and line breaks without producing HTML', () => {
    expect(titleParts('Donde la noche\n*sabe mejor*')).toEqual([
      { text: 'Donde la noche', emphasis: false, lineBreak: false },
      { text: '', emphasis: false, lineBreak: true },
      { text: 'sabe mejor', emphasis: true, lineBreak: false },
    ]);
  });

  it('should emphasize in the middle of a line', () => {
    expect(titleParts('Tradición, *fuego* y más').map(part => [part.text, part.emphasis])).toEqual([
      ['Tradición, ', false],
      ['fuego', true],
      [' y más', false],
    ]);
  });

  it('should keep markup characters as plain text', () => {
    const [part] = titleParts('<img src=x onerror=alert(1)>');
    expect(part).toEqual({ text: '<img src=x onerror=alert(1)>', emphasis: false, lineBreak: false });
  });
});

describe('tagColor', () => {
  it('should be deterministic and always return a palette color', () => {
    expect(tagColor('Clásico')).toBe(tagColor('Clásico'));
    expect(tagColor('Cualquier cosa')).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe('todayInZone', () => {
  it('should use the tenant time zone, not the browser one', () => {
    const instant = new Date('2026-01-01T02:30:00Z');
    expect(todayInZone('America/Montevideo', instant)).toBe('2025-12-31');
    expect(todayInZone('Europe/Madrid', instant)).toBe('2026-01-01');
  });

  it('should not break with an invalid zone', () => {
    expect(todayInZone('Marte/Olympus', new Date('2026-05-05T12:00:00Z'))).toBe('2026-05-05');
  });
});

describe('formatReservationDate', () => {
  it('should format the chosen day in the tenant locale without shifting it', () => {
    const formatted = formatReservationDate('2026-03-05', 'es-UY');
    expect(formatted).toContain('2026');
    expect(formatted).toContain('marzo');
    expect(formatted).toContain('5');
  });
});
