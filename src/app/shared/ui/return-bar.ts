import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export type ReturnMode = 'plataforma' | 'panel';

@Component({
  imports: [RouterLink],
  selector: 'app-return-bar',
  template: `
    <div class="return-bar glass" role="navigation" aria-label="Volver">
      @if (mode() === 'panel') {
        <a id="returnPanel" routerLink="/admin" class="btn btn-primary btn-sm"><span class="sm:hidden">← Volver al panel</span><span class="hidden sm:inline">← Volver al panel de administración</span></a>
      } @else {
        <a id="returnHome" routerLink="/" class="btn btn-secondary btn-sm"><span class="sm:hidden">← Volver</span><span class="hidden sm:inline">← Volver a La Terraza Pro</span></a>
        <a id="returnRegister" routerLink="/auth/register" class="btn btn-primary btn-sm">Crear mi negocio</a>
      }
    </div>
  `,
})
export class ReturnBar {
  readonly mode = input.required<ReturnMode>();
}
