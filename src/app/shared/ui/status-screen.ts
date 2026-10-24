import { Component, input } from '@angular/core';

@Component({
  selector: 'app-status-screen',
  template: `
    <main class="status-screen relative min-h-screen flex items-center justify-center px-5 py-12 text-center overflow-hidden"
          [attr.role]="kind() === 'loading' ? 'status' : null" [attr.aria-busy]="kind() === 'loading' ? 'true' : null">
      <span class="status-orb status-orb-a" aria-hidden="true"></span>
      <span class="status-orb status-orb-b" aria-hidden="true"></span>
      <div class="relative max-w-md anim-fade-up">
        <svg class="status-art" viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          @switch (kind()) {
            @case ('notfound') {
              <g class="status-float">
                <circle cx="60" cy="64" r="42"/>
                <circle cx="60" cy="64" r="28" stroke-width="2" opacity=".55"/>
                <path d="M52 56c0-5 3.5-8 8-8s8 3 8 8c0 6-8 6-8 12M60 76v.01" stroke-width="4"/>
              </g>
              <path d="M24 14c0 8-4 8-4 16M36 12c0 8-4 8-4 16M48 12c0 7-3 7-3 14" stroke-width="2.5" opacity=".5" class="status-steam"/>
            }
            @case ('error') {
              <g class="status-float">
                <path d="M30 84a18 18 0 0 1 3-35 26 26 0 0 1 50 6 16 16 0 0 1 3 29H30z"/>
                <path d="M60 60v12M60 80v.01" stroke-width="4"/>
              </g>
            }
            @default {
              <circle cx="60" cy="60" r="40" opacity=".2"/>
              <path class="status-spin" d="M60 20a40 40 0 0 1 40 40"/>
              <circle cx="60" cy="60" r="20" stroke-width="2" opacity=".5"/>
            }
          }
        </svg>
        @if (eyebrow()) {
          <p class="text-primary font-bold uppercase tracking-[.3em] text-xs mb-3">{{ eyebrow() }}</p>
        }
        @if (kind() === 'loading') {
          <p class="font-display text-2xl font-black">{{ title() }}</p>
        } @else {
          <h1 class="font-display text-4xl md:text-5xl font-black leading-tight">{{ title() }}@if (accent()) { <span class="italic text-primary">{{ accent() }}</span> }</h1>
        }
        @if (message()) {
          <p class="mt-4 font-medium text-muted">{{ message() }}</p>
        }
        <div class="mt-8 flex flex-wrap justify-center gap-3"><ng-content /></div>
      </div>
    </main>
  `,
})
export class StatusScreen {
  readonly kind = input<'notfound' | 'error' | 'loading'>('loading');
  readonly title = input.required<string>();
  readonly accent = input('');
  readonly eyebrow = input('');
  readonly message = input('');
}
