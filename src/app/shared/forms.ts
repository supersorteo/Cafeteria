import { AbstractControl, ValidationErrors } from '@angular/forms';

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const FALLBACK_TIMEZONES = [
  'America/Montevideo', 'America/Argentina/Buenos_Aires', 'America/Santiago', 'America/Sao_Paulo', 'America/Lima',
  'America/Bogota', 'America/Mexico_City', 'America/New_York', 'Europe/Madrid', 'UTC',
];

export function supportedTimezones(): string[] {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return FALLBACK_TIMEZONES;
  }
}

export function timezoneValidator(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value;
  if (!value) {
    return null;
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return null;
  } catch {
    return { timezone: true };
  }
}

export function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return (control.value ?? '').trim() ? null : { required: true };
}

export function describeErrors(control: AbstractControl, patternMessage = 'El formato no es válido.'): string | null {
  const errors = control.errors;
  if (!control.touched || !errors) {
    return null;
  }
  if (errors['server']) {
    return String(errors['server']);
  }
  if (errors['required']) {
    return 'Este campo es obligatorio.';
  }
  if (errors['maxlength']) {
    return `Máximo ${errors['maxlength'].requiredLength} caracteres.`;
  }
  if (errors['email']) {
    return 'Escribe un correo válido.';
  }
  if (errors['timezone']) {
    return 'Zona horaria no válida (por ejemplo America/Montevideo).';
  }
  if (errors['min'] || errors['max']) {
    return 'El valor está fuera del rango permitido.';
  }
  if (errors['pattern']) {
    return patternMessage;
  }
  return 'El valor no es válido.';
}
