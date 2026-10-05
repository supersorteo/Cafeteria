import { AfterViewInit, Component, OnDestroy, signal } from '@angular/core';
import { NgForm, FormsModule } from '@angular/forms';

type Category = 'cocteles' | 'destilados' | 'entrantes' | 'principales' | 'postres';

interface MenuItem {
  name: string;
  description: string;
  price: number;
  tag: string;
}

interface Reservation {
  name: string;
  phone: string;
  date: string;
  time: string;
  people: string;
  area: string;
  occasion: string;
  note: string;
}

@Component({
  imports: [FormsModule],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App implements AfterViewInit, OnDestroy {
  protected readonly selectedCategory = signal<Category>('cocteles');
  protected readonly counters = signal([0, 0, 0]);
  protected readonly reservation: Reservation = {
    name: '',
    phone: '',
    date: '',
    time: '20:00',
    people: '2',
    area: 'Sin preferencia',
    occasion: '',
    note: '',
  };

  protected readonly categories: { id: Category; label: string }[] = [
    { id: 'cocteles', label: 'Cocteles' },
    { id: 'destilados', label: 'Destilados & Cervezas' },
    { id: 'entrantes', label: 'Entrantes' },
    { id: 'principales', label: 'Platos principales' },
    { id: 'postres', label: 'Postres' },
  ];

  protected readonly categoryImages: Record<Category, string[]> = {
    cocteles: [
      '/images/negroni.jpg',
      '/images/margarita.jpg',
      '/images/old-fashioned.jpg',
      '/images/negroni.jpg',
      '/images/margarita.jpg',
      '/images/old-fashioned.jpg',
    ],
    destilados: [
      '/images/old-fashioned.jpg',
      '/images/negroni.jpg',
      '/images/margarita.jpg',
      '/images/old-fashioned.jpg',
      '/images/beer.jpg',
      '/images/restaurant.jpg',
    ],
    entrantes: [
      '/images/tacos.jpg',
      '/images/wings.jpg',
      '/images/seafood.jpg',
      '/images/tacos.jpg',
      '/images/wings.jpg',
      '/images/tacos.jpg',
    ],
    principales: [
      '/images/steak.jpg',
      '/images/seafood.jpg',
      '/images/vegetariano.jpg',
      '/images/burger.jpg',
      '/images/seafood.jpg',
      '/images/steak.jpg',
    ],
    postres: [
      '/images/chocolate.jpg',
      '/images/cheesecake.jpg',
      '/images/cheesecake.jpg',
      '/images/chocolate.jpg',
    ],
  };

  protected readonly menu: Record<Category, MenuItem[]> = {
    cocteles: [
      { name: 'Negroni de la Casa', description: 'Gin, vermut rojo y bitter artesanal, servido en roca grande.', price: 180, tag: 'Clásico' },
      { name: 'Margarita de Mango & Tajín', description: 'Tequila reposado, mango natural, lima y escarchado de tajín.', price: 160, tag: 'De temporada' },
      { name: 'Old Fashioned Ahumado', description: 'Bourbon, bitters de cacao y humo de roble al momento.', price: 210, tag: 'Firma' },
      { name: 'Mezcalita de Frutos Rojos', description: 'Mezcal joven, mermelada de frutos rojos y toque de habanero.', price: 175, tag: 'Picante' },
      { name: 'Espresso Martini', description: 'Vodka, licor de café y espresso doble cremoso.', price: 170, tag: 'Post-cena' },
      { name: 'Spritz de la Terraza', description: 'Aperitivo de la casa, prosecco y soda con romero quemado.', price: 150, tag: 'Refrescante' },
    ],
    destilados: [
      { name: 'Whisky Single Malt 12 años', description: '2 oz · servido solo o en las rocas.', price: 220, tag: 'Escocia' },
      { name: 'Mezcal Artesanal Joven', description: '2 oz · ensamble espadín-cuishe, acompañado de sal de gusano.', price: 190, tag: 'Oaxaca' },
      { name: 'Tequila Reposado', description: '2 oz · barrica de roble blanco, notas de vainilla.', price: 180, tag: 'Jalisco' },
      { name: 'Ron Añejo 15 años', description: '2 oz · Caribe, madera dulce y especias.', price: 200, tag: 'Premium' },
      { name: 'Cerveza Artesanal de la Casa', description: 'Lager o IPA de cervecería local, 355 ml.', price: 95, tag: 'Local' },
      { name: 'Vino de la Semana', description: 'Copa 5 oz · selección rotativa de nuestra cava.', price: 140, tag: 'Cava' },
    ],
    entrantes: [
      { name: 'Tacos de Arrachera (3 pzas)', description: 'Tortilla de maíz, guacamole, cebolla curtida y salsa de la casa.', price: 165, tag: 'Para compartir' },
      { name: 'Alitas BBQ & Miel Chipotle', description: '500 g, aderezo ranch casero.', price: 180, tag: 'Favorito' },
      { name: 'Carpaccio de Salmón', description: 'Aceite de trufa, alcaparras, rúgula y parmesano.', price: 190, tag: 'Fresco' },
      { name: 'Nachos La Terraza', description: 'Totopos, queso fundido, frijoles, pico de gallo y crema.', price: 150, tag: 'Para compartir' },
      { name: 'Croquetas de Jamón Ibérico', description: 'Con alioli de limón asado (6 piezas).', price: 145, tag: 'Entrada' },
      { name: 'Queso Fundido con Chorizo', description: 'Queso manchego gratinado, chorizo español y tortillas.', price: 160, tag: 'Clásico' },
    ],
    principales: [
      { name: 'Rib Eye 400 g', description: 'Corte madurado 28 días, mantequilla de hierbas y papas rústicas.', price: 480, tag: 'A la parrilla' },
      { name: 'Pulpo Anticuchero', description: 'Papa confitada, emulsión de ají amarillo y brotes.', price: 390, tag: 'Del mar' },
      { name: 'Risotto de Hongos', description: 'Arborio, tres hongos, parmesano y aceite de trufa.', price: 320, tag: 'Vegetariano' },
      { name: 'Burger La Terraza', description: '200 g de res, queso cheddar madurado, tocino y papas trufadas.', price: 290, tag: 'Firma' },
      { name: 'Salmón a la Parrilla', description: 'Mantequilla de miso, espárragos y limón asado.', price: 360, tag: 'Del mar' },
      { name: 'Costillas BBQ (1 kg)', description: 'Cocción lenta 8 horas, salsa BBQ de la casa y elote.', price: 420, tag: 'Para compartir' },
    ],
    postres: [
      { name: 'Volcán de Chocolate', description: 'Centro líquido, helado de vainilla y frutos rojos.', price: 130, tag: 'Caliente' },
      { name: 'Crème Brûlée de Café', description: 'Azúcar caramelizada y biscotti de almendra.', price: 120, tag: 'Clásico' },
      { name: 'Cheesecake de Maracuyá', description: 'Base de galleta, coulis de maracuyá natural.', price: 125, tag: 'Ácido-dulce' },
      { name: 'Churros con Chocolate', description: 'Canela, azúcar y chocolate espeso caliente (6 piezas).', price: 110, tag: 'Para compartir' },
    ],
  };

  private readonly tagColors: Record<string, string> = {
    Clásico: '#0E8388',
    'De temporada': '#FF5C39',
    Firma: '#FFB020',
    Picante: '#E63946',
    'Post-cena': '#3D1D2E',
    Refrescante: '#0E8388',
    Escocia: '#3D1D2E',
    Oaxaca: '#FF5C39',
    Jalisco: '#0E8388',
    Premium: '#FFB020',
    Local: '#0E8388',
    Cava: '#7A3FA0',
    'Para compartir': '#FF5C39',
    Favorito: '#FFB020',
    Fresco: '#0E8388',
    Entrada: '#3D1D2E',
    'A la parrilla': '#E63946',
    'Del mar': '#0E8388',
    Vegetariano: '#3E9B4F',
    Caliente: '#E63946',
    'Ácido-dulce': '#FF5C39',
  };

  private readonly revealObserver?: IntersectionObserver;
  private readonly counterObserver?: IntersectionObserver;
  private readonly counterTimers: number[] = [];
  private readonly whatsappNumber = '+59896909509';

  constructor() {
    if (typeof IntersectionObserver !== 'undefined') {
      this.revealObserver = new IntersectionObserver(
        entries => entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            this.revealObserver?.unobserve(entry.target);
          }
        }),
        { threshold: 0.12 },
      );

      this.counterObserver = new IntersectionObserver(
        entries => entries.forEach(entry => {
          if (entry.isIntersecting) {
            const index = Number((entry.target as HTMLElement).dataset['counterIndex']);
            this.counterObserver?.unobserve(entry.target);
            this.animateCounter(index, [14, 120, 35][index]);
          }
        }),
        { threshold: 0.5 },
      );
    }
  }

  ngAfterViewInit(): void {
    document.querySelectorAll('.reveal').forEach(element => this.revealObserver?.observe(element));
    document.querySelectorAll('[data-counter-index]').forEach(element => this.counterObserver?.observe(element));
  }

  ngOnDestroy(): void {
    this.revealObserver?.disconnect();
    this.counterObserver?.disconnect();
    this.counterTimers.forEach(timer => window.clearInterval(timer));
  }

  protected colorForTag(tag: string): string {
    return this.tagColors[tag] ?? '#FF5C39';
  }

  protected whatsappUrl(message: string): string {
    return `https://wa.me/${this.whatsappNumber}?text=${encodeURIComponent(message)}`;
  }

  protected scrollTo(event: Event): void {
    event.preventDefault();
    const link = event.currentTarget as HTMLAnchorElement;
    const target = document.querySelector(link.getAttribute('href') ?? '');
    if (!target) {
      return;
    }

    const top = target.getBoundingClientRect().top + window.scrollY - 64;
    window.scrollTo({ top, behavior: 'smooth' });
    history.replaceState(null, '', link.getAttribute('href'));
  }

  protected submitReservation(form: NgForm): void {
    if (form.invalid) {
      return;
    }

    const reservationDate = this.reservation.date
      ? new Date(`${this.reservation.date}T12:00:00`).toLocaleDateString('es-MX', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : '';
    const optionalDetails = [
      this.reservation.occasion && `Ocasión: ${this.reservation.occasion.trim()}`,
      this.reservation.note && `Nota: ${this.reservation.note.trim()}`,
      this.reservation.phone && `Mi teléfono: ${this.reservation.phone.trim()}`,
    ].filter(Boolean);
    const message = [
      'Hola, quisiera hacer una reserva en La Terraza Bar & Cocina.',
      '',
      `Nombre: ${this.reservation.name.trim()}`,
      `Fecha: ${reservationDate}`,
      `Hora: ${this.reservation.time}`,
      `Personas: ${this.reservation.people}`,
      `Zona: ${this.reservation.area}`,
      ...optionalDetails,
      '',
      'Quedo pendiente de su confirmación. ¡Gracias!',
    ].join('\n');

    window.open(this.whatsappUrl(message), '_blank', 'noopener,noreferrer');
  }

  private animateCounter(index: number, end: number): void {
    let current = 0;
    const step = Math.max(1, Math.round(end / 60));
    const timer = window.setInterval(() => {
      current = Math.min(current + step, end);
      this.counters.update(values => values.map((value, i) => i === index ? current : value));
      if (current >= end) {
        window.clearInterval(timer);
      }
    }, 25);
    this.counterTimers.push(timer);
  }
}
