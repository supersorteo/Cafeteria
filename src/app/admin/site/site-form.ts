import { AbstractControl, FormArray, FormControl, FormGroup, NonNullableFormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { ImageRef, SiteSettingsDetail, SiteSettingsPayload } from '../../core/site-admin.models';
import { DEFAULT_BRAND_STYLE } from '../../core/site-branding';
import { HEX_COLOR, describeErrors, notBlank, timezoneValidator } from '../../shared/forms';

export const CURRENCIES = [
  { code: 'UYU', label: 'Peso uruguayo (UYU)' },
  { code: 'USD', label: 'Dólar estadounidense (USD)' },
  { code: 'MXN', label: 'Peso mexicano (MXN)' },
  { code: 'EUR', label: 'Euro (EUR)' },
];
export const LOCALES = [
  { code: 'es-UY', label: 'Español (Uruguay)' },
  { code: 'es-MX', label: 'Español (México)' },
  { code: 'es-ES', label: 'Español (España)' },
];

export type StatGroup = FormGroup<{ label: FormControl<string>; value: FormControl<number | null> }>;
export type SpaceGroup = FormGroup<{
  name: FormControl<string>;
  description: FormControl<string>;
  bookable: FormControl<boolean>;
  image: FormControl<ImageRef | null>;
}>;
export const MAX_SPACES = 10;

function uniqueSpaceNames(control: AbstractControl): ValidationErrors | null {
  const names = (control as FormArray<SpaceGroup>).controls.map(group => group.controls.name.value.trim().toLowerCase()).filter(Boolean);
  return new Set(names).size === names.length ? null : { duplicateNames: true };
}
export type SiteForm = ReturnType<typeof createSiteForm>;

export function createSiteForm(fb: NonNullableFormBuilder) {
  return fb.group({
    name: ['', [notBlank, Validators.maxLength(120)]],
    descriptor: ['', Validators.maxLength(60)],
    whatsappNumber: ['', Validators.pattern(/^\d{8,15}$/)],
    phone: ['', Validators.maxLength(30)],
    email: ['', [Validators.email, Validators.maxLength(254)]],
    address: ['', Validators.maxLength(255)],
    schedule: ['', Validators.maxLength(500)],
    currency: ['UYU', Validators.required],
    locale: ['es-UY', Validators.required],
    timezone: ['America/Montevideo', [Validators.required, Validators.maxLength(64), timezoneValidator]],
    primaryColor: ['#FF5C39', [Validators.required, Validators.pattern(HEX_COLOR)]],
    accentColor: ['#0E8388', [Validators.required, Validators.pattern(HEX_COLOR)]],
    businessTitleColor: [DEFAULT_BRAND_STYLE.businessTitleColor, [Validators.required, Validators.pattern(HEX_COLOR)]],
    backgroundColor: [DEFAULT_BRAND_STYLE.backgroundColor, [Validators.required, Validators.pattern(HEX_COLOR)]],
    footerColor: [DEFAULT_BRAND_STYLE.footerColor, [Validators.required, Validators.pattern(HEX_COLOR)]],
    headingColor: [DEFAULT_BRAND_STYLE.headingColor, [Validators.required, Validators.pattern(HEX_COLOR)]],
    paragraphColor: [DEFAULT_BRAND_STYLE.paragraphColor, [Validators.required, Validators.pattern(HEX_COLOR)]],
    whatsappColor: [DEFAULT_BRAND_STYLE.whatsappColor, [Validators.required, Validators.pattern(HEX_COLOR)]],
    marqueeColor: [DEFAULT_BRAND_STYLE.marqueeColor, [Validators.required, Validators.pattern(HEX_COLOR)]],
    fontFamily: [DEFAULT_BRAND_STYLE.fontFamily, [Validators.required]],
    tagline: ['', Validators.maxLength(160)],
    heroTitle: ['', Validators.maxLength(160)],
    heroDescription: ['', Validators.maxLength(600)],
    heroCaption: ['', Validators.maxLength(80)],
    aboutTitle: ['', Validators.maxLength(120)],
    aboutText: ['', Validators.maxLength(2000)],
    footerText: ['', Validators.maxLength(200)],
    marqueeItems: fb.array<FormControl<string>>([]),
    partySizes: fb.array<FormControl<string>>([]),
    stats: fb.array<StatGroup>([]),
    spaces: fb.array<SpaceGroup>([], { validators: uniqueSpaceNames }),
  });
}

export function newStat(fb: NonNullableFormBuilder, label: string, value: number): StatGroup {
  return fb.group({
    label: [label, [notBlank, Validators.maxLength(40)]],
    value: [value as number | null, [Validators.required, Validators.min(0), Validators.max(999999), Validators.pattern(/^\d+$/)]],
  });
}

export function newSpace(fb: NonNullableFormBuilder, name = '', description = '', image: ImageRef | null = null, bookable = true): SpaceGroup {
  return fb.group({
    name: [name, [notBlank, Validators.maxLength(60)]],
    description: [description, Validators.maxLength(200)],
    bookable: [bookable],
    image: new FormControl<ImageRef | null>(image),
  });
}

function fillStrings(array: FormArray<FormControl<string>>, values: string[], maxLength: number): void {
  array.clear();
  values.forEach(value =>
    array.push(new FormControl(value, { nonNullable: true, validators: [Validators.required, Validators.maxLength(maxLength)] })),
  );
}

export function applySettings(form: SiteForm, fb: NonNullableFormBuilder, settings: SiteSettingsDetail, editable: boolean): void {
  form.patchValue({
    name: settings.name,
    descriptor: settings.descriptor ?? '',
    whatsappNumber: settings.whatsappNumber ?? '',
    phone: settings.phone ?? '',
    email: settings.email ?? '',
    address: settings.address ?? '',
    schedule: settings.schedule ?? '',
    currency: settings.currency,
    locale: settings.locale,
    timezone: settings.timezone,
    primaryColor: settings.primaryColor.toUpperCase(),
    accentColor: settings.accentColor.toUpperCase(),
    businessTitleColor: settings.businessTitleColor?.toUpperCase() ?? DEFAULT_BRAND_STYLE.businessTitleColor,
    backgroundColor: settings.backgroundColor?.toUpperCase() ?? DEFAULT_BRAND_STYLE.backgroundColor,
    footerColor: settings.footerColor?.toUpperCase() ?? DEFAULT_BRAND_STYLE.footerColor,
    headingColor: settings.headingColor?.toUpperCase() ?? DEFAULT_BRAND_STYLE.headingColor,
    paragraphColor: settings.paragraphColor?.toUpperCase() ?? DEFAULT_BRAND_STYLE.paragraphColor,
    whatsappColor: settings.whatsappColor?.toUpperCase() ?? DEFAULT_BRAND_STYLE.whatsappColor,
    marqueeColor: settings.marqueeColor?.toUpperCase() ?? DEFAULT_BRAND_STYLE.marqueeColor,
    fontFamily: (settings.fontFamily ?? DEFAULT_BRAND_STYLE.fontFamily) as typeof DEFAULT_BRAND_STYLE.fontFamily,
    tagline: settings.tagline ?? '',
    heroTitle: settings.heroTitle ?? '',
    heroDescription: settings.heroDescription ?? '',
    heroCaption: settings.heroCaption ?? '',
    aboutTitle: settings.aboutTitle ?? '',
    aboutText: settings.aboutText ?? '',
    footerText: settings.footerText ?? '',
  });
  fillStrings(form.controls.marqueeItems, settings.marqueeItems, 80);
  fillStrings(form.controls.partySizes, settings.partySizes, 20);
  form.controls.stats.clear();
  settings.stats.forEach(stat => form.controls.stats.push(newStat(fb, stat.label, stat.value)));
  form.controls.spaces.clear();
  settings.spaces.forEach(space => form.controls.spaces.push(newSpace(fb, space.name, space.description ?? '', space.image, space.bookable)));
  form.markAsPristine();
  form.markAsUntouched();
  if (editable) {
    form.enable({ emitEvent: false });
  } else {
    form.disable({ emitEvent: false });
  }
}

export function toPayload(form: SiteForm, version: number): SiteSettingsPayload {
  const value = form.getRawValue();
  const blank = (text: string): string | null => text.trim() || null;
  return {
    name: value.name.trim(),
    descriptor: blank(value.descriptor),
    whatsappNumber: blank(value.whatsappNumber),
    phone: blank(value.phone),
    email: blank(value.email),
    address: blank(value.address),
    schedule: blank(value.schedule),
    currency: value.currency,
    locale: value.locale,
    timezone: value.timezone.trim(),
    primaryColor: value.primaryColor.trim(),
    accentColor: value.accentColor.trim(),
    businessTitleColor: blank(value.businessTitleColor),
    backgroundColor: blank(value.backgroundColor),
    footerColor: blank(value.footerColor),
    headingColor: blank(value.headingColor),
    paragraphColor: blank(value.paragraphColor),
    whatsappColor: blank(value.whatsappColor),
    marqueeColor: blank(value.marqueeColor),
    fontFamily: blank(value.fontFamily),
    tagline: blank(value.tagline),
    heroTitle: blank(value.heroTitle),
    heroDescription: blank(value.heroDescription),
    heroCaption: blank(value.heroCaption),
    aboutTitle: blank(value.aboutTitle),
    aboutText: blank(value.aboutText),
    footerText: blank(value.footerText),
    marqueeItems: value.marqueeItems.map(item => item.trim()),
    partySizes: value.partySizes.map(item => item.trim()),
    stats: value.stats.map(stat => ({ label: stat.label.trim(), value: stat.value ?? 0 })),
    spaces: value.spaces.map(space => ({
      name: space.name.trim(),
      description: blank(space.description),
      imageId: space.image?.id ?? null,
      bookable: space.bookable,
    })),
    version,
  };
}

export function fieldError(form: SiteForm, name: keyof SiteForm['controls'], patternMessage?: string): string | null {
  return describeErrors(form.controls[name] as AbstractControl, patternMessage);
}
