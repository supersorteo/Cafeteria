import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { toProblem } from '../core/api-error';
import { PlanOption, RegionOption, formatUsd } from '../core/billing.api';
import { NoticeService } from '../core/notice.service';
import { SuperAdminApi } from '../core/superadmin.api';

@Component({
  imports: [FormsModule],
  selector: 'app-superadmin-prices',
  host: { class: 'block' },
  template: `
    <section aria-label="Planes y precios" class="space-y-4" data-prices>
      <p class="text-sm font-medium text-muted">Los cambios de precio valen para los pedidos nuevos; los pedidos ya creados conservan el precio con el que se hicieron.</p>
      @if (failed()) {
        <div class="card p-5 text-center" role="alert">
          <p class="font-bold text-danger">No pudimos cargar los precios.</p>
          <button type="button" class="btn btn-secondary btn-sm mt-3" data-prices-retry (click)="load()">Reintentar</button>
        </div>
      }
      @for (plan of plans(); track plan.code + plan.months) {
        <article class="card p-4 sm:p-5" [attr.data-price-plan]="plan.code">
          <div class="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 class="font-display text-xl font-black">{{ plan.name }}</h2>
              <p class="text-sm font-medium text-muted">{{ plan.months }} {{ plan.months === 1 ? 'mes' : 'meses' }} · hasta {{ plan.maxMenuItems }} platos · {{ plan.maxActiveCoupons }} cupones activos · {{ plan.maxGallery }} fotos</p>
              <p class="mt-1 text-sm font-bold" data-price-current>Precio actual: {{ usd(plan.usdCents) }}</p>
            </div>
            <form class="flex items-end gap-2" (submit)="save(plan, $event)">
              <label class="block"><span class="text-xs font-bold uppercase tracking-wider text-muted">Nuevo precio (US$)</span>
                <input class="input mt-1 w-32" type="number" min="1" max="1000" step="0.5" inputmode="decimal" [attr.data-price-input]="plan.code"
                       [ngModel]="draft(plan)" (ngModelChange)="setDraft(plan, $event)" [name]="key(plan)"></label>
              <button type="submit" class="btn btn-primary btn-sm" data-price-save [disabled]="busy()">Guardar</button>
            </form>
          </div>
        </article>
      }
      @if (error()) { <p role="alert" class="text-sm font-bold text-danger" data-prices-error>{{ error() }}</p> }

      <h2 class="pt-2 font-display text-lg font-black">Países y WhatsApp</h2>
      <ul class="space-y-2">
        @for (region of regions(); track region.code) {
          <li class="card flex items-center justify-between gap-3 p-3 text-sm font-bold" [attr.data-region]="region.code">
            <span>{{ region.name }}</span>
            <span class="font-medium text-muted">{{ region.whatsapp ? 'WhatsApp configurado' : 'Sin WhatsApp (variable de entorno pendiente)' }}</span>
          </li>
        }
      </ul>
      <p class="text-xs font-medium text-muted">Los números de WhatsApp se definen en el servidor (variables BILLING_WHATSAPP_AR y BILLING_WHATSAPP_UY), no desde aquí.</p>
    </section>
  `,
})
export class SuperAdminPrices implements OnInit {
  private readonly api = inject(SuperAdminApi);
  private readonly notices = inject(NoticeService);

  protected readonly plans = signal<PlanOption[]>([]);
  protected readonly regions = signal<RegionOption[]>([]);
  protected readonly drafts = signal<Record<string, number | string | null>>({});
  protected readonly failed = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly usd = formatUsd;

  ngOnInit(): void {
    void this.load();
  }

  protected key(plan: PlanOption): string {
    return `${plan.code}-${plan.months}`;
  }

  protected draft(plan: PlanOption): number | string | null {
    return this.drafts()[this.key(plan)] ?? plan.usdCents / 100;
  }

  protected setDraft(plan: PlanOption, value: number | string | null): void {
    this.drafts.update(current => ({ ...current, [this.key(plan)]: value }));
  }

  protected async load(): Promise<void> {
    this.failed.set(false);
    try {
      const data = await firstValueFrom(this.api.billingOptions());
      this.plans.set(data.plans);
      this.regions.set(data.regions);
      this.drafts.set({});
    } catch {
      this.failed.set(true);
    }
  }

  protected async save(plan: PlanOption, event: Event): Promise<void> {
    event.preventDefault();
    const dollars = Number(this.draft(plan));
    if (!Number.isFinite(dollars) || dollars < 1 || dollars > 1000) {
      this.error.set('El precio debe estar entre US$ 1 y US$ 1000.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.api.setPrice(plan.code, plan.months, Math.round(dollars * 100)));
      this.notices.show('info', `Precio de ${plan.name} actualizado.`);
      await this.load();
    } catch (error) {
      const problem = toProblem(error);
      this.error.set(problem.code === 'forbidden' ? 'Solo el dueño puede cambiar los precios.' : 'No se pudo guardar el precio.');
    } finally {
      this.busy.set(false);
    }
  }
}
