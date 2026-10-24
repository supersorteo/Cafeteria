import { Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  host: { class: 'block' },
  template: `
    <div class="flex flex-col items-center text-center py-10 px-4 anim-fade-up">
      <div class="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 8h16l-1.2 10.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8L4 8z"/><path d="M8 8a4 4 0 0 1 8 0"/>
        </svg>
      </div>
      <h3 class="mt-4 font-display text-xl font-black">{{ title() }}</h3>
      @if (text()) {
        <p class="mt-1.5 max-w-sm text-sm font-medium text-muted">{{ text() }}</p>
      }
      <div class="mt-5"><ng-content /></div>
    </div>
  `,
})
export class EmptyState {
  readonly title = input.required<string>();
  readonly text = input('');
}
