import { SiteSettingsDetail } from '../../core/site-admin.models';

export type StepId = 'basics' | 'brand' | 'hero' | 'menu' | 'about' | 'ambience' | 'booking' | 'contact' | 'publish';
export type PreviewTarget = 'top' | 'menu' | 'nosotros' | 'galeria' | 'reservas' | 'contacto';
export type Requirement = 'required' | 'recommended' | 'optional' | 'final';

export interface StepDef {
  id: StepId;
  number: number;
  title: string;
  short: string;
  why: string;
  example: string;
  where: string;
  target: PreviewTarget;
  requirement: Requirement;
  icon: string;
}

export interface SetupSnapshot {
  settings: SiteSettingsDetail;
  categories: number;
  activeItems: number;
}

export const STEPS: readonly StepDef[] = [
  {
    id: 'basics', number: 1, title: 'Tu negocio',
    short: 'Dile al mundo cómo te llamas y a qué WhatsApp te escriben.',
    why: 'Con esto tus clientes saben quién eres y pueden reservar contigo. El WhatsApp es lo único que necesitas sí o sí para publicar.',
    example: 'Café Aurora · Bar y cocina · 59899123456',
    where: 'El nombre arriba de tu página y el botón «Reservar»',
    target: 'top', requirement: 'required',
    icon: 'M4 20V9l8-5 8 5v11M9 20v-6h6v6',
  },
  {
    id: 'brand', number: 2, title: 'Tu marca',
    short: 'Sube tu logo y elige los colores de tu página.',
    why: 'Hace que tu página se vea como tu negocio. Si no subes un logo, se usa el de la app, y siempre puedes cambiarlo después.',
    example: 'Un logo cuadrado y el color de tu local',
    where: 'El logo arriba, y los botones y detalles con tus colores',
    target: 'top', requirement: 'optional',
    icon: 'M12 3a9 9 0 1 0 0 18c1.7 0 2-1.2 1.4-2.2-.7-1.2 0-2.3 1.3-2.3H17a4 4 0 0 0 4-4c0-5-4-9.5-9-9.5zM7.5 11h.01M10 7.5h.01M14.5 7.5h.01',
  },
  {
    id: 'hero', number: 3, title: 'Tu portada',
    short: 'La primera pantalla: una foto grande, un título y una frase de bienvenida.',
    why: 'Es lo primero que ve un cliente al entrar. Una buena foto y una frase corta hacen que quiera seguir mirando.',
    example: '«Donde la noche sabe mejor»',
    where: 'Lo primero que ve el cliente al abrir tu página',
    target: 'top', requirement: 'optional',
    icon: 'M4 5h16v14H4V5zM4 15l4.5-4.5L13 15l3-3 4 4M9 9.5h.01',
  },
  {
    id: 'menu', number: 4, title: 'Tu carta',
    short: 'Tus platos y bebidas, con precio y foto.',
    why: 'Los clientes miran la carta antes de decidir. Agrupa tus productos en categorías (por ejemplo Cocteles o Postres).',
    example: 'Cocteles → Mojito — $180',
    where: 'La sección «La carta»',
    target: 'menu', requirement: 'recommended',
    icon: 'M4 4h12a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4zM8 9h7M8 13h7',
  },
  {
    id: 'about', number: 5, title: 'Tu historia',
    short: 'Cuenta quién eres con un texto, fotos y números que dan confianza.',
    why: 'Sirve para que el cliente te conozca y confíe en ti antes de visitarte.',
    example: 'Desde 2012 · 120 destilados',
    where: 'La sección «Nosotros»',
    target: 'nosotros', requirement: 'optional',
    icon: 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21a8 8 0 0 1 16 0',
  },
  {
    id: 'ambience', number: 6, title: 'Tus espacios y fotos',
    short: 'Muestra tus espacios (terraza, salón, barra…) con su foto y elige cuáles aceptan reservas.',
    why: 'El cliente ve cada espacio con su foto, nombre y descripción, y puede reservar directamente en él. También puedes sumar más fotos del ambiente.',
    example: 'Terraza · Aire libre y música en vivo · Acepta reservas',
    where: 'La sección «El ambiente», con un botón «Reservar aquí» en cada espacio',
    target: 'galeria', requirement: 'optional',
    icon: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7L12 3z',
  },
  {
    id: 'booking', number: 7, title: 'Reservas por WhatsApp',
    short: 'Elige para cuántas personas se puede reservar.',
    why: 'Así el cliente reserva más fácil y te llega el mensaje ya ordenado. Las zonas salen de tus espacios (paso 6). Si no añades nada, se usan opciones normales.',
    example: 'Grupos de 2 a 10 personas',
    where: 'El formulario de reserva',
    target: 'reservas', requirement: 'optional',
    icon: 'M4 6h16v14H4V6zM4 10h16M8 3v4M16 3v4',
  },
  {
    id: 'contact', number: 8, title: 'Contacto y horarios',
    short: 'Teléfono, dirección y horarios para que te encuentren.',
    why: 'Para que sepan cuándo abres y cómo llegar o llamarte.',
    example: 'Lun a Vie 18:00 a 02:00',
    where: 'Al final de la página',
    target: 'contacto', requirement: 'optional',
    icon: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  },
  {
    id: 'publish', number: 9, title: 'Publicar tu página',
    short: 'Revisa que todo esté listo y haz visible tu página.',
    why: 'Mientras no publiques, solo tú ves tu página. Al publicarla, cualquiera con el enlace podrá verla.',
    example: '',
    where: 'Toda tu página, para cualquiera con el enlace',
    target: 'top', requirement: 'final',
    icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  },
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
      return s.images.gallery.length > 0 || s.spaces.length > 0;
    case 'booking':
      return s.spaces.some(space => space.bookable) || s.partySizes.length > 0;
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
  return {
    required: 'Necesario para publicar',
    recommended: 'Muy recomendable',
    optional: 'Puedes hacerlo después',
    final: 'Último paso',
  }[requirement];
}
