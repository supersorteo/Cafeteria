import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { BillingApi, PlanOption, formatUsd } from '../core/billing.api';

@Component({
  imports: [RouterLink],
  selector: 'app-plan-cards',
  template: `
    @if (failed()) {
      <div class="card p-6 text-center" role="alert">
        <p class="font-bold text-danger">No pudimos cargar los planes.</p>
        <button type="button" class="btn btn-secondary btn-sm mt-3" data-retry (click)="load()">Reintentar</button>
      </div>
    } @else if (plans() === null) {
      <div class="grid gap-5 md:grid-cols-2" aria-hidden="true"><div class="skeleton h-96"></div><div class="skeleton h-96"></div></div>
    } @else {
      <div class="grid gap-5 md:grid-cols-2 items-stretch" data-plans>
        @for (plan of plans(); track plan.code) {
          <article class="plan-card card card-hover p-6 relative" [class.plan-card-featured]="featured(plan)" [attr.data-plan]="plan.code">
            @if (featured(plan)) {
              <span class="plan-ribbon">Más elegido</span>
            }
            <h3 class="font-display text-2xl font-black">{{ plan.name }}</h3>
            <p class="mt-4 font-display text-4xl font-black text-primary" data-price>{{ usd(plan.usdCents) }} <span class="text-sm font-sans font-bold text-muted">/ mes</span></p>
            <ul class="mt-6 space-y-3 text-sm font-semibold">
              @for (feature of features(plan); track feature) {
                <li class="flex items-start gap-2"><span class="plan-check" aria-hidden="true">✓</span><span>{{ feature }}</span></li>
              }
            </ul>
            <div class="mt-7 pt-5 border-t border-line">
              <a routerLink="/comprar" [queryParams]="{ plan: plan.code }" class="btn w-full" [class.btn-primary]="featured(plan)" [class.btn-secondary]="!featured(plan)" data-choose>Elegir {{ plan.name }}</a>
            </div>
          </article>
        }
      </div>
    }
  `,
})
export class PlanCards implements OnInit {
  private readonly api = inject(BillingApi);

  protected readonly plans = signal<PlanOption[] | null>(null);
  protected readonly failed = signal(false);
  protected readonly usd = formatUsd;

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.failed.set(false);
    try {
      this.plans.set((await firstValueFrom(this.api.options())).plans);
    } catch {
      this.failed.set(true);
    }
  }

  protected featured(plan: PlanOption): boolean {
    return plan.code === 'PROFESIONAL';
  }

  protected features(plan: PlanOption): string[] {
    return [
      `Hasta ${plan.maxMenuItems} platos en tu carta`,
      plan.advancedCoupons
        ? `Hasta ${plan.maxActiveCoupons} cupones activos, con horarios, límite de usos y canjes`
        : `Hasta ${plan.maxActiveCoupons} cupones activos, con fechas de inicio y fin`,
      plan.tableQr ? `QR personalizable y QR por mesa (hasta ${plan.maxTableQr} mesas)` : 'QR personalizable',
      plan.fullBranding ? 'Marca completa: 7 colores y 8 fuentes' : 'Tu logo y 2 colores',
      `Hasta ${plan.maxGallery} fotos de galería`,
      'Sitio público, carta digital y reservas por WhatsApp',
      plan.prioritySupport ? 'Soporte prioritario por WhatsApp' : 'Soporte por correo',
    ];
  }
}
