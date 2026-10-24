export interface SiteContact {
  whatsappNumber: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  schedule: string | null;
}

export interface SiteItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  tag: string | null;
  imageUrl: string | null;
}

export interface SiteCategory {
  id: string;
  name: string;
  items: SiteItem[];
}

export interface SiteData {
  slug: string;
  name: string;
  descriptor: string | null;
  tagline: string | null;
  footerText: string | null;
  currency: string;
  locale: string;
  timezone: string;
  theme: { primaryColor: string; accentColor: string };
  contact: SiteContact;
  hero: { title: string | null; description: string | null; caption: string | null; imageUrl: string | null };
  about: { title: string | null; text: string | null; imageUrls: string[] };
  gallery: { url: string; alt: string | null }[];
  marquee: string[];
  stats: { label: string; value: number }[];
  highlights: { title: string; description: string | null }[];
  reservation: { areas: string[]; partySizes: string[] };
  categories: SiteCategory[];
}
