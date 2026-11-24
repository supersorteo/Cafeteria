import { Component } from '@angular/core';
import { PlanCards } from '../shared/plan-cards';
import { BillingShell } from './billing-shell';

@Component({
  imports: [BillingShell, PlanCards],
  selector: 'app-pricing-page',
  template: `
    <app-billing-shell>
      <header class="text-center max-w-2xl mx-auto">
        <p class="badge badge-warning">Planes mensuales</p>
        <h1 class="mt-4 font-display text-4xl md:text-5xl font-black">Elige el plan de tu negocio</h1>
        <p class="mt-3 text-lg font-medium text-muted">Sin permanencia: pagas cada mes. La diferencia está en cuánto puedes mostrar y cuánto puedes personalizar.</p>
      </header>
      <div class="mt-10"><app-plan-cards /></div>
      <section class="card mt-10 p-6" aria-labelledby="how-title">
        <h2 id="how-title" class="font-display text-xl font-black">¿Cómo funciona el pago?</h2>
        <ol class="mt-3 list-decimal space-y-2 pl-5 text-sm font-medium text-muted">
          <li>Eliges tu plan y tu país, y registramos tu pedido.</li>
          <li>Nos escribes por WhatsApp con tu número de pedido y coordinamos el pago.</li>
          <li>Cuando confirmamos el pago, te enviamos por correo un código de activación.</li>
          <li>Con ese código creas tu negocio y empiezas a usarlo.</li>
        </ol>
      </section>
    </app-billing-shell>
  `,
})
export class PricingPage {}
