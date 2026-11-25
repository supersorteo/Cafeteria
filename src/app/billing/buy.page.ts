import { Component, DestroyRef, InjectionToken, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { BillingApi, BillingOptions, CheckoutConfig, RegionOption, formatUsd, openWhatsApp, whatsappMessage } from '../core/billing.api';
import { BillingShell } from './billing-shell';
import { OnlineCheckout } from './online-checkout';

const STEPS = ['Plan', 'País', 'Pago'];
const ONLINE_STEPS = ['Plan', 'País', 'Pago', 'Tus datos'];

export const WHATSAPP_TIMINGS = new InjectionToken('whatsapp-open-timings', {
  factory: () => ({ waitMs: 5000, minAwayMs: 1500 }),
});

type WhatsappState = 'idle' | 'opening' | 'opened' | 'notOpened';

const METHOD_TEXT: Record<string, string> = {
  WHATSAPP: 'Te escribimos por WhatsApp, coordinamos el pago y te enviamos tu código de activación.',
  MERCADOPAGO: 'Tarjeta o saldo en pesos argentinos. Tu negocio se crea al instante.',
  PAYPAL: 'Tarjeta o cuenta PayPal, en dólares. Tu negocio se crea al instante.',
};

@Component({
  imports: [BillingShell, RouterLink, OnlineCheckout],
  selector: 'app-buy-page',
  template: `
    <app-billing-shell>
      <header class="max-w-2xl">
        <h1 class="font-display text-3xl md:text-4xl font-black">Contratar tu plan</h1>
        <p class="mt-2 font-medium text-muted">Pocos pasos. Eliges cómo pagar y creas tu negocio.</p>
      </header>

      @if (failed()) {
        <div class="card mt-8 p-6 text-center" role="alert">
          <p class="font-bold text-danger">No pudimos cargar los planes.</p>
          <button type="button" class="btn btn-secondary btn-sm mt-3" data-retry (click)="load()">Reintentar</button>
        </div>
      } @else if (options(); as data) {
        <ol class="mt-8 flex max-w-2xl items-center gap-2" aria-label="Pasos" data-steps>
          @for (label of steps(); track label; let i = $index) {
            <li class="flex flex-1 items-center gap-2" [attr.aria-current]="step() === i + 1 ? 'step' : null">
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-black"
                    [class.bg-primary]="step() >= i + 1" [class.text-white]="step() >= i + 1" [class.border-line]="step() < i + 1">{{ step() > i + 1 ? '✓' : i + 1 }}</span>
              <span class="hidden text-sm font-bold sm:inline" [class.text-muted]="step() < i + 1">{{ label }}</span>
              @if (i < steps().length - 1) { <span class="h-px flex-1 bg-line" aria-hidden="true"></span> }
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
                <p class="mt-1 text-sm font-medium text-muted">Te atiende la persona de tu país. Elegimos uno por tu zona horaria; puedes cambiarlo.</p>
                <div class="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="País">
                  @for (region of data.regions; track region.code) {
                    <label [class]="card(regionCode() === region.code) + (usable(region) ? '' : ' opacity-50 cursor-not-allowed')" [attr.data-selected]="regionCode() === region.code">
                      <input type="radio" name="region" class="sr-only" [value]="region.code" [checked]="regionCode() === region.code" [disabled]="!usable(region)" (change)="pickRegion(region.code)" [attr.data-region]="region.code">
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
                        <span class="block text-xs font-medium text-muted">{{ usable(region) ? 'Pago disponible' : 'Por ahora no disponible' }}</span>
                      </span>
                      <span [class]="mark(regionCode() === region.code)" aria-hidden="true">@if (regionCode() === region.code) { ✓ }</span>
                    </label>
                  }
                </div>
                <p class="mt-3 text-xs font-medium text-muted">Si tu país no aparece, elige el más cercano: coordinamos el pago por WhatsApp.</p>
              </fieldset>
            }
            @case (3) {
              <fieldset>
                <legend class="font-display text-xl font-black">¿Cómo quieres pagar?</legend>
                <p class="mt-1 text-sm font-medium text-muted" data-summary>{{ summary() }}</p>
                <div class="mt-4 space-y-3" role="radiogroup" aria-label="Forma de pago">
                  @for (method of methods(); track method.code) {
                    <label [class]="card(methodCode() === method.code) + (method.available ? '' : ' cursor-not-allowed bg-surface-2')" [attr.data-selected]="methodCode() === method.code">
                      <input type="radio" name="method" class="sr-only" [value]="method.code" [checked]="methodCode() === method.code" [disabled]="!method.available" (change)="methodCode.set(method.code)" [attr.data-method]="method.code">
                      <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-ui-md bg-surface-2 text-primary" aria-hidden="true">
                        @if (method.code === 'WHATSAPP') {
                          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1.3-4A8 8 0 1 1 8.3 18.8L4 20z"/><path d="M9 9.5c.4 2 2.5 4 4.5 4.5"/></svg>
                        } @else {
                          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h4"/></svg>
                        }
                      </span>
                      <span class="min-w-0 flex-1">
                        <span class="flex flex-wrap items-center gap-2">
                          <strong class="font-display text-lg" [class.text-muted]="!method.available">{{ method.name }}</strong>
                          @if (method.available) {
                            <span class="badge badge-success">{{ method.code === 'WHATSAPP' ? 'Disponible' : 'Automático' }}</span>
                          } @else {
                            <span class="badge badge-warning" data-soon>Próximamente</span>
                          }
                        </span>
                        <span class="mt-0.5 block text-xs font-medium text-muted">{{ methodText(method.code) }}</span>
                      </span>
                      <span [class]="mark(methodCode() === method.code)" aria-hidden="true">@if (methodCode() === method.code) { ✓ }</span>
                    </label>
                  }
                </div>
                @if (methodCode() === 'WHATSAPP') {
                  <p class="mt-4 rounded-ui-md bg-surface-2 px-4 py-3 text-sm font-medium" data-whatsapp-hint>
                    Se abrirá la aplicación de WhatsApp con un mensaje listo para enviar. Cuando lo envíes, te llevamos al registro: ahí pegas el código que te enviemos.
                  </p>
                }
                @switch (waState()) {
                  @case ('opening') {
                    <p class="mt-3 text-sm font-bold" role="status" data-wa-status="opening">Abriendo WhatsApp… Envía el mensaje y vuelve aquí.</p>
                  }
                  @case ('opened') {
                    <div class="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-ui-md border border-primary/30 bg-primary/10 px-4 py-3" role="status" data-wa-status="opened">
                      <p class="text-sm font-bold">WhatsApp abierto. Envía el mensaje y vuelve aquí: te llevamos al registro.</p>
                      <button type="button" class="btn btn-primary btn-sm" data-wa-continue (click)="goToRegister()">Ya lo envié, continuar</button>
                    </div>
                  }
                  @case ('notOpened') {
                    <div class="mt-3 rounded-ui-md border border-warning/40 bg-warning/10 px-4 py-3" role="alert" data-wa-status="notOpened">
                      <p class="text-sm font-bold">No detectamos que se abriera WhatsApp.</p>
                      <div class="mt-2 flex flex-wrap gap-2">
                        <button type="button" class="btn btn-secondary btn-sm" data-wa-retry (click)="pay()">Intentar de nuevo</button>
                      </div>
                    </div>
                  }
                }
              </fieldset>
            }
            @default {
              @if (selectedPlan(); as plan) {
                @if (selectedRegion(); as region) {
                  <app-online-checkout [plan]="plan" [region]="region" [method]="methodCode()" [config]="checkout()" />
                }
              }
            }
          }

          @if (error()) { <p role="alert" class="text-sm font-bold text-danger" data-error>{{ error() }}</p> }
          <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            @if (step() > 1) {
              <button type="button" class="btn btn-secondary" data-back (click)="back()">Atrás</button>
            } @else { <span></span> }
            @if (step() < 4) {
              <button type="submit" class="btn btn-primary btn-lg" data-submit [disabled]="!canContinue() || waState() === 'opening' || waState() === 'opened'">
                {{ step() < 3 ? 'Continuar' : (methodCode() === 'WHATSAPP' ? 'Abrir WhatsApp' : 'Continuar') }}
              </button>
            }
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly timings = inject(WHATSAPP_TIMINGS);
  private stopWatching: (() => void) | null = null;

  protected readonly online = computed(() => this.methodCode() === 'PAYPAL' || this.methodCode() === 'MERCADOPAGO');
  protected readonly steps = computed(() => (this.online() ? ONLINE_STEPS : STEPS));
  protected readonly checkout = computed<CheckoutConfig>(() => this.options()?.checkout ?? { paypalClientId: '', mercadopagoPublicKey: '' });
  protected readonly selectedPlan = computed(() => this.options()?.plans.find(item => item.code === this.planCode()) ?? null);
  protected readonly selectedRegion = computed(() => this.options()?.regions.find(item => item.code === this.regionCode()) ?? null);
  protected readonly options = signal<BillingOptions | null>(null);
  protected readonly failed = signal(false);
  protected readonly step = signal(1);
  protected readonly planCode = signal('');
  protected readonly regionCode = signal('');
  protected readonly methodCode = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly waState = signal<WhatsappState>('idle');
  protected readonly usd = formatUsd;
  protected readonly methods = computed(() => this.options()?.regions.find(item => item.code === this.regionCode())?.methods ?? []);
  protected readonly summary = computed(() => {
    const data = this.options();
    const plan = data?.plans.find(item => item.code === this.planCode());
    const region = data?.regions.find(item => item.code === this.regionCode());
    return plan && region ? `Plan ${plan.name} · ${formatUsd(plan.usdCents)} al mes · ${region.name}` : '';
  });

  protected card(selected: boolean): string {
    return 'relative flex cursor-pointer items-center gap-3 rounded-ui-lg border-2 p-4 transition focus-within:ring-2 focus-within:ring-primary/40 '
      + (selected ? 'border-primary bg-primary/10 shadow-sm' : 'border-line bg-surface hover:border-primary/50');
  }

  protected mark(selected: boolean): string {
    return 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-black '
      + (selected ? 'border-primary bg-primary text-white' : 'border-line');
  }

  ngOnInit(): void {
    void this.load();
    this.destroyRef.onDestroy(() => this.stopWatching?.());
  }

  protected async load(): Promise<void> {
    this.failed.set(false);
    try {
      const data = await firstValueFrom(this.api.options());
      this.options.set(data);
      const wanted = this.route.snapshot.queryParamMap.get('plan');
      const chosen = data.plans.find(plan => plan.code === wanted)?.code;
      if (chosen) {
        this.planCode.set(chosen);
        this.step.set(2);
      }
    } catch {
      this.failed.set(true);
    }
  }

  protected usable(region: RegionOption): boolean {
    return region.methods.some(method => method.available);
  }

  protected canContinue(): boolean {
    return this.step() === 1 ? !!this.planCode() : this.step() === 2 ? !!this.regionCode() : !!this.methodCode();
  }

  protected methodText(code: string): string {
    return METHOD_TEXT[code] ?? '';
  }

  protected pickRegion(code: string): void {
    this.regionCode.set(code);
    if (!this.methods().some(method => method.code === this.methodCode() && method.available)) {
      this.methodCode.set('');
    }
  }

  protected back(): void {
    this.error.set(null);
    this.step.update(current => Math.max(1, current - 1));
  }

  protected next(event: Event): void {
    event.preventDefault();
    this.error.set(null);
    if (!this.canContinue()) {
      this.error.set(this.step() === 1 ? 'Elige un plan para continuar.' : this.step() === 2 ? 'Elige tu país para continuar.' : 'Elige cómo quieres pagar.');
      return;
    }
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
    this.pay();
  }

  protected pay(): void {
    const data = this.options();
    const plan = data?.plans.find(item => item.code === this.planCode());
    const region = data?.regions.find(item => item.code === this.regionCode());
    if (!plan || !region || !this.methodCode()) {
      this.error.set('Elige cómo quieres pagar.');
      return;
    }
    if (this.methodCode() === 'WHATSAPP') {
      this.watchWhatsapp();
      openWhatsApp(region.whatsappNumber, whatsappMessage(plan, region));
      return;
    }
    this.step.set(4);
  }

  protected goToRegister(): void {
    this.stopWatching?.();
    this.stopWatching = null;
    void this.router.navigate(['/auth/register'], { queryParams: { from: 'whatsapp', plan: this.planCode() } });
  }

  private watchWhatsapp(): void {
    this.stopWatching?.();
    this.waState.set('opening');
    let leftAt = 0;
    const onBlur = (): void => {
      leftAt = Date.now();
      this.waState.set('opened');
    };
    let onBack = (): void => undefined;
    const onHidden = (): void => {
      if (document.visibilityState === 'hidden') {
        onBlur();
      } else {
        onBack();
      }
    };
    onBack = (): void => {
      if (this.waState() !== 'opened') {
        return;
      }
      if (Date.now() - leftAt >= this.timings.minAwayMs) {
        this.goToRegister();
      } else {
        this.waState.set('opening');
      }
    };
    const timer = setTimeout(() => {
      if (this.waState() === 'opening') {
        this.waState.set('notOpened');
      }
    }, this.timings.waitMs);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onBack);
    document.addEventListener('visibilitychange', onHidden);
    this.stopWatching = () => {
      clearTimeout(timer);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onBack);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }
}
