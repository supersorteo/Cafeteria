import { CanDeactivateFn } from '@angular/router';

export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = component =>
  !component.hasUnsavedChanges() || confirm('Tienes cambios sin guardar. ¿Salir de todas formas?');
