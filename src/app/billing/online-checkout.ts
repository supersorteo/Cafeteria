import { Component, ElementRef, InjectionToken, OnDestroy, OnInit, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { isConnectionProblem, toProblem } from '../core/api-error';
import { AuthService } from '../core/auth.service';
import {
  BillingApi, Checkout, CheckoutConfig, OrderState, PlanOption, RegionOption, forgetCheckout, formatArs, formatUsd, rememberCheckout,
} from '../core/billing.api';
import { RESERVED_SLUGS, SLUG_PATTERN, slugify } from '../shared/slug';
import { PasswordToggle } from '../shared/ui/password-toggle';
import { clearDraft, loadDraft, mailboxFor, saveDraft, takeEmailCode } from './checkout-draft';
import { emailProblem, emailSuggestion, passwordProblem, passwordRules } from './checkout-rules';
import { OtpInput } from './otp-input';
import { CHECKOUT_CHANNEL, CheckoutChannel, CheckoutMessage, PAGE_REDIRECT, PAYMENT_WINDOW, PaymentWindow, SDK_LOADER } from './sdk-loader';

type Field = 'businessName' | 'slug' | 'email' | 'password';
type EmailState = 'idle' | 'sending' | 'sent' | 'verifying' | 'verified';
type MpState = 'idle' | 'opening' | 'waiting' | 'checking';

const FIELDS: Field[] = ['businessName', 'slug', 'email', 'password'];
const RESEND_SECONDS = 45;

export const MP_POLL_MS = new InjectionToken<number>('mercadopago-poll-ms', { factory: () => 4000 });

interface PayPalButtons {
  render(host: HTMLElement): Promise<void>;
  close?(): void;
}

interface PayPalSdk {
  Buttons(options: Record<string, unknown>): PayPalButtons;
}

@Component({
  imports: [FormsModule, OtpInput, PasswordToggle],
  selector: 'app-online-checkout',
  host: { class: 'block' },
  template: `
    <form class="space-y-5" data-online-checkout novalidate (submit)="$event.preventDefault()">
      <div>
        <h2 class="font-display text-xl font-black">Crea tu negocio y paga</h2>
        <p class="mt-1 text-sm font-medium text-muted" data-total>{{ total() }}</p>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <label for="co-business" class="text-xs font-bold uppercase tracking-wider text-muted">Nombre del negocio</label>
          <input id="co-business" class="input mt-2" maxlength="120" autocomplete="organization" placeholder="Ej.: Café La Esquina" data-business
                 [ngModel]="businessName()" (ngModelChange)="setBusiness($event)" name="businessName" (blur)="touch('businessName')"
                 [disabled]="locked()" [attr.aria-invalid]="!!errors().businessName" [attr.aria-describedby]="errors().businessName ? 'co-business-error' : null">
          @if (errors().businessName) { <p id="co-business-error" class="field-error" data-field-error="businessName">{{ errors().businessName }}</p> }
        </div>

        <div class="sm:col-span-2">
          <label for="co-slug" class="text-xs font-bold uppercase tracking-wider text-muted">Dirección de tu sitio</label>
          <input id="co-slug" class="input mt-2" maxlength="63" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="tu-negocio" data-slug
                 [ngModel]="slug()" (ngModelChange)="setSlug($event)" name="slug" (blur)="touch('slug')"
                 [disabled]="locked()" [attr.aria-invalid]="!!errors().slug" aria-describedby="co-slug-hint">
          <p id="co-slug-hint" class="mt-1 text-xs font-medium text-muted">{{ origin }}/<strong class="text-ink">{{ slug() || 'tu-negocio' }}</strong></p>
          @if (errors().slug) { <p class="field-error" data-field-error="slug">{{ errors().slug }}</p> }
        </div>

        <div class="sm:col-span-2">
          <label for="co-email" class="text-xs font-bold uppercase tracking-wider text-muted">Correo</label>
          <div class="relative mt-2">
            <input id="co-email" class="input" [class.has-addon]="emailState() !== 'verified'" type="email" maxlength="254" autocomplete="email" inputmode="email"
                   autocapitalize="off" spellcheck="false" placeholder="nombre@gmail.com" data-email
                   [ngModel]="email()" (ngModelChange)="setEmail($event)" name="email" (blur)="emailBlur()" (keydown.enter)="sendEmailCode()"
                   [disabled]="locked() || emailState() === 'verified' || emailState() === 'verifying'"
                   [attr.aria-invalid]="!!errors().email" [attr.aria-describedby]="errors().email ? 'co-email-error' : null">
            <div class="field-addon">
              @switch (emailState()) {
                @case ('verified') { <span class="badge badge-success" data-email-verified>✓ Verificado</span> }
                @case ('sending') { <span class="px-2 text-xs font-bold text-muted" data-email-sending>Enviando…</span> }
                @case ('idle') { <button type="button" class="btn btn-secondary btn-sm" data-email-send (click)="sendEmailCode()">Verificar</button> }
                @default { <button type="button" class="btn btn-ghost btn-sm" data-email-change (click)="changeEmail()">Cambiar</button> }
              }
            </div>
          </div>
          @if (suggestion(); as better) {
            <p class="mt-1 text-xs font-medium text-muted" data-email-suggestion>¿Quisiste decir
              <button type="button" class="font-bold text-primary underline" (click)="useSuggestion(better)">{{ better }}</button>?</p>
          }
          @if (errors().email) { <p id="co-email-error" class="field-error" data-field-error="email">{{ errors().email }}</p> }
          @if (emailState() === 'verified' && !locked()) {
            <button type="button" class="mt-1 text-xs font-bold text-muted underline" data-email-change (click)="changeEmail()">Usar otro correo</button>
          }

          @if (emailState() === 'sent' || emailState() === 'verifying') {
            <div class="mt-3 rounded-2xl border border-line bg-surface-2 p-4 sm:p-5" data-email-code-box>
              <p class="text-sm font-medium">Te enviamos un correo a <strong>{{ email().trim() }}</strong>. Sigue estos 2 pasos; esta página te espera abierta.</p>
              <ol class="mt-4 space-y-4">
                <li class="code-step" [class.code-step-active]="!mailOpened()" [class.code-step-done]="mailOpened()" data-code-step="1">
                  <span class="code-step-n" aria-hidden="true">{{ mailOpened() ? '✓' : '1' }}</span>
                  <div class="min-w-0 flex-1">
                    <p class="font-bold">Abre tu correo</p>
                    @if (mailbox(); as box) {
                      <a class="btn btn-primary btn-sm mt-2" [href]="box.url" target="_blank" rel="noopener" data-open-mailbox (click)="mailOpened.set(true)">Abrir {{ box.name }} ↗</a>
                    } @else {
                      <p class="text-xs font-medium text-muted">Ábrelo en otra pestaña o en la app de tu correo.</p>
                      <button type="button" class="mt-1 text-xs font-bold text-primary underline" data-mailbox-opened (click)="mailOpened.set(true)">Ya lo abrí</button>
                    }
                    <p class="mt-2 text-xs font-medium text-muted">Busca el mensaje «Deliora: tu código es…». Si no está, mira en Spam o Promociones.</p>
                  </div>
                </li>
                <li class="code-step" [class.code-step-active]="mailOpened()" data-code-step="2">
                  <span class="code-step-n" aria-hidden="true">2</span>
                  <div class="min-w-0 flex-1">
                    <p class="font-bold">Toca el enlace del mensaje, o copia el código</p>
                    <p class="text-xs font-medium text-muted">Con el enlace se verifica solo y sigues aquí. Si copias el código, al volver lo pegamos por ti.</p>
                    <app-otp-input class="mt-3" [disabled]="emailState() === 'verifying'" [invalid]="!!codeError()" (completed)="confirmEmailCode($event)" />
                    <div class="mt-3 flex flex-wrap items-center gap-3">
                      <button type="button" class="btn btn-secondary btn-sm" [class.paste-hint]="returned() && emailState() === 'sent'" data-paste-code
                              [disabled]="emailState() === 'verifying'" (click)="pasteCode()">Pegar código</button>
                      <span class="min-h-5 text-xs font-bold" aria-live="polite">
                        @if (emailState() === 'verifying') { <span class="text-muted" data-email-verifying>Verificando…</span> }
                        @else if (codeError()) { <span class="text-danger" data-code-error>{{ codeError() }}</span> }
                        @else if (attempted()) { <span class="text-danger" data-code-pending>Falta este paso: escribe el código para continuar.</span> }
                      </span>
                    </div>
                  </div>
                </li>
              </ol>
              <p class="mt-4 text-xs font-medium text-muted">¿No llegó?
                @if (resendIn() > 0) { <span data-email-countdown>Podrás reenviarlo en {{ resendIn() }} s.</span> }
                @else { <button type="button" class="font-bold text-primary underline" data-email-resend (click)="sendEmailCode(true)">Reenviar código</button> }
              </p>
            </div>
          }
        </div>

        <div class="sm:col-span-2">
          <label for="co-password" class="text-xs font-bold uppercase tracking-wider text-muted">Contraseña</label>
          <app-password-toggle class="mt-2">
            <input id="co-password" class="input has-toggle" type="password" maxlength="72" autocomplete="new-password" data-password
                   [ngModel]="password()" (ngModelChange)="setPassword($event)" name="password" (blur)="touch('password')"
                   [disabled]="locked()" [attr.aria-invalid]="!!errors().password" aria-describedby="co-password-rules">
          </app-password-toggle>
          <ul id="co-password-rules" class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold" aria-label="Requisitos de la contraseña">
            @for (rule of rules(); track rule.key) {
              <li [attr.data-password-rule]="rule.key" [attr.data-ok]="rule.ok" [class.text-success]="rule.ok" [class.text-muted]="!rule.ok">
                <span aria-hidden="true">{{ rule.ok ? '✓' : '○' }}</span> {{ rule.label }}<span class="sr-only">{{ rule.ok ? ': cumplido' : ': pendiente' }}</span>
              </li>
            }
          </ul>
          @if (errors().password) { <p class="field-error" data-field-error="password">{{ errors().password }}</p> }
        </div>
      </div>

      @if (error()) { <p role="alert" class="rounded-xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger" data-online-error>{{ error() }}</p> }
      @if (notice()) { <p role="status" class="rounded-xl bg-surface-2 px-4 py-3 text-sm font-bold" data-online-notice>{{ notice() }}</p> }

      @if (method() === 'PAYPAL') {
        <div>
          <div #paypalHost data-paypal-buttons class="min-h-12"></div>
          @if (sdkFailed()) {
            <p class="text-sm font-bold text-danger" role="alert" data-sdk-error>No pudimos cargar PayPal. Revisa tu conexión y recarga la página.</p>
          }
          @if (busy()) { <p class="text-sm font-medium text-muted" data-busy>Confirmando tu pago…</p> }
        </div>
      } @else {
        @switch (mpState()) {
          @case ('idle') {
            <div>
              <button type="button" class="btn btn-mp btn-lg w-full" data-mp-start (click)="startMercadoPago()">Pagar con Mercado Pago</button>
              <p class="mt-2 text-center text-xs font-medium text-muted">Se abre una ventana segura de Mercado Pago. Al terminar, entras a tu panel automáticamente.</p>
            </div>
          }
          @case ('opening') {
            <button type="button" class="btn btn-mp btn-lg w-full" disabled data-mp-opening>Abriendo Mercado Pago…</button>
          }
          @default {
            <div class="rounded-2xl border border-line bg-surface-2 p-5 text-center" role="status" data-mp-waiting>
              <span class="mx-auto block h-8 w-8 animate-spin rounded-full border-[3px] border-[#009ee3] border-r-transparent" aria-hidden="true"></span>
              @if (mpState() === 'checking') {
                <p class="mt-3 font-bold" data-mp-checking>Confirmando tu pago…</p>
                <p class="mt-1 text-sm font-medium text-muted">En unos segundos creamos tu negocio y entras a tu panel.</p>
              } @else if (popupClosed()) {
                <p class="mt-3 font-bold" data-mp-closed>Se cerró la ventana de Mercado Pago</p>
                <p class="mt-1 text-sm font-medium text-muted">Si ya pagaste, la confirmación llega sola en unos segundos. Si no, ábrela de nuevo.</p>
              } @else {
                <p class="mt-3 font-bold">Completa el pago en la ventana de Mercado Pago</p>
                <p class="mt-1 text-sm font-medium text-muted">Esta página se actualiza sola cuando el pago se confirme.</p>
              }
              <div class="mt-4 flex flex-wrap justify-center gap-2">
                <button type="button" class="btn btn-secondary btn-sm" data-mp-focus (click)="showPaymentWindow()">{{ popupClosed() ? 'Abrir Mercado Pago' : 'Ir a la ventana de pago' }}</button>
                <button type="button" class="btn btn-ghost btn-sm" data-mp-cancel (click)="cancelMercadoPago()">Cancelar</button>
              </div>
            </div>
          }
        }
      }
    </form>
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
  private readonly openWindow = inject(PAYMENT_WINDOW);
  private readonly openChannel = inject(CHECKOUT_CHANNEL);
  private readonly pollMs = inject(MP_POLL_MS);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly paypalHost = viewChild<ElementRef<HTMLElement>>('paypalHost');
  private readonly otp = viewChild(OtpInput);
  private paypalButtons: PayPalButtons | null = null;
  private checkout: Checkout | null = null;
  private popup: PaymentWindow | null = null;
  private channel: CheckoutChannel | null = null;
  private emailChannel: CheckoutChannel | null = null;
  private readonly onPageBack = (): void => this.pageBack();
  private pollTimer?: ReturnType<typeof setInterval>;
  private resendTimer?: ReturnType<typeof setInterval>;
  private proof = '';
  private lastSent = '';
  private slugEdited = false;

  protected readonly origin = typeof location === 'undefined' ? '' : location.host;
  protected readonly businessName = signal('');
  protected readonly slug = signal('');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly touched = signal<ReadonlySet<Field>>(new Set());
  protected readonly attempted = signal(false);
  protected readonly serverErrors = signal<Partial<Record<Field, string>>>({});
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly locked = signal(false);
  protected readonly sdkFailed = signal(false);
  protected readonly emailState = signal<EmailState>('idle');
  protected readonly codeError = signal<string | null>(null);
  protected readonly resendIn = signal(0);
  protected readonly mpState = signal<MpState>('idle');
  protected readonly popupClosed = signal(false);
  protected readonly mailOpened = signal(false);
  protected readonly returned = signal(false);
  protected readonly mailbox = computed(() => mailboxFor(this.email()));

  protected readonly rules = computed(() => passwordRules(this.password()));
  protected readonly suggestion = computed(() => (this.emailState() === 'verified' ? null : emailSuggestion(this.email())));

  private readonly localErrors = computed<Partial<Record<Field, string>>>(() => {
    const errors: Partial<Record<Field, string>> = {};
    if (!this.businessName().trim()) {
      errors.businessName = 'Escribe el nombre de tu negocio.';
    }
    const slug = this.slug().trim();
    if (slug.length < 3 || !SLUG_PATTERN.test(slug)) {
      errors.slug = 'Usa de 3 a 63 letras minúsculas, números o guiones, sin guiones al inicio ni al final.';
    } else if (RESERVED_SLUGS.includes(slug)) {
      errors.slug = 'Esa dirección no está disponible. Elige otra.';
    }
    const emailIssue = emailProblem(this.email());
    if (emailIssue) {
      errors.email = emailIssue;
    } else if (this.attempted() && this.emailState() !== 'verified') {
      errors.email = this.emailState() === 'idle' ? 'Verifica tu correo: toca «Verificar» y te enviamos un código.' : 'Escribe el código de 6 dígitos que te enviamos.';
    }
    const passwordIssue = passwordProblem(this.password());
    if (passwordIssue) {
      errors.password = passwordIssue;
    }
    return errors;
  });

  protected readonly errors = computed<Partial<Record<Field, string>>>(() => {
    const local = this.localErrors();
    const server = this.serverErrors();
    const touched = this.touched();
    const shown: Partial<Record<Field, string>> = {};
    const codePending = this.emailState() === 'sent' || this.emailState() === 'verifying';
    for (const field of FIELDS) {
      if (field === 'email' && codePending && !server.email) {
        continue;
      }
      const message = server[field] ?? local[field];
      if (message && (server[field] || this.attempted() || touched.has(field))) {
        shown[field] = message;
      }
    }
    return shown;
  });

  protected readonly total = computed(() => {
    const plan = this.plan();
    const price = this.method() === 'MERCADOPAGO' && plan.arsPrice ? formatArs(plan.arsPrice) : formatUsd(plan.usdCents);
    return `Plan ${plan.name} · ${price} al mes · ${this.region().name}`;
  });

  constructor() {
    effect(() => {
      const draft = {
        plan: this.plan().code, region: this.region().code, method: this.method(),
        businessName: this.businessName(), slug: this.slug(), email: this.email(),
      };
      if (draft.businessName || draft.email) {
        saveDraft(draft);
      }
    });
  }

  ngOnInit(): void {
    this.restoreDraft();
    if (this.method() === 'PAYPAL') {
      void this.mountPayPal();
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', this.onPageBack);
      document.addEventListener('visibilitychange', this.onPageBack);
    }
  }

  ngOnDestroy(): void {
    this.paypalButtons?.close?.();
    this.stopWaiting();
    this.closeEmailChannel();
    clearInterval(this.resendTimer);
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', this.onPageBack);
      document.removeEventListener('visibilitychange', this.onPageBack);
    }
  }

  private restoreDraft(): void {
    const draft = loadDraft();
    if (!draft || draft.plan !== this.plan().code || draft.region !== this.region().code || draft.method !== this.method()) {
      return;
    }
    this.businessName.set(draft.businessName);
    this.slug.set(draft.slug);
    this.email.set(draft.email);
    this.slugEdited = draft.slug !== slugify(draft.businessName);
    const code = draft.email ? takeEmailCode(draft.email) : null;
    if (code) {
      this.lastSent = draft.email.trim().toLowerCase();
      this.mailOpened.set(true);
      this.emailState.set('sent');
      this.notice.set('Retomamos tu compra donde la dejaste. Solo falta tu contraseña.');
      void this.confirmEmailCode(code);
    }
  }

  private pageBack(): void {
    if (document.visibilityState !== 'visible' || this.emailState() !== 'sent' || !this.mailOpened()) {
      return;
    }
    this.returned.set(true);
    void this.autoPaste();
  }

  private async autoPaste(): Promise<void> {
    try {
      const permission = await navigator.permissions?.query({ name: 'clipboard-read' as PermissionName });
      if (permission?.state === 'granted') {
        const code = (await navigator.clipboard.readText()).match(/\b\d{6}\b/)?.[0];
        if (code) {
          this.useCode(code);
          return;
        }
      }
    } catch {
      // sin permiso para leer el portapapeles: se ofrece «Pegar código»
    }
    this.otp()?.focus();
  }

  protected async pasteCode(): Promise<void> {
    this.codeError.set(null);
    try {
      const code = (await navigator.clipboard.readText()).match(/\b\d{6}\b/)?.[0];
      if (code) {
        this.useCode(code);
      } else {
        this.codeError.set('No encontramos un código de 6 dígitos copiado. Cópialo del correo e inténtalo de nuevo.');
      }
    } catch {
      this.codeError.set('Tu navegador no nos deja leer lo copiado. Mantén presionada la primera casilla y elige «Pegar».');
      this.otp()?.focus();
    }
  }

  private useCode(code: string): void {
    const otp = this.otp();
    if (otp) {
      otp.fillCode(code);
    } else {
      void this.confirmEmailCode(code);
    }
  }

  private listenForEmailLink(): void {
    this.closeEmailChannel();
    this.emailChannel = this.openChannel();
    if (!this.emailChannel) {
      return;
    }
    this.emailChannel.onmessage = event => {
      const message = event.data;
      if (message?.type !== 'email-code' || !message.code || message.email?.trim().toLowerCase() !== this.email().trim().toLowerCase()
        || this.emailState() !== 'sent') {
        return;
      }
      this.emailChannel?.postMessage({ type: 'email-ack', email: message.email });
      this.useCode(message.code);
    };
  }

  private closeEmailChannel(): void {
    this.emailChannel?.close();
    this.emailChannel = null;
  }

  protected touch(field: Field): void {
    if (!this.touched().has(field)) {
      this.touched.update(current => new Set([...current, field]));
    }
  }

  private clearServerError(field: Field): void {
    if (this.serverErrors()[field]) {
      this.serverErrors.update(current => ({ ...current, [field]: undefined }));
    }
    this.error.set(null);
  }

  protected setBusiness(value: string): void {
    this.businessName.set(value);
    this.clearServerError('businessName');
    if (!this.slugEdited) {
      this.slug.set(slugify(value));
      this.clearServerError('slug');
    }
  }

  protected setSlug(value: string): void {
    this.slugEdited = true;
    this.slug.set(value.toLowerCase().replace(/\s+/g, '-'));
    this.clearServerError('slug');
  }

  protected setPassword(value: string): void {
    this.password.set(value);
    this.clearServerError('password');
  }

  protected setEmail(value: string): void {
    this.email.set(value);
    this.clearServerError('email');
  }

  protected useSuggestion(value: string): void {
    this.setEmail(value);
    this.touch('email');
  }

  protected emailBlur(): void {
    this.touch('email');
    const email = this.email().trim();
    if (this.emailState() === 'idle' && !emailProblem(email) && !this.suggestion() && email.toLowerCase() !== this.lastSent) {
      void this.sendEmailCode();
    }
  }

  protected changeEmail(): void {
    this.closeEmailChannel();
    this.notice.set(null);
    this.mailOpened.set(false);
    this.returned.set(false);
    this.emailState.set('idle');
    this.proof = '';
    this.lastSent = '';
    this.codeError.set(null);
    clearInterval(this.resendTimer);
    setTimeout(() => (this.host.querySelector('[data-email]') as HTMLInputElement | null)?.focus());
  }

  protected async sendEmailCode(resend = false): Promise<void> {
    const email = this.email().trim();
    this.touch('email');
    if (emailProblem(email) || this.emailState() === 'sending' || (resend && this.resendIn() > 0)) {
      return;
    }
    this.clearServerError('email');
    this.codeError.set(null);
    this.emailState.set('sending');
    try {
      await firstValueFrom(this.api.sendEmailCode(email));
      this.lastSent = email.toLowerCase();
      this.emailState.set('sent');
      this.listenForEmailLink();
      this.startResendCountdown();
      setTimeout(() => (resend ? this.otp()?.clear() : this.otp()?.focus()));
    } catch (error) {
      this.emailState.set('idle');
      const problem = toProblem(error);
      this.serverErrors.update(current => ({
        ...current,
        email: problem.code === 'email_in_use' ? 'Ese correo ya tiene una cuenta. Inicia sesión para renovar tu plan.'
          : problem.status === 429 ? 'Pediste demasiados códigos. Espera unos minutos e inténtalo de nuevo.'
          : problem.fieldErrors.length > 0 ? 'Revisa el formato del correo. Ejemplo: nombre@gmail.com'
          : isConnectionProblem(problem) ? 'No pudimos enviar el código. Revisa tu conexión e inténtalo de nuevo.' : 'No pudimos enviar el código a ese correo.',
      }));
    }
  }

  private startResendCountdown(): void {
    clearInterval(this.resendTimer);
    this.resendIn.set(RESEND_SECONDS);
    this.resendTimer = setInterval(() => {
      this.resendIn.update(value => Math.max(0, value - 1));
      if (this.resendIn() === 0) {
        clearInterval(this.resendTimer);
      }
    }, 1000);
  }

  protected async confirmEmailCode(code: string): Promise<void> {
    if (this.emailState() !== 'sent') {
      return;
    }
    this.emailState.set('verifying');
    this.codeError.set(null);
    try {
      this.proof = (await firstValueFrom(this.api.verifyEmailCode(this.email().trim(), code))).proof;
      this.clearServerError('email');
      this.emailState.set('verified');
      this.closeEmailChannel();
      clearInterval(this.resendTimer);
      if (!this.password()) {
        setTimeout(() => (this.host.querySelector('[data-password]') as HTMLInputElement | null)?.focus());
      }
    } catch (error) {
      this.emailState.set('sent');
      this.codeError.set(toProblem(error).code === 'invalid_email_code'
        ? 'El código no es correcto o venció. Revísalo o pide uno nuevo.'
        : 'No pudimos verificar el código. Inténtalo de nuevo.');
      setTimeout(() => this.otp()?.clear());
    }
  }

  private attempt(): boolean {
    this.attempted.set(true);
    this.notice.set(null);
    const errors = { ...this.localErrors(), ...this.serverErrors() };
    const first = FIELDS.find(field => errors[field]);
    if (!first) {
      this.error.set(null);
      return true;
    }
    this.error.set('Revisa los campos marcados antes de pagar.');
    if (this.emailState() === 'idle' && !emailProblem(this.email())) {
      void this.sendEmailCode();
    }
    const selector = first === 'email' && (this.emailState() === 'sent' || this.emailState() === 'verifying') ? '[data-otp="0"]' : `[data-${first === 'businessName' ? 'business' : first}]`;
    setTimeout(() => {
      const target = this.host.querySelector(selector) as HTMLElement | null;
      target?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      target?.focus({ preventScroll: true });
    });
    return false;
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
      this.showCheckoutError(toProblem(error));
      throw error;
    } finally {
      this.busy.set(false);
    }
  }

  private showCheckoutError(problem: ReturnType<typeof toProblem>): void {
    if (problem.code === 'email_not_verified') {
      this.changeEmail();
      this.serverErrors.update(current => ({ ...current, email: 'Tu verificación venció. Verifica tu correo de nuevo.' }));
    } else if (problem.code === 'slug_taken' || problem.code === 'slug_reserved') {
      this.serverErrors.update(current => ({ ...current, slug: 'Esa dirección ya está en uso. Elige otra.' }));
    } else if (problem.code === 'email_in_use') {
      this.serverErrors.update(current => ({ ...current, email: 'Ese correo ya tiene una cuenta. Inicia sesión para renovar tu plan.' }));
    } else if (problem.code === 'method_unavailable') {
      this.error.set('Esta forma de pago no está disponible por ahora. Elige otra.');
      return;
    } else if (problem.fieldErrors.length > 0) {
      const next: Partial<Record<Field, string>> = {};
      for (const { field, message } of problem.fieldErrors) {
        next[field as Field] = message;
      }
      this.serverErrors.update(current => ({ ...current, ...next }));
    } else if (problem.status === 429) {
      this.error.set('Demasiados intentos. Espera un momento e inténtalo de nuevo.');
      return;
    } else if (isConnectionProblem(problem)) {
      this.error.set('No pudimos iniciar el pago. Inténtalo de nuevo en unos minutos.');
      return;
    } else {
      this.error.set('No pudimos iniciar el pago. Revisa tus datos.');
      return;
    }
    this.error.set('Revisa los campos marcados antes de pagar.');
  }

  private releaseCheckout(): void {
    this.checkout = null;
    this.locked.set(false);
    forgetCheckout();
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
      onClick: (_: unknown, actions: { resolve(): Promise<void>; reject(): Promise<void> }) => (this.attempt() ? actions.resolve() : actions.reject()),
      createOrder: async () => (await this.startCheckout('PAYPAL')).providerRef,
      onApprove: async () => {
        await this.finishPayPal();
      },
      onCancel: () => {
        this.busy.set(false);
        this.releaseCheckout();
        this.notice.set('Cancelaste el pago. No se hizo ningún cobro; puedes intentarlo de nuevo cuando quieras.');
      },
      onError: () => {
        this.busy.set(false);
        if (!this.error()) {
          this.releaseCheckout();
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
    this.busy.set(true);
    try {
      const state = await firstValueFrom(this.api.capturePayPal(checkout.reference));
      await this.enter(state, checkout);
    } catch {
      this.busy.set(false);
      await this.router.navigate(['/pago/resultado'], { queryParams: { ref: checkout.reference } });
    }
  }

  protected async startMercadoPago(): Promise<void> {
    if (this.mpState() !== 'idle' || !this.attempt()) {
      return;
    }
    const popup = this.openWindow();
    this.mpState.set('opening');
    let checkout: Checkout;
    try {
      checkout = await this.startCheckout('MERCADOPAGO');
    } catch {
      popup?.close();
      this.mpState.set('idle');
      return;
    }
    if (!checkout.initPoint) {
      popup?.close();
      this.releaseCheckout();
      this.mpState.set('idle');
      this.error.set('No pudimos abrir Mercado Pago. Inténtalo de nuevo.');
      return;
    }
    if (!popup || popup.closed) {
      this.redirect(checkout.initPoint);
      return;
    }
    popup.location.href = checkout.initPoint;
    this.popup = popup;
    this.popupClosed.set(false);
    this.mpState.set('waiting');
    this.watch(checkout);
  }

  protected showPaymentWindow(): void {
    const checkout = this.checkout;
    if (!checkout?.initPoint) {
      return;
    }
    if (this.popup && !this.popup.closed) {
      this.popup.focus();
      return;
    }
    const popup = this.openWindow();
    if (!popup) {
      this.redirect(checkout.initPoint);
      return;
    }
    popup.location.href = checkout.initPoint;
    this.popup = popup;
    this.popupClosed.set(false);
  }

  protected cancelMercadoPago(): void {
    this.stopWaiting();
    this.releaseCheckout();
    this.notice.set('Cancelaste el pago. Si ya pagaste en Mercado Pago, te avisaremos por correo; si no, puedes intentarlo de nuevo.');
  }

  private watch(checkout: Checkout): void {
    this.channel?.close();
    this.channel = this.openChannel();
    if (this.channel) {
      this.channel.onmessage = event => this.onReturn(event.data, checkout);
    }
    clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => {
      if (this.popup?.closed && !this.popupClosed()) {
        this.popupClosed.set(true);
      }
      void this.refresh(checkout, null);
    }, this.pollMs);
  }

  private onReturn(message: CheckoutMessage, checkout: Checkout): void {
    if (message?.type !== 'mp-return' || message.reference !== checkout.reference) {
      return;
    }
    this.channel?.postMessage({ type: 'mp-ack', reference: checkout.reference });
    this.popup?.close();
    this.popupClosed.set(true);
    this.mpState.set('checking');
    void this.refresh(checkout, message.paymentId ?? null, true);
  }

  private async refresh(checkout: Checkout, paymentId: string | null, returned = false): Promise<void> {
    if (this.checkout !== checkout) {
      return;
    }
    let state: OrderState;
    try {
      state = paymentId
        ? await firstValueFrom(this.api.verifyMercadoPago(checkout.reference, paymentId))
        : await firstValueFrom(this.api.orderState(checkout.reference));
    } catch {
      return;
    }
    if (this.checkout !== checkout) {
      return;
    }
    if (state.status === 'PAID') {
      this.mpState.set('checking');
      if (state.ready) {
        await this.enter(state, checkout);
      }
      return;
    }
    const open = state.status === 'PENDING';
    if (open && (!returned || (paymentId && !state.failure))) {
      return;
    }
    this.stopWaiting();
    this.releaseCheckout();
    if (open && !state.failure) {
      this.notice.set('No completaste el pago en Mercado Pago. No se hizo ningún cobro; puedes intentarlo de nuevo.');
    } else {
      this.error.set('Mercado Pago no aprobó el pago. No se hizo ningún cobro; puedes intentarlo de nuevo con otra tarjeta o medio.');
    }
  }

  private stopWaiting(): void {
    clearInterval(this.pollTimer);
    this.pollTimer = undefined;
    this.channel?.close();
    this.channel = null;
    if (this.popup && !this.popup.closed) {
      this.popup.close();
    }
    this.popup = null;
    this.popupClosed.set(false);
    this.mpState.set('idle');
  }

  private async enter(state: OrderState, checkout: Checkout): Promise<void> {
    clearInterval(this.pollTimer);
    if (this.popup && !this.popup.closed) {
      this.popup.close();
    }
    if (state.ready) {
      try {
        await firstValueFrom(this.api.startSession(checkout.reference, checkout.claimToken));
        await this.auth.refreshUser();
        forgetCheckout();
        clearDraft();
        await this.router.navigateByUrl('/admin');
        return;
      } catch {
        // si la sesión automática falla, la pantalla de resultado indica cómo entrar
      }
    }
    await this.router.navigate(['/pago/resultado'], { queryParams: { ref: checkout.reference } });
  }
}
