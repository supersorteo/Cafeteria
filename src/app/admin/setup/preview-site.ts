import { SiteImages, SiteSettingsDetail } from '../../core/site-admin.models';
import { SiteCategory, SiteData } from '../../core/site.models';
import { HEX_COLOR } from '../../shared/forms';
import { SiteForm } from '../site/site-form';
import { PreviewTarget } from './setup-steps';

export type SiteDraft = ReturnType<SiteForm['getRawValue']>;

export const PREVIEW_SELECTORS: Record<PreviewTarget, string | null> = {
  top: null,
  menu: '#menu',
  nosotros: '#nosotros',
  galeria: '#galeria',
  reservas: '#reservas',
  contacto: '#contacto',
};

const blank = (value: string): string | null => value.trim() || null;
const color = (value: string, fallback: string): string => (HEX_COLOR.test(value.trim()) ? value.trim() : fallback);

export function buildPreviewSite(saved: SiteSettingsDetail, draft: SiteDraft, images: SiteImages, categories: SiteCategory[]): SiteData {
  return {
    slug: saved.slug,
    name: draft.name.trim() || saved.name,
    descriptor: blank(draft.descriptor),
    tagline: blank(draft.tagline),
    footerText: blank(draft.footerText),
    currency: draft.currency,
    locale: draft.locale,
    timezone: draft.timezone || saved.timezone,
    theme: { primaryColor: color(draft.primaryColor, saved.primaryColor), accentColor: color(draft.accentColor, saved.accentColor) },
    contact: {
      whatsappNumber: blank(draft.whatsappNumber),
      phone: blank(draft.phone),
      email: blank(draft.email),
      address: blank(draft.address),
      schedule: blank(draft.schedule),
    },
    hero: { title: blank(draft.heroTitle), description: blank(draft.heroDescription), caption: blank(draft.heroCaption), imageUrl: images.hero?.url ?? null },
    about: { title: blank(draft.aboutTitle), text: blank(draft.aboutText), imageUrls: images.about.map(image => image.url) },
    gallery: images.gallery.map(image => ({ url: image.url, alt: image.alt })),
    logoUrl: images.logo?.url ?? null,
    marquee: draft.marqueeItems.map(item => item.trim()).filter(Boolean),
    stats: draft.stats.filter(stat => stat.label.trim()).map(stat => ({ label: stat.label.trim(), value: stat.value ?? 0 })),
    spaces: draft.spaces
      .filter(space => space.name.trim())
      .map(space => ({ name: space.name.trim(), description: blank(space.description), imageUrl: space.image?.url ?? null, bookable: space.bookable })),
    reservation: {
      areas: draft.spaces.filter(space => space.bookable && space.name.trim()).map(space => space.name.trim()),
      partySizes: draft.partySizes.map(item => item.trim()).filter(Boolean),
    },
    categories,
  };
}
