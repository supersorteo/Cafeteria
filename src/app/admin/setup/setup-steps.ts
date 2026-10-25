import { SiteSettingsDetail } from '../../core/site-admin.models';

export type StepId = 'basics' | 'brand' | 'menu' | 'hero' | 'about' | 'ambience' | 'booking' | 'contact' | 'publish';
export type PreviewTarget = 'top' | 'menu' | 'nosotros' | 'galeria' | 'reservas' | 'contacto';
export type Requirement = 'required' | 'recommended' | 'optional' | 'final';

export interface StepDef {
  id: StepId;
  number: number;
  title: string;
  why: string;
  where: string;
  target: PreviewTarget;
  requirement: Requirement;
}

export interface SetupSnapshot {
  settings: SiteSettingsDetail;
  categories: number;
  activeItems: number;
}

export const STEPS: readonly StepDef[] = [
  { id: 'basics', number: 1, title: 'Datos básicos', why: 'El nombre de tu negocio y el WhatsApp donde recibirás las reservas.', where: 'Encabezado y botón «Reservar»', target: 'top', requirement: 'required' },
  { id: 'brand', number: 2, title: 'Logo y colores', why: 'Tu identidad: el logo y los colores que usará toda tu página.', where: 'Encabezado, botones y acentos', target: 'top', requirement: 'optional' },
  { id: 'menu', number: 3, title: 'Tu carta', why: 'Categorías y productos con precio y foto.', where: 'Sección «La carta»', target: 'menu', requirement: 'recommended' },
  { id: 'hero', number: 4, title: 'Portada', why: 'La primera impresión: frase, título, descripción y foto principal.', where: 'Parte superior de la página', target: 'top', requirement: 'optional' },
  { id: 'about', number: 5, title: 'Nosotros', why: 'Cuenta tu historia con un texto, fotos y cifras que generen confianza.', where: 'Sección «Nosotros»', target: 'nosotros', requirement: 'optional' },
  { id: 'ambience', number: 6, title: 'Ambiente', why: 'Fotos de tu local y los espacios o promociones que ofreces.', where: 'Sección «El ambiente»', target: 'galeria', requirement: 'optional' },
  { id: 'booking', number: 7, title: 'Reservas', why: 'Las zonas del local y los tamaños de grupo que el cliente puede elegir.', where: 'Formulario de reserva', target: 'reservas', requirement: 'optional' },
  { id: 'contact', number: 8, title: 'Contacto y pie de página', why: 'Teléfono, correo, dirección, horarios y el texto final de la página.', where: 'Pie de página', target: 'contacto', requirement: 'optional' },
  { id: 'publish', number: 9, title: 'Publicar', why: 'Revisa todo y haz visible tu página para tus clientes.', where: 'Toda tu página', target: 'top', requirement: 'final' },
];

export function stepById(id: StepId): StepDef {
  return STEPS.find(step => step.id === id) as StepDef;
}

export function isStepDone(id: StepId, { settings: s, categories, activeItems }: SetupSnapshot): boolean {
  switch (id) {
    case 'basics':
      return !!s.whatsappNumber;
    case 'brand':
      return !!s.images.logo;
    case 'menu':
      return categories > 0 && activeItems > 0;
    case 'hero':
      return !!(s.heroTitle || s.tagline || s.images.hero);
    case 'about':
      return !!(s.aboutText || s.aboutTitle || s.images.about.length > 0 || s.stats.length > 0);
    case 'ambience':
      return s.images.gallery.length > 0 || s.highlights.length > 0;
    case 'booking':
      return s.reservationAreas.length > 0 || s.partySizes.length > 0;
    case 'contact':
      return !!(s.phone || s.email || s.address || s.schedule || s.footerText);
    case 'publish':
      return s.published;
  }
}

export function progressOf(snapshot: SetupSnapshot): { done: number; total: number; percent: number } {
  const done = STEPS.filter(step => isStepDone(step.id, snapshot)).length;
  return { done, total: STEPS.length, percent: Math.round((done / STEPS.length) * 100) };
}

export function nextPendingStep(snapshot: SetupSnapshot, after?: StepId): StepDef | null {
  const start = after ? stepById(after).number : 0;
  const pending = (step: StepDef) => !isStepDone(step.id, snapshot);
  return STEPS.find(step => step.number > start && pending(step)) ?? STEPS.find(pending) ?? null;
}

export function requirementLabel(requirement: Requirement): string {
  return { required: 'Obligatorio', recommended: 'Recomendado', optional: 'Opcional', final: 'Final' }[requirement];
}
