import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { BillingApi, OrderReceipt, formatUsd, whatsappLink } from '../core/billing.api';
import { BillingShell } from './billing-shell';

export const ORDER_POLL_MS = 10000;

const TRACKER = ['Pedido creado', 'Pago por WhatsApp', 'Recibes tu código', 'Creas tu negocio'];

@Component({
  imports: [BillingShell, DatePipe, RouterLink],
  selector: 'app-order-result-page',
  template: `
    <app-billing-shell>
      @switch (state()) {
        @case ('loading') { <div class="skeleton h-64 max-w-2xl" aria-hidden="true"></div> }
        @case ('missing') {
          <div class="card max-w-2xl p-6" role="alert" data-missing>
            <h1 class="font-display text-2xl font-black">No encontramos ese pedido</h1>
            <p class="mt-2 font-medium text-muted">Revisa el número de pedido o vuelve a elegir tu plan.</p>
            <a routerLink="/precios" class="btn btn-primary mt-4">Ver planes</a>
          </div>
        }
        @case ('error') {
          <div class="card max-w-2xl p-6 text-center" role="alert">
            <p class="font-bold text-danger">No pudimos consultar tu pedido.</p>
            <button type="button" class="btn btn-secondary btn-sm mt-3" data-retry (click)="load()">Reintentar</button>
          </div>
        }
        @default {
          @if (order(); as o) {
            <ol class="mb-5 grid max-w-2xl grid-cols-4 gap-2 text-center text-xs font-bold" aria-label="Avance de tu compra" data-tracker>
              @for (label of trackerSteps; track label; let i = $index) {
                <li [attr.aria-current]="stage(o) === i + 1 ? 'step' : null">
                  <span class="mx-auto flex h-8 w-8 items-center justify-center rounded-full border text-sm font-black"
                        [class.bg-primary]="stage(o) >= i + 1" [class.text-white]="stage(o) >= i + 1" [class.border-line]="stage(o) < i + 1">{{ stage(o) > i + 1 ? '✓' : i + 1 }}</span>
                  <span class="mt-1 block" [class.text-muted]="stage(o) < i + 1">{{ label }}</span>
                </li>
              }
            </ol>
            <section class="card max-w-2xl p-6 md:p-8" [attr.data-status]="o.status">
              <p class="text-xs font-bold uppercase tracking-wider text-muted">Pedido</p>
              <p class="mt-1 font-display text-3xl font-black tracking-wider" data-reference>{{ o.reference }}</p>
              <p class="mt-1 text-sm font-medium text-muted">Plan {{ o.planName }} · {{ usd(o.usdCents) }} por {{ o.months }} {{ o.months === 1 ? 'mes' : 'meses' }}</p>

              @switch (o.status) {
                @case ('PENDING') {
                  <h1 class="mt-6 font-display text-2xl font-black">Último paso: escríbenos por WhatsApp</h1>
                  <p class="mt-2 font-medium text-muted">Guarda tu número de pedido. Escríbenos y coordinamos el pago; cuando lo confirmemos, te enviamos un código de activación por correo.</p>
                  <a [href]="link(o)" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-lg mt-5" data-whatsapp>Abrir WhatsApp con mi pedido</a>
                  <p class="mt-3 text-xs font-medium text-muted">Esta página se actualiza sola. Tu pedido vence el {{ o.expiresAt | date: 'dd/MM/yyyy' }}.</p>
                }
                @case ('PAID') {
                  <h1 class="mt-6 font-display text-2xl font-black" data-paid>¡Pago confirmado!</h1>
                  <p class="mt-2 font-medium text-muted">Te enviamos tu código de activación a <strong data-email-hint>{{ o.emailHint }}</strong>. Abre el correo y pulsa el botón «Crear mi negocio»: el código y tu correo ya vienen escritos. Revisa también la carpeta de spam.</p>
                  <a routerLink="/auth/register" class="btn btn-secondary mt-5">Ya tengo el código, quiero escribirlo</a>
                }
                @case ('EXPIRED') {
                  <h1 class="mt-6 font-display text-2xl font-black">Este pedido venció</h1>
                  <p class="mt-2 font-medium text-muted">Si ya pagaste, escríbenos con tu número de pedido y lo revisamos. Si no, puedes empezar de nuevo.</p>
                  <a routerLink="/precios" class="btn btn-secondary mt-5">Ver planes</a>
                }
                @default {
                  <h1 class="mt-6 font-display text-2xl font-black">Este pedido fue cancelado</h1>
                  <a routerLink="/precios" class="btn btn-secondary mt-5">Ver planes</a>
                }
              }
            </section>
          }
        }
      }
    </app-billing-shell>
  `,
})
export class OrderResultPage implements OnInit {
  private readonly api = inject(BillingApi);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private poll?: ReturnType<typeof setInterval>;

  protected readonly order = signal<OrderReceipt | null>(null);
  protected readonly state = signal<'loading' | 'ready' | 'missing' | 'error'>('loading');
  protected readonly usd = formatUsd;
  protected readonly link = whatsappLink;
  protected readonly trackerSteps = TRACKER;

  protected stage(order: OrderReceipt): number {
    return order.status === 'PAID' ? 3 : order.status === 'PENDING' ? 2 : 1;
  }

  ngOnInit(): void {
    void this.load();
    this.poll = setInterval(() => {
      if (this.order()?.status === 'PENDING' && document.visibilityState === 'visible') {
        void this.load(true);
      }
    }, ORDER_POLL_MS);
    this.destroyRef.onDestroy(() => clearInterval(this.poll));
  }

  protected async load(silent = false): Promise<void> {
    const reference = this.route.snapshot.queryParamMap.get('ref') ?? '';
    if (!reference) {
      this.state.set('missing');
      return;
    }
    if (!silent) {
      this.state.set('loading');
    }
    try {
      this.order.set(await firstValueFrom(this.api.order(reference)));
      this.state.set('ready');
    } catch (error) {
      if (silent) {
        return;
      }
      this.state.set((error as { status?: number }).status === 404 ? 'missing' : 'error');
    }
  }
}
