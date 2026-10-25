import { ChangeDetectionStrategy, Component, ElementRef, computed, input, viewChild } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { startWith, switchMap } from 'rxjs';
import { titleParts } from '../site-format';
import { AutosizeDirective } from './autosize.directive';

export function toggleHighlight(value: string, start: number, end: number): { value: string; start: number; end: number } | null {
  const selected = value.slice(start, end);
  if (!selected.trim()) {
    return null;
  }
  const wrapped = value[start - 1] === '*' && value[end] === '*';
  if (wrapped) {
    return { value: value.slice(0, start - 1) + selected + value.slice(end + 1), start: start - 1, end: end - 1 };
  }
  if (selected.includes('*')) {
    const clean = selected.replaceAll('*', '');
    return { value: value.slice(0, start) + clean + value.slice(end), start, end: start + clean.length };
  }
  const lines = selected.split('\n').map(line => (line.trim() ? line.replace(/^(\s*)(.*?)(\s*)$/, '$1*$2*$3') : line));
  const result = lines.join('\n');
  return { value: value.slice(0, start) + result + value.slice(end), start, end: start + result.length };
}

@Component({
  imports: [ReactiveFormsModule, AutosizeDirective],
  selector: 'app-highlight-title',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <textarea #box appAutosize [id]="inputId()" [formControl]="control()" rows="2" [attr.maxlength]="maxLength()" class="input resize-none"></textarea>
    @if (control().enabled) {
      <div class="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" data-highlight (mousedown)="$event.preventDefault()" (click)="highlight()" class="btn btn-secondary btn-sm">
          Resaltar con color
        </button>
        <span class="text-xs font-medium text-muted">Selecciona una palabra y pulsa el botón (otra vez para quitarlo).</span>
      </div>
    }
    @if (parts().length > 0) {
      <p class="mt-3 text-xs font-bold uppercase tracking-wider text-muted">Así se verá</p>
      <p class="mt-1 font-display text-2xl font-black leading-tight" data-title-preview>
        @for (part of parts(); track $index) {
          @if (part.lineBreak) {
            <br>
          } @else if (part.emphasis) {
            <span class="italic text-primary">{{ part.text }}</span>
          } @else {
            {{ part.text }}
          }
        }
      </p>
    }
  `,
})
export class HighlightTitle {
  readonly control = input.required<FormControl<string>>();
  readonly inputId = input.required<string>();
  readonly maxLength = input(160);

  private readonly box = viewChild.required<ElementRef<HTMLTextAreaElement>>('box');
  private readonly value = toSignal(
    toObservable(this.control).pipe(switchMap(control => control.valueChanges.pipe(startWith(control.value)))),
    { initialValue: '' },
  );
  protected readonly parts = computed(() => titleParts(this.value()));

  protected highlight(): void {
    const el = this.box().nativeElement;
    const next = toggleHighlight(el.value, el.selectionStart, el.selectionEnd);
    if (!next || next.value.length > this.maxLength()) {
      return;
    }
    const control = this.control();
    control.setValue(next.value);
    control.markAsDirty();
    el.value = next.value;
    el.focus();
    el.setSelectionRange(next.start, next.end);
  }
}
