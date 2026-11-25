import { Component, ElementRef, OnDestroy, OnInit, computed, inject, input, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { isConnectionProblem, toProblem } from '../core/api-error';
import { AuthService } from '../core/auth.service';
import {
  BillingApi, Checkout, CheckoutConfig, OrderState, PlanOption, RegionOption, formatArs, formatUsd, rememberCheckout,
} from '../core/billing.api';
import { RESERVED_SLUGS, SLUG_PATTERN, slugify } from '../shared/slug';
import { PasswordMeter } from '../shared/ui/password-meter';
import { PAGE_REDIRECT, SDK_LOADER } from './sdk-loader';

type Field = 'businessName' | 'slug' | 'email' | 'password';

interface PayPalButtons {
  render(host: HTMLElement): Promise<void>;
  close?(): void;
}

interface PayPalSdk {
  Buttons(options: Record<string, unknown>): PayPalButtons;
}

interface MercadoPagoSdk {
  new (publicKey: string, options?: Record<string, unknown>): {
    bricks(): { create(name: string, container: string, options: Record<string, unknown>): Promise<unknown> };
  };
}

@Component({
  imports: [FormsModule, PasswordMeter],
  selector: 'app-online-checkout',
  host: { class: 'block' },
  template: `
    <div class="space-y-5" data-online-checkout>
      <div>
        <h2 class="font-display text-xl font-black">Crea tu negocio y paga</h2>
        <p class="mt-1 text-sm font-medium text-muted" data-total>{{ total() }}</p>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block sm:col-span-2"><span class="text-xs font-bold uppercase tracking-wider text-muted">Nombre del negocio</span>
          <input class="input mt-2" maxlength="120" autocomplete="organization" data-business [ngModel]="businessName()" (ngModelChange)="setBusiness($event)" name="businessName" [disabled]="locked()">
          @if (errors().businessName) { <small class="mt-1 block text-xs font-bold text-danger" data-field-error="businessName">{{ errors().businessName }}</small> }</label>
        <label class="block sm:col-span-2"><span class="text-xs font-bold uppercase tracking-wider text-muted">Dirección de tu sitio</span>
          <input class="input mt-2" maxlength="63" autocomplete="off" data-slug [ngModel]="slug()" (ngModelChange)="setSlug($event)" name="slug" [disabled]="locked()">
          <small class="mt-1 block text-xs font-medium text-muted">{{ origin }}/{{ slug() || 'tu-negocio' }}</small>
          @if (errors().slug) { <small class="block text-xs font-bold text-danger" data-field-error="slug">{{ errors().slug }}</small> }</label>
        <div class="sm:col-span-2">
          <label class="block"><span class="text-xs font-bold uppercase tracking-wider text-muted">Correo</span>
            <input class="input mt-2" type="email" maxlength="254" autocomplete="username" inputmode="email" data-email [ngModel]="email()" (ngModelChange)="setEmail($event)" name="email" [disabled]="locked() || emailState() === 'verified'"></label>
          @if (emailState() === 'verified') {
            <p class="mt-2 text-sm font-bold text-success" data-email-verified>✓ Correo verificado</p>
          } @else if (emailState() === 'idle' || emailState() === 'sending') {
            <button type="button" class="btn btn-secondary btn-sm mt-2" data-email-send [disabled]="emailState() === 'sending'" (click)="sendEmailCode()">{{ emailState() === 'sending' ? 'Enviando…' : 'Enviar código de verificación' }}</button>
          } @else {
            <div class="mt-3 flex flex-wrap items-end gap-2" data-email-code-box>
              <label class="block"><span class="text-xs font-bold uppercase tracking-wider text-muted">Código de 6 dígitos</span>
                <input class="input mt-1 w-40 tracking-widest" inputmode="numeric" maxlength="6" autocomplete="one-time-code" data-email-code [ngModel]="emailCode()" (ngModelChange)="emailCode.set($event)" name="emailCode"></label>
              <button type="button" class="btn btn-primary btn-sm" data-email-confirm [disabled]="emailState() === 'verifying' || emailCode().length < 6" (click)="confirmEmailCode()">{{ emailState() === 'verifying' ? 'Verificando…' : 'Verificar' }}</button>
              <button type="button" class="btn btn-ghost btn-sm" data-email-resend (click)="sendEmailCode()">Reenviar código</button>
            </div>
            <p class="mt-2 text-xs font-medium text-muted">Te enviamos un código a {{ email().trim() }}. Revisa también la carpeta de spam.</p>
          }
          @if (errors().email) { <small class="mt-1 block text-xs font-bold text-danger" data-field-error="email">{{ errors().email }}</small> }
        </div>
        <label class="block"><span class="text-xs font-bold uppercase tracking-wider text-muted">Contraseña</span>
          <input class="input mt-2" type="password" maxlength="72" autocomplete="new-password" data-password [ngModel]="password()" (ngModelChange)="password.set($event)" name="password" [disabled]="locked()">
          <app-password-meter class="mt-2" [value]="password()" />
          @if (errors().password) { <small class="mt-1 block text-xs font-bold text-danger" data-field-error="password">{{ errors().password }}</small> }</label>
      </div>

      @if (error()) { <p role="alert" class="text-sm font-bold text-danger" data-online-error>{{ error() }}</p> }
      @if (notice()) { <p role="status" class="text-sm font-bold" data-online-notice>{{ notice() }}</p> }

      @if (method() === 'PAYPAL') {
        <div>
          <div #paypalHost data-paypal-buttons class="min-h-12"></div>
          @if (sdkFailed()) {
            <p class="text-sm font-bold text-danger" role="alert" data-sdk-error>No pudimos cargar PayPal. Revisa tu conexión y recarga la página.</p>
          }
        </div>
      } @else {
        <div>
          @if (!walletShown()) {
            <button type="button" class="btn btn-primary btn-lg w-full sm:w-auto" data-mp-start [disabled]="busy()" (click)="startMercadoPago()">
              {{ busy() ? 'Preparando el pago…' : 'Continuar con Mercado Pago' }}
            </button>
          }
          <div id="mp-wallet-container" #walletHost data-mp-wallet class="mt-3"></div>
        </div>
      }
      @if (busy() && method() === 'PAYPAL') { <p class="text-sm font-medium text-muted" data-busy>Confirmando tu pago…</p> }
    </div>
  `,
})
export class OnlineCheckout implements OnInit, OnDestroy {
  readonly plan = input.required<PlanOption>();
  readonly region = input.required<RegionOption>();
  readonly method = input.required<string>();
  readonly config = input.required<CheckoutConfig>();

  private readonly api = inject(BillingApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly loadSdk = inject(SDK_LOADER);
  private readonly redirect = inject(PAGE_REDIRECT);
  private readonly paypalHost = viewChild<ElementRef<HTMLElement>>('paypalHost');
  private paypalButtons: PayPalButtons | null = null;
  private checkout: Checkout | null = null;

  protected readonly origin = typeof location === 'undefined' ? '' : location.host;
  protected readonly businessName = signal('');
  protected readonly slug = signal('');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly errors = signal<Partial<Record<Field, string>>>({});
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly locked = signal(false);
  protected readonly sdkFailed = signal(false);
  protected readonly walletShown = signal(false);
  protected readonly emailState = signal<'idle' | 'sending' | 'sent' | 'verifying' | 'verified'>('idle');
  protected readonly emailCode = signal('');
  private proof = '';
  private slugEdited = false;

  protected readonly total = computed(() => {
    const plan = this.plan();
    const price = this.method() === 'MERCADOPAGO' && plan.arsPrice ? formatArs(plan.arsPrice) : formatUsd(plan.usdCents);
    return `Plan ${plan.name} · ${price} al mes · ${this.region().name}`;
  });

  ngOnInit(): void {
    if (this.method() === 'PAYPAL') {
      void this.mountPayPal();
    }
  }

  ngOnDestroy(): void {
    this.paypalButtons?.close?.();
  }

  protected setEmail(value: string): void {
    this.email.set(value);
    if (this.emailState() !== 'idle') {
      this.emailState.set('idle');
      this.emailCode.set('');
      this.proof = '';
    }
  }

  protected async sendEmailCode(): Promise<void> {
    const email = this.email().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.errors.update(current => ({ ...current, email: 'Escribe un correo válido.' }));
      return;
    }
    this.errors.update(current => ({ ...current, email: undefined }));
    this.emailState.set('sending');
    try {
      await firstValueFrom(this.api.sendEmailCode(email));
      this.emailCode.set('');
      this.emailState.set('sent');
    } catch (error) {
      this.emailState.set('idle');
      const problem = toProblem(error);
      this.errors.update(current => ({
        ...current,
        email: problem.code === 'email_in_use' ? 'Ese correo ya tiene una cuenta. Inicia sesión para renovar tu plan.'
          : problem.status === 429 ? 'Pediste demasiados códigos. Inténtalo más tarde.'
          : isConnectionProblem(problem) ? 'No pudimos enviar el código. Inténtalo de nuevo.' : 'No pudimos enviar el código a ese correo.',
      }));
    }
  }

  protected async confirmEmailCode(): Promise<void> {
    this.emailState.set('verifying');
    try {
      this.proof = (await firstValueFrom(this.api.verifyEmailCode(this.email().trim(), this.emailCode().trim()))).proof;
      this.errors.update(current => ({ ...current, email: undefined }));
      this.emailState.set('verified');
    } catch (error) {
      this.emailState.set('sent');
      this.errors.update(current => ({
        ...current,
        email: toProblem(error).code === 'invalid_email_code' ? 'El código no es válido o venció. Pide uno nuevo.' : 'No pudimos verificar el código. Inténtalo de nuevo.',
      }));
    }
  }

  protected setBusiness(value: string): void {
    this.businessName.set(value);
    if (!this.slugEdited) {
      this.slug.set(slugify(value));
    }
  }

  protected setSlug(value: string): void {
    this.slugEdited = true;
    this.slug.set(value.toLowerCase());
  }

  private validate(): boolean {
    const errors: Partial<Record<Field, string>> = {};
    if (!this.businessName().trim()) {
      errors.businessName = 'Escribe el nombre de tu negocio.';
    }
    const slug = this.slug().trim();
    if (slug.length < 3 || !SLUG_PATTERN.test(slug)) {
      errors.slug = 'Usa de 3 a 63 letras minúsculas, números o guiones.';
    } else if (RESERVED_SLUGS.includes(slug)) {
      errors.slug = 'Esa dirección no está disponible.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email().trim())) {
      errors.email = 'Escribe un correo válido.';
    } else if (this.emailState() !== 'verified') {
      errors.email = 'Verifica tu correo con el código que te enviamos.';
    }
    if (this.password().length < 10) {
      errors.password = 'La contraseña debe tener al menos 10 caracteres.';
    }
    this.errors.set(errors);
    this.error.set(null);
    return Object.keys(errors).length === 0;
  }

  private async startCheckout(method: string): Promise<Checkout> {
    this.busy.set(true);
    try {
      const checkout = await firstValueFrom(this.api.checkout({
        planCode: this.plan().code,
        region: this.region().code,
        method,
        email: this.email().trim(),
        businessName: this.businessName().trim(),
        slug: this.slug().trim(),
        password: this.password(),
        emailProof: this.proof,
      }));
      this.checkout = checkout;
      rememberCheckout(checkout.reference, checkout.claimToken);
      this.locked.set(true);
      return checkout;
    } catch (error) {
      this.busy.set(false);
      this.showCheckoutError(toProblem(error));
      throw error;
    }
  }

  private showCheckoutError(problem: ReturnType<typeof toProblem>): void {
    if (problem.code === 'email_not_verified') {
      this.emailState.set('idle');
      this.proof = '';
      this.errors.update(current => ({ ...current, email: 'Tu verificación venció. Verifica tu correo de nuevo.' }));
    } else if (problem.code === 'slug_taken' || problem.code === 'slug_reserved') {
      this.errors.update(current => ({ ...current, slug: 'Esa dirección ya está en uso. Elige otra.' }));
    } else if (problem.code === 'email_in_use') {
      this.errors.update(current => ({ ...current, email: 'Ese correo ya tiene una cuenta. Inicia sesión para renovar tu plan.' }));
    } else if (problem.code === 'method_unavailable') {
      this.error.set('Esta forma de pago no está disponible por ahora. Elige otra.');
    } else if (problem.fieldErrors.length > 0) {
      const next: Partial<Record<Field, string>> = {};
      for (const { field, message } of problem.fieldErrors) {
        next[field as Field] = message;
      }
      this.errors.update(current => ({ ...current, ...next }));
    } else if (problem.status === 429) {
      this.error.set('Demasiados intentos. Espera un momento e inténtalo de nuevo.');
    } else if (isConnectionProblem(problem)) {
      this.error.set('No pudimos iniciar el pago. Inténtalo de nuevo en unos minutos.');
    } else {
      this.error.set('No pudimos iniciar el pago. Revisa tus datos.');
    }
  }

  private async mountPayPal(): Promise<void> {
    const clientId = this.config().paypalClientId;
    try {
      await this.loadSdk(`https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture&components=buttons`);
    } catch {
      this.sdkFailed.set(true);
      return;
    }
    const host = this.paypalHost()?.nativeElement;
    const sdk = (window as unknown as { paypal?: PayPalSdk }).paypal;
    if (!host || !sdk) {
      this.sdkFailed.set(true);
      return;
    }
    this.paypalButtons = sdk.Buttons({
      style: { layout: 'vertical', shape: 'pill', label: 'pay' },
      onClick: (_: unknown, actions: { resolve(): Promise<void>; reject(): Promise<void> }) => (this.validate() ? actions.resolve() : actions.reject()),
      createOrder: async () => (await this.startCheckout('PAYPAL')).providerRef,
      onApprove: async () => {
        await this.finishPayPal();
      },
      onCancel: () => {
        this.busy.set(false);
        this.locked.set(false);
        this.notice.set('Cancelaste el pago. Puedes intentarlo de nuevo cuando quieras.');
      },
      onError: () => {
        this.busy.set(false);
        if (!this.errors().slug && !this.errors().email && !this.error()) {
          this.error.set('PayPal no pudo completar el pago. No se hizo ningún cobro; inténtalo de nuevo.');
        }
      },
    });
    await this.paypalButtons.render(host);
  }

  private async finishPayPal(): Promise<void> {
    const checkout = this.checkout;
    if (!checkout) {
      return;
    }
    this.notice.set(null);
    try {
      const state = await firstValueFrom(this.api.capturePayPal(checkout.reference));
      await this.enter(state, checkout);
    } catch {
      this.busy.set(false);
      await this.router.navigate(['/pago/resultado'], { queryParams: { ref: checkout.reference } });
    }
  }

  protected async startMercadoPago(): Promise<void> {
    if (!this.validate()) {
      return;
    }
    try {
      const checkout = await this.startCheckout('MERCADOPAGO');
      const publicKey = this.config().mercadopagoPublicKey;
      if (publicKey) {
        await this.mountWallet(publicKey, checkout.providerRef);
        this.busy.set(false);
      } else if (checkout.initPoint) {
        this.redirect(checkout.initPoint);
      }
    } catch {
      this.busy.set(false);
    }
  }

  private async mountWallet(publicKey: string, preferenceId: string): Promise<void> {
    try {
      await this.loadSdk('https://sdk.mercadopago.com/js/v2');
      const sdk = (window as unknown as { MercadoPago?: MercadoPagoSdk }).MercadoPago;
      if (!sdk) {
        throw new Error('sin SDK');
      }
      await new sdk(publicKey, { locale: 'es-AR' }).bricks().create('wallet', 'mp-wallet-container', { initialization: { preferenceId } });
      this.walletShown.set(true);
    } catch {
      const checkout = this.checkout;
      if (checkout?.initPoint) {
        this.redirect(checkout.initPoint);
      } else {
        this.error.set('No pudimos cargar Mercado Pago. Inténtalo de nuevo.');
      }
    }
  }

  private async enter(state: OrderState, checkout: Checkout): Promise<void> {
    if (state.ready) {
      try {
        await firstValueFrom(this.api.startSession(checkout.reference, checkout.claimToken));
        await this.auth.refreshUser();
        await this.router.navigateByUrl('/admin');
        return;
      } catch {
        // si la sesión automática falla, la pantalla de resultado indica cómo entrar
      }
    }
    await this.router.navigate(['/pago/resultado'], { queryParams: { ref: checkout.reference } });
  }
}
