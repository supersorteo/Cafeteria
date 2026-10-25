export interface ImageRef {
  id: string;
  url: string;
}

export interface GalleryRef extends ImageRef {
  alt: string | null;
}

export interface SiteImages {
  hero: ImageRef | null;
  about: ImageRef[];
  gallery: GalleryRef[];
  logo: ImageRef | null;
}

export interface StatEntry {
  label: string;
  value: number;
}

export interface SpaceEntry {
  id: string;
  name: string;
  description: string | null;
  image: ImageRef | null;
  bookable: boolean;
}

export interface SpacePayload {
  name: string;
  description: string | null;
  imageId: string | null;
  bookable: boolean;
}

export interface SiteSettingsDetail {
  slug: string;
  published: boolean;
  name: string;
  whatsappNumber: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  schedule: string | null;
  currency: string;
  locale: string;
  timezone: string;
  primaryColor: string;
  accentColor: string;
  heroTitle: string | null;
  heroDescription: string | null;
  aboutText: string | null;
  version: number;
  images: SiteImages;
  descriptor: string | null;
  tagline: string | null;
  aboutTitle: string | null;
  footerText: string | null;
  heroCaption: string | null;
  marqueeItems: string[];
  partySizes: string[];
  stats: StatEntry[];
  spaces: SpaceEntry[];
}

export type SiteSettingsPayload = Omit<SiteSettingsDetail, 'slug' | 'published' | 'images' | 'spaces'> & { spaces: SpacePayload[] };

export interface SiteImagesPayload {
  hero: string | null;
  about: string[];
  gallery: { mediaId: string; alt: string | null }[];
  logo: string | null;
}
