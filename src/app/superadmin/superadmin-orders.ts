import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { isConnectionProblem, toProblem } from '../core/api-error';
import { OrderStatus, formatUsd } from '../core/billing.api';
import { NoticeService } from '../core/notice.service';
import { SuperAdminAuth } from '../core/superadmin-auth.service';
import { AdminOrder, AdminOrderPage, SuperAdminApi } from '../core/superadmin.api';
import { ConfirmDialog } from '../shared/confirm-dialog';
import { EmptyState } from '../shared/ui/empty-state';

type Action = { kind: 'confirm' | 'cancel'; order: AdminOrder };

export const ORDERS_POLL_MS = 10000;

const STATUS_LABELS: Record<OrderStatus, string> = { PENDING: 'Pendiente', PAID: 'Pagado', CANCELLED: 'Cancelado', EXPIRED: 'Vencido', FAILED: 'Con problema' };

@Component({
  imports: [DatePipe, ConfirmDialog, EmptyState],
  selector: 'app-superadmin-orders',
  host: { class: 'block' },
  template: `
    <section aria-label="Pedidos" class="space-y-4" data-orders>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap gap-2" role="group" aria-label="Filtrar pedidos por estado">
          @for (option of filters; track option.id) {
            <button type="button" class="btn btn-sm" [class.btn-primary]="status() === option.id" [class.btn-secondary]="status() !== option.id"
                    [attr.data-order-filter]="option.id" [attr.aria-pressed]="status() === option.id" (click)="setStatus(option.id)">{{ option.label }}</button>
          }
        </div>
        <button type="button" class="btn btn-secondary btn-sm" data-orders-refresh [disabled]="loading()" (click)="load(undefined, true)">Actualizar ahora</button>
      </div>

      @if (error()) {
        <div class="card p-5 text-center" role="alert">
          <p class="font-bold text-danger">{{ error() }}</p>
          <button type="button" class="btn btn-secondary btn-sm mt-3" data-orders-retry (click)="load()">Reintentar</button>
        </div>
      } @else if (loading() && !page()) {
        <div class="skeleton h-40" aria-hidden="true"></div>
      } @else if (page(); as data) {
        @if (data.content.length === 0) {
          <app-empty-state title="No hay pedidos" message="Cuando alguien contrate un plan, su pedido aparecerá aquí." />
        } @else {
          <ul class="space-y-3">
            @for (order of data.content; track order.id) {
              <li class="card p-4" data-order [attr.data-reference]="order.reference" [attr.data-status]="order.status">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="font-display text-lg font-black tracking-wider">{{ order.reference }}</p>
                    <p class="text-sm font-bold">{{ order.planName }} · {{ usd(order.usdCents) }} · {{ order.months }} {{ order.months === 1 ? 'mes' : 'meses' }} · {{ order.region }}</p>
                    <p class="mt-1 truncate text-sm font-medium text-muted">{{ order.buyerName || 'Sin nombre' }} · {{ order.buyerEmail }}</p>
                    <p class="mt-1 text-xs font-medium text-muted">Creado {{ order.createdAt | date: 'dd/MM/yyyy HH:mm' }}@if (order.confirmedAt) { · Confirmado {{ order.confirmedAt | date: 'dd/MM/yyyy HH:mm' }} por {{ order.confirmedBy }} }</p>
                    @if (order.activationCode) {
                      <p class="mt-2 text-sm font-bold" data-order-code>Código enviado: <span class="tracking-wider">{{ order.activationCode }}</span></p>
                    }
                  </div>
                  <div class="flex flex-col items-end gap-2">
                    <span class="badge" [class.badge-warning]="order.status === 'PENDING'" [class.badge-success]="order.status === 'PAID'">{{ label(order.status) }}</span>
                    @if (auth.isAdmin() && (order.status === 'PENDING' || order.status === 'EXPIRED')) {
                      <div class="flex gap-2">
                        <button type="button" class="btn btn-primary btn-sm" data-order-confirm (click)="action.set({ kind: 'confirm', order })">Confirmar pago</button>
                        <button type="button" class="btn btn-secondary btn-sm" data-order-cancel (click)="action.set({ kind: 'cancel', order })">Cancelar</button>
                      </div>
                    }
                  </div>
                </div>
              </li>
            }
          </ul>
          @if (data.totalPages > 1) {
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm font-medium text-muted">{{ data.totalElements }} pedidos · página {{ data.page + 1 }} de {{ data.totalPages }}</p>
              <div class="flex gap-2">
                <button type="button" class="btn btn-secondary btn-sm" data-orders-prev [disabled]="data.page === 0" (click)="load(data.page - 1)">Anterior</button>
                <button type="button" class="btn btn-secondary btn-sm" data-orders-next [disabled]="data.page + 1 >= data.totalPages" (click)="load(data.page + 1)">Siguiente</button>
              </div>
            </div>
          }
        }
      }
      @if (actionError()) { <p role="alert" class="text-sm font-bold text-danger" data-orders-error>{{ actionError() }}</p> }
    </section>

    @if (action(); as current) {
      <app-confirm-dialog
        [title]="current.kind === 'confirm' ? 'Confirmar el pago' : 'Cancelar el pedido'"
        [message]="current.kind === 'confirm'
          ? '¿Recibiste ' + usd(current.order.usdCents) + ' de ' + current.order.buyerEmail + '? Se generará un código del plan ' + current.order.planName + ' y se le enviará por correo.'
          : '¿Cancelar el pedido ' + current.order.reference + '? No se enviará ningún código.'"
        [confirmLabel]="current.kind === 'confirm' ? 'Confirmar pago' : 'Cancelar pedido'"
        [tone]="current.kind === 'confirm' ? 'primary' : 'danger'"
        busyLabel="Procesando…" [busy]="busy()" (confirmed)="run(current)" (cancelled)="action.set(null)" />
    }
  `,
})
export class SuperAdminOrders implements OnInit, OnDestroy {
  protected readonly auth = inject(SuperAdminAuth);
  private readonly api = inject(SuperAdminApi);
  private readonly notices = inject(NoticeService);
  private poll?: ReturnType<typeof setInterval>;

  protected readonly filters: { id: OrderStatus | 'all'; label: string }[] = [
    { id: 'PENDING', label: 'Pendientes' },
    { id: 'PAID', label: 'Pagados' },
    { id: 'all', label: 'Todos' },
  ];
  protected readonly page = signal<AdminOrderPage | null>(null);
  protected readonly status = signal<OrderStatus | 'all'>('PENDING');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly action = signal<Action | null>(null);
  protected readonly busy = signal(false);
  protected readonly actionError = signal<string | null>(null);
  protected readonly usd = formatUsd;

  ngOnInit(): void {
    void this.load();
    this.poll = setInterval(() => {
      if (document.visibilityState === 'visible' && !this.action() && !this.loading()) {
        void this.load(undefined, true);
      }
    }, ORDERS_POLL_MS);
  }

  ngOnDestroy(): void {
    clearInterval(this.poll);
  }

  protected label(status: OrderStatus): string {
    return STATUS_LABELS[status];
  }

  protected setStatus(status: OrderStatus | 'all'): void {
    this.status.set(status);
    void this.load(0);
  }

  protected async load(index = this.page()?.page ?? 0, silent = false): Promise<void> {
    if (!silent) {
      this.loading.set(true);
    }
    this.error.set(null);
    try {
      this.page.set(await firstValueFrom(this.api.orders(this.status(), '', index)));
    } catch (error) {
      if (silent && this.page()) {
        return;
      }
      this.error.set(isConnectionProblem(toProblem(error)) ? 'Problema de conexión al cargar los pedidos.' : 'No pudimos cargar los pedidos.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async run(current: Action): Promise<void> {
    this.busy.set(true);
    this.actionError.set(null);
    try {
      if (current.kind === 'confirm') {
        await firstValueFrom(this.api.confirmOrder(current.order.id));
        this.notices.show('info', `Pago confirmado. Se envió el código a ${current.order.buyerEmail}.`);
      } else {
        await firstValueFrom(this.api.cancelOrder(current.order.id));
        this.notices.show('info', 'Pedido cancelado.');
      }
      this.action.set(null);
      await this.load(undefined, true);
    } catch (error) {
      const problem = toProblem(error);
      this.action.set(null);
      this.actionError.set(problem.code === 'order_state_conflict' ? 'El pedido cambió de estado; lo actualizamos.' : 'No se pudo completar la acción. Inténtalo de nuevo.');
      void this.load(undefined, true);
    } finally {
      this.busy.set(false);
    }
  }
}
