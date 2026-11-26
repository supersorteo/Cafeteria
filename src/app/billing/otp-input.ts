import { Component, ElementRef, input, output, signal, viewChildren } from '@angular/core';

const LENGTH = 6;

@Component({
  selector: 'app-otp-input',
  host: { class: 'grid max-w-[21rem] grid-cols-6 gap-1.5 sm:gap-2', role: 'group', 'aria-label': 'Código de verificación de 6 dígitos' },
  template: `
    @for (slot of slots; track slot) {
      <input #box type="text" inputmode="numeric" maxlength="6" class="otp-box" [class.otp-filled]="!!digits()[slot]"
             [attr.aria-invalid]="invalid() || null" [attr.aria-label]="'Dígito ' + (slot + 1)" [attr.data-otp]="slot"
             [attr.autocomplete]="slot === 0 ? 'one-time-code' : 'off'" [value]="digits()[slot]" [disabled]="disabled()"
             (input)="typed(slot, $event)" (keydown)="key(slot, $event)" (paste)="pasted(slot, $event)" (focus)="selectAll($event)">
    }
  `,
})
export class OtpInput {
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly completed = output<string>();

  protected readonly slots = Array.from({ length: LENGTH }, (_, i) => i);
  protected readonly digits = signal<string[]>(Array<string>(LENGTH).fill(''));
  private readonly boxes = viewChildren<ElementRef<HTMLInputElement>>('box');

  focus(slot = 0): void {
    this.boxes()[Math.min(slot, LENGTH - 1)]?.nativeElement.focus();
  }

  fillCode(code: string): void {
    const clean = code.replace(/\D/g, '');
    if (clean.length === LENGTH) {
      this.fill(0, clean);
    }
  }

  clear(): void {
    this.digits.set(Array<string>(LENGTH).fill(''));
    this.boxes().forEach(box => (box.nativeElement.value = ''));
    this.focus(0);
  }

  protected typed(slot: number, event: Event): void {
    const field = event.target as HTMLInputElement;
    const clean = field.value.replace(/\D/g, '');
    if (clean.length > 1) {
      this.fill(slot, clean);
      return;
    }
    field.value = clean;
    this.update(slot, clean);
    if (clean) {
      this.focus(slot + 1);
    }
    this.emitIfComplete();
  }

  protected key(slot: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace' && !this.digits()[slot] && slot > 0) {
      event.preventDefault();
      this.update(slot - 1, '');
      this.boxes()[slot - 1].nativeElement.value = '';
      this.focus(slot - 1);
    } else if (event.key === 'ArrowLeft' && slot > 0) {
      event.preventDefault();
      this.focus(slot - 1);
    } else if (event.key === 'ArrowRight' && slot < LENGTH - 1) {
      event.preventDefault();
      this.focus(slot + 1);
    }
  }

  protected pasted(slot: number, event: ClipboardEvent): void {
    const text = event.clipboardData?.getData('text') ?? '';
    const clean = text.replace(/\D/g, '');
    if (clean) {
      event.preventDefault();
      this.fill(slot, clean);
    }
  }

  protected selectAll(event: Event): void {
    (event.target as HTMLInputElement).select();
  }

  private fill(from: number, value: string): void {
    const start = value.length >= LENGTH ? 0 : from;
    const next = [...this.digits()];
    for (let i = 0; i < value.length && start + i < LENGTH; i++) {
      next[start + i] = value[i];
    }
    this.digits.set(next);
    this.boxes().forEach((box, i) => (box.nativeElement.value = next[i]));
    this.focus(Math.min(start + value.length, LENGTH - 1));
    this.emitIfComplete();
  }

  private update(slot: number, digit: string): void {
    this.digits.update(current => current.map((value, i) => (i === slot ? digit : value)));
  }

  private emitIfComplete(): void {
    const code = this.digits().join('');
    if (code.length === LENGTH) {
      this.completed.emit(code);
    }
  }
}
