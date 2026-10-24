import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  imports: [RouterLink],
  selector: 'app-not-found',
  template: `
    <main class="min-h-screen flex items-center justify-center px-5 text-center">
      <div class="max-w-md">
        <p class="text-teal font-bold uppercase tracking-[.35em] text-xs mb-4">Error 404</p>
        <h1 class="font-display text-4xl md:text-5xl font-black" style="color:var(--plum)">
          No encontramos <span class="italic text-coral">este sitio</span>
        </h1>
        <p class="mt-4 font-medium" style="color:#5b4150">
          La dirección no existe o el negocio todavía no ha publicado su página.
        </p>
        <a routerLink="/" class="inline-block mt-8 bg-coral text-white font-bold px-8 py-3.5 rounded-full uppercase tracking-widest text-sm hover:brightness-110 transition-all">
          Ir al inicio
        </a>
      </div>
    </main>
  `,
})
export class NotFound {}
