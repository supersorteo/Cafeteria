import { Component, input } from '@angular/core';
import { FormArray, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { notBlank } from './forms';

@Component({
  imports: [ReactiveFormsModule],
  selector: 'app-string-list-editor',
  host: { class: 'block' },
  template: `
    <fieldset>
      <legend class="text-xs font-bold uppercase tracking-widest text-teal">{{ legend() }} ({{ array().length }}/{{ max() }})</legend>
      <ul class="mt-3 space-y-2">
        @for (control of array().controls; track control; let index = $index) {
          <li>
            <div class="flex gap-2">
              <input [formControl]="control" [maxlength]="itemMaxLength()" [attr.aria-label]="itemLabel() + ' ' + (index + 1)"
                     class="field flex-1 min-w-0 px-3 py-2 text-sm font-medium">
              @if (!readonly()) {
                <button type="button" (click)="remove(index)" [attr.aria-label]="'Quitar ' + itemLabel().toLowerCase() + ' ' + (index + 1)"
                        class="px-3 text-sm" style="color:#E63946">✕</button>
              }
            </div>
            @if (control.touched && control.invalid) {
              <p role="alert" class="mt-1 text-xs font-bold" style="color:#E63946">
                {{ control.errors?.['server'] ?? 'No puede estar vacío ni superar ' + itemMaxLength() + ' caracteres.' }}
              </p>
            }
          </li>
        }
      </ul>
      @if (!readonly()) {
        <button type="button" (click)="add()" [disabled]="array().length >= max()"
                class="mt-3 rounded-full border-2 px-4 py-1.5 text-xs font-bold uppercase tracking-widest disabled:opacity-40"
                style="border-color:var(--plum);color:var(--plum)">{{ addLabel() }}</button>
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
