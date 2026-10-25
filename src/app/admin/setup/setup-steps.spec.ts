import { SiteSettingsDetail } from '../../core/site-admin.models';
import { makeSettings } from '../../testing/site-admin.fixture';
import { SetupSnapshot, STEPS, isStepDone, nextPendingStep, progressOf, stepById } from './setup-steps';

const empty = (overrides: Partial<SiteSettingsDetail> = {}): SetupSnapshot => ({
  settings: makeSettings({
    whatsappNumber: null, phone: null, email: null, address: null, schedule: null, footerText: null, tagline: null,
    heroTitle: null, aboutText: null, aboutTitle: null, marqueeItems: [], partySizes: [],
    stats: [], spaces: [], published: false,
    images: { hero: null, logo: null, about: [], gallery: [] },
    ...overrides,
  }),
  categories: 0,
  activeItems: 0,
});

describe('setup steps', () => {
  it('should list the nine steps in order with unique numbers', () => {
    expect(STEPS.map(step => step.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(STEPS.map(step => step.id)).toEqual(['basics', 'brand', 'hero', 'menu', 'about', 'ambience', 'booking', 'contact', 'publish']);
    expect(stepById('basics').requirement).toBe('required');
    expect(STEPS.every(step => step.why && step.where)).toBe(true);
  });

  it('should consider nothing done for a brand-new business', () => {
    const snapshot = empty();
    expect(STEPS.some(step => isStepDone(step.id, snapshot))).toBe(false);
    expect(progressOf(snapshot)).toEqual({ done: 0, total: 9, percent: 0 });
  });

  it.each([
    ['basics', { whatsappNumber: '59899111222' }],
    ['brand', { images: { hero: null, logo: { id: 'l', url: '/m/l' }, about: [], gallery: [] } }],
    ['hero', { tagline: 'Desde 2012' }],
    ['hero', { heroTitle: 'Hola' }],
    ['hero', { images: { hero: { id: 'h', url: '/m/h' }, logo: null, about: [], gallery: [] } }],
    ['about', { aboutText: 'Historia' }],
    ['about', { stats: [{ label: 'Años', value: 3 }] }],
    ['about', { images: { hero: null, logo: null, about: [{ id: 'a', url: '/m/a' }], gallery: [] } }],
    ['ambience', { spaces: [{ id: 's1', name: 'Terraza', description: null, image: null, bookable: false }] }],
    ['ambience', { images: { hero: null, logo: null, about: [], gallery: [{ id: 'g', url: '/m/g', alt: null }] } }],
    ['booking', { spaces: [{ id: 's1', name: 'Barra', description: null, image: null, bookable: true }] }],
    ['booking', { partySizes: ['2', '4'] }],
    ['contact', { phone: '099' }],
    ['contact', { footerText: 'Pie' }],
    ['publish', { published: true }],
  ] as const)('should mark %s as done when %j is filled', (id, overrides) => {
    expect(isStepDone(id, empty(overrides as Partial<SiteSettingsDetail>))).toBe(true);
  });

  it('should only complete the menu with at least one category that has an active product', () => {
    expect(isStepDone('menu', { ...empty(), categories: 2, activeItems: 0 })).toBe(false);
    expect(isStepDone('menu', { ...empty(), categories: 0, activeItems: 3 })).toBe(false);
    expect(isStepDone('menu', { ...empty(), categories: 1, activeItems: 1 })).toBe(true);
  });

  it('should compute the progress percentage', () => {
    const snapshot = { ...empty({ whatsappNumber: '59899111222', published: true }), categories: 1, activeItems: 2 };
    expect(progressOf(snapshot)).toEqual({ done: 3, total: 9, percent: 33 });
  });

  it('should recommend the first pending step, then continue after the current one and wrap around', () => {
    const snapshot = { ...empty({ whatsappNumber: '59899111222' }), categories: 1, activeItems: 1 };
    expect(nextPendingStep(snapshot)?.id).toBe('brand');
    expect(nextPendingStep(snapshot, 'brand')?.id).toBe('hero');
    expect(nextPendingStep(snapshot, 'publish')?.id).toBe('brand');
  });

  it('should have no next step when everything is complete', () => {
    const full: SetupSnapshot = {
      settings: makeSettings({
        published: true,
        images: { hero: { id: 'h', url: '/m/h' }, logo: { id: 'l', url: '/m/l' }, about: [{ id: 'a', url: '/m/a' }], gallery: [{ id: 'g', url: '/m/g', alt: null }] },
      }),
      categories: 1,
      activeItems: 1,
    };
    expect(progressOf(full).percent).toBe(100);
    expect(nextPendingStep(full)).toBeNull();
  });
});
