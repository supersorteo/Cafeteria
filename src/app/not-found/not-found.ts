import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatusScreen } from '../shared/ui/status-screen';

@Component({
  imports: [RouterLink, StatusScreen],
  selector: 'app-not-found',
  template: `
    <app-status-screen kind="notfound" eyebrow="Error 404" title="No encontramos " accent="este sitio"
                       message="La dirección no existe o el negocio todavía no ha publicado su página.">
      <a routerLink="/" class="btn btn-primary btn-lg">Ir al inicio</a>
    </app-status-screen>
  `,
})
export class NotFound {}
