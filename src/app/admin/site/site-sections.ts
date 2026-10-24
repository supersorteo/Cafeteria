import { Component, Directive, inject, input, signal } from '@angular/core';
import { FormArray, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Field } from '../../shared/field';
import { supportedTimezones } from '../../shared/forms';
import { StringListEditor } from '../../shared/string-list-editor';
import { Tabs } from '../../shared/ui/tabs';
import { CURRENCIES, HighlightGroup, LOCALES, SiteForm, StatGroup, fieldError, newHighlight, newStat } from './site-form';

@Directive()
abstract class SiteSection {
  readonly form = input.required<SiteForm>();

  protected err(name: keyof SiteForm['controls'], patternMessage?: string): string | null {
    return fieldError(this.form(), name, patternMessage);
  }
}

@Component({
  imports: [ReactiveFormsModule, Field],
  selector: 'app-site-business',
  host: { class: 'block' },
  template: `
    <div class="space-y-5">
      <p class="text-sm font-medium text-muted">
        Dirección de tu sitio: <strong class="text-ink">{{ origin }}/{{ slug() }}</strong> (no se puede cambiar).
      </p>
      <div class="grid sm:grid-cols-2 gap-5">
        <app-field label="Nombre" forId="s-name" [error]="err('name')">
          <input id="s-name" [formControl]="form().controls.name" maxlength="120" class="input">
        </app-field>
        <app-field label="Tipo de negocio (opcional)" forId="s-descriptor" [error]="err('descriptor')" hint="Ej. Bar &amp; Cocina">
          <input id="s-descriptor" [formControl]="form().controls.descriptor" maxlength="60" class="input">
        </app-field>
      </div>
      <div class="grid sm:grid-cols-2 gap-5">
        <app-field label="Moneda" forId="s-currency" [error]="err('currency')">
          <select id="s-currency" [formControl]="form().controls.currency" class="input">
            @for (currency of currencies; track currency.code) { <option [value]="currency.code">{{ currency.label }}</option> }
          </select>
        </app-field>
        <app-field label="Idioma y formato" forId="s-locale" [error]="err('locale')">
          <select id="s-locale" [formControl]="form().controls.locale" class="input">
            @for (locale of locales; track locale.code) { <option [value]="locale.code">{{ locale.label }}</option> }
          </select>
        </app-field>
      </div>
      <app-field label="Zona horaria" forId="s-timezone" [error]="err('timezone')">
        <input id="s-timezone" [formControl]="form().controls.timezone" list="timezones" maxlength="64" class="input">
        <datalist id="timezones">
          @for (zone of timezones; track zone) { <option [value]="zone"></option> }
        </datalist>
      </app-field>
      <p class="text-xs font-medium text-muted">Cambiar la moneda no convierte los precios de tu carta: habría que actualizarlos a mano.</p>
    </div>
  `,
})
export class SiteBusinessSection extends SiteSection {
  readonly slug = input.required<string>();
  protected readonly origin = typeof location === 'undefined' ? '' : location.origin;
  protected readonly currencies = CURRENCIES;
  protected readonly locales = LOCALES;
  protected readonly timezones = supportedTimezones();
}

@Component({
  imports: [ReactiveFormsModule, Field],
  selector: 'app-site-contact',
  host: { class: 'block' },
  template: `
    <div class="space-y-5">
      <app-field label="WhatsApp" forId="s-whatsapp" [error]="err('whatsappNumber', 'Entre 8 y 15 dígitos, sin + ni espacios.')"
                 hint="Con código de país, sin + (ej. 59899123456). Obligatorio para publicar.">
        <input id="s-whatsapp" [formControl]="form().controls.whatsappNumber" inputmode="numeric" class="input">
      </app-field>
      <div class="grid sm:grid-cols-2 gap-5">
        <app-field label="Teléfono (opcional)" forId="s-phone" [error]="err('phone')">
          <input id="s-phone" [formControl]="form().controls.phone" maxlength="30" class="input">
        </app-field>
        <app-field label="Correo de contacto (opcional)" forId="s-email" [error]="err('email')">
          <input id="s-email" type="email" [formControl]="form().controls.email" maxlength="254" class="input">
        </app-field>
      </div>
      <app-field label="Dirección (opcional)" forId="s-address" [error]="err('address')">
        <input id="s-address" [formControl]="form().controls.address" maxlength="255" class="input">
      </app-field>
      <app-field label="Horarios (opcional)" forId="s-schedule" [error]="err('schedule')" hint="Una línea por franja horaria.">
        <textarea id="s-schedule" [formControl]="form().controls.schedule" rows="3" maxlength="500" class="input resize-none"></textarea>
      </app-field>
    </div>
  `,
})
export class SiteContactSection extends SiteSection {}

@Component({
  imports: [ReactiveFormsModule, Field],
  selector: 'app-site-brand',
  host: { class: 'block' },
  template: `
    <div class="brand-preview rounded-ui-lg p-5 text-white" [style.background]="'linear-gradient(135deg,' + form().controls.primaryColor.value + ',' + form().controls.accentColor.value + ')'" aria-hidden="true">
      <p class="text-xs font-bold uppercase tracking-widest opacity-90">Vista previa</p>
      <p class="font-display text-2xl font-black leading-tight mt-1">{{ form().controls.name.value || 'Tu negocio' }}</p>
      <span class="inline-block mt-3 rounded-full bg-white/95 px-4 py-1.5 text-xs font-bold" [style.color]="form().controls.primaryColor.value">Reservar</span>
    </div>
    <div class="mt-5 grid sm:grid-cols-2 gap-5">
      <app-field label="Color principal" forId="s-primary" [error]="err('primaryColor', 'Usa un color con el formato #FF5C39.')">
        <div class="flex gap-3 items-center">
          <input type="color" [value]="form().controls.primaryColor.value" [disabled]="form().disabled" aria-label="Elegir color principal"
                 (input)="setColor('primaryColor', $event)" class="color-swatch">
          <input id="s-primary" [formControl]="form().controls.primaryColor" maxlength="7" class="input flex-1">
        </div>
      </app-field>
      <app-field label="Color de acento" forId="s-accent" [error]="err('accentColor', 'Usa un color con el formato #0E8388.')">
        <div class="flex gap-3 items-center">
          <input type="color" [value]="form().controls.accentColor.value" [disabled]="form().disabled" aria-label="Elegir color de acento"
                 (input)="setColor('accentColor', $event)" class="color-swatch">
          <input id="s-accent" [formControl]="form().controls.accentColor" maxlength="7" class="input flex-1">
        </div>
      </app-field>
    </div>
  `,
})
export class SiteBrandSection extends SiteSection {
  protected setColor(name: 'primaryColor' | 'accentColor', event: Event): void {
    const control = this.form().controls[name];
    control.setValue((event.target as HTMLInputElement).value.toUpperCase());
    control.markAsDirty();
  }
}

@Component({
  imports: [ReactiveFormsModule, Field, Tabs],
  selector: 'app-site-texts',
  host: { class: 'block' },
  template: `
    <app-tabs [tabs]="tabs" [(selected)]="tab" label="Textos del sitio" />
    <p class="mt-4 text-sm font-medium text-muted">
      En los títulos, pulsa Enter para cambiar de línea y rodea una palabra con *asteriscos* para resaltarla.
    </p>
    <div class="mt-4 space-y-5" role="tabpanel" [attr.aria-labelledby]="'tab-' + tab()" [id]="'panel-' + tab()">
      @if (tab() === 'hero') {
        <app-field label="Frase corta de la portada (opcional)" forId="s-tagline" [error]="err('tagline')">
          <input id="s-tagline" [formControl]="form().controls.tagline" maxlength="160" class="input">
        </app-field>
        <app-field label="Título de la portada (opcional)" forId="s-hero-title" [error]="err('heroTitle')">
          <textarea id="s-hero-title" [formControl]="form().controls.heroTitle" rows="2" maxlength="160" class="input resize-none"></textarea>
        </app-field>
        <app-field label="Descripción de la portada (opcional)" forId="s-hero-description" [error]="err('heroDescription')">
          <textarea id="s-hero-description" [formControl]="form().controls.heroDescription" rows="3" maxlength="600" class="input resize-none"></textarea>
        </app-field>
        <app-field label="Etiqueta sobre la foto de portada (opcional)" forId="s-hero-caption" [error]="err('heroCaption')">
          <input id="s-hero-caption" [formControl]="form().controls.heroCaption" maxlength="80" class="input">
        </app-field>
      } @else {
        <app-field label="Título de «Nosotros» (opcional)" forId="s-about-title" [error]="err('aboutTitle')">
          <textarea id="s-about-title" [formControl]="form().controls.aboutTitle" rows="2" maxlength="120" class="input resize-none"></textarea>
        </app-field>
        <app-field label="Texto de «Nosotros» (opcional)" forId="s-about-text" [error]="err('aboutText')">
          <textarea id="s-about-text" [formControl]="form().controls.aboutText" rows="5" maxlength="2000" class="input resize-none"></textarea>
        </app-field>
        <app-field label="Texto del pie de página (opcional)" forId="s-footer" [error]="err('footerText')">
          <input id="s-footer" [formControl]="form().controls.footerText" maxlength="200" class="input">
        </app-field>
      }
    </div>
  `,
})
export class SiteTextsSection extends SiteSection {
  protected readonly tabs = [
    { id: 'hero', label: 'Portada' },
    { id: 'about', label: 'Nosotros y pie' },
  ];
  protected readonly tab = signal('hero');
}

@Component({
  imports: [ReactiveFormsModule, StringListEditor, Tabs],
  selector: 'app-site-highlights',
  host: { class: 'block' },
  template: `
    <app-tabs [tabs]="tabs" [(selected)]="tab" label="Contenido destacado" />
    <div class="mt-5" role="tabpanel" [attr.aria-labelledby]="'tab-' + tab()" [id]="'panel-' + tab()">
      @switch (tab()) {
        @case ('marquee') {
          <app-string-list-editor [array]="form().controls.marqueeItems" [max]="8" legend="Frases que se desplazan" itemLabel="Frase"
                                  addLabel="Añadir frase" [itemMaxLength]="80" [readonly]="form().disabled" />
        }
        @case ('stats') {
          <fieldset>
            <legend class="text-xs font-bold uppercase tracking-wider text-muted">Cifras ({{ form().controls.stats.length }}/3)</legend>
            <ul class="mt-3 space-y-3">
              @for (group of form().controls.stats.controls; track group; let index = $index) {
                <li class="flex flex-wrap gap-2 items-start anim-fade-in">
                  <input [formControl]="group.controls.label" maxlength="40" [attr.aria-label]="'Texto de la cifra ' + (index + 1)" placeholder="Años de historia"
                         class="input flex-1 min-w-[10rem]">
                  <input type="number" [formControl]="group.controls.value" min="0" max="999999" [attr.aria-label]="'Valor de la cifra ' + (index + 1)"
                         class="input !w-28">
                  @if (form().enabled) {
                    <button type="button" (click)="removeFrom(form().controls.stats, index)" [attr.aria-label]="'Quitar cifra ' + (index + 1)" class="btn btn-ghost btn-sm text-danger !px-3">✕</button>
                  }
                  @if ((group.controls.label.touched || group.controls.value.touched) && group.invalid) {
                    <p role="alert" class="w-full text-xs font-bold text-danger">Escribe un texto (máx. 40) y un valor entero entre 0 y 999999.</p>
                  }
                </li>
              }
            </ul>
            @if (form().enabled) {
              <button type="button" data-add-stat (click)="addStat()" [disabled]="form().controls.stats.length >= 3" class="btn btn-secondary btn-sm mt-3">+ Añadir cifra</button>
            }
          </fieldset>
        }
        @case ('highlights') {
          <fieldset>
            <legend class="text-xs font-bold uppercase tracking-wider text-muted">Espacios y promociones ({{ form().controls.highlights.length }}/3)</legend>
            <ul class="mt-3 space-y-3">
              @for (group of form().controls.highlights.controls; track group; let index = $index) {
                <li class="grid sm:grid-cols-[1fr_2fr_auto] gap-2 items-start anim-fade-in">
                  <input [formControl]="group.controls.title" maxlength="60" [attr.aria-label]="'Título del espacio ' + (index + 1)" placeholder="Terraza" class="input">
                  <input [formControl]="group.controls.description" maxlength="200" [attr.aria-label]="'Descripción del espacio ' + (index + 1)" placeholder="Aire libre y música en vivo" class="input">
                  @if (form().enabled) {
                    <button type="button" (click)="removeFrom(form().controls.highlights, index)" [attr.aria-label]="'Quitar espacio ' + (index + 1)" class="btn btn-ghost btn-sm text-danger !px-3">✕</button>
                  }
                  @if ((group.controls.title.touched || group.controls.description.touched) && group.invalid) {
                    <p role="alert" class="sm:col-span-3 text-xs font-bold text-danger">Escribe un título (máx. 60); la descripción admite hasta 200 caracteres.</p>
                  }
                </li>
              }
            </ul>
            @if (form().enabled) {
              <button type="button" data-add-highlight (click)="addHighlight()" [disabled]="form().controls.highlights.length >= 3" class="btn btn-secondary btn-sm mt-3">+ Añadir espacio</button>
            }
          </fieldset>
        }
        @default {
          <div class="space-y-8">
            <app-string-list-editor [array]="form().controls.reservationAreas" [max]="8" legend="Zonas para reservar" itemLabel="Zona"
                                    addLabel="Añadir zona" [itemMaxLength]="40" [readonly]="form().disabled" />
            <app-string-list-editor [array]="form().controls.partySizes" [max]="10" legend="Opciones de personas" itemLabel="Opción"
                                    addLabel="Añadir opción" [itemMaxLength]="20" [readonly]="form().disabled" />
          </div>
        }
      }
    </div>
  `,
})
export class SiteHighlightsSection extends SiteSection {
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly tabs = [
    { id: 'marquee', label: 'Frases' },
    { id: 'stats', label: 'Cifras' },
    { id: 'highlights', label: 'Espacios' },
    { id: 'booking', label: 'Reservas' },
  ];
  protected readonly tab = signal('marquee');

  protected addStat(): void {
    const array = this.form().controls.stats;
    if (array.length < 3) {
      array.push(newStat(this.fb, '', 0));
      array.markAsDirty();
    }
  }

  protected addHighlight(): void {
    const array = this.form().controls.highlights;
    if (array.length < 3) {
      array.push(newHighlight(this.fb, '', ''));
      array.markAsDirty();
    }
  }

  protected removeFrom(array: FormArray<StatGroup> | FormArray<HighlightGroup>, index: number): void {
    array.removeAt(index);
    array.markAsDirty();
  }
}
