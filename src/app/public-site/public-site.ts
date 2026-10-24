import { NgClass } from '@angular/common';
import { AfterViewInit, Component, HostListener, computed, effect, input, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { SiteData } from '../core/site.models';
import { CountUpDirective } from '../shared/count-up.directive';
import { RevealDirective } from '../shared/reveal.directive';
import { Modal } from '../shared/ui/modal';
import { formatReservationDate, readableOn, rgbTriplet, tagColor, titleParts, todayInZone } from '../shared/site-format';

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

const DEFAULT_PARTY_SIZES = ['2', '3', '4', '5', '6', '8', '10', '+10 (evento)'];
const HERO_CARD_CLASSES = ['hero-photo-card-one', 'hero-photo-card-two', 'hero-photo-card-three'];
const NO_PREFERENCE = 'Sin preferencia';

@Component({
  imports: [FormsModule, NgClass, RevealDirective, CountUpDirective, Modal],
  selector: 'app-public-site',
  styleUrl: './public-site.css',
  templateUrl: './public-site.html',
  host: {
    '[style.--coral]': 'site().theme.primaryColor',
    '[style.--teal]': 'site().theme.accentColor',
    '[style.--primary]': 'primaryRgb()',
    '[style.--primary-fg]': 'primaryContrast()',
    '[style.--brand-teal]': 'accentRgb()',
  },
})
export class PublicSite implements AfterViewInit {
  readonly site = input.required<SiteData>();

  protected readonly selectedCategoryId = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly reservationOpen = signal(false);
  protected readonly reservationSent = signal(false);
  protected readonly lightbox = signal<number | null>(null);
  protected readonly scrolled = signal(false);
  protected readonly reservation: Reservation = {
    name: '',
    phone: '',
    date: '',
    time: '20:00',
    people: '',
    area: NO_PREFERENCE,
    occasion: '',
    note: '',
  };
  protected readonly year = new Date().getFullYear();
  protected readonly noPreference = NO_PREFERENCE;
  protected readonly heroCardClasses = HERO_CARD_CLASSES;

  protected readonly primaryRgb = computed(() => rgbTriplet(this.site().theme.primaryColor, '214 66 38'));
  protected readonly primaryContrast = computed(() => readableOn(this.site().theme.primaryColor));
  protected readonly accentRgb = computed(() => rgbTriplet(this.site().theme.accentColor, '14 131 136'));
  protected readonly lightboxImage = computed(() => {
    const index = this.lightbox();
    return index === null ? null : (this.site().gallery[index] ?? null);
  });
  protected readonly displayName = computed(() => {
    const { name, descriptor } = this.site();
    return descriptor ? `${name} ${descriptor}` : name;
  });
  protected readonly visibleCategories = computed(() => this.site().categories.filter(category => category.items.length > 0));
  protected readonly activeCategory = computed(() => {
    const categories = this.visibleCategories();
    return categories.find(category => category.id === this.selectedCategoryId()) ?? categories[0] ?? null;
  });
  protected readonly heroTitleParts = computed(() => titleParts(this.site().hero.title ?? this.site().name));
  protected readonly aboutTitleParts = computed(() => titleParts(this.site().about.title ?? ''));
  protected readonly heroCards = computed(() => {
    const photos = this.visibleCategories()
      .map(category => category.items.find(item => item.imageUrl)?.imageUrl)
      .filter((url): url is string => !!url);
    if (photos.length <= 3) {
      return photos;
    }
    const last = photos.length - 1;
    return [...new Set([0, Math.floor(last / 2), last])].map(index => photos[index]);
  });
  protected readonly showAbout = computed(() => {
    const { about, stats } = this.site();
    return !!about.text || !!about.title || about.imageUrls.length > 0 || stats.length > 0;
  });
  protected readonly showAmbience = computed(() => this.site().gallery.length > 0 || this.site().highlights.length > 0);
  protected readonly marqueeLoop = computed(() => {
    const items = this.site().marquee;
    return items.length === 0 ? '' : `${items.join(' · ')} · `.repeat(items.length >= 4 ? 3 : 6);
  });
  protected readonly partySizes = computed(() => {
    const sizes = this.site().reservation.partySizes;
    return sizes.length > 0 ? sizes : DEFAULT_PARTY_SIZES;
  });
  protected readonly priceFormatter = computed(() => {
    const { locale, currency } = this.site();
    return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 });
  });
  protected readonly minDate = computed(() => todayInZone(this.site().timezone));
  protected readonly mailLink = computed(() => {
    const email = this.site().contact.email;
    return email ? `mailto:${email}` : null;
  });

  constructor() {
    effect(() => {
      const sizes = this.partySizes();
      if (!sizes.includes(this.reservation.people)) {
        this.reservation.people = sizes[0];
      }
    });
  }

  ngAfterViewInit(): void {
    if (location.hash) {
      requestAnimationFrame(() => this.scrollToSection(location.hash));
    }
  }

  @HostListener('window:scroll')
  protected onScroll(): void {
    this.scrolled.set(window.scrollY > 24);
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(event: KeyboardEvent): void {
    if (this.lightbox() === null) {
      return;
    }
    if (event.key === 'ArrowRight') {
      this.stepLightbox(1);
    } else if (event.key === 'ArrowLeft') {
      this.stepLightbox(-1);
    }
  }

  protected openReservation(event?: Event): void {
    event?.preventDefault();
    this.formError.set(null);
    this.reservationSent.set(false);
    this.reservationOpen.set(true);
  }

  protected closeReservation(): void {
    this.reservationOpen.set(false);
  }

  protected stepLightbox(delta: number): void {
    const total = this.site().gallery.length;
    const index = this.lightbox();
    if (index !== null && total > 0) {
      this.lightbox.set((index + delta + total) % total);
    }
  }

  protected tagColor(tag: string): string {
    return tagColor(tag);
  }

  protected formatPrice(value: number): string {
    return this.priceFormatter().format(value);
  }

  protected whatsappUrl(message: string): string {
    const number = (this.site().contact.whatsappNumber ?? '').replace(/\D/g, '');
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  }

  protected scrollTo(event: Event): void {
    event.preventDefault();
    const link = event.currentTarget as HTMLAnchorElement;
    const hash = link.getAttribute('href') ?? '';
    if (this.scrollToSection(hash, true)) {
      history.replaceState(null, '', `${location.pathname}${location.search}${hash}`);
    }
  }

  protected submitReservation(form: NgForm): void {
    this.formError.set(null);
    if (form.invalid) {
      this.formError.set('Completa tu nombre, la fecha y la hora para enviar la reserva.');
      return;
    }
    const name = this.reservation.name.trim();
    if (!name) {
      this.formError.set('Escribe tu nombre para enviar la reserva.');
      return;
    }
    if (this.reservation.date < this.minDate()) {
      this.formError.set('Elige una fecha de hoy en adelante.');
      return;
    }

    const optionalDetails = [
      this.reservation.occasion.trim() && `Ocasión: ${this.reservation.occasion.trim()}`,
      this.reservation.note.trim() && `Nota: ${this.reservation.note.trim()}`,
      this.reservation.phone.trim() && `Mi teléfono: ${this.reservation.phone.trim()}`,
    ].filter(Boolean);
    const showArea = this.site().reservation.areas.length > 0;
    const message = [
      `Hola, quisiera hacer una reserva en ${this.displayName()}.`,
      '',
      `Nombre: ${name}`,
      `Fecha: ${formatReservationDate(this.reservation.date, this.site().locale)}`,
      `Hora: ${this.reservation.time}`,
      `Personas: ${this.reservation.people}`,
      ...(showArea ? [`Zona: ${this.reservation.area}`] : []),
      ...optionalDetails,
      '',
      'Quedo pendiente de su confirmación. ¡Gracias!',
    ].join('\n');

    window.open(this.whatsappUrl(message), '_blank', 'noopener,noreferrer');
    this.reservationSent.set(true);
  }

  private scrollToSection(hash: string, smooth = false): boolean {
    const target = hash.length > 1 ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (!target) {
      return false;
    }

    const top = target.getBoundingClientRect().top + window.scrollY - 64;
    window.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
    return true;
  }
}
