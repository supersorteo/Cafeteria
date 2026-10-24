import { Component, computed, inject } from '@angular/core';
import { ThemeMode, ThemeService } from '../../core/theme.service';

const NEXT: Record<ThemeMode, ThemeMode> = { light: 'dark', dark: 'system', system: 'light' };
const LABEL: Record<ThemeMode, string> = { light: 'Tema claro', dark: 'Tema oscuro', system: 'Tema del sistema' };

@Component({
  selector: 'app-theme-toggle',
  template: `
    <button type="button" class="icon-btn" (click)="cycle()" [attr.aria-label]="label() + '. Cambiar tema'" [attr.title]="label()">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        @switch (theme.mode()) {
          @case ('light') { <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/> }
          @case ('dark') { <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/> }
          @default { <rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/> }
        }
      </svg>
    </button>
  `,
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeService);
  protected readonly label = computed(() => LABEL[this.theme.mode()]);

  protected cycle(): void {
    this.theme.setMode(NEXT[this.theme.mode()]);
  }
}
