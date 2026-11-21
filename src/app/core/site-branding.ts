export const BRAND_FONT_OPTIONS = [
  { code: 'fraunces', label: 'Fraunces · Editorial', family: "'Fraunces Variable', 'Fraunces', Georgia, serif" },
  { code: 'inter', label: 'Inter · Moderna', family: "'Inter Variable', 'Inter', Arial, sans-serif" },
  { code: 'georgia', label: 'Georgia · Clásica', family: 'Georgia, serif' },
  { code: 'garamond', label: 'Garamond · Elegante', family: 'Garamond, Baskerville, serif' },
  { code: 'trebuchet', label: 'Trebuchet · Cercana', family: "'Trebuchet MS', sans-serif" },
  { code: 'arial', label: 'Arial · Limpia', family: 'Arial, Helvetica, sans-serif' },
  { code: 'verdana', label: 'Verdana · Legible', family: 'Verdana, sans-serif' },
  { code: 'courier', label: 'Courier · Industrial', family: "'Courier New', monospace" },
] as const;

export type BrandFontCode = (typeof BRAND_FONT_OPTIONS)[number]['code'];

export const DEFAULT_BRAND_STYLE = {
  businessTitleColor: '#2A1420',
  backgroundColor: '#FFF6EC',
  footerColor: '#2A1420',
  headingColor: '#3D1D2E',
  paragraphColor: '#5B4150',
  whatsappColor: '#25D366',
  marqueeColor: '#3D1D2E',
  fontFamily: 'fraunces' as BrandFontCode,
};

export function brandFontFamily(code: string | null | undefined): string {
  return BRAND_FONT_OPTIONS.find(font => font.code === code)?.family ?? BRAND_FONT_OPTIONS[0].family;
}
