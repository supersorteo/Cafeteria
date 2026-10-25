import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BrandMark } from '../shared/ui/brand-mark';
import { ThemeToggle } from '../shared/ui/theme-toggle';

@Component({
  imports: [RouterLink, ThemeToggle, BrandMark],
  selector: 'app-auth-card',
  template: `
    <div class="min-h-screen lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] bg-app">
      <aside class="auth-brand hidden lg:flex flex-col justify-between p-12 text-white relative overflow-hidden" aria-hidden="true">
        <span class="auth-orb auth-orb-a"></span>
        <span class="auth-orb auth-orb-b"></span>
        <a routerLink="/" tabindex="-1" class="relative flex items-center gap-3 font-display text-2xl font-black"><app-brand-mark [size]="44" />La Terraza <span class="text-gold">Pro</span></a>
        <div class="relative max-w-md">
          <h2 class="font-display text-5xl font-black leading-[1.05]">Tu carta, siempre <span class="italic text-gold">al día</span>.</h2>
          <ul class="mt-8 space-y-4 text-lg font-medium text-white/85">
            <li class="flex gap-3 anim-fade-up" style="--i:2"><span class="auth-dot"></span>Página propia en minutos</li>
            <li class="flex gap-3 anim-fade-up" style="--i:3"><span class="auth-dot"></span>Carta con fotos y precios</li>
            <li class="flex gap-3 anim-fade-up" style="--i:4"><span class="auth-dot"></span>Reservas directo a tu WhatsApp</li>
          </ul>
        </div>
        <p class="relative text-sm text-white/60">© La Terraza Pro</p>
      </aside>

      <main class="relative flex flex-col items-center justify-center px-5 py-10 min-h-screen lg:min-h-0">
        <div class="absolute top-4 right-4"><app-theme-toggle /></div>
        <div class="w-full max-w-md anim-fade-up">
          <a routerLink="/" class="lg:hidden flex items-center justify-center gap-2.5 font-display text-2xl font-black text-primary mb-6"><app-brand-mark [size]="38" />La Terraza <span class="text-gold">Pro</span></a>
          <div class="card p-6 md:p-9 !rounded-ui-xl">
            <h1 class="font-display text-3xl font-black">{{ title() }}</h1>
            @if (subtitle()) {
              <p class="mt-2 font-medium text-muted">{{ subtitle() }}</p>
            }
            <div class="mt-7">
              <ng-content />
            </div>
          </div>
          <div class="mt-6 text-center text-sm font-medium text-muted auth-footer">
            <ng-content select="[footer]" />
          </div>
        </div>
      </main>
    </div>
  `,
})
export class AuthCard {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
}
