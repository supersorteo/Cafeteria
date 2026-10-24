import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { isConnectionProblem, toProblem } from '../core/api-error';
import { AuthService } from '../core/auth.service';
import { AuthCard } from './auth-card';

type Status = 'verifying' | 'ok' | 'invalid' | 'missing' | 'error';

@Component({
  imports: [RouterLink, AuthCard],
  selector: 'app-verify-email-page',
  template: `
    <app-auth-card [title]="title()" [subtitle]="message()">
      @switch (status()) {
        @case ('verifying') {
          <div class="space-y-3" aria-hidden="true"><div class="skeleton h-4 w-3/4"></div><div class="skeleton h-4 w-1/2"></div></div>
        }
        @case ('ok') {
          <div class="success-check mb-5" aria-hidden="true"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path class="anim-draw" d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
          <a routerLink="/auth/login" class="btn btn-primary btn-lg">
            Iniciar sesión
          </a>
        }
        @case ('invalid') {
          <a routerLink="/auth/resend-verification" class="btn btn-secondary">Pedir un enlace nuevo</a>
        }
        @case ('missing') {
          <a routerLink="/auth/resend-verification" class="btn btn-secondary">Pedir un enlace nuevo</a>
        }
        @case ('error') {
          <button type="button" (click)="retry()" class="btn btn-primary btn-lg">
            Reintentar
          </button>
        }
      }
    </app-auth-card>
  `,
})
export class VerifyEmailPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private token: string | null = null;

  protected readonly status = signal<Status>('verifying');

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token');
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
    void this.verify();
  }

  protected title(): string {
    return { verifying: 'Verificando…', ok: 'Correo confirmado', invalid: 'Enlace no válido', missing: 'Falta el enlace', error: 'No pudimos verificar' }[this.status()];
  }

  protected message(): string {
    return {
      verifying: 'Estamos confirmando tu correo.',
      ok: 'Tu cuenta está activa. Ya puedes iniciar sesión.',
      invalid: 'El enlace no es válido, ya se usó o caducó.',
      missing: 'Abre el enlace completo que te enviamos por correo.',
      error: 'Hubo un problema de conexión. Inténtalo de nuevo.',
    }[this.status()];
  }

  protected retry(): void {
    void this.verify();
  }

  private async verify(): Promise<void> {
    if (!this.token) {
      this.status.set('missing');
      return;
    }
    this.status.set('verifying');
    try {
      await this.auth.ensureCsrf();
      await firstValueFrom(this.http.post('/api/v1/auth/verify-email', { token: this.token }));
      this.token = null;
      this.status.set('ok');
    } catch (error) {
      const problem = toProblem(error);
      this.status.set(isConnectionProblem(problem) ? 'error' : 'invalid');
    }
  }
}
