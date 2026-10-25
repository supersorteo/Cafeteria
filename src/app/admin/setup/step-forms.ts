import { Component, Directive, inject } from '@angular/core';
import { AutosizeDirective } from '../../shared/ui/autosize.directive';
import { FormArray, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Field } from '../../shared/field';
import { supportedTimezones } from '../../shared/forms';
import { StringListEditor } from '../../shared/string-list-editor';
import { CURRENCIES, HighlightGroup, LOCALES, SiteForm, StatGroup, fieldError, newHighlight, newStat } from '../site/site-form';
import { SiteImagesEditor } from '../site/site-images-editor';
import { SiteSettingsStore } from './site-settings.store';

@Directive()
abstract class StepForm {
  protected readonly store = inject(SiteSettingsStore);
  protected readonly fb = inject(NonNullableFormBuilder);

  protected get form(): SiteForm {
    return this.store.form;
  }

  protected err(name: keyof SiteForm['controls'], patternMessage?: string): string | null {
    return fieldError(this.form, name, patternMessage);
  }
}

@Component({
  imports: [ReactiveFormsModule, Field],
  selector: 'app-step-basics',
  host: { class: 'block' },
  template: `
    <div class="space-y-5">
      <div class="grid sm:grid-cols-2 gap-5">
        <app-field label="Nombre del negocio" forId="s-name" [error]="err('name')">
          <input id="s-name" [formControl]="form.controls.name" maxlength="120" class="input">
        </app-field>
        <app-field label="Tipo de negocio (opcional)" forId="s-descriptor" [error]="err('descriptor')" hint="Ej. Bar &amp; Cocina">
          <input id="s-descriptor" [formControl]="form.controls.descriptor" maxlength="60" class="input">
        </app-field>
      </div>
      <app-field label="WhatsApp para reservas" forId="s-whatsapp" [error]="err('whatsappNumber', 'Entre 8 y 15 dígitos, sin + ni espacios.')"
                 hint="Con código de país, sin + (ej. 59899123456). Es obligatorio para publicar.">
        <input id="s-whatsapp" [formControl]="form.controls.whatsappNumber" inputmode="numeric" class="input">
      </app-field>
      <div class="grid sm:grid-cols-2 gap-5">
        <app-field label="Moneda" forId="s-currency" [error]="err('currency')">
          <select id="s-currency" [formControl]="form.controls.currency" class="input">
            @for (currency of currencies; track currency.code) { <option [value]="currency.code">{{ currency.label }}</option> }
          </select>
        </app-field>
        <app-field label="Idioma y formato" forId="s-locale" [error]="err('locale')">
          <select id="s-locale" [formControl]="form.controls.locale" class="input">
            @for (locale of locales; track locale.code) { <option [value]="locale.code">{{ locale.label }}</option> }
          </select>
        </app-field>
      </div>
      <app-field label="Zona horaria" forId="s-timezone" [error]="err('timezone')">
        <input id="s-timezone" [formControl]="form.controls.timezone" list="timezones" maxlength="64" class="input">
        <datalist id="timezones">
          @for (zone of timezones; track zone) { <option [value]="zone"></option> }
        </datalist>
      </app-field>
      <p class="text-xs font-medium text-muted">
        Dirección de tu sitio: <strong class="text-ink">{{ origin }}/{{ store.settings()?.slug }}</strong> (no se puede cambiar).
        Cambiar la moneda no convierte los precios de tu carta: habría que actualizarlos a mano.
      </p>
    </div>
  `,
})
export class StepBasicsForm extends StepForm {
  protected readonly origin = typeof location === 'undefined' ? '' : location.origin;
  protected readonly currencies = CURRENCIES;
  protected readonly locales = LOCALES;
  protected readonly timezones = supportedTimezones();
}

@Component({
  imports: [ReactiveFormsModule, Field, SiteImagesEditor],
  selector: 'app-step-brand',
  host: { class: 'block' },
  template: `
    @if (store.imagesState(); as images) {
      <app-site-images-editor [images]="images" [blocks]="['logo']" [embedded]="true" [readonly]="!store.isOwner()" (saved)="store.onImagesSaved($event)" />
    }
    <div class="brand-preview rounded-ui-lg p-5 text-white mt-6" [style.background]="'linear-gradient(135deg,' + form.controls.primaryColor.value + ',' + form.controls.accentColor.value + ')'" aria-hidden="true">
      <p class="text-xs font-bold uppercase tracking-widest opacity-90">Vista previa de colores</p>
      <p class="font-display text-2xl font-black leading-tight mt-1">{{ form.controls.name.value || 'Tu negocio' }}</p>
      <span class="inline-block mt-3 rounded-full bg-white/95 px-4 py-1.5 text-xs font-bold" [style.color]="form.controls.primaryColor.value">Reservar</span>
    </div>
    <div class="mt-5 grid sm:grid-cols-2 gap-5">
      <app-field label="Color principal" forId="s-primary" [error]="err('primaryColor', 'Usa un color con el formato #FF5C39.')">
        <div class="flex gap-3 items-center">
          <input type="color" [value]="form.controls.primaryColor.value" [disabled]="form.disabled" aria-label="Elegir color principal"
                 (input)="setColor('primaryColor', $event)" class="color-swatch">
          <input id="s-primary" [formControl]="form.controls.primaryColor" maxlength="7" class="input flex-1">
        </div>
      </app-field>
      <app-field label="Color de acento" forId="s-accent" [error]="err('accentColor', 'Usa un color con el formato #0E8388.')">
        <div class="flex gap-3 items-center">
          <input type="color" [value]="form.controls.accentColor.value" [disabled]="form.disabled" aria-label="Elegir color de acento"
                 (input)="setColor('accentColor', $event)" class="color-swatch">
          <input id="s-accent" [formControl]="form.controls.accentColor" maxlength="7" class="input flex-1">
        </div>
      </app-field>
    </div>
  `,
})
export class StepBrandForm extends StepForm {
  protected setColor(name: 'primaryColor' | 'accentColor', event: Event): void {
    const control = this.form.controls[name];
    control.setValue((event.target as HTMLInputElement).value.toUpperCase());
    control.markAsDirty();
  }
}

@Component({
  imports: [AutosizeDirective, ReactiveFormsModule, Field, StringListEditor, SiteImagesEditor],
  selector: 'app-step-hero',
  host: { class: 'block' },
  template: `
    <div class="space-y-5">
      <p class="text-sm font-medium text-muted">
        En los títulos, pulsa Enter para cambiar de línea y rodea una palabra con *asteriscos* para resaltarla.
      </p>
      <app-field label="Frase corta de la portada (opcional)" forId="s-tagline" [error]="err('tagline')">
        <input id="s-tagline" [formControl]="form.controls.tagline" maxlength="160" class="input">
      </app-field>
      <app-field label="Título de la portada (opcional)" forId="s-hero-title" [error]="err('heroTitle')">
        <textarea appAutosize id="s-hero-title" [formControl]="form.controls.heroTitle" rows="2" maxlength="160" class="input resize-none"></textarea>
      </app-field>
      <app-field label="Descripción de la portada (opcional)" forId="s-hero-description" [error]="err('heroDescription')">
        <textarea appAutosize id="s-hero-description" [formControl]="form.controls.heroDescription" rows="3" maxlength="600" class="input resize-none"></textarea>
      </app-field>
      <app-field label="Etiqueta sobre la foto de portada (opcional)" forId="s-hero-caption" [error]="err('heroCaption')">
        <input id="s-hero-caption" [formControl]="form.controls.heroCaption" maxlength="80" class="input">
      </app-field>
      @if (store.imagesState(); as images) {
        <app-site-images-editor [images]="images" [blocks]="['hero']" [embedded]="true" [readonly]="!store.isOwner()" (saved)="store.onImagesSaved($event)" />
      }
      <app-string-list-editor [array]="form.controls.marqueeItems" [max]="8" legend="Frases que se desplazan bajo la portada" itemLabel="Frase"
                              addLabel="Añadir frase" [itemMaxLength]="80" [readonly]="form.disabled" />
    </div>
  `,
})
export class StepHeroForm extends StepForm {}

@Component({
  imports: [AutosizeDirective, ReactiveFormsModule, Field, SiteImagesEditor],
  selector: 'app-step-about',
  host: { class: 'block' },
  template: `
    <div class="space-y-5">
      <app-field label="Título de «Nosotros» (opcional)" forId="s-about-title" [error]="err('aboutTitle')">
        <textarea appAutosize id="s-about-title" [formControl]="form.controls.aboutTitle" rows="2" maxlength="120" class="input resize-none"></textarea>
      </app-field>
      <app-field label="Texto de «Nosotros» (opcional)" forId="s-about-text" [error]="err('aboutText')">
        <textarea appAutosize id="s-about-text" [formControl]="form.controls.aboutText" rows="5" maxlength="2000" class="input resize-none"></textarea>
      </app-field>
      @if (store.imagesState(); as images) {
        <app-site-images-editor [images]="images" [blocks]="['about']" [embedded]="true" [readonly]="!store.isOwner()" (saved)="store.onImagesSaved($event)" />
      }
      <fieldset>
        <legend class="text-xs font-bold uppercase tracking-wider text-muted">Cifras ({{ form.controls.stats.length }}/3)</legend>
        <ul class="mt-3 space-y-3">
          @for (group of form.controls.stats.controls; track group; let index = $index) {
            <li class="flex flex-wrap gap-2 items-start anim-fade-in">
              <input [formControl]="group.controls.label" maxlength="40" [attr.aria-label]="'Texto de la cifra ' + (index + 1)" placeholder="Años de historia"
                     class="input flex-1 min-w-[10rem]">
              <input type="number" [formControl]="group.controls.value" min="0" max="999999" [attr.aria-label]="'Valor de la cifra ' + (index + 1)"
                     class="input !w-28">
              @if (form.enabled) {
                <button type="button" (click)="removeFrom(form.controls.stats, index)" [attr.aria-label]="'Quitar cifra ' + (index + 1)" class="btn btn-ghost btn-sm text-danger !px-3">✕</button>
              }
              @if ((group.controls.label.touched || group.controls.value.touched) && group.invalid) {
                <p role="alert" class="w-full text-xs font-bold text-danger">Escribe un texto (máx. 40) y un valor entero entre 0 y 999999.</p>
              }
            </li>
          }
        </ul>
        @if (form.enabled) {
          <button type="button" data-add-stat (click)="addStat()" [disabled]="form.controls.stats.length >= 3" class="btn btn-secondary btn-sm mt-3">+ Añadir cifra</button>
        }
      </fieldset>
    </div>
  `,
})
export class StepAboutForm extends StepForm {
  protected addStat(): void {
    const array = this.form.controls.stats;
    if (array.length < 3) {
      array.push(newStat(this.fb, '', 0));
      array.markAsDirty();
    }
  }

  protected removeFrom(array: FormArray<StatGroup>, index: number): void {
    array.removeAt(index);
    array.markAsDirty();
  }
}

@Component({
  imports: [ReactiveFormsModule, SiteImagesEditor],
  selector: 'app-step-ambience',
  host: { class: 'block' },
  template: `
    <div class="space-y-6">
      @if (store.imagesState(); as images) {
        <app-site-images-editor [images]="images" [blocks]="['gallery']" [embedded]="true" [readonly]="!store.isOwner()" (saved)="store.onImagesSaved($event)" />
      }
      <fieldset>
        <legend class="text-xs font-bold uppercase tracking-wider text-muted">Espacios y promociones ({{ form.controls.highlights.length }}/3)</legend>
        <ul class="mt-3 space-y-3">
          @for (group of form.controls.highlights.controls; track group; let index = $index) {
            <li class="grid sm:grid-cols-[1fr_2fr_auto] gap-2 items-start anim-fade-in">
              <input [formControl]="group.controls.title" maxlength="60" [attr.aria-label]="'Título del espacio ' + (index + 1)" placeholder="Terraza" class="input">
              <input [formControl]="group.controls.description" maxlength="200" [attr.aria-label]="'Descripción del espacio ' + (index + 1)" placeholder="Aire libre y música en vivo" class="input">
              @if (form.enabled) {
                <button type="button" (click)="removeFrom(form.controls.highlights, index)" [attr.aria-label]="'Quitar espacio ' + (index + 1)" class="btn btn-ghost btn-sm text-danger !px-3">✕</button>
              }
              @if ((group.controls.title.touched || group.controls.description.touched) && group.invalid) {
                <p role="alert" class="sm:col-span-3 text-xs font-bold text-danger">Escribe un título (máx. 60); la descripción admite hasta 200 caracteres.</p>
              }
            </li>
          }
        </ul>
        @if (form.enabled) {
          <button type="button" data-add-highlight (click)="addHighlight()" [disabled]="form.controls.highlights.length >= 3" class="btn btn-secondary btn-sm mt-3">+ Añadir espacio</button>
        }
      </fieldset>
    </div>
  `,
})
export class StepAmbienceForm extends StepForm {
  protected addHighlight(): void {
    const array = this.form.controls.highlights;
    if (array.length < 3) {
      array.push(newHighlight(this.fb, '', ''));
      array.markAsDirty();
    }
  }

  protected removeFrom(array: FormArray<HighlightGroup>, index: number): void {
    array.removeAt(index);
    array.markAsDirty();
  }
}

@Component({
  imports: [ReactiveFormsModule, StringListEditor],
  selector: 'app-step-booking',
  host: { class: 'block' },
  template: `
    <div class="space-y-8">
      <p class="text-sm font-medium text-muted">Si no añades nada, la página usa valores por defecto (de 2 a +10 personas, sin zonas).</p>
      <app-string-list-editor [array]="form.controls.reservationAreas" [max]="8" legend="Zonas para reservar" itemLabel="Zona"
                              addLabel="Añadir zona" [itemMaxLength]="40" [readonly]="form.disabled" />
      <app-string-list-editor [array]="form.controls.partySizes" [max]="10" legend="Opciones de personas" itemLabel="Opción"
                              addLabel="Añadir opción" [itemMaxLength]="20" [readonly]="form.disabled" />
    </div>
  `,
})
export class StepBookingForm extends StepForm {}

@Component({
  imports: [AutosizeDirective, ReactiveFormsModule, Field],
  selector: 'app-step-contact',
  host: { class: 'block' },
  template: `
    <div class="space-y-5">
      <div class="grid sm:grid-cols-2 gap-5">
        <app-field label="Teléfono (opcional)" forId="s-phone" [error]="err('phone')">
          <input id="s-phone" [formControl]="form.controls.phone" maxlength="30" class="input">
        </app-field>
        <app-field label="Correo de contacto (opcional)" forId="s-email" [error]="err('email')">
          <input id="s-email" type="email" [formControl]="form.controls.email" maxlength="254" class="input">
        </app-field>
      </div>
      <app-field label="Dirección (opcional)" forId="s-address" [error]="err('address')">
        <input id="s-address" [formControl]="form.controls.address" maxlength="255" class="input">
      </app-field>
      <app-field label="Horarios (opcional)" forId="s-schedule" [error]="err('schedule')" hint="Una línea por franja horaria.">
        <textarea appAutosize id="s-schedule" [formControl]="form.controls.schedule" rows="3" maxlength="500" class="input resize-none"></textarea>
      </app-field>
      <app-field label="Texto del pie de página (opcional)" forId="s-footer" [error]="err('footerText')">
        <input id="s-footer" [formControl]="form.controls.footerText" maxlength="200" class="input">
      </app-field>
    </div>
  `,
})
export class StepContactForm extends StepForm {}
