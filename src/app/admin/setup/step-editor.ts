import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublishPanel } from './publish-panel';
import { SiteSettingsStore } from './site-settings.store';
import { StepId, stepById } from './setup-steps';
import { StepAboutForm, StepAmbienceForm, StepBasicsForm, StepBookingForm, StepBrandForm, StepContactForm, StepHeroForm } from './step-forms';

@Component({
  imports: [RouterLink, PublishPanel, StepBasicsForm, StepBrandForm, StepHeroForm, StepAboutForm, StepAmbienceForm, StepBookingForm, StepContactForm],
  selector: 'app-step-editor',
  host: { class: 'block' },
  template: `
    <p class="text-sm font-medium text-muted">{{ def().why }}</p>
    <p class="mt-1 mb-5 text-xs font-bold text-primary">Dónde se ve: {{ def().where }}</p>

    @switch (step()) {
      @case ('basics') { <app-step-basics /> }
      @case ('brand') { <app-step-brand /> }
      @case ('menu') {
        <div class="card p-5 text-center">
          <p class="font-display text-3xl font-black">{{ store.dashboard()?.activeItems ?? 0 }}</p>
          <p class="text-sm font-medium text-muted">productos activos en {{ store.dashboard()?.categories ?? 0 }} categorías</p>
          <a [routerLink]="['/admin/menu']" [queryParams]="{ from: 'setup' }" data-open-menu class="btn btn-primary mt-4">Abrir mi carta</a>
        </div>
      }
      @case ('hero') { <app-step-hero /> }
      @case ('about') { <app-step-about /> }
      @case ('ambience') { <app-step-ambience /> }
      @case ('booking') { <app-step-booking /> }
      @case ('contact') { <app-step-contact /> }
      @case ('publish') { <app-publish-panel (openStep)="openStep.emit($event)" /> }
    }
  `,
})
export class StepEditor {
  protected readonly store = inject(SiteSettingsStore);

  readonly step = input.required<StepId>();
  readonly openStep = output<StepId>();
  protected readonly def = computed(() => stepById(this.step()));
}
