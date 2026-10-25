import { Component, InjectionToken, inject, isDevMode, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { isConnectionProblem, toProblem } from '../core/api-error';
import { safeReturnUrl } from '../core/auth.guards';
import { AuthService } from '../core/auth.service';
import { NoticeService } from '../core/notice.service';
import { AuthCard } from './auth-card';
import { PasswordToggle } from '../shared/ui/password-toggle';

const REMEMBERED_EMAIL_KEY = 'terraza-login-email';
const DEV_PASSWORD_KEY = 'terraza-login-dev-password';

export const REMEMBER_PASSWORD_IN_DEV = new InjectionToken<boolean>('remember-password-in-dev', {
  factory: () => isDevMode() && typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname),
});

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string | null): void {
  try {
    if (value) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // sin almacenamiento no se recuerda nada
  }
}

@Component({
  imports: [ReactiveFormsModule, RouterLink, AuthCard, PasswordToggle],
  selector: 'app-login-page',
  template: `
    <app-auth-card title="Inicia sesión" subtitle="Administra tu carta, tus fotos y tu sitio.">
      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-5" novalidate>
        <div>
          <label for="login-email" class="text-xs font-bold uppercase tracking-wider text-muted">Correo</label>
          <input id="login-email" name="email" type="email" autocomplete="username" formControlName="email"
                 class="input mt-2">
          @if (form.controls.email.touched && form.controls.email.invalid) {
            <p class="mt-1.5 text-xs font-bold text-danger anim-fade-in">Escribe un correo válido.</p>
          }
        </div>
        <div>
          <label for="login-password" class="text-xs font-bold uppercase tracking-wider text-muted">Contraseña</label>
          <app-password-toggle><input id="login-password" name="password" type="password" autocomplete="current-password" formControlName="password"
                 class="input mt-2 has-toggle"></app-password-toggle>
          @if (form.controls.password.touched && form.controls.password.invalid) {
            <p class="mt-1.5 text-xs font-bold text-danger anim-fade-in">Escribe tu contraseña.</p>
          }
        </div>
        <label class="inline-flex items-center gap-2 text-sm font-medium text-muted">
          <input type="checkbox" formControlName="remember" data-remember>
          Recordar mis datos en este dispositivo
        </label>
        @if (error(); as message) {
          <p role="alert" class="rounded-ui-md bg-danger/10 px-4 py-3 text-sm font-bold text-danger anim-fade-in">{{ message }}</p>
        }
        <button type="submit" [disabled]="pending()"
                class="btn btn-primary btn-lg w-full" [class.btn-loading]="pending()">
          {{ pending() ? 'Entrando…' : 'Entrar' }}
        </button>
      </form>
      <div footer class="space-x-2">
        <a routerLink="/auth/forgot-password" >¿Olvidaste tu contraseña?</a>
        <span aria-hidden="true">·</span>
        <a routerLink="/auth/register" >Crear cuenta</a>
        <span aria-hidden="true">·</span>
        <a routerLink="/auth/resend-verification" >Reenviar verificación</a>
      </div>
    </app-auth-card>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly notices = inject(NoticeService);
  private readonly devPassword = inject(REMEMBER_PASSWORD_IN_DEV);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    remember: [true],
  });
  protected readonly pending = signal(false);

  constructor() {
    const savedEmail = readStored(REMEMBERED_EMAIL_KEY);
    if (savedEmail) {
      this.form.controls.email.setValue(savedEmail);
    }
    const savedPassword = this.devPassword ? readStored(DEV_PASSWORD_KEY) : null;
    if (savedPassword) {
      this.form.controls.password.setValue(savedPassword);
    }
    if (this.route.snapshot.queryParamMap.get('verified') === '1') {
      this.notices.show('info', 'Correo confirmado. Ya puedes iniciar sesión.');
      void this.router.navigate([], { queryParams: { verified: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
  }

  protected readonly error = signal<string | null>(null);

  protected async submit(): Promise<void> {
    if (this.pending()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.login(email, password);
      const remember = this.form.controls.remember.value;
      writeStored(REMEMBERED_EMAIL_KEY, remember ? email.trim() : null);
      writeStored(DEV_PASSWORD_KEY, remember && this.devPassword ? password : null);
      await this.router.navigateByUrl(safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')));
    } catch (error) {
      const problem = toProblem(error);
      if (problem.status === 401) {
        this.error.set('Correo o contraseña incorrectos, o la cuenta está suspendida o sin verificar.');
      } else if (problem.status === 429) {
        this.error.set('Demasiados intentos. Espera unos minutos e inténtalo de nuevo.');
      } else if (isConnectionProblem(problem)) {
        this.error.set('No pudimos conectar con el servidor. Inténtalo de nuevo.');
      } else {
        this.error.set('No se pudo iniciar sesión.');
      }
    } finally {
      this.pending.set(false);
    }
  }
}
