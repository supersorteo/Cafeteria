export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  version: number;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  tag: string | null;
  active: boolean;
  sortOrder: number;
  version: number;
  imageId: string | null;
  imageUrl: string | null;
}

export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ItemPayload {
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  tag: string | null;
  active: boolean;
  version: number | null;
  imageId?: string;
  removeImage?: boolean;
}

export interface MediaAsset {
  id: string;
  url: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  byteSize: number;
}

export interface SiteSettings {
  currency: string;
  locale: string;
  slug: string;
}

export type UploadEvent = { kind: 'progress'; percent: number } | { kind: 'done'; media: MediaAsset };
