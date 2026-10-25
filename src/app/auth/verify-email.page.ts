import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, InjectionToken, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { isConnectionProblem, toProblem } from '../core/api-error';
import { AuthService } from '../core/auth.service';
import { CrossTab } from '../core/cross-tab.service';
import { AuthCard } from './auth-card';

type Status = 'verifying' | 'ok' | 'invalid' | 'missing' | 'error';

export const VERIFY_TIMINGS = new InjectionToken('verify-email-timings', {
  factory: () => ({ ackWaitMs: 700, countdownSeconds: 3, tickMs: 1000 }),
});

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
          @if (otherTabContinued()) {
            <p class="font-medium text-muted" data-other-tab>Tu otra pestaña ya continuó con el inicio de sesión. Puedes cerrar esta.</p>
            <div class="mt-5 flex flex-wrap gap-3">
              <button type="button" data-close-tab (click)="closeTab()" class="btn btn-secondary">Cerrar esta pestaña</button>
              <a routerLink="/auth/login" [queryParams]="{ verified: 1 }" class="btn btn-primary">Iniciar sesión aquí</a>
            </div>
          } @else {
            @if (countdown() !== null) {
              <p class="font-medium text-muted" data-countdown>Te llevamos al inicio de sesión en {{ countdown() }}…</p>
            }
            <a routerLink="/auth/login" [queryParams]="{ verified: 1 }" class="btn btn-primary btn-lg mt-4">
              Iniciar sesión
            </a>
          }
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
  private readonly crossTab = inject(CrossTab);
  private readonly timings = inject(VERIFY_TIMINGS);
  private token: string | null = null;
  private stopListening: (() => void) | null = null;
  private ackTimer?: ReturnType<typeof setTimeout>;
  private tick?: ReturnType<typeof setInterval>;

  protected readonly status = signal<Status>('verifying');
  protected readonly otherTabContinued = signal(false);
  protected readonly countdown = signal<number | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cleanup());
  }

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

  protected closeTab(): void {
    window.close();
  }

  private announce(): void {
    this.cleanup();
    this.stopListening = this.crossTab.listen(message => {
      if (message === 'ack') {
        clearTimeout(this.ackTimer);
        this.otherTabContinued.set(true);
        this.countdown.set(null);
      }
    });
    this.crossTab.send('email-verified');
    this.ackTimer = setTimeout(() => this.startCountdown(), this.timings.ackWaitMs);
  }

  private startCountdown(): void {
    if (this.otherTabContinued()) {
      return;
    }
    this.countdown.set(this.timings.countdownSeconds);
    this.tick = setInterval(() => {
      const next = (this.countdown() ?? 1) - 1;
      if (next <= 0) {
        clearInterval(this.tick);
        void this.router.navigate(['/auth/login'], { queryParams: { verified: 1 } });
        return;
      }
      this.countdown.set(next);
    }, this.timings.tickMs);
  }

  private cleanup(): void {
    this.stopListening?.();
    this.stopListening = null;
    clearTimeout(this.ackTimer);
    clearInterval(this.tick);
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
      this.announce();
    } catch (error) {
      const problem = toProblem(error);
      this.status.set(isConnectionProblem(problem) ? 'error' : 'invalid');
    }
  }
}
