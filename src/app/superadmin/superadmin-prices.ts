import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { toProblem } from '../core/api-error';
import { PlanOption, RegionOption, formatArs, formatUsd } from '../core/billing.api';
import { NoticeService } from '../core/notice.service';
import { FxRate, SuperAdminApi } from '../core/superadmin.api';

export function pesosFor(usdCents: number, rate: number): number {
  return Math.max(10, Math.round((usdCents / 100) * rate / 10) * 10);
}

@Component({
  imports: [DatePipe, FormsModule],
  selector: 'app-superadmin-prices',
  host: { class: 'block' },
  template: `
    <section aria-label="Planes y precios" class="space-y-4" data-prices>
      <p class="text-sm font-medium text-muted">Los cambios valen para los pedidos nuevos; los ya creados conservan el precio y la tasa con los que se hicieron.</p>
      @if (failed()) {
        <div class="card p-5 text-center" role="alert">
          <p class="font-bold text-danger">No pudimos cargar los precios.</p>
          <button type="button" class="btn btn-secondary btn-sm mt-3" data-prices-retry (click)="load()">Reintentar</button>
        </div>
      }

      <article class="card p-4 sm:p-5" data-rate>
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 class="font-display text-xl font-black">Tasa de cambio USD → ARS</h2>
            <p class="text-sm font-medium text-muted">Se usa para cobrar en pesos con Mercado Pago: precio en dólares × tasa.</p>
            <p class="mt-1 text-sm font-bold" data-rate-current>
              @if (fx()?.rate; as rate) {
                Tasa actual: $ {{ rate }}
                @if (fx()?.updatedAt; as at) { <span class="font-medium text-muted">· {{ at | date: 'dd/MM/yyyy HH:mm' }}</span> }
              } @else {
                Sin tasa: Mercado Pago no se ofrece hasta que la cargues.
              }
            </p>
          </div>
          <form class="flex items-end gap-2" (submit)="saveRate($event)">
            <label class="block"><span class="text-xs font-bold uppercase tracking-wider text-muted">Nueva tasa ($ por US$ 1)</span>
              <input class="input mt-1 w-36" type="number" min="1" step="0.01" inputmode="decimal" data-rate-input name="rate"
                     [ngModel]="rateDraft()" (ngModelChange)="rateDraft.set($event)"></label>
            <button type="submit" class="btn btn-primary btn-sm" data-rate-save [disabled]="busy()">Guardar tasa</button>
          </form>
        </div>
        @if (fx()?.references?.length) {
          <div class="mt-3 flex flex-wrap items-center gap-2" data-rate-references>
            <span class="text-xs font-bold uppercase tracking-wider text-muted">Referencias de hoy (venta):</span>
            @for (ref of fx()!.references; track ref.code) {
              <button type="button" class="btn btn-ghost btn-sm" [attr.data-rate-reference]="ref.code" (click)="rateDraft.set(ref.sell)">{{ ref.name }} $ {{ ref.sell }}</button>
            }
          </div>
        }
      </article>

      @for (plan of plans(); track plan.code + plan.months) {
        <article class="card p-4 sm:p-5" [attr.data-price-plan]="plan.code">
          <div class="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 class="font-display text-xl font-black">{{ plan.name }}</h2>
              <p class="text-sm font-medium text-muted">{{ plan.months }} {{ plan.months === 1 ? 'mes' : 'meses' }} · hasta {{ plan.maxMenuItems }} platos · {{ plan.maxActiveCoupons }} cupones activos · {{ plan.maxGallery }} fotos</p>
              <p class="mt-1 text-sm font-bold" data-price-current>Precio actual: {{ usd(plan.usdCents) }}</p>
              <p class="text-sm font-medium text-muted" data-price-ars>
                @if (preview(plan); as pesos) { En pesos (Mercado Pago): {{ ars(pesos) }} } @else { En pesos: carga la tasa de cambio }
              </p>
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
  protected readonly fx = signal<FxRate | null>(null);
  protected readonly drafts = signal<Record<string, number | string | null>>({});
  protected readonly rateDraft = signal<number | string | null>(null);
  protected readonly failed = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly usd = formatUsd;
  protected readonly ars = formatArs;
  private readonly previewRate = computed(() => {
    const typed = Number(this.rateDraft());
    return Number.isFinite(typed) && typed > 0 ? typed : this.fx()?.rate ?? null;
  });

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

  protected preview(plan: PlanOption): number | null {
    const rate = this.previewRate();
    const dollars = Number(this.draft(plan));
    if (!rate || !Number.isFinite(dollars) || dollars <= 0) {
      return null;
    }
    return pesosFor(Math.round(dollars * 100), rate);
  }

  protected async load(): Promise<void> {
    this.failed.set(false);
    try {
      const [options, fx] = await Promise.all([firstValueFrom(this.api.billingOptions()), firstValueFrom(this.api.rate())]);
      this.plans.set(options.plans);
      this.regions.set(options.regions);
      this.fx.set(fx);
      this.drafts.set({});
      this.rateDraft.set(fx.rate);
    } catch {
      this.failed.set(true);
    }
  }

  protected async saveRate(event: Event): Promise<void> {
    event.preventDefault();
    const rate = Number(this.rateDraft());
    if (!Number.isFinite(rate) || rate < 1 || rate > 1_000_000) {
      this.error.set('La tasa debe ser un número mayor que 0.');
      return;
    }
    await this.run(() => this.api.setRate(Math.round(rate * 100) / 100), 'Tasa de cambio actualizada. Los precios en pesos ya se recalcularon.');
  }

  protected async save(plan: PlanOption, event: Event): Promise<void> {
    event.preventDefault();
    const dollars = Number(this.draft(plan));
    if (!Number.isFinite(dollars) || dollars < 1 || dollars > 1000) {
      this.error.set('El precio debe estar entre US$ 1 y US$ 1000.');
      return;
    }
    await this.run(() => this.api.setPrice(plan.code, plan.months, Math.round(dollars * 100)), `Precio de ${plan.name} actualizado.`);
  }

  private async run(call: () => import('rxjs').Observable<void>, done: string): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(call());
      this.notices.show('info', done);
      await this.load();
    } catch (error) {
      const problem = toProblem(error);
      this.error.set(problem.code === 'forbidden' ? 'Solo el dueño puede cambiar precios y tasas.' : 'No se pudo guardar el cambio.');
    } finally {
      this.busy.set(false);
    }
  }
}
