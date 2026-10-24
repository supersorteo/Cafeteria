import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { isConnectionProblem, toProblem } from '../core/api-error';
import { AuthService } from '../core/auth.service';
import { AuthCard } from './auth-card';
import { PasswordToggle } from '../shared/ui/password-toggle';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('newPassword')?.value;
  const confirm = group.get('confirm')?.value;
  return password === confirm ? null : { mismatch: true };
}

@Component({
  imports: [ReactiveFormsModule, RouterLink, AuthCard, PasswordToggle],
  selector: 'app-reset-password-page',
  template: `
    @switch (state()) {
      @case ('done') {
        <app-auth-card title="Contraseña actualizada" subtitle="Cerramos tus sesiones abiertas por seguridad.">
          <a routerLink="/auth/login" class="btn btn-primary btn-lg">
            Iniciar sesión
          </a>
        </app-auth-card>
      }
      @case ('invalid') {
        <app-auth-card title="Enlace no válido" subtitle="El enlace no es válido, ya se usó o caducó.">
          <a routerLink="/auth/forgot-password" class="btn btn-secondary">Pedir un enlace nuevo</a>
        </app-auth-card>
      }
      @default {
        <app-auth-card title="Crea una contraseña nueva" subtitle="Elige una contraseña de al menos 10 caracteres.">
          <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-5" novalidate>
            <div>
              <label for="reset-password" class="text-xs font-bold uppercase tracking-wider text-muted">Contraseña nueva</label>
              <app-password-toggle><input id="reset-password" type="password" autocomplete="new-password" formControlName="newPassword"
                     class="input mt-2 has-toggle"></app-password-toggle>
              @if (form.controls.newPassword.touched && form.controls.newPassword.invalid) {
                <p class="mt-1.5 text-xs font-bold text-danger anim-fade-in">Debe tener entre 10 y 72 caracteres.</p>
              }
            </div>
            <div>
              <label for="reset-confirm" class="text-xs font-bold uppercase tracking-wider text-muted">Repite la contraseña</label>
              <app-password-toggle><input id="reset-confirm" type="password" autocomplete="new-password" formControlName="confirm"
                     class="input mt-2 has-toggle"></app-password-toggle>
              @if (form.controls.confirm.touched && form.errors?.['mismatch']) {
                <p class="mt-1.5 text-xs font-bold text-danger anim-fade-in">Las contraseñas no coinciden.</p>
              }
            </div>
            @if (error(); as message) {
              <p role="alert" class="rounded-ui-md bg-danger/10 px-4 py-3 text-sm font-bold text-danger anim-fade-in">{{ message }}</p>
            }
            <button type="submit" [disabled]="pending()"
                    class="btn btn-primary btn-lg w-full" [class.btn-loading]="pending()">
              {{ pending() ? 'Guardando…' : 'Guardar contraseña' }}
            </button>
          </form>
        </app-auth-card>
      }
    }
  `,
})
export class ResetPasswordPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private token: string | null = null;

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(72)]],
      confirm: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );
  protected readonly state = signal<'form' | 'done' | 'invalid'>('form');
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token');
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
    if (!this.token) {
      this.state.set('invalid');
    }
  }

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
      await this.auth.ensureCsrf();
      await firstValueFrom(
        this.http.post('/api/v1/auth/reset-password', { token: this.token, newPassword: this.form.getRawValue().newPassword }),
      );
      this.token = null;
      this.state.set('done');
    } catch (error) {
      const problem = toProblem(error);
      if (problem.code === 'invalid_token') {
        this.state.set('invalid');
      } else if (problem.status === 429) {
        this.error.set('Demasiados intentos. Espera unos minutos e inténtalo de nuevo.');
      } else if (isConnectionProblem(problem)) {
        this.error.set('No pudimos conectar con el servidor. Inténtalo de nuevo.');
      } else {
        this.error.set('No se pudo cambiar la contraseña.');
      }
    } finally {
      this.pending.set(false);
    }
  }
}
