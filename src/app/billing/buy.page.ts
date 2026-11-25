import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { isConnectionProblem, toProblem } from '../core/api-error';
import { AuthService } from '../core/auth.service';
import { BillingApi, BillingOptions, OrderReceipt, formatUsd, guessRegion, lastOrderReference, rememberOrder } from '../core/billing.api';
import { BillingShell } from './billing-shell';

const STEPS = ['Plan', 'País', 'Tus datos'];

@Component({
  imports: [BillingShell, FormsModule, RouterLink],
  selector: 'app-buy-page',
  template: `
    <app-billing-shell>
      <header class="max-w-2xl">
        <h1 class="font-display text-3xl md:text-4xl font-black">Contratar tu plan</h1>
        <p class="mt-2 font-medium text-muted">Tres pasos rápidos. Pagas por WhatsApp y recibes tu código por correo.</p>
      </header>

      @if (pendingOrder(); as pending) {
        <div class="card mt-6 flex max-w-2xl flex-wrap items-center justify-between gap-3 p-4" data-resume>
          <p class="text-sm font-bold">Tienes un pedido pendiente: <span class="tracking-wider">{{ pending.reference }}</span> · Plan {{ pending.planName }}</p>
          <a routerLink="/pago/resultado" [queryParams]="{ ref: pending.reference }" class="btn btn-secondary btn-sm" data-resume-link>Retomarlo</a>
        </div>
      }

      @if (failed()) {
        <div class="card mt-8 p-6 text-center" role="alert">
          <p class="font-bold text-danger">No pudimos cargar los planes.</p>
          <button type="button" class="btn btn-secondary btn-sm mt-3" data-retry (click)="load()">Reintentar</button>
        </div>
      } @else if (options(); as data) {
        <ol class="mt-8 flex max-w-2xl items-center gap-2" aria-label="Pasos" data-steps>
          @for (label of steps; track label; let i = $index) {
            <li class="flex flex-1 items-center gap-2" [attr.aria-current]="step() === i + 1 ? 'step' : null">
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-black"
                    [class.bg-primary]="step() >= i + 1" [class.text-white]="step() >= i + 1" [class.border-line]="step() < i + 1">{{ step() > i + 1 ? '✓' : i + 1 }}</span>
              <span class="hidden text-sm font-bold sm:inline" [class.text-muted]="step() < i + 1">{{ label }}</span>
              @if (i < steps.length - 1) { <span class="h-px flex-1 bg-line" aria-hidden="true"></span> }
            </li>
          }
        </ol>

        <form class="card mt-6 max-w-2xl space-y-6 p-6" (submit)="next($event)" novalidate data-buy-form>
          @switch (step()) {
            @case (1) {
              <fieldset>
                <legend class="font-display text-xl font-black">¿Qué plan necesitas?</legend>
                <div class="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Plan">
                  @for (plan of data.plans; track plan.code) {
                    <label [class]="card(planCode() === plan.code)" [attr.data-selected]="planCode() === plan.code">
                      <input type="radio" name="plan" class="sr-only" [value]="plan.code" [checked]="planCode() === plan.code" (change)="planCode.set(plan.code)" [attr.data-plan]="plan.code">
                      <span class="min-w-0 flex-1">
                        <span class="flex items-baseline justify-between gap-3">
                          <strong class="font-display text-lg">{{ plan.name }}</strong>
                          <span class="font-bold text-primary">{{ usd(plan.usdCents) }}<span class="text-xs font-semibold text-muted"> / mes</span></span>
                        </span>
                        <span class="mt-1 block text-xs font-medium text-muted">Hasta {{ plan.maxMenuItems }} platos · {{ plan.fullBranding ? 'marca completa' : 'logo y 2 colores' }} · {{ plan.prioritySupport ? 'soporte prioritario' : 'soporte por correo' }}</span>
                      </span>
                      <span [class]="mark(planCode() === plan.code)" aria-hidden="true">@if (planCode() === plan.code) { ✓ }</span>
                    </label>
                  }
                </div>
              </fieldset>
            }
            @case (2) {
              <fieldset>
                <legend class="font-display text-xl font-black">¿Desde qué país pagas?</legend>
                <p class="mt-1 text-sm font-medium text-muted">Te atiende la persona de tu país por WhatsApp. Elegimos uno por tu zona horaria; puedes cambiarlo.</p>
                <div class="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="País">
                  @for (region of data.regions; track region.code) {
                    <label [class]="card(regionCode() === region.code) + (region.whatsapp ? '' : ' opacity-50 cursor-not-allowed')" [attr.data-selected]="regionCode() === region.code">
                      <input type="radio" name="region" class="sr-only" [value]="region.code" [checked]="regionCode() === region.code" [disabled]="!region.whatsapp" (change)="regionCode.set(region.code)" [attr.data-region]="region.code">
                      <span class="flex h-8 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line shadow-sm" aria-hidden="true">
                        @switch (region.code) {
                          @case ('AR') {
                            <svg viewBox="0 0 48 32" width="48" height="32"><rect width="48" height="32" fill="#74ACDF"/><rect y="10.7" width="48" height="10.7" fill="#fff"/><circle cx="24" cy="16" r="3.4" fill="#F6B40E"/></svg>
                          }
                          @case ('UY') {
                            <svg viewBox="0 0 48 32" width="48" height="32"><rect width="48" height="32" fill="#fff"/><g fill="#0038A8"><rect y="3.55" width="48" height="3.55"/><rect y="10.65" width="48" height="3.55"/><rect y="17.75" width="48" height="3.55"/><rect y="24.85" width="48" height="3.55"/></g><rect width="21" height="17.75" fill="#fff"/><circle cx="10.5" cy="8.9" r="4.6" fill="#FCD116"/></svg>
                          }
                          @default { <span class="text-xs font-black text-muted">{{ region.code }}</span> }
                        }
                      </span>
                      <span class="min-w-0 flex-1">
                        <strong class="block font-display text-lg">{{ region.name }}</strong>
                        <span class="block text-xs font-medium text-muted">{{ region.whatsapp ? 'Pago coordinado por WhatsApp' : 'Por ahora no disponible' }}</span>
                      </span>
                      <span [class]="mark(regionCode() === region.code)" aria-hidden="true">@if (regionCode() === region.code) { ✓ }</span>
                    </label>
                  }
                </div>
                <p class="mt-3 text-xs font-medium text-muted">Si tu país no aparece, elige el más cercano: coordinamos el pago por WhatsApp.</p>
              </fieldset>
            }
            @default {
              <fieldset class="space-y-4">
                <legend class="font-display text-xl font-black">¿Dónde te enviamos tu código?</legend>
                <p class="rounded-ui-md bg-surface-2 px-4 py-3 text-sm font-bold" data-summary>{{ summary() }}</p>
                <label class="block"><span class="text-sm font-bold">Correo</span>
                  <input class="input mt-1" type="email" maxlength="254" autocomplete="email" inputmode="email" data-email [ngModel]="email()" (ngModelChange)="email.set($event)" name="email">
                  <small class="mt-1 block text-xs font-medium text-muted">Usa el correo con el que crearás tu cuenta: así no tendrás que confirmarlo otra vez.</small></label>
                <label class="block"><span class="text-sm font-bold">Nombre (opcional)</span>
                  <input class="input mt-1" maxlength="120" autocomplete="name" data-name [ngModel]="name()" (ngModelChange)="name.set($event)" name="name"></label>
              </fieldset>
            }
          }

          @if (error()) { <p role="alert" class="text-sm font-bold text-danger" data-error>{{ error() }}</p> }
          <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            @if (step() > 1) {
              <button type="button" class="btn btn-secondary" data-back (click)="back()">Atrás</button>
            } @else { <span></span> }
            <button type="submit" class="btn btn-primary btn-lg" data-submit [disabled]="pending()">
              {{ step() < 3 ? 'Continuar' : (pending() ? 'Registrando…' : 'Crear mi pedido') }}
            </button>
          </div>
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

  protected readonly steps = STEPS;
  protected readonly options = signal<BillingOptions | null>(null);
  protected readonly failed = signal(false);
  protected readonly step = signal(1);
  protected readonly planCode = signal('');
  protected readonly regionCode = signal('');
  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly pendingOrder = signal<OrderReceipt | null>(null);
  protected readonly usd = formatUsd;
  protected card(selected: boolean): string {
    return 'relative flex cursor-pointer items-center gap-3 rounded-ui-lg border-2 p-4 transition focus-within:ring-2 focus-within:ring-primary/40 '
      + (selected ? 'border-primary bg-primary/10 shadow-sm' : 'border-line bg-surface hover:border-primary/50');
  }

  protected mark(selected: boolean): string {
    return 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-black '
      + (selected ? 'border-primary bg-primary text-white' : 'border-line');
  }

  protected readonly summary = computed(() => {
    const data = this.options();
    const plan = data?.plans.find(item => item.code === this.planCode());
    const region = data?.regions.find(item => item.code === this.regionCode());
    return plan && region ? `Plan ${plan.name} · ${formatUsd(plan.usdCents)} al mes · ${region.name}` : '';
  });

  ngOnInit(): void {
    void this.load();
    void this.resume();
  }

  protected async load(): Promise<void> {
    this.failed.set(false);
    try {
      const data = await firstValueFrom(this.api.options());
      this.options.set(data);
      const wanted = this.route.snapshot.queryParamMap.get('plan');
      this.planCode.set(data.plans.find(plan => plan.code === wanted)?.code ?? data.plans.find(plan => plan.code === 'PROFESIONAL')?.code ?? data.plans[0]?.code ?? '');
      const available = data.regions.filter(region => region.whatsapp);
      this.regionCode.set(available.find(region => region.code === guessRegion())?.code ?? available[0]?.code ?? '');
      if (wanted && data.plans.some(plan => plan.code === wanted)) {
        this.step.set(2);
      }
    } catch {
      this.failed.set(true);
    }
  }

  protected back(): void {
    this.error.set(null);
    this.step.update(current => Math.max(1, current - 1));
  }

  protected async next(event: Event): Promise<void> {
    event.preventDefault();
    this.error.set(null);
    if (this.step() === 1) {
      this.step.set(2);
      return;
    }
    if (this.step() === 2) {
      if (!this.regionCode()) {
        this.error.set('Elige tu país.');
        return;
      }
      this.step.set(3);
      return;
    }
    await this.submit();
  }

  private async resume(): Promise<void> {
    const reference = lastOrderReference();
    if (!reference) {
      return;
    }
    try {
      const order = await firstValueFrom(this.api.order(reference));
      this.pendingOrder.set(order.status === 'PENDING' ? order : null);
    } catch {
      this.pendingOrder.set(null);
    }
  }

  private async submit(): Promise<void> {
    if (this.pending()) {
      return;
    }
    const email = this.email().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.error.set('Escribe un correo válido: ahí te enviamos el código.');
      return;
    }
    this.pending.set(true);
    try {
      await this.auth.ensureCsrf();
      const receipt = await firstValueFrom(this.api.createOrder({ planCode: this.planCode(), region: this.regionCode(), email, name: this.name().trim() }));
      rememberOrder(receipt.reference);
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
