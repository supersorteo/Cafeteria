import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { toProblem, isConnectionProblem } from '../core/api-error';
import { AuthService } from '../core/auth.service';
import { BillingApi, BillingOptions, formatUsd } from '../core/billing.api';
import { BillingShell } from './billing-shell';

@Component({
  imports: [BillingShell, FormsModule, RouterLink],
  selector: 'app-buy-page',
  template: `
    <app-billing-shell>
      <header class="max-w-2xl">
        <h1 class="font-display text-3xl md:text-4xl font-black">Contratar tu plan</h1>
        <p class="mt-2 font-medium text-muted">Completa tus datos y te mostramos cómo coordinar el pago por WhatsApp.</p>
      </header>

      @if (failed()) {
        <div class="card mt-8 p-6 text-center" role="alert">
          <p class="font-bold text-danger">No pudimos cargar los planes.</p>
          <button type="button" class="btn btn-secondary btn-sm mt-3" data-retry (click)="load()">Reintentar</button>
        </div>
      } @else if (options(); as data) {
        <form class="card mt-8 max-w-2xl space-y-6 p-6" (submit)="submit($event)" novalidate data-buy-form>
          <fieldset>
            <legend class="text-xs font-bold uppercase tracking-wider text-muted">1. Plan</legend>
            <div class="mt-3 grid gap-3 sm:grid-cols-2">
              @for (plan of data.plans; track plan.code) {
                <label class="qr-choice flex-col !items-start !p-4" [class.active]="planCode() === plan.code">
                  <span class="flex w-full items-center justify-between gap-3">
                    <input type="radio" name="plan" class="sr-only" [value]="plan.code" [checked]="planCode() === plan.code" (change)="planCode.set(plan.code)" [attr.data-plan]="plan.code">
                    <strong class="font-display text-lg">{{ plan.name }}</strong>
                    <span class="font-bold text-primary">{{ usd(plan.usdCents) }} / mes</span>
                  </span>
                  <span class="mt-1 text-xs font-medium text-muted">Hasta {{ plan.maxMenuItems }} platos · {{ plan.fullBranding ? 'marca completa' : 'logo y 2 colores' }}</span>
                </label>
              }
            </div>
          </fieldset>

          <fieldset>
            <legend class="text-xs font-bold uppercase tracking-wider text-muted">2. Tu país</legend>
            <div class="mt-3 flex flex-wrap gap-3">
              @for (region of data.regions; track region.code) {
                <label class="qr-choice !min-h-11" [class.active]="regionCode() === region.code" [class.opacity-50]="!region.whatsapp">
                  <input type="radio" name="region" class="sr-only" [value]="region.code" [checked]="regionCode() === region.code" [disabled]="!region.whatsapp" (change)="regionCode.set(region.code)" [attr.data-region]="region.code">
                  {{ region.name }}
                </label>
              }
            </div>
            <p class="mt-2 text-xs font-medium text-muted">Si tu país no aparece, elige el más cercano: coordinamos el pago por WhatsApp.</p>
          </fieldset>

          <fieldset class="grid gap-4 sm:grid-cols-2">
            <legend class="text-xs font-bold uppercase tracking-wider text-muted">3. Tus datos</legend>
            <label class="block"><span class="text-sm font-bold">Nombre (opcional)</span>
              <input class="input mt-1" maxlength="120" autocomplete="name" data-name [ngModel]="name()" (ngModelChange)="name.set($event)" name="name"></label>
            <label class="block"><span class="text-sm font-bold">Correo donde recibirás el código</span>
              <input class="input mt-1" type="email" maxlength="254" autocomplete="email" inputmode="email" data-email [ngModel]="email()" (ngModelChange)="email.set($event)" name="email"></label>
          </fieldset>

          @if (error()) { <p role="alert" class="text-sm font-bold text-danger" data-error>{{ error() }}</p> }
          <button type="submit" class="btn btn-primary btn-lg w-full sm:w-auto" data-submit [disabled]="pending()">{{ pending() ? 'Registrando…' : 'Continuar' }}</button>
          <p class="text-xs font-medium text-muted">¿Ya tienes un código? <a routerLink="/auth/register" class="underline">Crea tu negocio</a>.</p>
        </form>
      } @else {
        <div class="skeleton mt-8 h-96 max-w-2xl" aria-hidden="true"></div>
      }
    </app-billing-shell>
  `,
})
export class BuyPage implements OnInit {
  private readonly api = inject(BillingApi);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly options = signal<BillingOptions | null>(null);
  protected readonly failed = signal(false);
  protected readonly planCode = signal('');
  protected readonly regionCode = signal('');
  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly usd = formatUsd;
  protected readonly ready = computed(() => !!this.planCode() && !!this.regionCode());

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.failed.set(false);
    try {
      const data = await firstValueFrom(this.api.options());
      this.options.set(data);
      const wanted = this.route.snapshot.queryParamMap.get('plan');
      this.planCode.set(data.plans.find(plan => plan.code === wanted)?.code ?? data.plans.find(plan => plan.code === 'PROFESIONAL')?.code ?? data.plans[0]?.code ?? '');
      this.regionCode.set(data.regions.find(region => region.whatsapp)?.code ?? '');
    } catch {
      this.failed.set(true);
    }
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.pending()) {
      return;
    }
    const email = this.email().trim();
    if (!this.ready()) {
      this.error.set('Elige un plan y tu país.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.error.set('Escribe un correo válido: ahí te enviamos el código.');
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    try {
      await this.auth.ensureCsrf();
      const receipt = await firstValueFrom(this.api.createOrder({ planCode: this.planCode(), region: this.regionCode(), email, name: this.name().trim() }));
      await this.router.navigate(['/pago/resultado'], { queryParams: { ref: receipt.reference } });
    } catch (error) {
      const problem = toProblem(error);
      this.error.set(
        problem.code === 'method_unavailable' ? 'Este método no está disponible en tu país por ahora.'
          : problem.code === 'too_many_attempts' ? 'Demasiados intentos. Inténtalo más tarde.'
          : problem.fieldErrors[0]?.message ?? (isConnectionProblem(problem) ? 'Problema de conexión. Inténtalo de nuevo.' : 'No pudimos registrar tu pedido.'),
      );
    } finally {
      this.pending.set(false);
    }
  }
}
