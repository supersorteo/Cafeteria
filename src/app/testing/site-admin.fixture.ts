import { SiteSettingsDetail } from '../core/site-admin.models';

export function makeSettings(overrides: Partial<SiteSettingsDetail> = {}): SiteSettingsDetail {
  return {
    slug: 'negocio-a',
    published: false,
    name: 'Negocio A',
    whatsappNumber: '59899111222',
    phone: '+598 99 111 222',
    email: 'hola@a.test',
    address: 'Calle 1 123',
    schedule: 'Lun a Vie 18-02',
    currency: 'UYU',
    locale: 'es-UY',
    timezone: 'America/Montevideo',
    primaryColor: '#ff5c39',
    accentColor: '#0e8388',
    heroTitle: 'Donde la noche\n*sabe mejor*',
    heroDescription: 'Descripción',
    aboutText: 'Texto de nosotros',
    version: 4,
    images: {
      hero: { id: 'h1', url: '/media/h1' },
      about: [{ id: 'a1', url: '/media/a1' }],
      gallery: [{ id: 'g1', url: '/media/g1', alt: 'Terraza' }],
      logo: null,
    },
    descriptor: 'Bar & Cocina',
    tagline: 'Desde 2012',
    aboutTitle: 'Tradición',
    footerText: 'Pie',
    heroCaption: 'Una noche',
    marqueeItems: ['Uno', 'Dos'],
    partySizes: ['2', '4'],
    stats: [{ label: 'Años', value: 14 }],
    spaces: [{ id: 's1', name: 'Terraza', description: 'Aire libre', image: null, bookable: true }],
    ...overrides,
  };
}
