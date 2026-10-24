import { Component, input } from '@angular/core';

@Component({
  selector: 'app-field',
  host: { class: 'block' },
  template: `
    <div>
      <label [for]="forId()" class="text-xs font-bold uppercase tracking-wider text-muted">{{ label() }}</label>
      <div class="mt-2"><ng-content /></div>
      @if (error(); as message) {
        <p role="alert" class="mt-1.5 text-xs font-bold text-danger anim-fade-in">{{ message }}</p>
      } @else if (hint()) {
        <p class="mt-1.5 text-xs font-medium text-muted">{{ hint() }}</p>
      }
    </div>
  `,
})
export class Field {
  readonly label = input.required<string>();
  readonly forId = input.required<string>();
  readonly error = input<string | null>(null);
  readonly hint = input<string>('');
}
