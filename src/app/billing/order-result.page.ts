import { Component, DestroyRef, InjectionToken, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { BillingApi, OrderState, forgetCheckout, recalledCheckout } from '../core/billing.api';
import { BillingShell } from './billing-shell';

export const RESULT_TIMINGS = new InjectionToken('payment-result-timings', {
  factory: () => ({ pollMs: 3000, maxPolls: 40 }),
});

type View = 'checking' | 'pending' | 'creating' | 'login' | 'failed' | 'expired' | 'missing' | 'error';

@Component({
  imports: [BillingShell, RouterLink],
  selector: 'app-order-result-page',
  template: `
    <app-billing-shell>
      <section class="card max-w-2xl p-6 md:p-8" [attr.data-view]="view()">
        @switch (view()) {
          @case ('checking') {
            <h1 class="font-display text-2xl font-black">Confirmando tu pago…</h1>
            <p class="mt-2 font-medium text-muted">Un momento, estamos verificando tu pago.</p>
            <div class="skeleton mt-5 h-3 w-2/3" aria-hidden="true"></div>
          }
          @case ('pending') {
            <h1 class="font-display text-2xl font-black" data-pending>Tu pago está pendiente</h1>
            <p class="mt-2 font-medium text-muted">Apenas se acredite, creamos tu negocio y entras automáticamente. Esta página se actualiza sola; también te avisaremos por correo.</p>
            <div class="skeleton mt-5 h-3 w-2/3" aria-hidden="true"></div>
          }
          @case ('creating') {
            <h1 class="font-display text-2xl font-black" data-creating>¡Pago recibido! Creando tu negocio…</h1>
            <p class="mt-2 font-medium text-muted">Esto toma unos segundos. No cierres esta página.</p>
            <div class="skeleton mt-5 h-3 w-2/3" aria-hidden="true"></div>
          }
          @case ('login') {
            <h1 class="font-display text-2xl font-black" data-login>¡Tu negocio está listo!</h1>
            <p class="mt-2 font-medium text-muted">Confirmamos tu pago y creamos tu cuenta. Inicia sesión con tu correo y la contraseña que elegiste.</p>
            <a routerLink="/auth/login" class="btn btn-primary btn-lg mt-5" data-go-login>Iniciar sesión</a>
          }
          @case ('failed') {
            <h1 class="font-display text-2xl font-black" data-failed>No pudimos completar el pago</h1>
            <p class="mt-2 font-medium text-muted">{{ detail() ?? 'No se hizo ningún cobro. Puedes intentarlo de nuevo con otra forma de pago.' }}</p>
            <a routerLink="/comprar" class="btn btn-primary mt-5">Volver a intentar</a>
          }
          @case ('expired') {
            <h1 class="font-display text-2xl font-black" data-expired>Este pedido venció</h1>
            <p class="mt-2 font-medium text-muted">Si ya pagaste, escríbenos y lo revisamos. Si no, puedes empezar de nuevo.</p>
            <a routerLink="/precios" class="btn btn-secondary mt-5">Ver planes</a>
          }
          @case ('missing') {
            <h1 class="font-display text-2xl font-black" data-missing>No encontramos ese pedido</h1>
            <p class="mt-2 font-medium text-muted">Revisa el enlace o vuelve a elegir tu plan.</p>
            <a routerLink="/precios" class="btn btn-primary mt-5">Ver planes</a>
          }
          @default {
            <h1 class="font-display text-2xl font-black" data-error>No pudimos consultar tu pedido</h1>
            <p class="mt-2 font-medium text-muted">Revisa tu conexión.</p>
            <button type="button" class="btn btn-secondary btn-sm mt-4" data-retry (click)="restart()">Reintentar</button>
          }
        }
      </section>
    </app-billing-shell>
  `,
})
export class OrderResultPage implements OnInit {
  private readonly api = inject(BillingApi);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly timings = inject(RESULT_TIMINGS);
  private timer?: ReturnType<typeof setTimeout>;
  private polls = 0;
  private reference = '';
  private paymentId: string | null = null;

  protected readonly view = signal<View>('checking');
  protected readonly detail = signal<string | null>(null);

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    this.reference = params.get('ref') ?? '';
    this.paymentId = params.get('payment_id') ?? params.get('collection_id');
    this.destroyRef.onDestroy(() => clearTimeout(this.timer));
    if (!this.reference) {
      this.view.set('missing');
      return;
    }
    void this.check();
  }

  protected restart(): void {
    this.polls = 0;
    this.view.set('checking');
    void this.check();
  }

  private async check(): Promise<void> {
    try {
      const state = this.paymentId
        ? await firstValueFrom(this.api.verifyMercadoPago(this.reference, this.paymentId))
        : await firstValueFrom(this.api.orderState(this.reference));
      await this.apply(state);
    } catch (error) {
      this.view.set((error as { status?: number }).status === 404 ? 'missing' : 'error');
    }
  }

  private async apply(state: OrderState): Promise<void> {
    if (state.status === 'PAID' && state.ready) {
      await this.enter();
      return;
    }
    if (state.status === 'FAILED' || state.status === 'CANCELLED') {
      this.detail.set(state.failure);
      this.view.set('failed');
      return;
    }
    if (state.status === 'EXPIRED') {
      this.view.set('expired');
      return;
    }
    this.view.set(state.status === 'PAID' ? 'creating' : 'pending');
    this.schedule();
  }

  private schedule(): void {
    if (++this.polls > this.timings.maxPolls) {
      return;
    }
    this.timer = setTimeout(() => {
      this.paymentId = this.view() === 'pending' ? this.paymentId : null;
      void this.check();
    }, this.timings.pollMs);
  }

  private async enter(): Promise<void> {
    const claim = recalledCheckout(this.reference);
    if (claim) {
      try {
        await firstValueFrom(this.api.startSession(this.reference, claim));
        await this.auth.refreshUser();
        forgetCheckout();
        await this.router.navigateByUrl('/admin');
        return;
      } catch {
        // la sesión automática es una comodidad; si falla, se pide iniciar sesión
      }
    }
    forgetCheckout();
    this.view.set('login');
  }
}
