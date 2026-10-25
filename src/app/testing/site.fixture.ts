import { SiteData } from '../core/site.models';

export function makeSite(overrides: Partial<SiteData> = {}): SiteData {
  return {
    slug: 'cafe-demo',
    name: 'Café Demo',
    descriptor: 'Bar & Cocina',
    tagline: 'Desde 2012 · Hecho a mano',
    footerText: 'Cocina de temporada.',
    currency: 'UYU',
    locale: 'es-UY',
    timezone: 'America/Montevideo',
    theme: { primaryColor: '#112233', accentColor: '#445566' },
    contact: {
      whatsappNumber: '59899111222',
      phone: '+598 99 111 222',
      email: 'hola@cafedemo.test',
      address: 'Calle 1 123',
      schedule: 'Lun a Vie · 18 a 02\nSáb · 18 a 03',
    },
    hero: {
      title: 'Donde la noche\n*sabe mejor*',
      description: 'Cocteles y platos de temporada.',
      caption: 'Una noche para disfrutar',
      imageUrl: '/media/hero',
    },
    about: { title: 'Tradición, *fuego*\ny compañía', text: 'Texto de nosotros.', imageUrls: ['/media/a1', '/media/a2', '/media/a3'] },
    logoUrl: null,
    gallery: [
      { url: '/media/g1', alt: 'Terraza' },
      { url: '/media/g2', alt: null },
    ],
    marquee: ['Música en vivo', 'Happy hour'],
    stats: [
      { label: 'Años', value: 14 },
      { label: 'Destilados', value: 120 },
    ],
    spaces: [
      { name: 'Terraza', description: 'Aire libre', imageUrl: '/media/s1', bookable: true },
      { name: 'Barra', description: null, imageUrl: null, bookable: true },
      { name: 'Happy hour', description: 'Martes a jueves', imageUrl: null, bookable: false },
    ],
    reservation: { areas: ['Terraza', 'Barra'], partySizes: ['2', '4', '+10'] },
    categories: [
      {
        id: 'c1',
        name: 'Cocteles',
        items: [
          { id: 'i1', name: 'Negroni', description: 'Gin y vermut', price: 180, tag: 'Clásico', imageUrl: '/media/i1' },
          { id: 'i2', name: 'Spritz', description: null, price: 150.5, tag: null, imageUrl: '/media/i2' },
        ],
      },
      {
        id: 'c2',
        name: 'Postres',
        items: [{ id: 'i3', name: 'Flan', description: 'Casero', price: 90, tag: 'Dulce', imageUrl: null }],
      },
      { id: 'c3', name: 'Vacía', items: [] },
    ],
    ...overrides,
  };
}

export function emptySite(): SiteData {
  return makeSite({
    descriptor: null,
    tagline: null,
    footerText: null,
    contact: { whatsappNumber: '59899111222', phone: null, email: null, address: null, schedule: null },
    hero: { title: null, description: null, caption: null, imageUrl: null },
    about: { title: null, text: null, imageUrls: [] },
    logoUrl: null,
    gallery: [],
    marquee: [],
    stats: [],
    spaces: [],
    reservation: { areas: [], partySizes: [] },
    categories: [],
  });
}
