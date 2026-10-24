import { Component, input } from '@angular/core';
import { FormArray, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { notBlank } from './forms';

@Component({
  imports: [ReactiveFormsModule],
  selector: 'app-string-list-editor',
  host: { class: 'block' },
  template: `
    <fieldset>
      <legend class="text-xs font-bold uppercase tracking-wider text-muted">{{ legend() }} ({{ array().length }}/{{ max() }})</legend>
      <ul class="mt-3 space-y-2">
        @for (control of array().controls; track control; let index = $index) {
          <li class="anim-fade-in">
            <div class="flex gap-2">
              <input [formControl]="control" [maxlength]="itemMaxLength()" [attr.aria-label]="itemLabel() + ' ' + (index + 1)"
                     class="input flex-1 min-w-0">
              @if (!readonly()) {
                <button type="button" (click)="remove(index)" [attr.aria-label]="'Quitar ' + itemLabel().toLowerCase() + ' ' + (index + 1)"
                        class="btn btn-ghost btn-sm text-danger !px-3">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
                </button>
              }
            </div>
            @if (control.touched && control.invalid) {
              <p role="alert" class="mt-1 text-xs font-bold text-danger">
                {{ control.errors?.['server'] ?? 'No puede estar vacío ni superar ' + itemMaxLength() + ' caracteres.' }}
              </p>
            }
          </li>
        }
      </ul>
      @if (!readonly()) {
        <button type="button" (click)="add()" [disabled]="array().length >= max()"
                class="btn btn-secondary btn-sm mt-3">+ {{ addLabel() }}</button>
      }
    </fieldset>
  `,
})
export class StringListEditor {
  readonly array = input.required<FormArray<FormControl<string>>>();
  readonly max = input.required<number>();
  readonly legend = input.required<string>();
  readonly itemLabel = input.required<string>();
  readonly addLabel = input('Añadir');
  readonly itemMaxLength = input(80);
  readonly readonly = input(false);

  protected add(): void {
    const array = this.array();
    if (array.length >= this.max()) {
      return;
    }
    array.push(new FormControl('', { nonNullable: true, validators: [notBlank, Validators.maxLength(this.itemMaxLength())] }));
    array.markAsDirty();
  }

  protected remove(index: number): void {
    const array = this.array();
    array.removeAt(index);
    array.markAsDirty();
  }
}
