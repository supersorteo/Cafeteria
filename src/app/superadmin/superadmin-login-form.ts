import { Component, DestroyRef, ElementRef, inject, output, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { isConnectionProblem, toProblem } from '../core/api-error';
import { SuperAdminAuth } from '../core/superadmin-auth.service';
import { PasswordToggle } from '../shared/ui/password-toggle';

@Component({
  imports: [ReactiveFormsModule, PasswordToggle],
  selector: 'app-superadmin-login-form',
  host: { class: 'block' },
  template: `
    @if (auth.step() === 'credentials') {
      <form [formGroup]="credentials" (ngSubmit)="submitCredentials()" class="space-y-5" novalidate data-step-credentials>
        <div>
          <label for="sa-email" class="text-xs font-bold uppercase tracking-wider text-muted">Correo</label>
          <input id="sa-email" name="sa_email" type="email" autocomplete="off" autocapitalize="off" spellcheck="false" formControlName="email" class="input mt-2">
        </div>
        <div>
          <label for="sa-password" class="text-xs font-bold uppercase tracking-wider text-muted">Contraseña</label>
          <app-password-toggle><input id="sa-password" name="sa_password" type="password" autocomplete="new-password"
                                      formControlName="password" class="input mt-2 has-toggle"></app-password-toggle>
        </div>
        @if (error(); as message) {
          <p role="alert" class="rounded-ui-md bg-danger/10 px-4 py-3 text-sm font-bold text-danger anim-fade-in">{{ message }}</p>
        }
        <button type="submit" [disabled]="pending()" class="btn btn-primary btn-lg w-full" [class.btn-loading]="pending()">
          {{ pending() ? 'Comprobando…' : 'Continuar' }}
        </button>
      </form>
    } @else {
      <form [formGroup]="codeForm" (ngSubmit)="submitCode()" class="space-y-5" novalidate data-step-code>
        <p class="font-medium text-muted">
          Enviamos un código de 6 dígitos a <strong class="text-ink break-words">{{ auth.maskedEmail() }}</strong>.
        </p>
        <div>
          <label for="sa-code" class="text-xs font-bold uppercase tracking-wider text-muted">Código</label>
          <input #codeInput id="sa-code" name="sa_code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*"
                 formControlName="code" (input)="onCodeInput()" class="input mt-2 text-center font-display text-3xl tracking-[.5em] !h-16" aria-describedby="sa-code-help">
          <p id="sa-code-help" class="mt-1.5 text-xs font-medium text-muted" data-countdown>
            @if (remaining() > 0) { Caduca en {{ remainingText() }}. } @else { El código caducó: vuelve a empezar. }
          </p>
        </div>
        @if (error(); as message) {
          <p role="alert" class="rounded-ui-md bg-danger/10 px-4 py-3 text-sm font-bold text-danger anim-fade-in">{{ message }}</p>
        }
        <div class="flex flex-col-reverse sm:flex-row gap-3">
          <button type="button" data-back (click)="back()" [disabled]="pending()" class="btn btn-secondary sm:flex-1">Volver</button>
          <button type="submit" [disabled]="pending() || remaining() <= 0" class="btn btn-primary sm:flex-1" [class.btn-loading]="pending()">
            {{ pending() ? 'Verificando…' : 'Entrar' }}
          </button>
        </div>
      </form>
    }
  `,
})
export class SuperAdminLoginForm {
  protected readonly auth = inject(SuperAdminAuth);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly timer = setInterval(() => this.now.set(Date.now()), 1000);
  private readonly codeInput = viewChild<ElementRef<HTMLInputElement>>('codeInput');

  readonly authenticated = output<void>();

  protected readonly credentials = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  protected readonly codeForm = this.fb.group({ code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]] });
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly now = signal(Date.now());

  protected remaining(): number {
    return Math.max(0, Math.floor((this.auth.codeExpiresAt() - this.now()) / 1000));
  }

  protected remainingText(): string {
    const seconds = this.remaining();
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }

  constructor() {
    inject(DestroyRef).onDestroy(() => clearInterval(this.timer));
  }

  protected async submitCredentials(): Promise<void> {
    if (this.pending()) {
      return;
    }
    if (this.credentials.invalid) {
      this.credentials.markAllAsTouched();
      this.error.set('Escribe tu correo y tu contraseña.');
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    try {
      const { email, password } = this.credentials.getRawValue();
      await this.auth.login(email, password);
      this.credentials.controls.password.reset('');
      this.codeForm.reset({ code: '' });
      queueMicrotask(() => setTimeout(() => this.codeInput()?.nativeElement.focus()));
    } catch (error) {
      this.error.set(this.describe(toProblem(error), 'credentials'));
    } finally {
      this.pending.set(false);
    }
  }

  protected onCodeInput(): void {
    const control = this.codeForm.controls.code;
    const digits = control.value.replace(/\D/g, '').slice(0, 6);
    if (digits !== control.value) {
      control.setValue(digits);
    }
    if (digits.length === 6) {
      void this.submitCode();
    }
  }

  protected async submitCode(): Promise<void> {
    if (this.pending() || this.codeForm.invalid) {
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    try {
      await this.auth.verify(this.codeForm.controls.code.value);
      this.authenticated.emit();
    } catch (error) {
      const problem = toProblem(error);
      this.error.set(this.describe(problem, 'code'));
      if (problem.status === 401) {
        this.codeForm.reset({ code: '' });
      }
    } finally {
      this.pending.set(false);
    }
  }

  protected back(): void {
    this.error.set(null);
    this.auth.backToCredentials();
  }

  private describe(problem: ReturnType<typeof toProblem>, step: 'credentials' | 'code'): string {
    if (problem.status === 429) {
      return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
    }
    if (problem.code === 'mail_unavailable') {
      return 'No pudimos enviar el código. Inténtalo de nuevo en unos minutos.';
    }
    if (problem.status === 404) {
      return 'No disponible.';
    }
    if (isConnectionProblem(problem)) {
      return 'No pudimos conectar con el servidor. Inténtalo de nuevo.';
    }
    return step === 'code' ? 'Código incorrecto o caducado.' : 'Credenciales inválidas.';
  }
}
