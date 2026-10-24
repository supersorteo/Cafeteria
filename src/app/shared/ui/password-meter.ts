import { Component, computed, input } from '@angular/core';

export function passwordStrength(value: string): number {
  if (!value) {
    return 0;
  }
  let score = 0;
  if (value.length >= 10) score++;
  if (value.length >= 14) score++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score++;
  return Math.max(1, score);
}

const LABELS = ['', 'Débil', 'Regular', 'Buena', 'Excelente'];

@Component({
  selector: 'app-password-meter',
  host: { class: 'block' },
  template: `
    <div class="flex items-center gap-2" aria-live="polite">
      <div class="flex-1 grid grid-cols-4 gap-1.5" aria-hidden="true">
        @for (step of steps; track step) {
          <span class="h-1.5 rounded-full bg-surface-2 overflow-hidden"><span class="meter-fill" [class.on]="level() >= step" [attr.data-level]="level()"></span></span>
        }
      </div>
      <span class="text-xs font-bold text-muted w-16 text-right">{{ label() }}</span>
    </div>
  `,
})
export class PasswordMeter {
  readonly value = input('');
  protected readonly steps = [1, 2, 3, 4];
  protected readonly level = computed(() => passwordStrength(this.value()));
  protected readonly label = computed(() => LABELS[this.level()]);
}
