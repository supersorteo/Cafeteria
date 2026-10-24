import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { isConnectionProblem, toProblem } from '../core/api-error';
import { safeReturnUrl } from '../core/auth.guards';
import { AuthService } from '../core/auth.service';
import { AuthCard } from './auth-card';

@Component({
  imports: [ReactiveFormsModule, RouterLink, AuthCard],
  selector: 'app-login-page',
  template: `
    <app-auth-card title="Inicia sesión" subtitle="Administra tu carta, tus fotos y tu sitio.">
      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-5" novalidate>
        <div>
          <label for="login-email" class="text-xs font-bold uppercase tracking-widest text-teal">Correo</label>
          <input id="login-email" type="email" autocomplete="username" formControlName="email"
                 class="field mt-2 w-full px-4 py-3 text-sm font-medium">
          @if (form.controls.email.touched && form.controls.email.invalid) {
            <p class="mt-1 text-xs font-bold" style="color:#E63946">Escribe un correo válido.</p>
          }
        </div>
        <div>
          <label for="login-password" class="text-xs font-bold uppercase tracking-widest text-teal">Contraseña</label>
          <input id="login-password" type="password" autocomplete="current-password" formControlName="password"
                 class="field mt-2 w-full px-4 py-3 text-sm font-medium">
          @if (form.controls.password.touched && form.controls.password.invalid) {
            <p class="mt-1 text-xs font-bold" style="color:#E63946">Escribe tu contraseña.</p>
          }
        </div>
        @if (error(); as message) {
          <p role="alert" class="text-sm font-bold" style="color:#E63946">{{ message }}</p>
        }
        <button type="submit" [disabled]="pending()"
                class="w-full bg-coral text-white font-bold py-4 rounded-xl uppercase tracking-widest text-sm hover:brightness-110 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
          {{ pending() ? 'Entrando…' : 'Entrar' }}
        </button>
      </form>
      <div footer class="space-x-2">
        <a routerLink="/auth/forgot-password" class="underline underline-offset-2 hover:text-coral">¿Olvidaste tu contraseña?</a>
        <span aria-hidden="true">·</span>
        <a routerLink="/auth/register" class="underline underline-offset-2 hover:text-coral">Crear cuenta</a>
        <span aria-hidden="true">·</span>
        <a routerLink="/auth/resend-verification" class="underline underline-offset-2 hover:text-coral">Reenviar verificación</a>
      </div>
    </app-auth-card>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  protected readonly pending = signal(false);
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
      await this.router.navigateByUrl(safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')));
    } catch (error) {
      const problem = toProblem(error);
      if (problem.status === 401) {
        this.error.set('Correo o contraseña incorrectos, o la cuenta aún no está verificada.');
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
