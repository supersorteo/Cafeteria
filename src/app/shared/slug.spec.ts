import { RESERVED_SLUGS, SLUG_PATTERN, slugify } from './slug';

describe('slugify', () => {
  it('should turn a business name into a valid address', () => {
    expect(slugify('Café La Terraza & Cocina')).toBe('cafe-la-terraza-cocina');
    expect(slugify('  ¡Bar   Ñandú!  ')).toBe('bar-nandu');
    expect(slugify('Año 2012')).toBe('ano-2012');
  });

  it('should always produce something the backend accepts or an empty string', () => {
    for (const name of ['---', 'Mi   Negocio--Raro', 'x'.repeat(100), '日本語']) {
      const slug = slugify(name);
      expect(slug === '' || SLUG_PATTERN.test(slug)).toBe(true);
      expect(slug.length).toBeLessThanOrEqual(63);
    }
  });

  it('should mirror the reserved words of the backend', () => {
    expect(RESERVED_SLUGS).toEqual(expect.arrayContaining(['admin', 'auth', 'api', 'media']));
  });
});
