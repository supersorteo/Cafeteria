import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { isConnectionProblem, toProblem } from '../core/api-error';
import { AuthService } from '../core/auth.service';
import { NoticeService } from '../core/notice.service';
import { PLAN_WARNING_DAYS, PlanService, daysLeft, formatActivationCode } from '../core/plan.service';
import { Modal } from '../shared/ui/modal';

@Component({
  imports: [DatePipe, FormsModule, Modal, RouterLink],
  selector: 'app-plan-banner',
  host: { class: 'block' },
  template: `
    @if (auth.user(); as user) {
      @if (auth.planExpired()) {
        <div class="plan-banner plan-banner-expired" role="alert" data-plan-expired>
          <div class="min-w-0">
            <p class="font-bold">Tu plan venció el {{ user.plan.expiresAt | date: 'dd/MM/yyyy' }} y tu sitio está en pausa</p>
            <p class="text-sm font-medium opacity-90">Quien escanea tu QR ve un aviso en lugar de tu carta, y no puedes hacer cambios. Tus datos están guardados: al renovar, todo vuelve al instante.</p>
          </div>
          @if (auth.isOwner()) {
            <a routerLink="/admin/plan" class="btn btn-primary btn-sm shrink-0" data-renew>Renovar ahora</a>
          } @else {
            <p class="text-sm font-bold shrink-0">Pide al propietario que renueve el plan.</p>
          }
        </div>
      } @else if (auth.planGrace()) {
        <div class="plan-banner plan-banner-expired" role="alert" data-plan-grace>
          <div class="min-w-0">
            <p class="font-bold">Tu plan venció el {{ user.plan.expiresAt | date: 'dd/MM/yyyy' }}</p>
            <p class="text-sm font-medium opacity-90">Todo sigue funcionando hasta el {{ user.plan.graceEndsAt | date: 'dd/MM/yyyy' }}. Ese día tu sitio se pausa y tus clientes dejan de ver tu carta.</p>
          </div>
          @if (auth.isOwner()) {
            <a routerLink="/admin/plan" class="btn btn-primary btn-sm shrink-0" data-renew>Renovar ahora</a>
          } @else {
            <p class="text-sm font-bold shrink-0">Pide al propietario que renueve el plan.</p>
          }
        </div>
      } @else if (soon() !== null) {
        <div class="plan-banner plan-banner-soon" data-plan-soon>
          <p class="min-w-0 text-sm font-bold">Tu plan vence en {{ soon() }} {{ soon() === 1 ? 'día' : 'días' }} ({{ user.plan.expiresAt | date: 'dd/MM/yyyy' }}). Si renuevas ahora, el tiempo se suma y no pierdes ningún día.</p>
          @if (auth.isOwner()) {
            <a routerLink="/admin/plan" class="btn btn-secondary btn-sm shrink-0" data-renew>Renovar</a>
          }
        </div>
      }
      @if (nearLimit(); as warning) {
        <div class="plan-banner plan-banner-soon mt-3" data-plan-near-limit>
          <p class="min-w-0 text-sm font-bold">{{ warning }}</p>
        </div>
      }
    }

    @if (plan.renewalOpen()) {
      <app-modal heading="Renovar tu plan" size="sm" [dismissable]="!busy()" (closed)="close()">
        <p class="font-medium text-muted">Escribe el código de activación que adquiriste. El tiempo se suma a tu plan y todo vuelve a funcionar.</p>
        <label for="renew-code" class="mt-4 block text-xs font-bold uppercase tracking-wider text-muted">Código de activación</label>
        <input id="renew-code" class="input mt-2 font-bold tracking-wider" autocomplete="off" autocapitalize="characters" spellcheck="false"
               placeholder="DLR-XXXX-XXXX" data-renew-code [ngModel]="code()" (ngModelChange)="onCode($event)" (keyup.enter)="submit()">
        @if (error()) { <p role="alert" class="mt-2 text-sm font-bold text-danger">{{ error() }}</p> }
        <div modal-footer class="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button type="button" class="btn btn-secondary" data-cancel [disabled]="busy()" (click)="close()">Cancelar</button>
          <button type="button" class="btn btn-primary" data-confirm [disabled]="busy() || code().length < 13" (click)="submit()">{{ busy() ? 'Comprobando…' : 'Renovar' }}</button>
        </div>
      </app-modal>
    }
  `,
})
export class PlanBanner {
  protected readonly auth = inject(AuthService);
  protected readonly plan = inject(PlanService);
  private readonly notices = inject(NoticeService);

  protected readonly code = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected soon(): number | null {
    const days = daysLeft(this.auth.user()?.plan?.expiresAt ?? null);
    return days !== null && days > 0 && days <= PLAN_WARNING_DAYS ? days : null;
  }

  protected nearLimit(): string | null {
    const limits = this.auth.limits();
    const usage = this.auth.usage();
    if (!limits || !usage || this.auth.planExpired()) {
      return null;
    }
    const checks = [
      { used: usage.menuItems, max: limits.maxMenuItems, label: 'platos' },
      { used: usage.activeCoupons, max: limits.maxActiveCoupons, label: 'cupones activos' },
    ];
    const hit = checks.find(check => check.max > 0 && check.used >= Math.ceil(check.max * 0.8));
    return hit ? `Usas ${hit.used} de ${hit.max} ${hit.label} de tu plan ${limits.name}.` : null;
  }

  protected onCode(value: string): void {
    this.code.set(formatActivationCode(value));
  }

  protected close(): void {
    if (!this.busy()) {
      this.plan.closeRenewal();
      this.code.set('');
      this.error.set(null);
    }
  }

  protected async submit(): Promise<void> {
    if (this.busy() || this.code().length < 13) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.plan.redeem(this.code());
      this.busy.set(false);
      this.close();
      this.notices.show('info', 'Plan renovado. Ya puedes volver a hacer cambios.');
    } catch (error) {
      const problem = toProblem(error);
      this.error.set(
        problem.code === 'invalid_code'
          ? 'El código no es válido o ya fue usado.'
          : problem.status === 429
            ? 'Demasiados intentos. Espera un rato e inténtalo de nuevo.'
            : isConnectionProblem(problem)
              ? 'No pudimos conectar con el servidor. Inténtalo de nuevo.'
              : 'No se pudo renovar el plan.',
      );
    } finally {
      this.busy.set(false);
    }
  }
}
