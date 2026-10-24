import { Component, input, model } from '@angular/core';

export interface TabItem {
  id: string;
  label: string;
}

@Component({
  selector: 'app-tabs',
  host: { class: 'block' },
  template: `
    <div class="tabs" role="tablist" [attr.aria-label]="label()" (keydown)="onKey($event)">
      @for (tab of tabs(); track tab.id) {
        <button type="button" role="tab" class="tab" [id]="'tab-' + tab.id" [attr.aria-selected]="tab.id === selected()"
                [attr.aria-controls]="'panel-' + tab.id" [attr.tabindex]="tab.id === selected() ? 0 : -1" (click)="selected.set(tab.id)">
          {{ tab.label }}
        </button>
      }
    </div>
  `,
})
export class Tabs {
  readonly tabs = input.required<readonly TabItem[]>();
  readonly label = input('Secciones');
  readonly selected = model.required<string>();

  protected onKey(event: KeyboardEvent): void {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) {
      return;
    }
    const tabs = this.tabs();
    const index = tabs.findIndex(tab => tab.id === this.selected());
    const next = tabs[(index + step + tabs.length) % tabs.length];
    this.selected.set(next.id);
    const list = event.currentTarget as HTMLElement;
    queueMicrotask(() => list.querySelector<HTMLElement>(`#tab-${next.id}`)?.focus());
    event.preventDefault();
  }
}
