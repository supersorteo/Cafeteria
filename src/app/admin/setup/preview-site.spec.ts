import { NonNullableFormBuilder } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { makeSettings } from '../../testing/site-admin.fixture';
import { applySettings, createSiteForm } from '../site/site-form';
import { buildPreviewSite } from './preview-site';

function draftOf(overrides: Partial<ReturnType<ReturnType<typeof createSiteForm>['getRawValue']>> = {}) {
  const fb = TestBed.inject(NonNullableFormBuilder);
  const form = createSiteForm(fb);
  applySettings(form, fb, makeSettings(), true);
  return { ...form.getRawValue(), ...overrides };
}

describe('buildPreviewSite', () => {
  const saved = makeSettings();
  const images = saved.images;

  it('should map the saved settings and images into the public site shape', () => {
    const site = buildPreviewSite(saved, draftOf(), { ...images, logo: { id: 'l1', url: '/media/l1' } }, []);
    expect(site.name).toBe('Negocio A');
    expect(site.slug).toBe('negocio-a');
    expect(site.theme).toEqual({ primaryColor: '#FF5C39', accentColor: '#0E8388' });
    expect(site.hero).toEqual({ title: 'Donde la noche\n*sabe mejor*', description: 'Descripción', caption: 'Una noche', imageUrl: '/media/h1' });
    expect(site.about).toEqual({ title: 'Tradición', text: 'Texto de nosotros', imageUrls: ['/media/a1'] });
    expect(site.gallery).toEqual([{ url: '/media/g1', alt: 'Terraza' }]);
    expect(site.logoUrl).toBe('/media/l1');
    expect(site.marquee).toEqual(['Uno', 'Dos']);
    expect(site.stats).toEqual([{ label: 'Años', value: 14 }]);
    expect(site.highlights).toEqual([{ title: 'Terraza', description: 'Aire libre' }]);
    expect(site.reservation).toEqual({ areas: ['Barra'], partySizes: ['2', '4'] });
    expect(site.contact.whatsappNumber).toBe('59899111222');
  });

  it('should reflect unsaved edits of the draft as the user types', () => {
    const site = buildPreviewSite(saved, draftOf({ name: '  Café Nuevo ', tagline: 'Otra frase', primaryColor: '#112233' }), images, []);
    expect(site.name).toBe('Café Nuevo');
    expect(site.tagline).toBe('Otra frase');
    expect(site.theme.primaryColor).toBe('#112233');
  });

  it('should turn blank fields into null and drop empty list entries', () => {
    const site = buildPreviewSite(
      saved,
      draftOf({ tagline: '   ', phone: '', marqueeItems: ['  ', 'Música'], reservationAreas: [' '], stats: [{ label: ' ', value: 1 }], highlights: [{ title: '', description: 'x' }] }),
      images,
      [],
    );
    expect(site.tagline).toBeNull();
    expect(site.contact.phone).toBeNull();
    expect(site.marquee).toEqual(['Música']);
    expect(site.reservation.areas).toEqual([]);
    expect(site.stats).toEqual([]);
    expect(site.highlights).toEqual([]);
  });

  it('should keep the saved color while the typed one is not a valid hex and never invent a name', () => {
    const site = buildPreviewSite(saved, draftOf({ primaryColor: 'rojo', accentColor: '#12', name: '   ' }), images, []);
    expect(site.theme).toEqual({ primaryColor: saved.primaryColor, accentColor: saved.accentColor });
    expect(site.name).toBe(saved.name);
  });

  it('should show no logo and no hero photo when the business has none', () => {
    const site = buildPreviewSite(saved, draftOf(), { hero: null, logo: null, about: [], gallery: [] }, []);
    expect(site.logoUrl).toBeNull();
    expect(site.hero.imageUrl).toBeNull();
    expect(site.gallery).toEqual([]);
  });

  it('should pass the menu categories through', () => {
    const categories = [{ id: 'c1', name: 'Cocteles', items: [] }];
    expect(buildPreviewSite(saved, draftOf(), images, categories).categories).toBe(categories);
  });
});
