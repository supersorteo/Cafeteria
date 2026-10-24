export const SLUG_PATTERN = /^[a-z0-9]([a-z0-9]|-[a-z0-9])*$/;

export const RESERVED_SLUGS = ['admin', 'api', 'media', 'assets', 'images', 'auth', 'www', 'support', 'status'];

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/g, '');
}
