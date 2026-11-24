import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BrandMark } from '../shared/ui/brand-mark';
import { ThemeToggle } from '../shared/ui/theme-toggle';

@Component({
  imports: [RouterLink, BrandMark, ThemeToggle],
  selector: 'app-billing-shell',
  host: { class: 'block' },
  template: `
    <div class="min-h-screen bg-app">
      <header class="glass sticky top-0 z-30 flex items-center justify-between gap-3 px-4 md:px-8 py-2.5 !border-x-0 !border-t-0">
        <a routerLink="/" class="flex items-center gap-2.5 font-display text-xl font-black text-primary"><app-brand-mark [size]="32" />Deliora</a>
        <div class="flex items-center gap-1">
          <app-theme-toggle />
          <a routerLink="/precios" class="btn btn-ghost btn-sm">Precios</a>
          <a routerLink="/auth/login" class="btn btn-secondary btn-sm">Entrar</a>
        </div>
      </header>
      <main class="mx-auto max-w-5xl px-4 py-10 md:py-14"><ng-content /></main>
    </div>
  `,
})
export class BillingShell {}
