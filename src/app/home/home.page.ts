import { Component, HostListener, computed, inject, signal, viewChild } from '@angular/core';
import type { Options } from 'qr-code-styling';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { RevealDirective } from '../shared/reveal.directive';
import { BrandMark } from '../shared/ui/brand-mark';
import { Modal } from '../shared/ui/modal';
import { QrCanvas } from '../shared/ui/qr-canvas';
import { ThemeToggle } from '../shared/ui/theme-toggle';
import { PlanCards } from '../shared/plan-cards';

@Component({
  imports: [RouterLink, RevealDirective, ThemeToggle, BrandMark, Modal, QrCanvas, PlanCards],
  selector: 'app-home',
  template: `
    <header class="home-header sticky top-0 z-40 transition-all" [class.scrolled]="scrolled()">
      <div class="max-w-6xl mx-auto px-4 sm:px-5 flex items-center justify-between gap-2 transition-all" [class.py-4]="!scrolled()" [class.py-2]="scrolled()">
        <a routerLink="/" class="flex items-center gap-2.5 font-display text-lg sm:text-xl md:text-2xl font-black text-primary whitespace-nowrap"><app-brand-mark [size]="34" />Deliora</a>
        <nav class="flex items-center gap-1 sm:gap-2" aria-label="Principal">
          <app-theme-toggle class="hidden min-[400px]:block" />
          @if (auth.user()) {
            <a id="homePanel" routerLink="/admin" class="btn btn-primary btn-sm">Ir a mi panel</a>
          } @else {
            <a id="homeLogin" routerLink="/auth/login" class="btn btn-ghost btn-sm"><span class="sm:hidden">Entrar</span><span class="hidden sm:inline">Iniciar sesión</span></a>
            <a id="homePlans" routerLink="/precios" class="btn btn-primary btn-sm"><span class="sm:hidden">Planes</span><span class="hidden sm:inline">Ver planes</span></a>
          }
        </nav>
      </div>
    </header>

    <main>
      <section class="home-hero relative overflow-hidden">
        <span class="hero-orb hero-orb-a" aria-hidden="true"></span>
        <span class="hero-orb hero-orb-b" aria-hidden="true"></span>
        <div class="relative max-w-6xl mx-auto px-5 pt-12 pb-20 md:pt-20 md:pb-28 grid lg:grid-cols-[1.1fr_.9fr] gap-14 items-center">
          <div>
            <p class="anim-fade-up inline-flex items-center gap-2 badge badge-success" style="--i:0">Para bares, cafeterías y restaurantes</p>
            <h1 class="anim-fade-up mt-5 font-display font-black leading-[1.02] tracking-tight text-[clamp(2.5rem,7vw,4.75rem)] text-primary" style="--i:1">
              Tu carta y tu web, <span class="italic text-primary">listas en minutos</span>
            </h1>
            <p class="anim-fade-up mt-6 text-lg md:text-xl font-medium max-w-xl text-muted" style="--i:2">
              Sube tu carta con fotos, crea cupones para tus clientes y publica una página propia con reservas por WhatsApp. Tú la administras desde un panel sencillo.
            </p>
            <div class="anim-fade-up mt-9 flex flex-col sm:flex-row gap-3" style="--i:3">
              <a routerLink="/precios" class="btn btn-primary btn-lg">Ver planes y precios</a>
              <a id="homeDemo" routerLink="/la-terraza" [queryParams]="{ ref: 'plataforma' }" class="btn btn-secondary btn-lg">Ver un ejemplo</a>
            </div>
            <p class="anim-fade-up mt-5 text-sm font-semibold text-muted" style="--i:4">Planes mensuales · Sin permanencia · Pagas por WhatsApp</p>
          </div>

          <div class="hero-visual relative mx-auto w-full max-w-sm anim-scale-in" aria-hidden="true">
            <div class="phone card !rounded-[2rem] bg-[#fffaf2] text-[#2A1420] p-4 shadow-xl">
              <div class="rounded-ui-lg p-4 text-[#2A1420]" style="background:linear-gradient(135deg,#fff1d6,#f7c27d)">
                <p class="text-xs font-bold uppercase tracking-widest opacity-90">Bistro Demo</p>
                <p class="font-display text-2xl font-black leading-tight mt-1">Cocina de barrio, noches con sabor</p>
              </div>
              <ul class="mt-4 space-y-3">
                @for (dish of dishes; track dish.name) {
                  <li class="flex items-center gap-3">
                    <img class="w-12 h-12 rounded-ui-md shrink-0 object-cover" [src]="dish.image" [alt]="dish.name" />
                    <span class="flex-1 min-w-0"><span class="block text-sm font-bold truncate">{{ dish.name }}</span><span class="block text-xs text-muted">{{ dish.tag }}</span></span>
                    <span class="font-display font-black text-primary">{{ dish.price }}</span>
                  </li>
                }
              </ul>
              <div class="mt-4 btn btn-primary w-full pointer-events-none">Reservar por WhatsApp</div>
            </div>
            <div class="float-chip float-chip-a card px-4 py-3 flex items-center gap-3">
              <span class="w-9 h-9 rounded-full bg-success/15 text-success flex items-center justify-center font-black">✓</span>
              <span class="text-sm font-bold leading-tight">Carta<br>actualizada</span>
            </div>
            <div class="float-chip float-chip-b card px-4 py-3">
              <p class="text-xs font-bold text-muted">Reserva nueva</p>
              <p class="text-sm font-black">Mesa para 4 · 21:00</p>
            </div>
          </div>
        </div>
      </section>

      <section class="py-20 bg-surface border-y border-line">
        <div class="max-w-6xl mx-auto px-5">
          <div class="reveal text-center max-w-2xl mx-auto">
            <h2 class="font-display text-3xl md:text-5xl font-black">Cómo funciona</h2>
            <p class="mt-3 text-lg font-medium text-muted">Cuatro pasos y tu negocio está en línea.</p>
          </div>
          <ol class="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            @for (step of steps; track step.title; let i = $index) {
              <li class="reveal" [style.transition-delay.ms]="i * 80">
                <div class="card card-hover p-6 h-full">
                  <img class="w-24 h-24 object-contain drop-shadow-[0_8px_18px_rgba(255,255,255,0.2)]" [src]="step.image" [alt]="'Paso ' + (i + 1)" />
                  <h3 class="mt-3 font-display text-xl font-black text-primary">{{ step.title }}</h3>
                  <p class="mt-2 text-sm font-medium text-muted">{{ step.text }}</p>
                </div>
              </li>
            }
          </ol>
        </div>
      </section>

      <section class="py-20">
        <div class="max-w-6xl mx-auto px-5 grid gap-5 md:grid-cols-3">
          @for (feature of features; track feature.title; let i = $index) {
            <article class="reveal card p-7" [style.transition-delay.ms]="i * 80">
              <span class="w-full h-56 md:h-64 rounded-ui-md bg-transparent flex items-center justify-center" aria-hidden="true">
                <img class="w-full h-full object-contain drop-shadow-[0_8px_18px_rgba(255,255,255,0.28)]" [src]="feature.image" alt="" />
              </span>
              <h3 class="mt-4 font-display text-xl font-black text-primary">{{ feature.title }}</h3>
              <p class="mt-2 font-medium text-muted">{{ feature.text }}</p>
            </article>
          }
        </div>
      </section>

      <section id="planes" class="plans-section py-20 bg-surface border-y border-line">
        <div class="max-w-6xl mx-auto px-5">
          <div class="reveal max-w-2xl mx-auto text-center">
            <p class="badge badge-warning">Elige tu ritmo</p>
            <h2 class="mt-4 font-display text-3xl md:text-5xl font-black">Dos planes, mes a mes</h2>
            <p class="mt-3 text-lg font-medium text-muted">Empieza con lo esencial o suma marca completa y cupones avanzados. Cambias cuando quieras.</p>
          </div>

          <div class="mt-12"><app-plan-cards /></div>
          <p class="mt-8 text-center text-sm font-semibold text-muted">Pago por WhatsApp, sin permanencia. <a routerLink="/precios" class="underline">Ver todos los detalles</a> · <button type="button" class="underline" (click)="openQrCustomizer()">Probar el diseño de un QR</button></p>
        </div>
      </section>

      <section class="px-5 pb-20">
        <div class="reveal cta-band max-w-6xl mx-auto rounded-ui-xl px-6 py-14 md:py-16 text-center text-white relative overflow-hidden">
          <div class="map-pin-visual relative mx-auto mb-4 flex h-36 w-36 justify-center md:h-44 md:w-44">
            <img class="relative z-10 h-full w-full object-contain drop-shadow-[0_8px_18px_rgba(255,255,255,0.18)]" src="/deliora-map-pin.webp" alt="Pin de ubicación" />
          </div>
          <h2 class="relative font-display text-3xl md:text-5xl font-black">Pon tu negocio <span class="italic text-gold">en el mapa</span></h2>
          <p class="relative mt-3 text-lg font-medium text-white/80">Elige tu plan y publica tu carta hoy.</p>
          <div class="relative mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <a routerLink="/precios" class="btn btn-lg bg-white text-[#2A1420] hover:shadow-lift">Ver planes y precios</a>
            <a routerLink="/la-terraza" [queryParams]="{ ref: 'plataforma' }" class="btn btn-lg border-white/40 text-white hover:bg-white/10">Ver un ejemplo</a>
          </div>
        </div>
      </section>
    </main>

    <footer class="py-8 text-center text-xs font-medium text-muted border-t border-line">
      © {{ year }} Deliora ·
      <a routerLink="/precios" class="underline underline-offset-2 hover:text-primary">Precios</a> ·
      <a routerLink="/auth/register" class="underline underline-offset-2 hover:text-primary">Tengo un código</a> ·
      <a routerLink="/auth/login" class="underline underline-offset-2 hover:text-primary">Acceso para negocios</a>
    </footer>

    @if (qrOpen()) {
      <app-modal heading="Personaliza tu QR" size="md" (closed)="closeQrCustomizer()">
        <div class="grid gap-6 md:grid-cols-[1fr_auto] items-center">
          <div>
            <span class="badge badge-success">Muestra</span>
            <h3 class="mt-4 font-display text-2xl font-black">Un QR con el estilo de tu negocio</h3>
            <p class="mt-2 text-sm font-medium text-muted">Escribe la dirección de tu página pública. El código se actualiza al instante y puedes abrirlo para imprimirlo.</p>
            <label for="planQrUrl" class="mt-5 block text-xs font-bold uppercase tracking-wider text-muted">Enlace de destino</label>
            <input id="planQrUrl" class="input mt-2" type="url" [value]="qrUrl()" (input)="setQrUrl($event)" placeholder="https://tusitio.com/mi-negocio" />
            <label for="planQrLabel" class="mt-4 block text-xs font-bold uppercase tracking-wider text-muted">Nombre bajo el QR (opcional)</label>
            <input id="planQrLabel" class="input mt-2" type="text" [value]="qrLabel()" (input)="setQrLabel($event)" placeholder="Ej. Entrada" />
            <button type="button" class="btn btn-primary mt-5 w-full sm:w-auto" data-demo-qr-download (click)="downloadDemoQr()">Descargar QR de muestra</button>
            <p class="mt-3 text-xs font-medium text-muted">Es una muestra. Con tu plan creas y guardas el diseño de tu QR desde el panel.</p>
          </div>
          <div class="qr-preview card p-4 text-center">
            <app-qr-canvas class="mx-auto" [options]="qrOptions()" [label]="'Código QR para ' + (qrLabel() || 'tu negocio')" />
            <p class="mt-3 text-xs font-bold text-muted">{{ qrLabel() || 'Tu negocio' }}</p>
          </div>
        </div>
      </app-modal>
    }

    @if (introOpen()) {
      <app-modal heading="El próximo paso de tu negocio empieza aquí" size="lg" (closed)="closeIntro()">
        @let scene = introScenes[introSlide()];
        <div class="rounded-ui-lg border border-line bg-surface-2/60 p-4 md:p-6">
          <div class="grid items-center gap-6 md:grid-cols-[.9fr_1.1fr]">
            <div class="order-2 md:order-1">
              <p class="text-xs font-bold uppercase tracking-[.18em] text-primary">{{ scene.eyebrow }}</p>
              <h3 class="mt-3 font-display text-3xl md:text-4xl font-black leading-tight text-primary">{{ scene.title }}</h3>
              <p class="mt-4 text-base md:text-lg font-medium text-muted">{{ scene.text }}</p>

              <div class="mt-7 flex flex-wrap items-center gap-3">
                @if (introSlide() < introScenes.length - 1) {
                  <button type="button" class="btn btn-primary" (click)="nextIntro()">Quiero verlo</button>
                } @else {
                  <button type="button" class="btn btn-primary" (click)="closeIntro()">Estoy listo</button>
                }
                @if (introSlide() > 0) {
                  <button type="button" class="btn btn-secondary" (click)="previousIntro()">Volver</button>
                }
              </div>
            </div>

            <div class="order-1 flex min-h-64 items-center justify-center md:order-2">
              <img class="max-h-80 w-full object-contain drop-shadow-[0_12px_24px_rgba(255,255,255,0.2)]" [class]="'intro-scene-image intro-scene-image-' + introSlide()" [src]="scene.image" [alt]="scene.alt" />
            </div>
          </div>

          <div class="mt-6 flex items-center justify-center gap-2" aria-label="Progreso de introducción">
            @for (introScene of introScenes; track introScene.image; let i = $index) {
              <button type="button" class="h-2.5 rounded-full transition-all" [class.w-8]="i === introSlide()" [class.w-2.5]="i !== introSlide()" [class.bg-primary]="i === introSlide()" [class.bg-line]="i !== introSlide()" [attr.aria-label]="'Ir a escena ' + (i + 1)" (click)="goToIntro(i)"></button>
            }
          </div>
        </div>
      </app-modal>
    }
  `,
})
export class HomePage {
  protected readonly auth = inject(AuthService);
  protected readonly year = new Date().getFullYear();
  protected readonly scrolled = signal(false);
  protected readonly introOpen = signal(true);
  protected readonly introSlide = signal(0);
  protected readonly qrOpen = signal(false);
  protected readonly qrUrl = signal('https://deliora.app/mi-negocio');
  protected readonly qrLabel = signal('');
  private readonly demoQr = viewChild(QrCanvas);
  protected readonly qrOptions = computed<Partial<Options>>(() => {
    const destination = this.qrUrl().trim() || 'https://deliora.app/mi-negocio';
    return {
      type: 'svg',
      width: 176,
      height: 176,
      margin: 8,
      data: destination,
      qrOptions: { errorCorrectionLevel: 'H' },
      dotsOptions: { type: 'dots', color: '#2A1420' },
      cornersSquareOptions: { type: 'extra-rounded', color: '#2A1420' },
      cornersDotOptions: { type: 'dot', color: '#2A1420' },
      backgroundOptions: { color: '#ffffff' },
    };
  });
  protected readonly introScenes = [
    {
      image: '/deliora-hermes-mascot-prototype.webp',
      alt: 'Hermes, mascota chef de Deliora, sosteniendo una bandeja dorada',
      eyebrow: 'Bienvenido a Deliora',
      title: 'Tu negocio tiene más para contar.',
      text: 'Con Deliora, tu carta, tu marca y tus reservas trabajan juntas para que cada visita empiece antes de llegar a la mesa.',
    },
    {
      image: '/deliora-hermes-intro-brand.webp',
      alt: 'Hermes presentando una identidad visual para un restaurante',
      eyebrow: 'Tu identidad, en movimiento',
      title: 'Haz que te reconozcan antes de visitarte.',
      text: 'Ordena tus platos, viste tu negocio con personalidad y convierte cada detalle en una experiencia que tus clientes recuerden.',
    },
    {
      image: '/deliora-hermes-intro-connect.webp',
      alt: 'Hermes conectando un restaurante con sus clientes',
      eyebrow: 'Tu próximo gran servicio',
      title: 'Publica. Conecta. Crece.',
      text: 'Una plataforma potente para que tu negocio se vea, se entienda y se elija. Todo empieza con una carta bien contada.',
    },
  ];
  protected readonly dishes = [
    { name: 'Milanesa napolitana', tag: 'Casero', price: '$350', image: '/deliora-dish-milanesa.webp' },
    { name: 'Ensalada César', tag: 'Liviano', price: '$280', image: '/deliora-dish-ensalada.webp' },
    { name: 'Volcán de chocolate', tag: 'Postre', price: '$190', image: '/deliora-dish-volcan.webp' },
  ];
  protected readonly steps = [
    { image: '/deliora-step-1.webp', title: 'Elige tu plan', text: 'Escoge el plan y tu país, y registramos tu pedido.' },
    { image: '/deliora-step-2.webp', title: 'Paga por WhatsApp', text: 'Nos escribes con tu número de pedido; al confirmar el pago te enviamos un código por correo.' },
    { image: '/deliora-step-3.webp', title: 'Crea tu negocio', text: 'Con el código creas tu cuenta y cargas tu carta, con fotos, precios e ingredientes.' },
    { image: '/deliora-step-4.webp', title: 'Publica', text: 'Personaliza tu marca, crea cupones y activa tu página pública.' },
  ];
  protected readonly features = [
    { image: '/deliora-feature-carta.webp', title: 'Carta siempre al día', text: 'Cambia precios, indica los ingredientes de cada plato, oculta lo agotado y reordena en segundos.' },
    { image: '/deliora-feature-marca.webp', title: 'Tu marca, tu estilo', text: 'Logo, colores, textos y fotos propios. Con el plan Profesional, además, todos los colores y 8 tipografías.' },
    { image: '/deliora-feature-reservas.webp', title: 'Reservas por WhatsApp', text: 'Tus clientes reservan y el mensaje llega directo a tu teléfono.' },
  ];

  @HostListener('window:scroll')
  protected onScroll(): void {
    this.scrolled.set(window.scrollY > 24);
  }

  constructor() {
    void this.auth.ensureInitialized();
  }

  protected nextIntro(): void {
    this.introSlide.update((slide) => Math.min(slide + 1, this.introScenes.length - 1));
  }

  protected previousIntro(): void {
    this.introSlide.update((slide) => Math.max(slide - 1, 0));
  }

  protected goToIntro(index: number): void {
    this.introSlide.set(index);
  }

  protected closeIntro(): void {
    this.introOpen.set(false);
  }

  protected openQrCustomizer(): void {
    this.qrOpen.set(true);
  }

  protected async downloadDemoQr(): Promise<void> {
    await this.demoQr()?.download('qr-muestra', 'png');
  }

  protected closeQrCustomizer(): void {
    this.qrOpen.set(false);
  }

  protected setQrUrl(event: Event): void {
    this.qrUrl.set((event.target as HTMLInputElement).value);
  }

  protected setQrLabel(event: Event): void {
    this.qrLabel.set((event.target as HTMLInputElement).value);
  }
}
