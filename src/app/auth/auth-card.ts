import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  imports: [RouterLink],
  selector: 'app-auth-card',
  template: `
    <main class="min-h-screen flex items-center justify-center px-5 py-12">
      <div class="w-full max-w-md">
        <a routerLink="/" class="block text-center font-display text-2xl font-black text-coral mb-6">Panel de administración</a>
        <div class="bg-white rounded-3xl p-6 md:p-10 shadow-2xl border-t-8" style="border-color:var(--coral)">
          <h1 class="font-display text-3xl font-black" style="color:var(--plum)">{{ title() }}</h1>
          @if (subtitle()) {
            <p class="mt-2 font-medium" style="color:#5b4150">{{ subtitle() }}</p>
          }
          <div class="mt-8">
            <ng-content />
          </div>
        </div>
        <div class="mt-6 text-center text-sm font-medium" style="color:#5b4150">
          <ng-content select="[footer]" />
        </div>
      </div>
    </main>
  `,
})
export class AuthCard {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
}
