import { Component, ElementRef, inject, signal } from '@angular/core';

@Component({
  selector: 'app-password-toggle',
  host: { class: 'block relative' },
  template: `
    <ng-content />
    <button type="button" class="pw-toggle icon-btn" (click)="toggle()" [attr.aria-label]="visible() ? 'Ocultar contraseña' : 'Mostrar contraseña'" [attr.aria-pressed]="visible()">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        @if (visible()) {
          <path d="M3 3l18 18M10.6 6.1A9.5 9.5 0 0 1 12 6c5 0 8.5 4 9.5 6a12.8 12.8 0 0 1-2.7 3.5M6.6 6.7A12.7 12.7 0 0 0 2.5 12c1 2 4.5 6 9.5 6 1.5 0 2.8-.4 4-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>
        } @else {
          <path d="M2.5 12C3.5 10 7 6 12 6s8.5 4 9.5 6c-1 2-4.5 6-9.5 6s-8.5-4-9.5-6z"/><circle cx="12" cy="12" r="3"/>
        }
      </svg>
    </button>
  `,
})
export class PasswordToggle {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  protected readonly visible = signal(false);

  protected toggle(): void {
    this.visible.update(value => !value);
    const input = this.host.querySelector('input');
    if (input) {
      input.type = this.visible() ? 'text' : 'password';
    }
  }
}
