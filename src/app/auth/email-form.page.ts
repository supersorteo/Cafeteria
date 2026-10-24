import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { isConnectionProblem, toProblem } from '../core/api-error';
import { AuthService } from '../core/auth.service';
import { AuthCard } from './auth-card';

type Mode = 'forgot' | 'resend';

const COPY: Record<Mode, { title: string; subtitle: string; endpoint: string; done: string }> = {
  forgot: {
    title: 'Recupera tu contraseña',
    subtitle: 'Escribe tu correo y te enviaremos un enlace para crear una nueva.',
    endpoint: '/api/v1/auth/forgot-password',
    done: 'Si existe una cuenta con ese correo, te enviamos un mensaje con las instrucciones. El enlace vale 1 hora.',
  },
  resend: {
    title: 'Reenviar verificación',
    subtitle: 'Escribe el correo con el que te registraste.',
    endpoint: '/api/v1/auth/resend-verification',
    done: 'Si la cuenta existe y está pendiente de confirmar, te enviamos un nuevo enlace.',
  },
};

@Component({
  imports: [ReactiveFormsModule, RouterLink, AuthCard],
  selector: 'app-email-form-page',
  template: `
    <app-auth-card [title]="copy.title" [subtitle]="done() ? '' : copy.subtitle">
      @if (done()) {
        <p role="status" class="font-medium text-muted">{{ copy.done }}</p>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-5" novalidate>
          <div>
            <label for="email-form-email" class="text-xs font-bold uppercase tracking-wider text-muted">Correo</label>
            <input id="email-form-email" type="email" autocomplete="username" formControlName="email"
                   class="input mt-2">
            @if (form.controls.email.touched && form.controls.email.invalid) {
              <p class="mt-1.5 text-xs font-bold text-danger anim-fade-in">Escribe un correo válido.</p>
            }
          </div>
          @if (error(); as message) {
            <p role="alert" class="rounded-ui-md bg-danger/10 px-4 py-3 text-sm font-bold text-danger anim-fade-in">{{ message }}</p>
          }
          <button type="submit" [disabled]="pending()"
                  class="btn btn-primary btn-lg w-full" [class.btn-loading]="pending()">
            {{ pending() ? 'Enviando…' : 'Enviar' }}
          </button>
        </form>
      }
      <div footer>
        <a routerLink="/auth/login" >Volver a iniciar sesión</a>
      </div>
    </app-auth-card>
  `,
})
export class EmailFormPage {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  protected readonly copy = COPY[(inject(ActivatedRoute).snapshot.data['mode'] as Mode | undefined) ?? 'forgot'];
  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
  });
  protected readonly pending = signal(false);
  protected readonly done = signal(false);
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
      await this.auth.ensureCsrf();
      await firstValueFrom(this.http.post(this.copy.endpoint, { email: this.form.getRawValue().email.trim() }));
      this.done.set(true);
    } catch (error) {
      const problem = toProblem(error);
      if (problem.status === 429) {
        this.error.set('Demasiados intentos. Espera unos minutos e inténtalo de nuevo.');
      } else if (isConnectionProblem(problem)) {
        this.error.set('No pudimos conectar con el servidor. Inténtalo de nuevo.');
      } else {
        this.error.set('No se pudo enviar la solicitud.');
      }
    } finally {
      this.pending.set(false);
    }
  }
}
