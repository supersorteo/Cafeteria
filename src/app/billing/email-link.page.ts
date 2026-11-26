import { Component, InjectionToken, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BillingShell } from './billing-shell';
import { loadDraft, saveEmailCode } from './checkout-draft';
import { CHECKOUT_CHANNEL } from './sdk-loader';

export const EMAIL_LINK_WAIT_MS = new InjectionToken<number>('email-link-wait-ms', { factory: () => 1500 });

type View = 'checking' | 'handed' | 'code' | 'invalid';

@Component({
  imports: [BillingShell, RouterLink],
  selector: 'app-email-link-page',
  template: `
    <app-billing-shell>
      <section class="card max-w-xl p-6 md:p-8" [attr.data-view]="view()">
        @switch (view()) {
          @case ('checking') {
            <h1 class="font-display text-2xl font-black">Verificando tu correo…</h1>
            <div class="skeleton mt-5 h-3 w-2/3" aria-hidden="true"></div>
          }
          @case ('handed') {
            <p class="text-4xl" aria-hidden="true">✅</p>
            <h1 class="mt-2 font-display text-2xl font-black" data-handed>¡Correo verificado!</h1>
            <p class="mt-2 font-medium text-muted">Vuelve a la pestaña de Deliora donde estabas comprando: ya puedes pagar. Esta pestaña puedes cerrarla.</p>
          }
          @case ('code') {
            <h1 class="font-display text-2xl font-black" data-code-view>Tu código de verificación</h1>
            <p class="mt-2 font-medium text-muted">Escríbelo en la página de compra para continuar.</p>
            <p class="mt-4 font-display text-4xl font-black tracking-[.3em]" data-code>{{ code }}</p>
            <div class="mt-5 flex flex-wrap gap-2">
              <button type="button" class="btn btn-primary" data-copy (click)="copy()">{{ copied() ? '✓ Copiado' : 'Copiar código' }}</button>
              <a routerLink="/precios" class="btn btn-secondary">Ir a los planes</a>
            </div>
          }
          @default {
            <h1 class="font-display text-2xl font-black" data-invalid>Este enlace no es válido</h1>
            <p class="mt-2 font-medium text-muted">Pide un código nuevo desde la página de compra.</p>
            <a routerLink="/precios" class="btn btn-primary mt-5">Ver planes</a>
          }
        }
      </section>
    </app-billing-shell>
  `,
})
export class EmailLinkPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly openChannel = inject(CHECKOUT_CHANNEL);
  private readonly waitMs = inject(EMAIL_LINK_WAIT_MS);

  protected readonly view = signal<View>('checking');
  protected readonly copied = signal(false);
  protected code = '';

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const email = (params.get('email') ?? '').trim().toLowerCase();
    this.code = (params.get('code') ?? '').trim();
    if (!email.includes('@') || !/^\d{6}$/.test(this.code)) {
      this.view.set('invalid');
      return;
    }
    void this.handOff(email);
  }

  private async handOff(email: string): Promise<void> {
    const channel = this.openChannel();
    const handed = channel
      ? await new Promise<boolean>(resolve => {
        const timer = setTimeout(() => resolve(false), this.waitMs);
        channel.onmessage = event => {
          if (event.data?.type === 'email-ack' && event.data.email?.trim().toLowerCase() === email) {
            clearTimeout(timer);
            resolve(true);
          }
        };
        channel.postMessage({ type: 'email-code', email, code: this.code });
      })
      : false;
    channel?.close();
    if (handed) {
      this.view.set('handed');
      return;
    }
    saveEmailCode(email, this.code);
    const draft = loadDraft();
    if (draft && draft.email.trim().toLowerCase() === email) {
      await this.router.navigate(['/comprar'], { queryParams: { continuar: 1 }, replaceUrl: true });
      return;
    }
    this.view.set('code');
  }

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.code);
      this.copied.set(true);
    } catch {
      this.copied.set(false);
    }
  }
}
