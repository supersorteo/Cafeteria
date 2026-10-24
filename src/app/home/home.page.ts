import { Component, HostListener, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { RevealDirective } from '../shared/reveal.directive';
import { ThemeToggle } from '../shared/ui/theme-toggle';

@Component({
  imports: [RouterLink, RevealDirective, ThemeToggle],
  selector: 'app-home',
  template: `
    <header class="home-header sticky top-0 z-40 transition-all" [class.scrolled]="scrolled()">
      <div class="max-w-6xl mx-auto px-4 sm:px-5 flex items-center justify-between gap-2 transition-all" [class.py-4]="!scrolled()" [class.py-2]="scrolled()">
        <a routerLink="/" class="font-display text-lg sm:text-xl md:text-2xl font-black text-primary whitespace-nowrap">La Terraza <span class="text-gold">Pro</span></a>
        <nav class="flex items-center gap-1 sm:gap-2" aria-label="Principal">
          <app-theme-toggle class="hidden min-[400px]:block" />
          @if (auth.user()) {
            <a id="homePanel" routerLink="/admin" class="btn btn-primary btn-sm">Ir a mi panel</a>
          } @else {
            <a id="homeLogin" routerLink="/auth/login" class="btn btn-ghost btn-sm"><span class="sm:hidden">Entrar</span><span class="hidden sm:inline">Iniciar sesión</span></a>
            <a id="homeRegister" routerLink="/auth/register" class="btn btn-primary btn-sm"><span class="sm:hidden">Registrarme</span><span class="hidden sm:inline">Crear mi negocio</span></a>
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
            <h1 class="anim-fade-up mt-5 font-display font-black leading-[1.02] tracking-tight text-[clamp(2.5rem,7vw,4.75rem)]" style="--i:1">
              Tu carta y tu web, <span class="italic text-primary">listas en minutos</span>
            </h1>
            <p class="anim-fade-up mt-6 text-lg md:text-xl font-medium max-w-xl text-muted" style="--i:2">
              Registra tu negocio, sube tu carta con fotos y publica una página propia con reservas por WhatsApp. Tú la administras desde un panel sencillo.
            </p>
            <div class="anim-fade-up mt-9 flex flex-col sm:flex-row gap-3" style="--i:3">
              <a routerLink="/auth/register" class="btn btn-primary btn-lg">Crear mi negocio</a>
              <a id="homeDemo" routerLink="/la-terraza" class="btn btn-secondary btn-lg">Ver un ejemplo</a>
            </div>
            <p class="anim-fade-up mt-5 text-sm font-semibold text-muted" style="--i:4">Sin tarjeta · Listo en 5 minutos · Tu carta siempre actualizada</p>
          </div>

          <div class="hero-visual relative mx-auto w-full max-w-sm anim-scale-in" aria-hidden="true">
            <div class="phone card !rounded-[2rem] p-4">
              <div class="rounded-ui-lg p-4 text-white" style="background:linear-gradient(135deg,rgb(var(--primary)),rgb(var(--gold)))">
                <p class="text-xs font-bold uppercase tracking-widest opacity-90">Bistro Demo</p>
                <p class="font-display text-2xl font-black leading-tight mt-1">Cocina de barrio, noches con sabor</p>
              </div>
              <ul class="mt-4 space-y-3">
                @for (dish of dishes; track dish.name) {
                  <li class="flex items-center gap-3">
                    <span class="w-12 h-12 rounded-ui-md shrink-0" [style.background]="dish.tone"></span>
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
                  <span class="font-display text-5xl font-black text-primary/90">{{ i + 1 }}</span>
                  <h3 class="mt-3 font-display text-xl font-black">{{ step.title }}</h3>
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
              <span class="w-12 h-12 rounded-ui-md bg-primary/10 text-primary flex items-center justify-center text-2xl" aria-hidden="true">{{ feature.icon }}</span>
              <h3 class="mt-4 font-display text-xl font-black">{{ feature.title }}</h3>
              <p class="mt-2 font-medium text-muted">{{ feature.text }}</p>
            </article>
          }
        </div>
      </section>

      <section class="px-5 pb-20">
        <div class="reveal cta-band max-w-6xl mx-auto rounded-ui-xl px-6 py-14 md:py-16 text-center text-white relative overflow-hidden">
          <h2 class="relative font-display text-3xl md:text-5xl font-black">Pon tu negocio <span class="italic text-gold">en el mapa</span></h2>
          <p class="relative mt-3 text-lg font-medium text-white/80">Crea tu cuenta gratis y publica tu carta hoy.</p>
          <div class="relative mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <a routerLink="/auth/register" class="btn btn-lg bg-white text-[#2A1420] hover:shadow-lift">Crear mi negocio</a>
            <a routerLink="/la-terraza" class="btn btn-lg border-white/40 text-white hover:bg-white/10">Ver un ejemplo</a>
          </div>
        </div>
      </section>
    </main>

    <footer class="py-8 text-center text-xs font-medium text-muted border-t border-line">
      © {{ year }} La Terraza Pro ·
      <a routerLink="/auth/login" class="underline underline-offset-2 hover:text-primary">Acceso para negocios</a>
    </footer>
  `,
})
export class HomePage {
  protected readonly auth = inject(AuthService);
  protected readonly year = new Date().getFullYear();
  protected readonly scrolled = signal(false);
  protected readonly dishes = [
    { name: 'Milanesa napolitana', tag: 'Casero', price: '$350', tone: 'linear-gradient(135deg,#f4b183,#d6602f)' },
    { name: 'Ensalada César', tag: 'Liviano', price: '$280', tone: 'linear-gradient(135deg,#b9d99a,#5f9a4a)' },
    { name: 'Volcán de chocolate', tag: 'Postre', price: '$190', tone: 'linear-gradient(135deg,#8b5a46,#3d1d2e)' },
  ];
  protected readonly steps = [
    { title: 'Regístrate', text: 'Crea tu cuenta con tu correo y elige la dirección de tu página.' },
    { title: 'Confirma tu correo', text: 'Te enviamos un enlace para activar la cuenta.' },
    { title: 'Carga tu carta', text: 'Categorías, platos, precios y fotos desde el panel.' },
    { title: 'Publica', text: 'Personaliza colores y textos, y activa tu página pública.' },
  ];
  protected readonly features = [
    { icon: '🍽️', title: 'Carta siempre al día', text: 'Cambia precios, oculta platos agotados y reordena categorías en segundos.' },
    { icon: '🎨', title: 'Tu marca, tu estilo', text: 'Colores, textos, fotos y horarios propios. Tu página se ve como tu negocio.' },
    { icon: '💬', title: 'Reservas por WhatsApp', text: 'Tus clientes reservan y el mensaje llega directo a tu teléfono.' },
  ];

  @HostListener('window:scroll')
  protected onScroll(): void {
    this.scrolled.set(window.scrollY > 24);
  }

  constructor() {
    void this.auth.ensureInitialized();
  }
}
