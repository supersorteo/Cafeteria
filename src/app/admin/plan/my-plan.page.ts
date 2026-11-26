import { formatDate } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { BillingApi, BillingOptions, CheckoutConfig, OrderState, PlanOption, formatArs, formatUsd, openWhatsApp } from '../../core/billing.api';
import { NoticeService } from '../../core/notice.service';
import { PLAN_WARNING_DAYS, PlanService, daysLeft } from '../../core/plan.service';
import { OnlineCheckout } from '../../billing/online-checkout';

const REGION_KEY = 'deliora.renovar.pais';

const METHOD_TEXT: Record<string, string> = {
  PAYPAL: 'Tarjeta o cuenta PayPal, en dólares. Se renueva al instante.',
  MERCADOPAGO: 'Tarjeta o saldo en pesos argentinos. Se renueva al instante.',
  WHATSAPP: 'Coordinamos el pago por WhatsApp y te enviamos un código de activación.',
};

interface Meter {
  key: string;
  label: string;
  used: number;
  max: number;
}

function day(iso: string | null | undefined): string {
  return iso ? formatDate(iso, 'dd/MM/yyyy', 'en-US') : '';
}

@Component({
  imports: [OnlineCheckout],
  selector: 'app-my-plan-page',
  host: { class: 'block' },
  template: `
    <section class="max-w-3xl space-y-6" data-my-plan>
      <header>
        <h1 class="font-display text-3xl font-black">Mi plan</h1>
        <p class="mt-1 font-medium text-muted">Tu plan, lo que estás usando y cómo renovarlo.</p>
      </header>

      @if (justRenewed()) {
        <div class="card border-success/40 bg-success/10 p-4" role="status" data-renewed>
          <p class="font-bold text-success">✓ ¡Listo! Renovamos tu plan.</p>
          <p class="text-sm font-medium">Ahora vence el {{ expiresOn() }}. Te enviamos el recibo por correo.</p>
        </div>
      }

      <article class="card p-5 sm:p-6" data-plan-status>
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-xs font-bold uppercase tracking-wider text-muted">Plan actual</p>
            <h2 class="font-display text-2xl font-black" data-plan-name>{{ auth.limits()?.name ?? 'Profesional' }}</h2>
            <p class="mt-1 text-sm font-medium" data-plan-expiry>{{ expiryText() }}</p>
          </div>
          <span class="badge" [class.badge-success]="stage() === 'ok'" [class.badge-warning]="stage() === 'soon'"
                [class.badge-danger]="stage() === 'grace' || stage() === 'paused' || stage() === 'archived'" data-plan-stage>{{ stageLabel() }}</span>
        </div>
        @if (meters().length) {
          <div class="mt-5 grid gap-4 sm:grid-cols-2" data-usage>
            @for (meter of meters(); track meter.key) {
              <div [attr.data-meter]="meter.key">
                <div class="flex items-baseline justify-between text-sm font-bold">
                  <span>{{ meter.label }}</span>
                  <span [class.text-danger]="meter.used >= meter.max" [class.text-muted]="meter.used < meter.max">{{ meter.used }} de {{ meter.max }}</span>
                </div>
                <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                  <span class="block h-full rounded-full transition-all" [style.width.%]="percent(meter)"
                        [class.bg-success]="percent(meter) < 80" [class.bg-warning]="percent(meter) >= 80 && percent(meter) < 100" [class.bg-danger]="percent(meter) >= 100"></span>
                </div>
              </div>
            }
          </div>
        }
      </article>

      @if (!hasExpiry()) {
        <p class="text-sm font-medium text-muted" data-no-expiry>Tu plan no tiene vencimiento.</p>
      } @else if (!auth.isOwner()) {
        <p class="card p-5 text-sm font-bold" data-owner-only>Solo el propietario del negocio puede renovar el plan.</p>
      } @else {
        <article class="card space-y-6 p-5 sm:p-6" data-renew-section>
          <div>
            <h2 class="font-display text-xl font-black">Renovar o cambiar de plan</h2>
            <p class="mt-1 text-sm font-medium text-muted" data-renew-hint>{{ renewHint() }}</p>
          </div>

          @if (optionsFailed()) {
            <div role="alert" class="rounded-xl bg-danger/10 p-4 text-sm font-bold text-danger">
              No pudimos cargar los planes. <button type="button" class="underline" data-options-retry (click)="load()">Reintentar</button>
            </div>
          } @else if (options(); as data) {
            <fieldset>
              <legend class="text-xs font-bold uppercase tracking-wider text-muted">1. Elige tu plan</legend>
              <div class="mt-2 grid gap-3 sm:grid-cols-2">
                @for (option of data.plans; track option.code) {
                  <label [class]="card(planCode() === option.code)" [attr.data-plan-option]="option.code">
                    <input type="radio" name="renew-plan" class="sr-only" [value]="option.code" [checked]="planCode() === option.code" (change)="pickPlan(option.code)">
                    <span class="min-w-0 flex-1">
                      <span class="flex items-center justify-between gap-2">
                        <strong class="font-display text-lg">{{ option.name }}</strong>
                        @if (option.code === currentPlan()) { <span class="badge text-xs" data-current-plan>Tu plan actual</span> }
                      </span>
                      <span class="block text-sm font-bold">{{ usd(option.usdCents) }} al mes @if (option.arsPrice) { <span class="font-medium text-muted">· {{ ars(option.arsPrice) }}</span> }</span>
                      <span class="mt-1 block text-xs font-medium text-muted">Hasta {{ option.maxMenuItems }} platos · {{ option.maxActiveCoupons }} cupones activos · {{ option.maxGallery }} fotos{{ option.tableQr ? ' · QR por mesa' : '' }}{{ option.fullBranding ? ' · marca completa' : '' }}</span>
                    </span>
                  </label>
                }
              </div>
            </fieldset>

            <fieldset>
              <legend class="text-xs font-bold uppercase tracking-wider text-muted">2. ¿Desde dónde pagas?</legend>
              <div class="mt-2 flex flex-wrap gap-2">
                @for (region of data.regions; track region.code) {
                  <button type="button" class="btn btn-sm" [class.btn-primary]="regionCode() === region.code" [class.btn-secondary]="regionCode() !== region.code"
                          [attr.aria-pressed]="regionCode() === region.code" [attr.data-region-option]="region.code" (click)="pickRegion(region.code)">{{ region.name }}</button>
                }
              </div>
            </fieldset>

            @if (region(); as zone) {
              <fieldset>
                <legend class="text-xs font-bold uppercase tracking-wider text-muted">3. Forma de pago</legend>
                <div class="mt-2 grid gap-3">
                  @for (option of methods(); track option.code) {
                    <label [class]="card(methodCode() === option.code)" [attr.data-method-option]="option.code">
                      <input type="radio" name="renew-method" class="sr-only" [value]="option.code" [checked]="methodCode() === option.code" (change)="methodCode.set(option.code)">
                      <span class="min-w-0">
                        <strong class="block">{{ option.name }}</strong>
                        <span class="block text-xs font-medium text-muted">{{ methodText(option.code) }}</span>
                      </span>
                    </label>
                  }
                </div>
              </fieldset>

              @if (methodCode() === 'WHATSAPP') {
                <div class="rounded-2xl border border-line bg-surface-2 p-4" data-renew-whatsapp-box>
                  <p class="text-sm font-medium">Te abrimos WhatsApp con un mensaje listo. Cuando pagues, te enviamos un código de activación para canjearlo aquí.</p>
                  <div class="mt-3 flex flex-wrap gap-2">
                    <button type="button" class="btn btn-primary btn-sm" data-renew-whatsapp (click)="openWhatsapp()">Escribir por WhatsApp</button>
                    <button type="button" class="btn btn-secondary btn-sm" data-have-code (click)="plans.openRenewal()">Ya tengo mi código</button>
                  </div>
                </div>
              } @else if (chosenPlan() && methodCode()) {
                @for (key of [checkoutKey()]; track key) {
                  <app-online-checkout mode="renewal" [plan]="chosenPlan()!" [region]="zone" [method]="methodCode()" [config]="config()" (renewed)="onRenewed($event)" />
                }
              }
            }
          } @else {
            <div class="skeleton h-40" aria-hidden="true"></div>
          }

          <p class="border-t border-line pt-4 text-sm font-medium text-muted">¿Ya tienes un código de activación?
            <button type="button" class="font-bold text-primary underline" data-redeem-code (click)="plans.openRenewal()">Canjéalo aquí</button></p>
        </article>

        <article class="card p-5 text-sm font-medium text-muted" data-lifecycle>
          <h2 class="font-bold text-ink">Qué pasa cuando vence</h2>
          <ul class="mt-2 list-disc space-y-1 pl-5">
            <li>Te avisamos por correo 7, 3 y 1 día antes.</li>
            <li>Al vencer tienes 3 días de gracia: todo sigue funcionando.</li>
            <li>Después tu sitio se pausa: tus clientes ven un aviso en lugar de tu carta y el panel queda en solo lectura.</li>
            <li>A los 90 días se archiva. Nunca borramos tu carta ni tus datos: al renovar, todo vuelve al instante.</li>
          </ul>
        </article>
      }
    </section>
  `,
})
export class MyPlanPage implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly plans = inject(PlanService);
  private readonly api = inject(BillingApi);
  private readonly notices = inject(NoticeService);
  private readonly route = inject(ActivatedRoute);

  protected readonly options = signal<BillingOptions | null>(null);
  protected readonly optionsFailed = signal(false);
  protected readonly planCode = signal('');
  protected readonly regionCode = signal('');
  protected readonly methodCode = signal('');
  protected readonly justRenewed = signal(false);
  protected readonly usd = formatUsd;
  protected readonly ars = formatArs;
  private attempt = 0;

  protected readonly currentPlan = computed(() => this.auth.user()?.plan?.planCode ?? this.auth.limits()?.code ?? '');
  protected readonly hasExpiry = computed(() => !!this.auth.user()?.plan?.expiresAt);
  protected readonly chosenPlan = computed<PlanOption | null>(() => this.options()?.plans.find(plan => plan.code === this.planCode()) ?? null);
  protected readonly region = computed(() => this.options()?.regions.find(region => region.code === this.regionCode()) ?? null);
  protected readonly methods = computed(() => {
    const region = this.region();
    if (!region) {
      return [];
    }
    return region.methods.filter(method => method.available && (method.code !== 'WHATSAPP' || region.whatsapp));
  });
  protected readonly config = computed<CheckoutConfig>(() => this.options()?.checkout ?? { paypalClientId: '', mercadopagoPublicKey: '' });
  protected readonly checkoutKey = computed(() => `${this.planCode()}-${this.regionCode()}-${this.methodCode()}-${this.attempt}`);
  protected readonly expiresOn = computed(() => day(this.auth.user()?.plan?.expiresAt));

  protected readonly stage = computed<'ok' | 'soon' | 'grace' | 'paused' | 'archived'>(() => {
    const plan = this.auth.user()?.plan;
    switch (plan?.status) {
      case 'GRACE': return 'grace';
      case 'EXPIRED': return 'paused';
      case 'ARCHIVED': return 'archived';
    }
    const days = daysLeft(plan?.expiresAt ?? null);
    return days !== null && days <= PLAN_WARNING_DAYS ? 'soon' : 'ok';
  });

  protected readonly stageLabel = computed(() => ({ ok: 'Activo', soon: 'Vence pronto', grace: 'En gracia', paused: 'En pausa', archived: 'Archivado' })[this.stage()]);

  protected readonly expiryText = computed(() => {
    const plan = this.auth.user()?.plan;
    if (!plan?.expiresAt) {
      return 'Sin vencimiento.';
    }
    const expires = day(plan.expiresAt);
    switch (this.stage()) {
      case 'grace': return `Venció el ${expires}. Todo sigue funcionando hasta el ${day(plan.graceEndsAt)}.`;
      case 'paused': return `Venció el ${expires}. Tu sitio está en pausa hasta que renueves.`;
      case 'archived': return `Venció el ${expires}. Tu sitio está archivado; tus datos siguen guardados.`;
      default: {
        const days = daysLeft(plan.expiresAt) ?? 0;
        return `Vence el ${expires} (${days === 1 ? 'mañana' : `en ${days} días`}).`;
      }
    }
  });

  protected readonly renewHint = computed(() => {
    switch (this.stage()) {
      case 'grace': return `Si renuevas ahora, el mes nuevo cuenta desde el ${this.expiresOn()} y tu sitio no se pausa.`;
      case 'paused':
      case 'archived': return 'Al pagar, tu sitio vuelve a estar en línea al instante y el mes nuevo cuenta desde hoy.';
      default: return 'Si renuevas antes de que venza, el mes nuevo se suma al tiempo que te queda: no pierdes ningún día.';
    }
  });

  protected readonly meters = computed<Meter[]>(() => {
    const limits = this.auth.limits();
    const usage = this.auth.usage();
    if (!limits || !usage) {
      return [];
    }
    return [
      { key: 'menu', label: 'Platos en la carta', used: usage.menuItems, max: limits.maxMenuItems },
      { key: 'coupons', label: 'Cupones activos', used: usage.activeCoupons, max: limits.maxActiveCoupons },
      { key: 'gallery', label: 'Fotos de la galería', used: usage.gallery, max: limits.maxGallery },
    ].filter(meter => meter.max > 0);
  });

  ngOnInit(): void {
    this.justRenewed.set(this.route.snapshot.queryParamMap.has('renovado'));
    this.planCode.set(this.currentPlan());
    try {
      this.regionCode.set(localStorage.getItem(REGION_KEY) ?? '');
    } catch {
      this.regionCode.set('');
    }
    if (this.hasExpiry() && this.auth.isOwner()) {
      void this.load();
    }
  }

  protected async load(): Promise<void> {
    this.optionsFailed.set(false);
    try {
      const data = await firstValueFrom(this.api.options());
      this.options.set(data);
      if (!data.plans.some(plan => plan.code === this.planCode())) {
        this.planCode.set(data.plans[0]?.code ?? '');
      }
      if (!data.regions.some(region => region.code === this.regionCode())) {
        this.regionCode.set('');
      }
    } catch {
      this.optionsFailed.set(true);
    }
  }

  protected percent(meter: Meter): number {
    return Math.min(100, Math.round((meter.used / meter.max) * 100));
  }

  protected card(selected: boolean): string {
    return 'relative flex cursor-pointer items-start gap-3 rounded-ui-lg border-2 p-4 transition focus-within:ring-2 focus-within:ring-primary/40 '
      + (selected ? 'border-primary bg-primary/10 shadow-sm' : 'border-line bg-surface hover:border-primary/50');
  }

  protected methodText(code: string): string {
    return METHOD_TEXT[code] ?? '';
  }

  protected pickPlan(code: string): void {
    this.planCode.set(code);
  }

  protected pickRegion(code: string): void {
    this.regionCode.set(code);
    try {
      localStorage.setItem(REGION_KEY, code);
    } catch {
      // recordar el país es solo una comodidad
    }
    if (!this.methods().some(method => method.code === this.methodCode())) {
      this.methodCode.set('');
    }
  }

  protected openWhatsapp(): void {
    const region = this.region();
    const plan = this.chosenPlan();
    const user = this.auth.user();
    if (!region || !plan || !user) {
      return;
    }
    openWhatsApp(region.whatsappNumber, `Hola, quiero renovar el plan *${plan.name}* de Deliora (${formatUsd(plan.usdCents)} por mes) `
      + `para mi negocio *${user.tenant.name}* (${location.host}/${user.tenant.slug}).\n`
      + `Estoy en ${region.name}. ¿Me indican cómo pagar para recibir mi código de activación?\nGracias.`);
  }

  protected onRenewed(state: OrderState): void {
    this.attempt++;
    this.methodCode.set('');
    this.justRenewed.set(true);
    this.notices.show('info', `Plan renovado (${state.reference}). Ya está todo funcionando.`);
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  }
}
